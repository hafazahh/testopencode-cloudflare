import { Hono, Context, MiddlewareHandler } from 'hono';
import type { D1Database, SessionRow, UserRow } from './db';
import type { AppContext, AppEnv } from './context';
import {
  SESSION_COOKIE,
  SESSION_LIFE_MILLIS,
  SESSION_MAX_AGE,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS,
  LOGIN_LOCKOUT_SECONDS,
} from './context';
import { renderLogin } from './render';
import { getUserPermissions, listNonAdminUsers } from './db';

/** Fase C2: 43 route Flask → Hono + auth/RBAC.
 *  - PBKDF2-SHA256 (maks 100.000 iterasi) — workerd tidak mendukung scrypt.
 *  - Session di D1: id UUID(32), user_id (nullable; 0/NULL = anonymous),
 *    csrf_token, expires_at +7 hari.
 *  - Cookie `testopencode_sid` HttpOnly + SameSite=Lax; `Secure` hanya saat production.
 *  - Login rate limit: 5 gagal / 15 menit.
 */
function randomBytes(len: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, bytes = 32): Promise<Uint8Array<ArrayBuffer>> {
  const keyData = new TextEncoder().encode(password) as Uint8Array<ArrayBuffer>;
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations } as AlgorithmIdentifier,
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations } as AlgorithmIdentifier,
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

export function hashPassword(password: string, saltB64?: string): Promise<string> {
  const salt = saltB64 || bytesToBase64url(randomBytes(16));
  return hashPasswordWithSalt(password, salt);
}

async function hashPasswordWithSalt(password: string, saltB64: string): Promise<string> {
  const salt = base64urlToBytes(saltB64);
  const hash = await pbkdf2(password, salt, 100_000, 32);
  return `pbkdf2$100000$${saltB64}$${bytesToBase64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const hona = stored.match(/^pbkdf2\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/);
  if (hona) {
    const iterations = Number(hona[1]);
    if (iterations > 100_000) return false;
    try {
      const hash = await pbkdf2(password, base64urlToBytes(hona[2]), iterations, 32);
      return secretsEqual(hash, base64urlToBytes(hona[3]));
    } catch {
      return false;
    }
  }

  // werkzeug: `pbkdf2:sha256:ITER$<saltB64>$<hashB64>`
  const wk = stored.match(/^(?:scrypt|pbkdf2):([^:]+):(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/);
  if (wk) {
    const method = wk[1];
    const iterations = Number(wk[2]);
    if (method === 'scrypt') return false;
    if (method === 'pbkdf2') {
      try {
        const hash = await pbkdf2(password, base64urlToBytes(wk[3]), iterations, 32);
        return secretsEqual(hash, base64urlToBytes(wk[4]));
      } catch {
        return false;
      }
    }
  }
  return false;
}

function secretsEqual(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a[i] ^ b[i];
  return out === 0;
}

function bytesToBase64url(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(str: string): Uint8Array<ArrayBuffer> {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4 !== 0) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** ---------- session (D1) ---------- */
export async function createSession(db: D1Database, userId: number | null): Promise<SessionRow> {
  const id = bytesToBase64url(randomBytes(32));
  const csrf = bytesToBase64url(randomBytes(32));
  const expiresAt = Date.now() + SESSION_LIFE_MILLIS;
  await db.prepare('INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, csrf, expiresAt).run();
  return { id, user_id: userId, csrf_token: csrf, expires_at: expiresAt, created_at: new Date().toISOString() };
}

export async function getSessionUser(db: D1Database, sessionId: string): Promise<{ session: SessionRow | null; user: UserRow | null }> {
  if (!sessionId) return { session: null, user: null };
  const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first<SessionRow>();
  if (!session) return { session: null, user: null };
  if (Date.now() > session.expires_at) {
    await deleteSession(db, sessionId);
    return { session: null, user: null };
  }
  let user: UserRow | null = null;
  if (session.user_id) {
    user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<UserRow>();
  }
  return { session, user: user || null };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function getCsrfTokenForSession(db: D1Database, sessionId: string): Promise<string> {
  const s = await db.prepare('SELECT csrf_token FROM sessions WHERE id = ?').bind(sessionId).first<SessionRow>();
  if (s && s.csrf_token) return s.csrf_token;
  const csrf = bytesToBase64url(randomBytes(32));
  await db.prepare('UPDATE sessions SET csrf_token = ? WHERE id = ?').bind(csrf, sessionId).run();
  return csrf;
}

/** ---------- middleware ---------- */
export function sessionMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const cookie = readCookie(c.req.header('Cookie') ?? null, SESSION_COOKIE);
    let sessionId: string | null = cookie ? cookie.trim() : null;
    if (!sessionId) {
      c.set('session', null);
      c.set('userId', null);
      await next();
      return;
    }
    const { session, user } = await getSessionUser(c.env.DB, sessionId);
    c.set('session', session);
    c.set('userId', user?.id ?? null);
    await next();
  };
}

export function flashMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const raw = readCookie(c.req.header('Cookie') ?? null, 'testopencode_flash');
    let flashes: { category: string; message: string }[] = [];
    if (raw) {
      try {
        flashes = JSON.parse(raw);
      } catch {
        flashes = [];
      }
      c.header('Set-Cookie', `testopencode_flash=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    }
    c.set('flash', flashes);
    await next();
  };
}

export function flash(c: AppContext, category: string, message: string): void {
  const current = c.get('flash') as { category: string; message: string }[];
  const flashes = [...(current || []), { category, message }];
  c.header('Set-Cookie', `testopencode_flash=${encodeURIComponent(JSON.stringify(flashes))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
}

export function loginRequired(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('userId')) {
      flash(c, 'error', 'Silakan login terlebih dahulu!');
      return c.redirect('/login');
    }
    await next();
  };
}

export function hasPermission(menu: string, action: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = c.get('userId');
    if (!userId) {
      flash(c, 'error', 'Silakan login terlebih dahulu!');
      return c.redirect('/login');
    }
    const perms = await getUserPermissions(c.env.DB, userId);
    const menuPerms = perms[menu] || [];
    if (!menuPerms.includes(action)) {
      flash(c, 'error', 'Akses ditolak! Anda tidak memiliki izin.');
      return c.redirect('/');
    }
    await next();
  };
}

export function csrfProtect(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method !== 'POST') {
      await next();
      return;
    }
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string };
    const submitted = form.get('csrf_token') || c.req.header('X-CSRF-Token');
    const session = c.get('session');
    if (!submitted || !session || !session.csrf_token || !stringsEqual(String(submitted), session.csrf_token)) {
      return c.json({ error: 'CSRF token invalid' }, 403);
    }
    await next();
  };
}

export async function loginPage(c: AppContext): Promise<Response> {
  const session = c.get('session');
  let sessionId: string | null = session?.id ?? null;
  if (!sessionId) {
    const created = await createSession(c.env.DB, null);
    sessionId = created.id;
    c.set('session', created);
    c.header('Set-Cookie', sessionCookie(created.id));
  }
  const csrf = await getCsrfTokenForSession(c.env.DB, sessionId);
  const nonAdmin = await listNonAdminUsers(c.env.DB);
  return c.html(renderLogin({ csrf, non_admin_users: nonAdmin }));
}

export async function handleLogin(c: AppContext): Promise<Response> {
  const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string };
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  const session = c.get('session');
  const sessionId = session?.id ?? null;
  const ip = _clientIp(c);

  if (loginLockedFor(c, username, ip) > 0) {
    flash(c, 'error', `Terlalu banyak percobaan gagal. Coba lagi dalam ${loginLockedFor(c, username, ip) / 60000} menit.`);
    return c.redirect('/login');
  }

  if (sessionId) {
    const { session: s, user } = await getSessionUser(c.env.DB, sessionId);
    if (user && (await verifyPassword(password, user.password_hash))) {
      clearLoginFailures(c, username, ip);
      const fresh = await createSession(c.env.DB, user.id);
      c.set('session', fresh);
      c.set('userId', user.id);
      c.header('Set-Cookie', sessionCookie(fresh.id));
      flash(c, 'success', `Selamat datang, ${user.username}!`);
      return c.redirect('/');
    }
    await deleteSession(c.env.DB, sessionId);
    c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  if (!username) {
    flash(c, 'error', 'Username atau password salah!');
    return c.redirect('/login');
  }

  recordLoginFailure(c, username, ip);
  const attempts = _loginAttempts.get(_loginKey(ip, username))?.count ?? 0;
  const left = LOGIN_MAX_ATTEMPTS - attempts;
  if (left > 0 && left <= 2) {
    flash(c, 'error', `Username atau password salah! Sisa ${left} percobaan sebelum akun terkunci sementara.`);
  } else if (left <= 0) {
    flash(c, 'error', 'Akun Anda sedang terkunci. Coba lagi dalam 15 menit.');
  }
  return c.redirect('/login');
}

export async function handleLogout(c: AppContext): Promise<Response> {
  const session = c.get('session');
  if (session) await deleteSession(c.env.DB, session.id);
  c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  flash(c, 'success', 'Anda telah logout.');
  return c.redirect('/login');
}

/** ---------- rate limiting (login) ---------- */
const _loginAttempts = new Map<string, { count: number; first: number; lockedUntil: number }>();

function _clientIp(c: AppContext): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

function _loginKey(ip: string, username: string): string {
  return `${ip.split(',')[0].trim()}|${username.toLowerCase()}`;
}

export function loginLockedFor(c: AppContext, username: string, ip: string): number {
  const entry = _loginAttempts.get(_loginKey(ip, username));
  if (!entry) return 0;
  const remaining = entry.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function recordLoginFailure(c: AppContext, username: string, ip: string): void {
  const now = Date.now();
  let entry = _loginAttempts.get(_loginKey(ip, username));
  if (!entry || now - entry.first > LOGIN_WINDOW_SECONDS * 1000) {
    entry = { count: 0, first: now, lockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_LOCKOUT_SECONDS * 1000;
    entry.count = 0;
    entry.first = now;
  }
  _loginAttempts.set(_loginKey(ip, username), entry);
}

export function clearLoginFailures(c: AppContext, username: string, ip: string): void {
  _loginAttempts.delete(_loginKey(ip, username));
}

function stringsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function sessionCookie(id: string): string {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFE_MILLIS}`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const prefix = `${name}=`;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return null;
}
