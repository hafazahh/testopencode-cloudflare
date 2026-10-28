import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listSupplier,
  listItems,
  getItem,
  getSupplier as getSupplierRow,
  createPembelianTx,
  deletePembelian,
  getUserPermissions
} from '../db';
import { PembelianRow, PembelianDetailRow } from './render-types';
import {
  renderPembelianIndex,
  renderPembelianCreate,
  renderPembelianView,
} from '../render';
import {loginRequired, hasPermission, csrfProtect, flash, currentUser } from '../auth';

function toRows(results: unknown[]): PembelianRow[] {
  return results as PembelianRow[];
}

export function register(app: AppHono) {
  app.get(
    '/pembelian',
    loginRequired(),
    hasPermission('pembelian', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await db.prepare(`
        SELECT p.*, s.nama as supplier_nama, u.username as created_by_username
        FROM pembelian p
        JOIN supplier s ON p.supplier_id = s.id
        JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `).all<PembelianRow>();
      const perms = await getUserPermissions(db, c.get('userId') ?? 0);
      return c.html(renderPembelianIndex({current_user: currentUser(c),  pembelian: toRows(rows.results), user_perms: perms || {}, csrf }));
    },
  );

  app.get('/pembelian/create', loginRequired(), hasPermission('pembelian', 'create'), async (c) => {
    const db = c.env.DB;
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    // Dropdown supplier sebelumnya selalu KOSONG: handler hanya query `items`
    // lalu render hanya mengisi pilihan item di baris detail. Form memakai
    // supplier_id ber-`required`, jadi tidak bisa disubmit sama sekali.
    // Kini supplier diambil dari tabel supplier (listSupplier) dan dikirim ke
    // renderPembelianCreate sebagai prop `suppliers`.
    const [items, suppliers] = await Promise.all([
      db.prepare('SELECT id, nama, harga_pokok FROM items ORDER BY nama').all(),
      listSupplier(db),
    ]);
    const perms = await getUserPermissions(db, c.get('userId') ?? 0);
    return c.html(renderPembelianCreate({current_user: currentUser(c), 
      items: items.results as { id: number; nama: string; harga_pokok: number }[],
      suppliers: suppliers.map((s) => ({ id: s.id, nama: s.nama })),
      user_perms: perms || {},
      csrf,
    }));
  });

  app.post('/pembelian/create', loginRequired(), hasPermission('pembelian', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.formData();
    const supplier_id = Number(form.get('supplier_id') || 0);
    const tanggal = String(form.get('tanggal') || '').trim();
    const catatan = String(form.get('catatan') || '').trim();

    const errors: string[] = [];
    if (!supplier_id) errors.push('Supplier wajib dipilih!');
    if (!tanggal) errors.push('Tanggal wajib diisi!');

    const itemIds = form.getAll('item_id[]').map(Number).filter((n): n is number => Number.isInteger(n) && n > 0);
    const qtys = form.getAll('qty[]').map(Number);
    const hargas = form.getAll('harga_beli[]').map(Number);

    const validItems: { item_id: number; qty: number; harga_beli: number }[] = [];
    for (let i = 0; i < itemIds.length; i += 1) {
      const itemId = itemIds[i];
      const qty = qtys[i] ?? 0;
      const harga = hargas[i] ?? 0;
      if (!qty || qty <= 0) { errors.push(`Item ${i + 1}: Qty harus lebih dari 0!`); continue; }
      if (harga < 0) { errors.push(`Item ${i + 1}: Harga beli tidak boleh negatif!`); continue; }
      const item = await getItem(db, itemId);
      if (!item) { errors.push(`Item ${i + 1} tidak valid!`); continue; }
      validItems.push({ item_id: itemId, qty, harga_beli: harga });
    }

    if (supplier_id && !(await getSupplierRow(db, supplier_id))) errors.push('Supplier tidak valid!');
    if (validItems.length === 0 && errors.length === 0) errors.push('Minimal 1 item harus ditambahkan!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/pembelian/create');
    }

    const { nomor, id } = await createPembelianTx(db, {
      supplier_id,
      tanggal,
      catatan: catatan || undefined,
      items: validItems,
      userId: c.get('userId') ?? 0,
    });
    flash(c, 'success', `Pembelian ${nomor} berhasil dibuat!`);
    return c.redirect(`/pembelian/${id}`);
  });

  app.get('/pembelian/:id', loginRequired(), hasPermission('pembelian', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const pembelian = await db.prepare(`
      SELECT p.*, s.nama as supplier_nama, u.username as created_by_username
      FROM pembelian p
      JOIN supplier s ON p.supplier_id = s.id
      JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).bind(id).first<PembelianRow>();
    if (!pembelian) {
      flash(c, 'error', 'Pembelian tidak ditemukan!');
      return c.redirect('/pembelian');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const detail = await db.prepare(`
      SELECT pd.*, i.nama as item_nama
      FROM pembelian_detail pd
      JOIN items i ON pd.item_id = i.id
      WHERE pd.pembelian_id = ?
    `).bind(id).all<PembelianDetailRow>();
    const perms = await getUserPermissions(db, c.get('userId') ?? 0);
    return c.html(renderPembelianView({current_user: currentUser(c),  pembelian: pembelian as PembelianRow, detail: detail.results as PembelianDetailRow[], user_perms: perms || {}, csrf }));
  });

  app.post('/pembelian/:id/delete', loginRequired(), hasPermission('pembelian', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const pembelian = await db.prepare('SELECT id FROM pembelian WHERE id = ?').bind(id).first();
    if (!pembelian) {
      flash(c, 'error', 'Pembelian tidak ditemukan!');
      return c.redirect('/pembelian');
    }
    const ok = await deletePembelian(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus pembelian.');
    else flash(c, 'success', 'Pembelian berhasil dihapus!');
    return c.redirect('/pembelian');
  });
}
