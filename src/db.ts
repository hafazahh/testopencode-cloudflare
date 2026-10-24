/**
 * SKELETON Fase B — data layer testopencode.
 *
 * Belum ada query. Fase C mengisi file ini (dan `src/schema.ts`) dengan port
 * dari `app.py` + `database.db` repo Flask:
 *   - 13 tabel: items, kategori, pelanggan, supplier, pembelian,
 *     pembelian_detail, penjualan, penjualan_detail, stok_akhir, stok_mutasi,
 *     users, roles
 *   - D1 tidak punya `PRAGMA journal_mode` / koneksi per-request
 *   - `margin` di Flask adalah `GENERATED ALWAYS AS` — perlu diperiksa
 *     kompatibilitasnya dengan D1
 */

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  SITE_URL: string;
}

/** Placeholder sampai Fase C mendefinisikan skema D1. */
export async function initDb(_db: D1Database): Promise<void> {
  // no-op
}
