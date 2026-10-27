import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  listKategori,
  getUserPermissions
} from '../db';
import { ItemRow } from './render-types';
import {
  renderIndex,
  renderViewItem,
  renderCreateItem,
  renderEditItem,
} from '../render';
import {loginRequired, hasPermission, csrfProtect, flash, currentUser } from '../auth';

function itemRows(results: unknown[]): ItemRow[] {
  return results as ItemRow[];
}

export function register(app: AppHono) {
  // ---------- item ----------
  app.get(
    '/',
    loginRequired(),
    hasPermission('items', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await db.prepare('SELECT * FROM items ORDER BY id DESC').all<ItemRow>();
      const perms = await getUserPermissions(db, c.get('userId') ?? 0);
      return c.html(renderIndex({current_user: currentUser(c),  items: itemRows(rows.results), user_perms: perms || {}, csrf }));
    },
  );
  app.get(
    '/item/create',
    loginRequired(),
    hasPermission('items', 'create'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await listKategori(db);
      return c.html(renderCreateItem({current_user: currentUser(c), 
        categories: rows.map((r) => ({ nama: r.nama })),
        csrf,
      }));
    },
  );

  app.post(
    '/item/create',
    loginRequired(),
    hasPermission('items', 'create'),
    csrfProtect(),
    async (c) => {
      const db = c.env.DB;
      const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
      const nama = String(form.get('nama') || '').trim();
      const category = String(form.get('category') || '').trim();
      const harga_pokok = parseFloat(String(form.get('harga_pokok') || '0'));
      const harga_jual = parseFloat(String(form.get('harga_jual') || '0'));

      const errors: string[] = [];
      if (!nama) errors.push('Nama item wajib diisi!');
      if (!category) errors.push('Kategori wajib dipilih!');
      else {
        const valid = await db.prepare('SELECT nama FROM kategori').all();
        if (!valid.results.some((r) => (r as { nama: string }).nama === category)) {
          errors.push('Kategori tidak valid!');
        }
      }
      if (Number.isNaN(harga_pokok)) errors.push('Harga harus berupa angka!');
      if (Number.isNaN(harga_jual)) errors.push('Harga harus berupa angka!');
      if (harga_pokok < 0 || harga_jual < 0) errors.push('Harga tidak boleh negatif!');

      if (errors.length > 0) {
        for (const e of errors) flash(c, 'error', e);
        return c.redirect('/item/create');
      }

      const ok = await createItem(db, { nama, harga_pokok, harga_jual, category });
      if (!ok) { flash(c, 'error', 'Gagal menyimpan item.'); }
      else { flash(c, 'success', 'Item berhasil ditambahkan!'); }
      return c.redirect('/');
    },
  );
  app.get(
    '/item/:id',
    loginRequired(),
    hasPermission('items', 'view'),
    async (c) => {
      const db = c.env.DB;
      const id = Number(c.req.param('id'));
      const item = await getItem(db, id);
      if (!item) {
        flash(c, 'error', 'Item tidak ditemukan!');
        return c.redirect('/');
      }
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      return c.html(renderViewItem({current_user: currentUser(c),  item: item as ItemRow, csrf }));
    },
  );
  app.get(
    '/item/:id/edit',
    loginRequired(),
    hasPermission('items', 'edit'),
    async (c) => {
      const db = c.env.DB;
      const id = Number(c.req.param('id'));
      const item = await getItem(db, id);
      if (!item) {
        flash(c, 'error', 'Item tidak ditemukan!');
        return c.redirect('/');
      }
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await listKategori(db);
      return c.html(renderEditItem({current_user: currentUser(c),  item: item as ItemRow, categories: rows.map((r) => ({ nama: r.nama })), csrf }));
    },
  );
  app.post(
    '/item/:id/edit',
    loginRequired(),
    hasPermission('items', 'edit'),
    csrfProtect(),
    async (c) => {
      const db = c.env.DB;
      const id = Number(c.req.param('id'));
      const item = await getItem(db, id);
      if (!item) {
        flash(c, 'error', 'Item tidak ditemukan!');
        return c.redirect('/');
      }
      const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
      const nama = String(form.get('nama') || '').trim();
      const category = String(form.get('category') || '').trim();
      const harga_pokok = parseFloat(String(form.get('harga_pokok') || '0'));
      const harga_jual = parseFloat(String(form.get('harga_jual') || '0'));

      const errors: string[] = [];
      if (!nama) errors.push('Nama item wajib diisi!');
      if (Number.isNaN(harga_pokok)) errors.push('Harga harus berupa angka!');
      if (Number.isNaN(harga_jual)) errors.push('Harga harus berupa angka!');
      if (harga_pokok < 0 || harga_jual < 0) errors.push('Harga tidak boleh negatif!');

      if (errors.length > 0) {
        for (const e of errors) flash(c, 'error', e);
        return c.redirect(`/item/${id}/edit`);
      }

      const ok = await updateItem(db, id, { nama, harga_pokok, harga_jual, category });
      if (!ok) { flash(c, 'error', 'Gagal memperbarui item.'); }
      else { flash(c, 'success', 'Item berhasil diperbarui!'); }
      return c.redirect('/');
    },
  );
  app.post(
    '/item/:id/delete',
    loginRequired(),
    hasPermission('items', 'delete'),
    csrfProtect(),
    async (c) => {
      const db = c.env.DB;
      const id = Number(c.req.param('id'));
      const item = await getItem(db, id);
      if (!item) {
        flash(c, 'error', 'Item tidak ditemukan!');
        return c.redirect('/');
      }
      const ok = await deleteItem(db, id);
      if (!ok) { flash(c, 'error', 'Gagal menghapus item.'); }
      else { flash(c, 'success', 'Item berhasil dihapus!'); }
      return c.redirect('/');
    },
  );
}

