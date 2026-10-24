# task_plan.md — testopencode-cloudflare / Fase C1

## Tujuan
Port data layer CRUD `testopencode` dari Flask+SQLite ke Cloudflare Workers+D1.
Kartu ini mengerjakan **Fase C1**: skema D1 + fungsi query.

## Path (absolute)
- Project Worker: `/home/choirulhaq/venvProject/testopencode-cloudflare/`
- Sumber Flask (baca saja): `/home/choirulhaq/venvProject/testopencode/`
  - `app.py` — `init_db()` untuk DDL 13 tabel (diproses: 12 tabel + hapus `password_plain`).
  - `database.db` — SQLite asli, baca saja.
  - `seed_fase6.py` — data awal (referensi).

## Fase C1
- [x] `src/schema.ts` — `SCHEMA_SQL` konstanta: 12 `CREATE TABLE IF NOT EXISTS` + index.
      - `users` tanpa `password_plain`.
      - Hapus `sessions` (bukan bagian C1).
- [x] `src/db.ts` — query D1 prepared statements: item, kategori, pelanggan, supplier
      (list/get/insert/update/delete) + `initDb()`.
- [x] `scripts/seed.mjs` — jalankan SCHEMA_SQL batch, seed 3 role + permissions,
      4 kategori, user admin (PBKDF2), mode `--remote`.

## Uji & verifikasi
- [x] `tsc`: diagnostics total 0.
- [x] D1 lokal: 12 tabel (`items` s/d `users`).
- [x] Baris: roles=3, kategori=4, users=1.
- [x] Idempoten: seed 2x → baris tetap 3/4/1.

## Fase D
- [x] `src/headers.ts` — CSP (nonce `script-src`) + HSTS (hanya HTTPS, tanpa preload).
- [x] `src/render.ts` — 37 `export function render*` (Jinja2 → template string, escape otomatis).
- [x] `static/` — confirm.js, margin.js, pembelian.js, penjualan.js, kartu-stok.js, favicon.svg, style.css.
- [x] `login.html` port — tanpa tabel `password_plain`.
- [x] `tsc`: diagnostics total 0.
- [x] `grep on*= static/ src/`: bersih.
- [x] `grep "script-src" src/headers.ts`: mengandung `nonce-`, tidak `unsafe-inline`.
- [x] `grep "password_plain" src/`: bersih.
- [x] `grep -c "export function render" src/render.ts`: 37 (>= 20).

## Fase C2 — port route Flask → Hono (4 kartu)
- [x] **C2a** — `src/auth.ts`, `src/context.ts`, `src/index.ts` (commit `075f79f`): 0 diagnostic.
- [x] **C2b** — `src/routes/users.ts` + `src/routes/roles.ts` (commit `56a0be2`): 10 diagnostic → `BERSIH`.
- [ ] C2c — (file lain: items/kategori/pelanggan/pembelian/penjualan/supplier)
- [ ] C2d — tsc total 0.

## Aturan keras
- JANGAN mengubah `/home/choirulhaq/venvProject/testopencode/` (arsip sumber).
- JANGAN `git init` ulang, JANGAN tambah remote, JANGAN push.
- JANGAN deploy (`wrangler deploy`).
- JANGAN bawa `password_plain` dari Flask.
- JANGAN fabrikasi data.
- Commit per fase dengan pesan konvensional (`feat: ...`). Working tree bersih.
- JANGAN mengubah `/home/choirulhaq/venvProject/testopencode/` (arsip sumber).
- JANGAN `git init` ulang, JANGAN tambah remote, JANGAN push.
- JANGAN deploy (`wrangler deploy`).
- JANGAN bawa `password_plain` dari Flask.
- JANGAN fabrikasi data.
- Commit per fase dengan pesan konvensional (`feat: ...`). Working tree bersih.
