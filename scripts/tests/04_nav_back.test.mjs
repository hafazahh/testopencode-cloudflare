// scripts/tests/04_nav_back.test.mjs — regresi nav menu + tombol back:
//
// BUG NAV KOSONG: 27 fungsi render non-index di src/render.ts mengirim
// `user_perms: {}` (hardcoded) ke renderBaseItem. renderBase memakai nilai itu
// untuk navLinks(props.user_perms), jadi Object.keys({}) = 0 → <nav></nav>
// kosong di hampir semua halaman non-index. Perbaikan: fungsi render kini
// menerima `user_perms` opsional dari props dan meneruskannya, dan setiap
// route GET meng-query getUserPermissions lalu mengirim hasil aslinya.
// Asersi 1: setiap halaman wajib punya nav tidak kosong (>= 5 <a ... btn-nav>)
// untuk user admin (all-access: 10 menu — laporan jadi 2 link — total 11).
//
// BUG TOMBOL BACK: /stok/kartu, /laporan/penjualan, /laporan/stok tidak punya
// tombol back sedangkan halaman detail lain punya.
// Asersi 2: ketiga halaman memuat <a href="/" class="btn btn-secondary">
// Kembali ke Daftar Item</a>.
//
// KONTROL LOGIN: halaman /login dipakai TANPA sesi/user, jadi nav di sana
// TETAP kosong (kontrak renderLogin: pemanggil tidak mengirim perms).
// Asersi 3: /login TIDAK memuat satu pun link btn-nav di dalam <nav>.

import { Client, D1Mock, createApp } from './_harness.mjs';

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

/** Hitung <a ... class="btn btn-nav"> DI DALAM elemen <nav>. */
function navLinkCount(body) {
  const navHtml = (body.match(/<nav>([\s\S]*?)<\/nav>/) || [])[1] || '';
  return (navHtml.match(/<a href="[^"]*" class="btn btn-nav">/g) || []).length;
}

/** D1Mock + satu item contoh supaya /item/1, /item/1/edit, /stok/kartu
 *  punya data nyata untuk dirender. */
class SeededD1 extends D1Mock {
  _seed() {
    super._seed();
    this.db.prepare('INSERT INTO items (nama, category, harga_pokok, harga_jual) VALUES (?, ?, ?, ?)')
      .run('Kabel USB', 'Elektronik', 10000, 15000);
  }
}

async function main() {
  const app = await createApp();
  const db = new SeededD1();
  const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };

  // --- login admin (all-access: nav penuh) ---
  const admin = new Client(app, env);
  const csrf = (await admin.getCsrf()) ?? '';
  const loginForm = new URLSearchParams({ csrf_token: csrf, username: 'admin', password: 'admin123' }).toString();
  const loginRes = await admin.post('/login', loginForm, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  check('login admin berhasil (302 ke /)', loginRes.status === 302 && (loginRes.headers.get('location') || '').startsWith('/'), `got ${loginRes.status}`);

  // --- [1] NAV TIDAK KOSONG di semua halaman non-login ---
  console.log('[1] NAV MENU TIDAK KOSONG (>= 5 <a class="btn-nav"> di <nav>)');
  // SEMUA halaman index WAJIB masuk: bug /pelanggan (query permissions mentah
  // tanpa JSON.parse → Object.keys hanya ["permissions"] → nav kosong) lolos
  // dari ronde ini karena daftar awalnya hanya memuat halaman non-index.
  const PAGES = [
    '/',
    '/kategori',
    '/pelanggan',
    '/supplier',
    '/users',
    '/roles',
    '/pembelian',
    '/penjualan',
    '/item/create',
    '/item/1',
    '/item/1/edit',
    '/kategori/create',
    '/kategori/1',
    '/kategori/1/edit',
    '/pelanggan/create',
    '/supplier/create',
    '/pembelian/create',
    '/penjualan/create',
    '/stok/kartu',
    '/laporan/penjualan',
    '/laporan/stok',
    '/users/create',
    '/roles/create',
  ];
  for (const page of PAGES) {
    const res = await admin.get(page, { redirect: 'manual' });
    const count = navLinkCount(res.body);
    check(
      `${page} status 200 + nav >= 5 link`,
      res.status === 200 && count >= 5,
      `status=${res.status}, link nav=${count}`
    );
  }
  // Kontrol kontras: user admin di index punya 11 link (10 menu, laporan = 2).
  const home = await admin.get('/');
  check('nav admin punya 11 link (all-access, laporan = 2 link)', navLinkCount(home.body) === 11, `link=${navLinkCount(home.body)}`);

  // --- [2] TOMBOL KEMBALI DI STOK & LAPORAN ---
  console.log('[2] TOMBOL "Kembali ke Daftar Item" DI /stok/kartu + 2 LAPORAN');
  const BACK_PAGES = ['/stok/kartu', '/laporan/penjualan', '/laporan/stok'];
  for (const page of BACK_PAGES) {
    const res = await admin.get(page);
    const hasBack = res.body.includes('<a href="/" class="btn btn-secondary">Kembali ke Daftar Item</a>');
    check(`${page} punya link Kembali ke Daftar Item (href="/")`, res.status === 200 && hasBack, `status=${res.status}, ada=${hasBack}`);
  }

  // --- [3] KONTROL: /login TANPA SESI TIDAK PUNYA NAV ---
  console.log('[3] HALAMAN /login TETAP TANPA NAV (belum ada sesi)');
  const anon = new Client(app, env);
  const loginPage = await anon.get('/login');
  check('/login status 200', loginPage.status === 200);
  const navHtml = (loginPage.body.match(/<nav>([\s\S]*?)<\/nav>/) || [])[1] || '';
  const anonLinks = (navHtml.match(/btn-nav/g) || []).length;
  check('/login <nav> kosong (0 link btn-nav)', anonLinks === 0, `link=${anonLinks}`);

  console.log(`\nRESULT: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST ERROR:', e); process.exit(1); });
