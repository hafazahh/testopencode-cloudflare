/** Worker entry point (Hono) — testopencode.
 *
 * Fase C2: 43 route Flask → Hono + auth/RBAC.
 * - `src/routes/*` registrasi tiap grup route.
 * - `src/auth.ts` middleware login_required / has_permission / csrf / session.
 * - `src/headers.ts` CSP (nonce per-request) + headers keamanan.
 */
import { Hono } from 'hono';
import type { Env } from './db';
import { securityHeaders } from './headers';
import { sessionMiddleware, flashMiddleware } from './auth';
import type { AppContext, AppEnv, AppHono } from './context';
import { register as registerAuth } from './routes/auth';
import { register as registerItems } from './routes/items';
import { register as registerPelanggan } from './routes/pelanggan';
import { register as registerKategori } from './routes/kategori';
import { register as registerUsers } from './routes/users';
import { register as registerRoles } from './routes/roles';
import { register as registerSupplier } from './routes/supplier';
import { register as registerPembelian } from './routes/pembelian';
import { register as registerPenjualan } from './routes/penjualan';
import { register as registerStok } from './routes/stok';
import { register as registerLaporan } from './routes/laporan';

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const app: AppHono = new Hono<AppEnv>();

// ---------- middleware global ----------
app.use(sessionMiddleware());
app.use(flashMiddleware());

// CSP + security headers per-request (nonce dibuat di sini).
app.use('*', async (c: AppContext, next) => {
  const nonce = bytesToBase64url(crypto.getRandomValues(new Uint8Array(16)));
  const isSecure = c.env.ENVIRONMENT === 'production' || c.req.header('X-Forwarded-Proto') === 'https';
  const headers = securityHeaders(nonce, isSecure);
  for (const [k, v] of Object.entries(headers)) c.header(k, v);
  await next();
});

// ---------- route register ----------
registerAuth(app);
registerItems(app);
registerPelanggan(app);
registerKategori(app);
registerUsers(app);
registerRoles(app);
registerSupplier(app);
registerPembelian(app);
registerPenjualan(app);
registerStok(app);
registerLaporan(app);

// ---------- health ----------
app.get('/health', (c) => c.text('ok', 200));
app.get('/healthz', (c) => c.text('ok', 200));

export default { fetch: app.fetch };
