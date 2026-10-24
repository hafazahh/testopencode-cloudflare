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

## Aturan keras
- JANGAN mengubah `/home/choirulhaq/venvProject/testopencode/` (arsip sumber).
- JANGAN `git init` ulang, JANGAN tambah remote, JANGAN push.
- JANGAN deploy (`wrangler deploy`).
- JANGAN bawa `password_plain` dari Flask.
- JANGAN fabrikasi data.
- Commit per fase dengan pesan konvensional (`feat: ...`). Working tree bersih.
