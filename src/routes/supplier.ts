import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listSupplier,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listKategori,
  getUserPermissions
} from '../db';
import { SupplierRow } from './render-types';
import {
  renderSupplierIndex,
  renderSupplierCreate,
  renderSupplierEdit,
  renderSupplierView,
} from '../render';
import {loginRequired, hasPermission, csrfProtect, flash, currentUser } from '../auth';

function toRows(results: unknown[]): SupplierRow[] {
  return results as SupplierRow[];
}

export function register(app: AppHono) {
  app.get(
    '/supplier',
    loginRequired(),
    hasPermission('supplier', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await listSupplier(db);
      const perms = await getUserPermissions(db, c.get('userId') ?? 0);
      return c.html(renderSupplierIndex({current_user: currentUser(c),  suppliers: toRows(rows), user_perms: perms || {}, csrf }));
    },
  );
  app.get('/supplier/create', loginRequired(), hasPermission('supplier', 'create'), async (c) => {
    const db = c.env.DB;
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const perms = await getUserPermissions(db, c.get('userId') ?? 0);
    return c.html(renderSupplierCreate({current_user: currentUser(c),  user_perms: perms || {}, csrf }));
  });
  app.post('/supplier/create', loginRequired(), hasPermission('supplier', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const nama = String(form.get('nama') || '').trim();
    const kontak = String(form.get('kontak') || '').trim();
    const alamat = String(form.get('alamat') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama supplier wajib diisi!');
    if (kontak.length > 100) errors.push('Kontak maksimal 100 karakter!');
    if (alamat.length > 500) errors.push('Alamat maksimal 500 karakter!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/supplier/create');
    }

    const ok = await createSupplier(db, { nama, kontak: kontak || undefined, alamat: alamat || undefined });
    if (!ok) flash(c, 'error', 'Gagal menyimpan supplier.');
    else flash(c, 'success', 'Supplier berhasil ditambahkan!');
    return c.redirect('/supplier');
  });
  app.get('/supplier/:id', loginRequired(), hasPermission('supplier', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const supplier = await getSupplier(db, id);
    if (!supplier) {
      flash(c, 'error', 'Supplier tidak ditemukan!');
      return c.redirect('/supplier');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const perms = await getUserPermissions(db, c.get('userId') ?? 0);
    return c.html(renderSupplierView({current_user: currentUser(c),  supplier: supplier as SupplierRow, user_perms: perms || {}, csrf }));
  });
  app.get('/supplier/:id/edit', loginRequired(), hasPermission('supplier', 'edit'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const supplier = await getSupplier(db, id);
    if (!supplier) {
      flash(c, 'error', 'Supplier tidak ditemukan!');
      return c.redirect('/supplier');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const perms = await getUserPermissions(db, c.get('userId') ?? 0);
    return c.html(renderSupplierEdit({current_user: currentUser(c),  supplier: supplier as SupplierRow, user_perms: perms || {}, csrf }));
  });
  app.post('/supplier/:id/edit', loginRequired(), hasPermission('supplier', 'edit'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const supplier = await getSupplier(db, id);
    if (!supplier) {
      flash(c, 'error', 'Supplier tidak ditemukan!');
      return c.redirect('/supplier');
    }
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const nama = String(form.get('nama') || '').trim();
    const kontak = String(form.get('kontak') || '').trim();
    const alamat = String(form.get('alamat') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama supplier wajib diisi!');
    if (kontak.length > 100) errors.push('Kontak maksimal 100 karakter!');
    if (alamat.length > 500) errors.push('Alamat maksimal 500 karakter!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect(`/supplier/${id}/edit`);
    }

    const ok = await updateSupplier(db, id, { nama, kontak: kontak || undefined, alamat: alamat || undefined });
    if (!ok) flash(c, 'error', 'Gagal memperbarui supplier.');
    else flash(c, 'success', 'Supplier berhasil diperbarui!');
    return c.redirect('/supplier');
  });
  app.post('/supplier/:id/delete', loginRequired(), hasPermission('supplier', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const supplier = await getSupplier(db, id);
    if (!supplier) {
      flash(c, 'error', 'Supplier tidak ditemukan!');
      return c.redirect('/supplier');
    }
    const count = await db.prepare('SELECT COUNT(*) AS n FROM pembelian WHERE supplier_id = ?').bind(id).first<{ n: number }>();
    if (count && count.n > 0) {
      flash(c, 'error', `Supplier tidak dapat dihapus! Masih ada ${count.n} pembelian yang menggunakan supplier ini.`);
      return c.redirect('/supplier');
    }
    const ok = await deleteSupplier(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus supplier.');
    else flash(c, 'success', 'Supplier berhasil dihapus!');
    return c.redirect('/supplier');
  });
}

