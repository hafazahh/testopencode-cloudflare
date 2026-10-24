import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listKategori,
  getKategori,
  createKategori,
  updateKategori,
  deleteKategori,
  getUserPermissions
} from '../db';
import { KategoriRow } from './render-types';
import {
  renderKategoriIndex,
  renderKategoriCreate,
  renderKategoriEdit,
  renderKategoriView,
} from '../render';
import { loginRequired, hasPermission, csrfProtect, flash } from '../auth';

function toRows(results: unknown[]): KategoriRow[] {
  return results as KategoriRow[];
}

export function register(app: AppHono) {
  app.get(
    '/kategori',
    loginRequired(),
    hasPermission('kategori', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await listKategori(db);
      const perms = await getUserPermissions(db, c.get('userId') ?? 0);
      return c.html(renderKategoriIndex({ kategori: toRows(rows), user_perms: perms || {}, csrf }));
    },
  );

  app.get('/kategori/:id', loginRequired(), hasPermission('kategori', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const kategori = await getKategori(db, id);
    if (!kategori) {
      flash(c, 'error', 'Kategori tidak ditemukan!');
      return c.redirect('/kategori');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const itemCount = await db.prepare('SELECT COUNT(*) AS n FROM items WHERE category = ?').bind(kategori.nama).first();
    return c.html(renderKategoriView({ kategori: kategori as KategoriRow, item_count: itemCount?.n ?? 0, csrf }));
  });

  app.get('/kategori/create', loginRequired(), hasPermission('kategori', 'create'), async (c) => {
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    return c.html(renderKategoriCreate({ csrf }));
  });

  app.post('/kategori/create', loginRequired(), hasPermission('kategori', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.formBody();
    const nama = String(form.get('nama') || '').trim();
    const deskripsi = String(form.get('deskripsi') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama kategori wajib diisi!');
    else {
      if (nama.length > 100) errors.push('Nama kategori maksimal 100 karakter!');
      if (deskripsi.length > 500) errors.push('Deskripsi maksimal 500 karakter!');
      const exist = await db.prepare('SELECT id FROM kategori WHERE LOWER(nama) = LOWER(?)').bind(nama).first();
      if (exist) errors.push(`Kategori '${nama}' sudah ada!`);
    }

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/kategori/create');
    }

    const ok = await createKategori(db, { nama, deskripsi: deskripsi || undefined });
    if (!ok) flash(c, 'error', 'Gagal menyimpan kategori.');
    else flash(c, 'success', 'Kategori berhasil ditambahkan!');
    return c.redirect('/kategori');
  });

  app.get('/kategori/:id/edit', loginRequired(), hasPermission('kategori', 'edit'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const kategori = await getKategori(db, id);
    if (!kategori) {
      flash(c, 'error', 'Kategori tidak ditemukan!');
      return c.redirect('/kategori');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    return c.html(renderKategoriEdit({ kategori: kategori as KategoriRow, csrf }));
  });

  app.post('/kategori/:id/edit', loginRequired(), hasPermission('kategori', 'edit'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const kategori = await getKategori(db, id);
    if (!kategori) {
      flash(c, 'error', 'Kategori tidak ditemukan!');
      return c.redirect('/kategori');
    }
    const form = await c.req.formBody();
    const nama = String(form.get('nama') || '').trim();
    const deskripsi = String(form.get('deskripsi') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama kategori wajib diisi!');
    else {
      if (nama.length > 100) errors.push('Nama kategori maksimal 100 karakter!');
      if (deskripsi.length > 500) errors.push('Deskripsi maksimal 500 karakter!');
      const exist = await db.prepare('SELECT id FROM kategori WHERE LOWER(nama) = LOWER(?) AND id != ?').bind(nama, id).first();
      if (exist) errors.push(`Kategori '${nama}' sudah ada!`);
    }

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect(`/kategori/${id}/edit`);
    }

    const ok = await updateKategori(db, id, { nama, deskripsi: deskripsi || undefined });
    if (!ok) flash(c, 'error', 'Gagal memperbarui kategori.');
    else flash(c, 'success', 'Kategori berhasil diperbarui!');
    return c.redirect('/kategori');
  });

  app.post('/kategori/:id/delete', loginRequired(), hasPermission('kategori', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const kategori = await getKategori(db, id);
    if (!kategori) {
      flash(c, 'error', 'Kategori tidak ditemukan!');
      return c.redirect('/kategori');
    }
    const itemCount = await db.prepare('SELECT COUNT(*) AS n FROM items WHERE category = ?').bind(kategori.nama).first<{ n: number }>();
    if ((itemCount?.n ?? 0) > 0) {
      flash(c, 'error', `Kategori tidak dapat dihapus! Masih ada ${itemCount?.n} item yang menggunakan kategori ini.`);
      return c.redirect('/kategori');
    }
    const ok = await deleteKategori(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus kategori.');
    else flash(c, 'success', 'Kategori berhasil dihapus!');
    return c.redirect('/kategori');
  });
}
