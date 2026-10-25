import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listItems,
  getStokTersedia,
  getUserPermissions
} from '../db';
import { LaporanDetailRow, StokItemRow } from './render-types';
import {
  renderLaporanPenjualan,
  renderLaporanStok,
} from '../render';
import {loginRequired, hasPermission, flash, currentUser } from '../auth';

export function register(app: AppHono) {
  // ---------- laporan penjualan ----------
  app.get(
    '/laporan/penjualan',
    loginRequired(),
    hasPermission('laporan', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const start_date = c.req.query('start_date') || '';
      const end_date = c.req.query('end_date') || '';

      const params: unknown[] = [];
      let sql = `
        SELECT pd.*, p.nomor_transaksi, p.tanggal, pl.nama as pelanggan_nama, i.nama as item_nama
        FROM penjualan_detail pd
        JOIN penjualan p ON pd.penjualan_id = p.id
        JOIN pelanggan pl ON p.pelanggan_id = pl.id
        JOIN items i ON pd.item_id = i.id
        WHERE 1=1
      `;
      if (start_date) {
        sql += ' AND p.tanggal >= ?';
        params.push(start_date);
      }
      if (end_date) {
        sql += ' AND p.tanggal <= ?';
        params.push(end_date);
      }
      sql += ' ORDER BY p.tanggal DESC, p.nomor_transaksi ASC';

      const result = await db.prepare(sql).bind(...params).all<LaporanDetailRow>();
      const details = result.results as LaporanDetailRow[];

      const total_transaksi = new Set(details.map((d) => d.nomor_transaksi)).size;
      const total_item = details.reduce((s, d) => s + d.qty, 0);
      const total_penjualan = details.reduce((s, d) => s + d.subtotal, 0);
      const total_margin = details.reduce((s, d) => s + (d.subtotal - d.harga_pokok * d.qty), 0);

      return c.html(renderLaporanPenjualan({current_user: currentUser(c), 
        details,
        start_date,
        end_date,
        total_transaksi,
        total_item,
        total_penjualan,
        total_margin,
        csrf,
      }));
    },
  );

  // ---------- laporan stok ----------
  app.get(
    '/laporan/stok',
    loginRequired(),
    hasPermission('laporan', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await db.prepare(`
        SELECT i.*, COALESCE(sa.qty_akhir, 0) as qty_akhir, COALESCE(sa.harga_pokok_rata, 0) as harga_pokok_rata
        FROM items i
        LEFT JOIN stok_akhir sa ON i.id = sa.item_id
        ORDER BY i.nama ASC
      `).all<StokItemRow>();

      const items = rows.results as StokItemRow[];
      const total_items = items.length;
      const total_value = items.reduce((s, i) => s + i.qty_akhir * i.harga_pokok_rata, 0);
      const low_stock_count = items.filter((i) => i.qty_akhir > 0 && i.qty_akhir < 10).length;
      const out_of_stock_count = items.filter((i) => i.qty_akhir === 0).length;

      return c.html(renderLaporanStok({current_user: currentUser(c), 
        items,
        total_items,
        total_value,
        low_stock_count,
        out_of_stock_count,
        csrf,
      }));
    },
  );
}
