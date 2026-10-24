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
