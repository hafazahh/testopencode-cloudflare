# findings.md — Fase C1 (testopencode-cloudflare): skema D1 + data layer

## Sumber
- Flask archive: `/home/choirulhaq/venvProject/testopencode/app.py` (`init_db()`, 13 tabel DDL).
- Sumber data: `/home/choirulhaq/venvProject/testopencode/database.db` (SQLite).
- Target: Cloudflare Workers + D1. Local D1 (miniflare) digunakan untuk verifikasi.

## Skema D1 (12 tabel)
items, kategori, pelanggan, supplier, pembelian, pembelian_detail, penjualan,
penjualan_detail, roles, stok_akhir, stok_mutasi, users.

## Perubahan vs Flask (SQLite → D1)

### fitur yang diperiksa
| Fitur SQLite | Status di D1 | Catatan |
|---|---|---|
| `GENERATED ALWAYS AS ... STORED` (items.margin) | ✅ diterima (syntax OK) | `margin = harga_jual - harga_pokok`; perlu verifikasi SELECT di D1 |
| `INSERT OR IGNORE` / `ON CONFLICT` | ✅ | dipakai di seed untuk idempotensi |
| `CHECK(qty > 0)`, `CHECK(jenis_mutasi IN ('IN','OUT'))` | ✅ | diterima |
| `UNIQUE` (nomor_transaksi, username) | ✅ | diterima |
| `FOREIGN KEY ... ON DELETE` | ✅ | `RESTRICT` / `CASCADE`; D1 tidak aktifkan FK secara default, validasi di-handle di app layer |
| `AUTOINCREMENT` | ✅ | diterima |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | ✅ | diterima |
| PRAGMA journal_mode / busy_timeout | ❌ | tidak dipakai (urusan file lokal) |

### keputusan desain
- `users` TIDAK mengandung kolom `password_plain` (aturan keras kartu C1).
- `password_hash` berisi PBKDF2-SHA256: `pbkdf2$100000$<saltB64>$<hashB64>`.
- Schema huruf kapital/indentasi rapi (PRAGMA table_info dari app.py + sqlite_master).

## Data awal (seed)
- 3 role: admin, kasir, gudang + permissions JSON persis dari app.py.
- 4 kategori: Elektronik, Makanan, Pakaian, Lainnya.
- 1 user: admin (idempoten, username UNIQUE).

## Verifikasi (Fase C1)
- `tsc`: diagnostics total 0 (0 di own sources).
- Schema D1 lokal: 12 tabel (`items` s/d `users`).
- Baris: roles=3, kategori=4, users=1.
- Idempoten: seed 2x → baris tetap 3/4/1.

## Fase D — port tampilan (Jinja2 → template string + static JS + CSP headers)
- `src/headers.ts`: `securityHeaders(_nonce, _isSecure)` — CSP dengan `script-src 'self' 'nonce-${_nonce}'`, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, COOP/COEP, CORP, HSTS (hanya HTTPS, tanpa `preload`).
- `src/render.ts`: 37 `export function render*` — setiap template Jinja2 jadi fungsi render string HTML lewat tagged template `html` (escape otomatis). Tidak ada inline handler `on*=` (CSP-safe).
- `static/`: confirm.js, margin.js, pembelian.js, penjualan.js, kartu-stok.js, favicon.svg, style.css.
- `login.html` port: tanpa tabel `password_plain` (password plaintext dihapus dari tampilan).
- `tsc`: diagnostics total 0.
- `grep on*= static/ src/`: tidak ada inline handler.
- `grep script-src src/headers.ts`: mengandung `nonce-`, tidak ada `unsafe-inline`.
- `grep password_plain src/`: bersih.

## Fase C2b — type error users/roles (commit `56a0be2`)
- 10 diagnostic: 6 di `src/routes/users.ts` + 4 di `src/routes/roles.ts`.
- Perbaikan:
  - `users.ts`: `.all<UserRow>().results` (bukan D1Result); map UserRow eksplisit tanpa spread (`id/username/role_id/created_at/role_nama`); `c.req.parseBody()` + cast `Record<string, string> & { get, getAll }`; `JSON.parse` permissions → `Record<string, string[]>`; `user as UserRow` → objek `userView: UserRow` eksplisit.
  - `roles.ts`: rename variabel `rows` → `roleRows` (konflik dengan fungsi helper `rows`); `JSON.parse(String(permsRow.permissions ?? ''))` → `Record<string, string[]>`; `c.req.parseBody()` + cast dengan `getAll`.
- Verifikasi: `node scripts/tscheck.mjs` → `grep src/routes/users.ts src/routes/roles.ts` → kosong → `BERSIH`.
- Kriteria diterima: 0 diagnostic pada dua file; `git log` memuat commit `56a0be2` (working tree clean).
