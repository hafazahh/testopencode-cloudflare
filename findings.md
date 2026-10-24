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
