// scripts/tests/01_security.test.mjs — port of verify_security.py (Fase E)
import { Client, assert, D1Mock, createApp } from './_harness.mjs';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failed += 1;
    console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  const app = await createApp();
  const db = new D1Mock();
  const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };
  const client = new Client(app, env);

  // --- 1. security headers (GET /login) ---
  console.log('[1] SECURITY HEADERS');
  const r = await client.get('/login');
  check('Content-Security-Policy present', r.headers.get('content-security-policy') != null);
  const cspHeader = r.headers.get('content-security-policy') || '';
  const scriptSrc = /script-src\s+([^;]+)/i.exec(cspHeader)?.[1] ?? '';
  check("CSP frame-ancestors 'none'", /frame-ancestors\s+'none'/i.test(cspHeader));
  check("CSP object-src 'none'", /object-src\s+'none'/i.test(cspHeader));
  check("CSP base-uri 'self'", /base-uri\s+'self'/i.test(cspHeader));
  // Hanya script-src yang wajib bebas unsafe-inline. style-src memang memakai
  // 'unsafe-inline' (dipakai Flask juga), jadi mengecek seluruh header CSP
  // selalu gagal meskipun script-src sudah benar.
  check("CSP script-src has no unsafe-inline", !/['"]unsafe-inline['"]/i.test(scriptSrc));
  check("CSP script-src has a nonce", /'nonce-[A-Za-z0-9_-]+'/.test(scriptSrc));
  check('X-Content-Type-Options: nosniff', r.headers.get('x-content-type-options') === 'nosniff');
  check('X-Frame-Options: DENY', r.headers.get('x-frame-options') === 'DENY');
  check('Referrer-Policy set', r.headers.get('referrer-policy') === 'strict-origin-when-cross-origin');
  check('Permissions-Policy set', r.headers.get('permissions-policy') === 'geolocation=(), microphone=(), camera=(), payment=()');
  check('Cross-Origin-Opener-Policy set', r.headers.get('cross-origin-opener-policy') === 'same-origin');
  check('Cross-Origin-Resource-Policy set', r.headers.get('cross-origin-resource-policy') === 'same-origin');

  // --- 2. session cookie flags (GET /login) ---
  console.log('[2] SESSION COOKIE FLAGS');
  const cookie = r.setCookie || '';
  check('cookie present', /testopencode_sid=/i.test(cookie));
  check('HttpOnly set', /HttpOnly/i.test(cookie));
  check('SameSite set', /SameSite=Lax/i.test(cookie));
  // config Secure / HttpOnly / SameSite are read from env — verify via login page
  // (Hono worker env: ENVIRONMENT='local' so Secure only on real HTTPS)

  // --- 3. Secure cookie + HSTS over simulated HTTPS ---
  console.log('[3] SECURE COOKIE + HSTS');
  const clientHttps = new Client(app, env);
  const rHttps = await clientHttps.get('/login', { headers: { 'X-Forwarded-Proto': 'https' } });
  const setCookieHttps = rHttps.setCookie || '';
  check('Secure attribute emitted over HTTPS', /Secure/i.test(setCookieHttps));
  const hsts = rHttps.headers.get('strict-transport-security') || rHttps.headers.get('strict-transport-policy');
  check('HSTS present over HTTPS', !!hsts);
  check('HSTS max-age=31536000', /max-age=31536000/.test(hsts || ''));
  check('HSTS includeSubDomains', /includeSubDomains/.test(hsts || ''));

  // HSTS over plain HTTP must NOT be sent
  const rHttp = await client.get('/login');
  check('HSTS NOT sent over http://', rHttp.headers.get('strict-transport-security') === null);

  // --- 4. login rate limiting ---
  console.log('[4] LOGIN RATE LIMITING');
  // Setiap percobaan HARUS membawa csrf_token yang valid. Tanpa itu csrfProtect
  // menolak dengan 403 sebelum handleLogin jalan, jadi yang terukur adalah CSRF
  // bukan penolakan password — dan asersi `status === 302` selalu gagal.
  const wrongClient = new Client(app, env);
  const wrongPage = await wrongClient.get('/login');
  const wrongCsrf = (wrongPage.body.match(/name="csrf_token" value="([^"]+)"/) || [])[1] ?? '';
  check('csrf token available for wrong-password attempts', wrongCsrf.length > 0);

  let lockoutBody = '';
  for (let i = 0; i < 7; i += 1) {
    const form = new URLSearchParams({ csrf_token: wrongCsrf, username: 'admin', password: `wrong${i}` });
    const rr = await wrongClient.post('/login', form.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
    lockoutBody = rr.body;
    // login always redirects to /login (302) with an error flash, never to index
    check(`wrong${i} does not log in (redirects to login, not index)`, rr.status === 302 && (rr.headers.get('location') || '').includes('/login'));
  }
  // after threshold, lockout message must appear
  // Flash disimpan di cookie dan dirender pada halaman BERIKUTNYA, jadi harus
  // diambil lewat GET /login setelah percobaan gagal — membaca body respons 302
  // (yang kosong) tidak akan pernah menemukan pesannya.
  const afterLockout = await wrongClient.get('/login');
  const lockoutText = lockoutBody + ' ' + afterLockout.body;
  check('lockout message appears after threshold', /Terlalu banyak percobaan gagal/i.test(lockoutText) || /terkunci/i.test(lockoutText));

  // --- 5. CSRF enforcement ---
  console.log('[5] CSRF ENFORCEMENT');
  // need a fresh session: clear cookie
  const anon = new Client(app, env);
  const page = await anon.get('/login');
  const m = page.body.match(/name="csrf_token" value="([^"]+)"/);
  const csrf = m ? m[1] : '';
  const noToken = await anon.post('/login', new URLSearchParams({ username: 'admin', password: 'admin123' }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  check('POST without CSRF token -> 403', noToken.status === 403, `got ${noToken.status}`);
  const wrongToken = await anon.post('/login', new URLSearchParams({ csrf_token: 'bogus', username: 'admin', password: 'admin123' }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  check('POST with wrong CSRF token -> 403', wrongToken.status === 403, `got ${wrongToken.status}`);

  // --- 5b. 403 responds with real status (not redirect) ---
  console.log('[5b] 403 AS REAL STATUS');
  check('403 is not masked as 302', noToken.status !== 302);
  check('403 body is HTML', /<!DOCTYPE/i.test(noToken.body) || /<html/i.test(noToken.body));
  check('403 renders error template', /Akses Ditolak/i.test(noToken.body));

  // --- 6. authorization (unauthenticated access blocked) ---
  console.log('[6] AUTHORIZATION');
  const anon2 = new Client(app, env);
  for (const path of ['/', '/users', '/roles', '/kategori', '/pelanggan']) {
    const rr = await anon2.get(path);
    check(`${path} redirects anonymous -> login`, rr.status === 302 && (rr.headers.get('location') || '').includes('/login'), `got ${rr.status}`);
  }

  console.log(`\nRESULT: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST ERROR:', e); process.exit(1); });
