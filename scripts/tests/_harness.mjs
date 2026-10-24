// scripts/tests/_harness.mjs — shared test harness for the testopencode Cloudflare
// Worker port (Fase E). Exports a D1Mock (sqlite-backed D1 emulation), a Statement
// wrapper that matches the D1 API the port uses, an HTTP Client with cookie jar,
// the esbuild-based app loader and the shared assert helper.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';
import { build } from '/home/choirulhaq/venvProject/testopencode-cloudflare/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, pbkdf2Sync } from 'node:crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// ---------- schema ----------
const _schemaSrc = readFileSync(new URL('../../src/schema.ts', import.meta.url), 'utf8');
const _m = _schemaSrc.match(/export const SCHEMA_SQL = `([\s\S]*?)`;/);
export const SCHEMA_SQL = _m ? _m[1] : '';

// ---------- crypto helpers (match src/auth.ts pbkdf2 format) ----------
function b64url(buf) {
  let bin = '';
  for (let i = 0; i < buf.length; i += 1) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function randomB64url(len) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return b64url(buf);
}
export function pbkdf2Hash(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64url');
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  return `pbkdf2$100000$${saltB64}$${hash.toString('base64url')}`;
}
export function hashPassword(password) {
  return pbkdf2Hash(password, randomB64url(16));
}

// ---------- seed data ----------
export const ROLES = [
  {
    nama: 'admin',
    deskripsi: 'Full access to all menus',
    permissions: JSON.stringify({
      items: ['view', 'create', 'edit', 'delete'],
      kategori: ['view', 'create', 'edit', 'delete'],
      pelanggan: ['view', 'create', 'edit', 'delete'],
      users: ['view', 'create', 'edit', 'delete'],
      roles: ['view', 'create', 'edit', 'delete'],
      supplier: ['view', 'create', 'edit', 'delete'],
      pembelian: ['view', 'create', 'delete'],
      penjualan: ['view', 'create', 'delete'],
      stok: ['view'],
      laporan: ['view'],
    }),
  },
  {
    nama: 'kasir',
    deskripsi: 'Akses kasir: penjualan + laporan',
    permissions: JSON.stringify({
      items: ['view'],
      kategori: ['view'],
      pelanggan: ['view', 'create', 'edit'],
      supplier: ['view'],
      pembelian: ['view'],
      penjualan: ['view', 'create', 'delete'],
      stok: ['view'],
      laporan: ['view'],
    }),
  },
  {
    nama: 'gudang',
    deskripsi: 'Akses gudang: supplier + pembelian + stok',
    permissions: JSON.stringify({
      items: ['view', 'create', 'edit'],
      kategori: ['view', 'create', 'edit'],
      pelanggan: ['view'],
      supplier: ['view', 'create', 'edit', 'delete'],
      pembelian: ['view', 'create', 'delete'],
      penjualan: ['view'],
      stok: ['view'],
      laporan: ['view'],
    }),
  },
];

export const KATEGORI = ['Elektronik', 'Makanan', 'Pakaian', 'Lainnya'];

const _adminHash = hashPassword('admin123');

// ---------- D1Mock ----------
export class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this._sql = this.normalizeSql(sql);
    this.params = [];
  }
  bind(...params) {
    this.params = params;
    return this;
  }
  normalizeSql(sql) {
    // Double-quoted strings are treated as identifiers by node:sqlite (no fallback
    // to string literal), while the original app (SQLite) falls back. Convert them
    // to single-quoted string literals to keep behaviour identical.
    return sql.replace(/"([^"]*)"/g, "'$1'");
  }
  _nodeStmt() {
    return this.db.db.prepare(this._sql);
  }
  async all() {
    const rows = this._nodeStmt().all(...this.params);
    return { results: rows };
  }
  async first() {
    const rows = await this.all();
    return rows.results.length ? rows.results[0] : null;
  }
  async run() {
    const r = this._nodeStmt().run(...this.params);
    return { success: true, meta: { last_row_id: r.lastInsertRowid, changes: r.changes } };
  }
}

export class D1Mock {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(SCHEMA_SQL);
    this._seed();
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  async batch(statements) {
    const results = [];
    for (const s of statements) results.push(s.run());
    await Promise.all(results);
    return { success: true, results, meta: { last_row_id: 0, changes: 0 } };
  }
  _seed() {
    for (const r of ROLES) {
      this.db.prepare('INSERT INTO roles (nama, deskripsi, permissions) VALUES (?, ?, ?)').run(r.nama, r.deskripsi, r.permissions);
    }
    for (const k of KATEGORI) {
      this.db.prepare('INSERT INTO kategori (nama, deskripsi) VALUES (?, ?)').run(k, null);
    }
    // admin user (idempotent: username UNIQUE)
    this.db.prepare(
      "INSERT OR IGNORE INTO users (username, password_hash, role_id) SELECT 'admin', ?, id FROM roles WHERE nama = 'admin'",
    ).run(_adminHash);
  }
}

// ---------- HTTP client (cookie jar) ----------
function parseCookieHeader(header) {
  const jar = {};
  if (!header) return jar;
  for (const part of header.split(';')) {
    const t = part.trim();
    const eq = t.indexOf('=');
    if (eq > 0) jar[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return jar;
}

export class Client {
  constructor(app, env) {
    this.app = app;
    this.env = env;
    this.cookie = '';
  }
  _headers(headers) {
    const h = { ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    return h;
  }
  async request(path, init = {}) {
    const res = await this.app.fetch(new Request('http://localhost' + path, {
      method: init.method || 'GET',
      headers: this._headers(init.headers || {}),
      body: init.body,
      // Default mengikuti redirect. Uji yang memeriksa 302 harus meminta
      // `redirect: 'manual'` lewat init, kalau tidak status yang terlihat adalah
      // status halaman tujuan (200) dan asersi 302 selalu gagal.
      redirect: init.redirect || 'follow',
    }), this.env);
    console.error('[CLIENT DEBUG] res=', res && typeof res === 'object' ? ('status='+res.status+' headers='+String(res.headers?._size)) : String(res));
    const sc = res.headers.get('set-cookie');
    if (sc) {
      // Simpan SEMUA cookie, bukan hanya yang pertama. Sejak perbaikan
      // `{ append: true }`, respons login memuat dua Set-Cookie (flash + sesi).
      // Ambil `split(';')[0]` akan menyimpan cookie flash dan membuang cookie
      // sesi, sehingga permintaan berikutnya gagal CSRF (403).
      const jar = parseCookieHeader(this.cookie);
      for (const raw of sc.split(/,\s*(?=[^;,]+\=)/)) {
        const first = raw.split(';')[0].trim();
        const eq = first.indexOf('=');
        if (eq <= 0) continue;
        const name = first.slice(0, eq);
        const value = first.slice(eq + 1);
        const isDeletion = /;\s*Max-Age=0/i.test(raw) || /;\s*max-age=0/i.test(raw);
        if (isDeletion || value === '') delete jar[name];
        else jar[name] = value;
      }
      this.cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return {
      status: res.status,
      headers: res.headers,
      body: await res.text(),
      setCookie: sc,
    };
  }
  get(path, init) { return this.request(path, { method: 'GET', ...init }); }
  post(path, body, init) { return this.request(path, { method: 'POST', body, ...init }); }
  async getCsrf(path = '/login') {
    const res = await this.get(path);
    const m = res.body.match(/name="csrf_token" value="([^"]+)"/);
    return m ? m[1] : null;
  }
  // helper used by tests: wait until the server is up
  static sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
}

// ---------- app loader (esbuild) ----------
// Bundle the whole Worker app into a single ESM file (all src modules inlined).
// `hono` + `@cloudflare/workers-types` stay external (node_modules). This avoids
// esbuild's `outdir` (which with a single entry only emits the entry file).
export async function createApp() {
  const tmpDir = join(ROOT, '.tmp-bundle');
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    await build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      format: 'esm',
      outdir: tmpDir,
      external: ['hono', '@cloudflare/workers-types'],
      logLevel: 'silent',
    });
  } catch (e) {
    console.error('esbuild build failed:', e.message);
    throw e;
  }
  const mod = await import(join(tmpDir, 'index.js'));
  return mod.app;
}

// ---------- assert helper ----------
export const assert = {
  count: { pass: 0, fail: 0 },
  assert(label, condition, detail = '') {
    if (condition) {
      this.count.pass += 1;
      console.log(`  [PASS] ${label}`);
    } else {
      this.count.fail += 1;
      console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
    }
    return condition;
  },
  result() {
    const { pass, fail } = this.count;
    console.log(`RESULT: ${pass} PASS, ${fail} FAIL`);
    return fail === 0;
  },
};
