/**
 * Fase C1 — Skema data layer testopencode (D1 / SQLite).
 * Port dari `init_db()` di `app.py` (repo Flask `testopencode`) — 12 tabel.
 *
 * Perubahan vs Flask:
 *   - `users` tidak memiliki kolom plaintext password (aturan keras kartu C1).
 *   - `margin` pada `items` tetap `GENERATED ALWAYS AS (harga_jual - harga_pokok) STORED`
 *     (D1 mendukung generated column; dicek di seed.mjs).
 *   - Foreign-key constraints: `ON DELETE RESTRICT` (supplier/pembelian/penjualan),
 *     `ON DELETE CASCADE` (detail/transaksi, stok_akhir, stok_mutasi).
 *   - `sessions` tidak disertakan (kartu C1 hanyakan 12 tabel).
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    harga_pokok REAL NOT NULL,
    harga_jual REAL NOT NULL,
    margin REAL GENERATED ALWAYS AS (harga_jual - harga_pokok) STORED,
    category TEXT NOT NULL DEFAULT 'Lainnya',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pelanggan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    email TEXT,
    telepon TEXT,
    alamat TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kategori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    permissions TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS supplier (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    kontak TEXT,
    alamat TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pembelian (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    nomor_transaksi TEXT NOT NULL UNIQUE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan TEXT,
    total REAL NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES supplier(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pembelian_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pembelian_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    qty REAL NOT NULL CHECK(qty > 0),
    harga_beli REAL NOT NULL CHECK(harga_beli >= 0),
    subtotal REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stok_mutasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    jenis_mutasi TEXT NOT NULL CHECK(jenis_mutasi IN ('IN', 'OUT')),
    qty REAL NOT NULL,
    harga REAL NOT NULL,
    saldo_berjalan REAL NOT NULL,
    referensi_tipe TEXT NOT NULL CHECK(referensi_tipe IN ('pembelian', 'penjualan')),
    referensi_id INTEGER NOT NULL,
    nomor_referensi TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stok_akhir (
    item_id INTEGER PRIMARY KEY,
    qty_akhir REAL NOT NULL DEFAULT 0,
    harga_pokok_rata REAL NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS penjualan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pelanggan_id INTEGER NOT NULL,
    nomor_transaksi TEXT NOT NULL UNIQUE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan TEXT,
    total REAL NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS penjualan_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    penjualan_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    qty REAL NOT NULL CHECK(qty > 0),
    harga_jual REAL NOT NULL CHECK(harga_jual >= 0),
    harga_pokok REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (penjualan_id) REFERENCES penjualan(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_supplier_nama ON supplier(nama);
CREATE INDEX IF NOT EXISTS idx_pembelian_tanggal ON pembelian(tanggal);
CREATE INDEX IF NOT EXISTS idx_pembelian_supplier ON pembelian(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pembelian_nomor ON pembelian(nomor_transaksi);
CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal ON penjualan(tanggal);
CREATE INDEX IF NOT EXISTS idx_penjualan_pelanggan ON penjualan(pelanggan_id);
CREATE INDEX IF NOT EXISTS idx_penjualan_nomor ON penjualan(nomor_transaksi);
CREATE INDEX IF NOT EXISTS idx_stok_mutasi_item ON stok_mutasi(item_id);
CREATE INDEX IF NOT EXISTS idx_stok_mutasi_referensi ON stok_mutasi(referensi_tipe, referensi_id);
CREATE INDEX IF NOT EXISTS idx_stok_akhir_item ON stok_akhir(item_id);
`;
