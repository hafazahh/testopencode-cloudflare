# progress.md — Fase C1 (testopencode-cloudflare): skema D1 + data layer

## Sesi 1 — Persiapan
- Baca `app.py` (`init_db()`) → 12 tabel DDL.
- Baca `database.db` (SQLite) → skema asli, `password_plain` ada di users (dihapus).
- Rencana port: `src/schema.ts` (SCHEMA_SQL), `src/db.ts` (query D1), `scripts/seed.mjs` (seed idempoten).

## Sesi 2 — Implementation
- `src/schema.ts`: `SCHEMA_SQL` constant, 12 `CREATE TABLE IF NOT EXISTS` + index.
  - Hapus `password_plain` dari `users`.
  - Hapus `sessions` (bukan bagian C1; 12 tabel saja).
- `src/db.ts`: query D1 prepared statements untuk item, kategori, pelanggan, supplier
  (list/get/insert/update/delete) + `initDb()`.
- `scripts/seed.mjs`: jalankan SCHEMA_SQL batch, seed 3 role + permissions, 4 kategori,
  user admin (PBKDF2), mode `--remote` tersedia.

## Sesi 3 — Uji & verifikasi
- `tsc`: diagnostics total 0.
- Seed D1 lokal: 12 tabel.
- Baris: roles=3, kategori=4, users=1.
- Idempoten: jalankan seed 2x, baris tetap 3/4/1.

## Diterima
- Output `tscheck`: diagnostics total 0.
- D1 lokal: 12 tabel.
- Jumlah baris: 3/4/1.
- `git log --oneline`: commit `feat:` per fase.

## Sesi 4 — Fase D (port tampilan)
- Port `headers.ts` (CSP nonce + HSTS).
- Port `render.ts` (37 fungsi render dari 24 template Jinja2).
- Salin static/ (confirm.js, margin.js, pembelian.js, penjualan.js, kartu-stok.js, favicon.svg, style.css).
- Filter `password_plain` dari login.html.
- `tsc`: diagnostics total 0.
- Grep `on*=` di static/ src/: bersih.
- Grep `script-src` headers.ts: mengandung `nonce-`, tanpa `unsafe-inline`.
- Grep `password_plain` src/: bersih.
- `render.ts` fungsi: 37 (>= 20).

## Sesi 5 — Fase C2b (port route users/roles)
- Perbaiki 10 diagnostic tipe di `src/routes/users.ts` (6) + `src/routes/roles.ts` (4).
- Teknik: `.all<T>().results` (bukan D1Result), map objek UserRow eksplisit (tanpa spread dari db.UserRow), `c.req.parseBody()` + cast `Record<string, string> & { get, getAll }`, `JSON.parse` permissions → `Record<string, string[]>`, rename variabel `rows` → `roleRows` (no konflik dengan fungsi helper `rows`).
- Verifikasi: `node scripts/tscheck.mjs` → grep users.ts/roles.ts → `BERSIH` (0 diagnostic).
- Commit: `56a0be2 fix: Fase C2b — type error users/roles`; git status --short kosong.

## Sesi 6 — Fase C2d (type error CRUD items/kategori/supplier/pelanggan)
- Bersihkan 9 diagnostic tipe di 4 file: items.ts (2), kategori.ts (3), supplier.ts (2), pelanggan.ts (2).
- Teknik: `.formBody()` → `.parseBody()` + cast `Record<string, string> & { get, getAll }`; `kategori.ts` `:first()` → `:first<{ n: number }>()` untuk item_count.
- Verifikasi: `tsc` diagnostics total 0; `tscheck` {items,kategori,supplier,pelanggan}.ts → BERSIH; `git status --short` kosong.
- Commit: `545dffa fix: Fase C2d — type error CRUD items/kategori/supplier/pelanggan`.

## Sesi 7 — Recon Fase E (test suite + API surface, tanpa modifikasi)
- Evaluasi semua skrip Python tes di `../testopencode/`: verify_security.py (headers/cookie/rate-limit/CSRF), test_fase2–7.py (CRUD + RBAC + seed + atomicity), naming & csrf/helper pola.
- Evaluasi Worker: src/index.ts (middleware + CSP nonce), src/auth.ts (session/D1/rate-limit/PBKDF2), src/db.ts (D1 query layer + createPembelianTx/createPenjualanTx atomic), src/routes/* (18 file route), src/render.ts (37 render*), src/schema.ts (12 tabel).
- Run local: `npm run dev` → wrangler dev --port 8790 (D1 miniflare). Test: `npm run test:local`.
- Findings disimpan di findings.md (Fase E — Recon section): coverage per tes, API surface, command lokal, naming convention, open questions.

## Sesi 8 — Fase F: perbaikan UI (2026-10-25)

Empat bug berturut-turut, semuanya di Worker, bukan di role:

1. **Aset statis 404** → tambah `[assets] directory = "./static"`; 8 URL
   `/static/x` → `/x`. Commit `8c9c3bc`.
2. **HTML double-escape** → 47 situs variabel + 12 situs inline dibungkus
   `raw()`. Gejala: `<a href="/item/create">` tampil sebagai
   `&lt;a href=&quot;/item/create&quot;&gt;`. Commit `8c9c3bc`.
3. **Menu kosong** → `navLinks` tidak lagi bergantung pada `user_perms.menu`
   yang tidak pernah ada; pakai `Object.keys(user_perms)`. Commit `d8dad2f`.
4. **Info user + Logout tidak tampil** → `AppState.user`, query
   `JOIN roles`, `c.set('user', user)`, `currentUser(c)`, `PageProps`, dan
   33 pemanggilan render mengirim `current_user(c)`. Commit `e98a737`.

Catatan: versi 3 di-deploy lebih dulu, jadi user melihat menu sudah ada
sebelum info user muncul.

Data: D1 remote diisi 4 item contoh (Mouse Wireless, Keyboard Mekanik,
Kabel HDMI 2m, Mousepad XL) supaya tabel tidak kosong.

Alat yang dipakai: `read_file`, `search_files`, `patch`, `terminal` (curl +
wrangler), dan browser headless. **Bukan** lewat tool MCP CBM.

## Sesi 9 — Fase G: perbaikan urutan route CRUD (2026-10-27)

**Bug**: tombol "Tambah" tidak memunculkan form tambah. Sesudah login admin,
`GET /<res>/create` membalas 302 ke halaman index dengan flash "X tidak
ditemukan!".

**Akar masalah**: registrasi route `GET /<res>/:id` berada SEBELUM
`GET /<res>/create`. Hono mencocokkan sesuai URUTAN registrasi, jadi
`/item/create` ditelan `/:id` dengan `id='create'` → baris tidak ditemukan →
flash + 302. Route bersarang 2 segmen (`/:id/edit`, `/:id/delete`) AMAN karena
pada segmen kedua cocok persis, bukan param.

**Reproduksi live sebelum fix** (semuanya sesudah login admin):
`/item/create`, `/kategori/create`, `/pelanggan/create`, `/supplier/create`,
`/users/create`, `/roles/create` → 302. `/pembelian/create`, `/penjualan/create`
→ 200 (create memang sudah terdaftar sebelum `/:id` di dua file itu).

**Perbaikan — HANYA urutan blok route, nol perubahan isi handler**:
blok `GET /<res>/create` + `POST /<res>/create` dipindahkan ke ATAS blok
`GET /<res>/:id`. Isi handler dan nama variabel tidak diubah — terverifikasi
multiset baris non-kosong identik sebelum vs sesudah. `render.ts`, `auth.ts`,
`db.ts`, `index.ts`, `static/`, `wrangler.toml` TIDAK disentuh.

| file | commit |
|---|---|
| src/routes/items.ts | `04b7f62` |
| src/routes/kategori.ts | `d8ea394` |
| src/routes/pelanggan.ts | `be60e27` |
| src/routes/supplier.ts | `590d74a` |
| src/routes/users.ts | `dce189f` |
| src/routes/roles.ts | `ba0c72e` |

**Tutup celah verifikasi**: file baru `scripts/tests/02_forms.test.mjs` —
sesudah login admin, GET setiap `/create` wajib 200 DAN body memuat
`<form method="POST" action="/<res>/create"`. Bukti asersi menangkap bug:
dijalankan di worktree commit pre-fix `e98a737` → **16 PASS / 18 FAIL** (tepat
6 resource × 3 asersi), sedangkan pembelian + penjualan lolos sebagai kontrol.

**Hasil verifikasi**:
- `node scripts/tscheck.mjs` (20 file) → **0 diagnostic**
- `node scripts/run_local.mjs` → **73 PASS, 0 FAIL** (39 security + 34 forms);
  sebelumnya 39/0, jadi tanpa regresi
- Lokal (`wrangler dev --port 8790 --var ENVIRONMENT:local` + seed lokal):
  8/8 URL /create → 200, 2 `<form>` per halaman
- LIVE (sesudah `wrangler deploy`): login admin + CSRF, 8/8 URL /create → 200,
  body memuat tag `<form method="POST" action="/.../create"` persis

| /create | lokal | live |
|---|---|---|
| /item/create | 200 (2 form) | 200 (2 form) |
| /kategori/create | 200 (2 form) | 200 (2 form) |
| /pelanggan/create | 200 (2 form) | 200 (2 form) |
| /supplier/create | 200 (2 form) | 200 (2 form) |
| /users/create | 200 (2 form) | 200 (2 form) |
| /roles/create | 200 (2 form) | 200 (2 form) |
| /pembelian/create | 200 (2 form) | 200 (2 form) |
| /penjualan/create | 200 (2 form) | 200 (2 form) |

Tidak ada regresi route lain: `/:id` dan `/:id/edit` untuk item, kategori,
users, roles tetap 200. Pelanggan/supplier/pembelian/penjualan `/:id` → 302
BUKAN regresi: tabel seed lokal masih kosong (COUNT = 0), jadi handler benar
melakukan flash "tidak ditemukan".

Deploy: Version ID `4553b4f6-5795-47d7-883a-c2e1f34021c9`.
