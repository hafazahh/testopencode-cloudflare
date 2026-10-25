import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listPelanggan,
  listItems,
  getItem,
  getStokTersedia,
  createPenjualanTx,
  deletePenjualan,
  getUserPermissions
} from '../db';
import { PenjualanRow, PenjualanDetailRow } from './render-types';
import {
  renderPenjualanIndex,
  renderPenjualanCreate,
  renderPenjualanView,
} from '../render';
import {loginRequired, hasPermission, csrfProtect, flash, currentUser } from '../auth';

function toRows(results: unknown[]): PenjualanRow[] {
  return results as PenjualanRow[];
}

export function register(app: AppHono) {
  app.get(
    '/penjualan',
    loginRequired(),
    hasPermission('penjualan', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await db.prepare(`
        SELECT p.*, pl.nama as pelanggan_nama, u.username as created_by_username
        FROM penjualan p
        JOIN pelanggan pl ON p.pelanggan_id = pl.id
        JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `).all<PenjualanRow>();
      const perms = await getUserPermissions(db, c.get('userId') ?? 0);
      return c.html(renderPenjualanIndex({current_user: currentUser(c),  penjualan: toRows(rows.results), user_perms: perms || {}, csrf }));
    },
  );

  app.get('/penjualan/create', loginRequired(), hasPermission('penjualan', 'create'), async (c) => {
    const db = c.env.DB;
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const pelanggans = await listPelanggan(db);
    const items = await db.prepare(`
      SELECT i.id, i.nama, COALESCE(sa.qty_akhir, 0) as stok_akhir, COALESCE(sa.harga_pokok_rata, 0) as harga_pokok
      FROM items i
      LEFT JOIN stok_akhir sa ON i.id = sa.item_id
      ORDER BY i.nama
    `).all();
    return c.html(renderPenjualanCreate({current_user: currentUser(c), 
      pelanggans: pelanggans.map((p) => ({ id: p.id, nama: p.nama })),
      items: items.results as { id: number; nama: string; stok_akhir: number; harga_pokok: number }[],
      csrf,
    }));
  });

  app.post('/penjualan/create', loginRequired(), hasPermission('penjualan', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.formData();
    const pelanggan_id = Number(form.get('pelanggan_id') || 0);
    const tanggal = String(form.get('tanggal') || '').trim();
    const catatan = String(form.get('catatan') || '').trim();

    const errors: string[] = [];
    if (!pelanggan_id) errors.push('Pelanggan wajib dipilih!');
    if (!tanggal) errors.push('Tanggal wajib diisi!');

    const itemIds = form.getAll('item_id[]').map(Number).filter((n): n is number => Number.isInteger(n) && n > 0);
    const qtys = form.getAll('qty[]').map(Number);
    const hargas = form.getAll('harga_jual[]').map(Number);

    const validItems: { item_id: number; qty: number; harga_jual: number }[] = [];
    for (let i = 0; i < itemIds.length; i += 1) {
      const itemId = itemIds[i];
      const qty = qtys[i] ?? 0;
      const harga = hargas[i] ?? 0;
      if (!qty || qty <= 0) { errors.push(`Item ${i + 1}: Qty harus lebih dari 0!`); continue; }
      if (harga < 0) { errors.push(`Item ${i + 1}: Harga jual tidak boleh negatif!`); continue; }
      const item = await getItem(db, itemId);
      if (!item) { errors.push(`Item ${i + 1} tidak valid!`); continue; }
      const stok = await getStokTersedia(db, itemId);
      if (stok < qty) { errors.push(`Item ${i + 1}: Stok tidak cukup. Tersedia: ${stok}, Diminta: ${qty}`); continue; }
      validItems.push({ item_id: itemId, qty, harga_jual: harga });
    }

    if (pelanggan_id && !(await listPelanggan(db)).some((p) => p.id === pelanggan_id)) errors.push('Pelanggan tidak valid!');
    if (validItems.length === 0 && errors.length === 0) errors.push('Minimal 1 item harus ditambahkan!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/penjualan/create');
    }

    const { nomor, id } = await createPenjualanTx(db, {
      pelanggan_id,
      tanggal,
      catatan: catatan || undefined,
      items: validItems,
      userId: c.get('userId') ?? 0,
    });
    flash(c, 'success', `Penjualan ${nomor} berhasil dibuat!`);
    return c.redirect(`/penjualan/${id}`);
  });

  app.get('/penjualan/:id', loginRequired(), hasPermission('penjualan', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const penjualan = await db.prepare(`
      SELECT p.*, pl.nama as pelanggan_nama, u.username as created_by_username
      FROM penjualan p
      JOIN pelanggan pl ON p.pelanggan_id = pl.id
      JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).bind(id).first<PenjualanRow>();
    if (!penjualan) {
      flash(c, 'error', 'Penjualan tidak ditemukan!');
      return c.redirect('/penjualan');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const detail = await db.prepare(`
      SELECT pd.*, i.nama as item_nama
      FROM penjualan_detail pd
      JOIN items i ON pd.item_id = i.id
      WHERE pd.penjualan_id = ?
    `).bind(id).all<PenjualanDetailRow>();
    return c.html(renderPenjualanView({current_user: currentUser(c),  penjualan: penjualan as PenjualanRow, detail: detail.results as PenjualanDetailRow[], csrf }));
  });

  app.post('/penjualan/:id/delete', loginRequired(), hasPermission('penjualan', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const penjualan = await db.prepare('SELECT id FROM penjualan WHERE id = ?').bind(id).first();
    if (!penjualan) {
      flash(c, 'error', 'Penjualan tidak ditemukan!');
      return c.redirect('/penjualan');
    }
    const ok = await deletePenjualan(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus penjualan.');
    else flash(c, 'success', 'Penjualan berhasil dihapus!');
    return c.redirect('/penjualan');
  });
}
