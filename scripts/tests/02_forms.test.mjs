// scripts/tests/02_forms.test.mjs — regresi urutan route: halaman /create WAJIB
// memuat form tambah, bukan menjebak di handler /:id.
//
// Bug yang diuji: route `GET /<res>/:id` terdaftar SEBELUM `GET /<res>/create`.
// Hono mencocokkan sesuai urutan registrasi, jadi `/item/create` ditelan `/:id`
// dengan id='create' -> baris tidak ditemukan -> flash + 302 redirect. User
// menekan tombol Tambah dan form tidak pernah muncul.
//
// Asersi per resource: status 200 DAN body memuat
// `<form method="POST" action="/<res>/create"`. Redirect (302) otomatis gagal
// karena body halaman tujuan tidak memuat form create.

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

// Semua resource CRUD yang punya halaman "Tambah". pembelian/penjualan disertakan
// sebagai kontrol: registrasi create-nya memang sudah benar sebelum :id.
const RESOURCES = [
  'item',
  'kategori',
  'pelanggan',
  'supplier',
  'users',
  'roles',
  'pembelian',
  'penjualan',
];

async function main() {
  const app = await createApp();
  const db = new D1Mock();
  const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };
  const client = new Client(app, env);

  // --- login admin (perlu CSRF + cookie jar dari session) ---
  const loginPage = await client.get('/login');
  const csrfMatch = loginPage.body.match(/name="csrf_token" value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  check('csrf token dapat diambil dari halaman login', csrf.length > 0);

  const loginForm = new URLSearchParams({ csrf_token: csrf, username: 'admin', password: 'admin123' }).toString();
  const loginRes = await client.post('/login', loginForm, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  check('login admin berhasil (302 ke index, bukan balik ke /login)', loginRes.status === 302 && !(loginRes.headers.get('location') || '').includes('/login'), `got ${loginRes.status} -> ${loginRes.headers.get('location')}`);

  // --- halaman create harus memuat form tambah ---
  console.log('[1] HALAMAN /create MEMUAT FORM TAMBAH (regresi urutan route)');
  for (const res of RESOURCES) {
    const path = `/${res}/create`;
    // redirect:'manual' supaya 302 terlihat sebagai 302, bukan menyembunyikan
    // diri sebagai 200 halaman tujuan.
    const r = await client.get(path, { redirect: 'manual' });
    const formTag = `<form method="POST" action="${path}"`;
    check(`${path} status 200 (bukan 302)`, r.status === 200, `got ${r.status}${r.status === 302 ? ' -> ' + (r.headers.get('location') || '') : ''}`);
    check(`${path} body memuat ${formTag}`, r.body.includes(formTag), r.status === 200 ? '' : 'body bukan halaman form create');
    const n = (r.body.match(/<form /g) || []).length;
    check(`${path} form form-nya tidak kosong`, n > 0, `jumlah <form> = ${n}`);
  }

  // --- kontrol: halaman index tiap resource tetap 200 ---
  // NB: daftar item disajikan di `/` (bukan `/item`) — lihat register di items.ts.
  console.log('[2] HALAMAN INDEX TETAP 200 (tidak ada regresi)');
  const INDEX_PATHS = {
    item: '/',
    kategori: '/kategori',
    pelanggan: '/pelanggan',
    supplier: '/supplier',
    users: '/users',
    roles: '/roles',
    pembelian: '/pembelian',
    penjualan: '/penjualan',
  };
  for (const [res, path] of Object.entries(INDEX_PATHS)) {
    const r = await client.get(path, { redirect: 'manual' });
    check(`${path} status 200`, r.status === 200, `got ${r.status}`);
  }

  // Catatan: jangan panggil assert.result() di sini — counter-nya global dan
  // sudah dibagikan dengan harness, sehingga mencetak baris RESULT kedua.
  // Format `RESULT: N PASS, M FAIL` yang dihitung runner cukup dari baris ini.
  console.log(`\nRESULT: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST ERROR:', e); process.exit(1); });
