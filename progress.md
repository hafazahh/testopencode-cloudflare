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
