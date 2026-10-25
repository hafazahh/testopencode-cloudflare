import { Hono } from 'hono';
import type { AppHono } from '../context';
import { listMutasiByItem } from '../db';
import { StokItemRow, MutasiRow } from './render-types';
import { renderStokKartu } from '../render';
import {loginRequired, hasPermission, flash, currentUser } from '../auth';

export function register(app: AppHono) {
  app.get(
    '/stok/kartu',
    loginRequired(),
    hasPermission('stok', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const itemId = c.req.query('item_id') ? Number(c.req.query('item_id')) : null;

      const itemsRes = await db.prepare(`
        SELECT i.*, COALESCE(sa.qty_akhir, 0) as qty_akhir, COALESCE(sa.harga_pokok_rata, 0) as harga_pokok_rata
        FROM items i
        LEFT JOIN stok_akhir sa ON i.id = sa.item_id
        ORDER BY i.id
      `).all<StokItemRow>();

      let selected: StokItemRow | null = null;
      let mutasi: MutasiRow[] = [];
      if (itemId && itemsRes.results) {
        selected = itemsRes.results.find((r) => r.id === itemId) ?? null;
      }
      if (!selected && itemsRes.results && itemsRes.results.length > 0) {
        selected = itemsRes.results[0];
      }
      if (selected) {
        mutasi = await listMutasiByItem(db, selected.id);
      }

      return c.html(renderStokKartu({current_user: currentUser(c), 
        items: itemsRes.results as StokItemRow[],
        selected_item: selected as StokItemRow,
        mutasi,
        csrf,
      }));
    },
  );
}
