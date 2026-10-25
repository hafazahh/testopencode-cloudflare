import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listPelanggan,
  getPelanggan,
  createPelanggan,
  updatePelanggan,
  deletePelanggan,
  getUserPermissions
} from '../db';
import { PelangganRow } from './render-types';
import {
  renderPelangganIndex,
  renderPelangganCreate,
  renderPelangganEdit,
  renderPelangganView,
} from '../render';
import {loginRequired, hasPermission, csrfProtect, flash, currentUser } from '../auth';

function toRows(results: unknown[]): PelangganRow[] {
  return results as PelangganRow[];
}

export function register(app: AppHono) {
  app.get(
    '/pelanggan',
    loginRequired(),
    hasPermission('pelanggan', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = await listPelanggan(db);
      const perms = await c?.env?.DB ? db.prepare("SELECT r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?").bind(c.get('userId') ?? 0).first() : {};
      return c.html(renderPelangganIndex({current_user: currentUser(c),  pelanggan: toRows(rows), user_perms: perms || {}, csrf }));
    },
  );

  app.get('/pelanggan/:id', loginRequired(), hasPermission('pelanggan', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const pelanggan = await getPelanggan(db, id);
    if (!pelanggan) {
      flash(c, 'error', 'Pelanggan tidak ditemukan!');
      return c.redirect('/pelanggan');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    return c.html(renderPelangganView({current_user: currentUser(c),  pelanggan: pelanggan as PelangganRow, csrf }));
  });

  app.get('/pelanggan/create', loginRequired(), hasPermission('pelanggan', 'create'), async (c) => {
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    return c.html(renderPelangganCreate({current_user: currentUser(c),  csrf }));
  });

  app.post('/pelanggan/create', loginRequired(), hasPermission('pelanggan', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const nama = String(form.get('nama') || '').trim();
    const email = String(form.get('email') || '').trim();
    const telepon = String(form.get('telepon') || '').trim();
    const alamat = String(form.get('alamat') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama pelanggan wajib diisi!');
    if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) errors.push('Format email tidak valid!');
    if (telepon && !/^[0-9+\-\s]+$/.test(telepon)) errors.push('Nomor telepon hanya boleh angka, +, -, dan spasi!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/pelanggan/create');
    }

    const ok = await createPelanggan(db, { nama, email: email || undefined, telepon: telepon || undefined, alamat: alamat || undefined });
    if (!ok) flash(c, 'error', 'Gagal menyimpan pelanggan.');
    else flash(c, 'success', 'Pelanggan berhasil ditambahkan!');
    return c.redirect('/pelanggan');
  });

  app.get('/pelanggan/:id/edit', loginRequired(), hasPermission('pelanggan', 'edit'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const pelanggan = await getPelanggan(db, id);
    if (!pelanggan) {
      flash(c, 'error', 'Pelanggan tidak ditemukan!');
      return c.redirect('/pelanggan');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    return c.html(renderPelangganEdit({current_user: currentUser(c),  pelanggan: pelanggan as PelangganRow, csrf }));
  });

  app.post('/pelanggan/:id/edit', loginRequired(), hasPermission('pelanggan', 'edit'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const pelanggan = await getPelanggan(db, id);
    if (!pelanggan) {
      flash(c, 'error', 'Pelanggan tidak ditemukan!');
      return c.redirect('/pelanggan');
    }
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const nama = String(form.get('nama') || '').trim();
    const email = String(form.get('email') || '').trim();
    const telepon = String(form.get('telepon') || '').trim();
    const alamat = String(form.get('alamat') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama pelanggan wajib diisi!');
    if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) errors.push('Format email tidak valid!');
    if (telepon && !/^[0-9+\-\s]+$/.test(telepon)) errors.push('Nomor telepon hanya boleh angka, +, -, dan spasi!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect(`/pelanggan/${id}/edit`);
    }

    const ok = await updatePelanggan(db, id, { nama, email: email || undefined, telepon: telepon || undefined, alamat: alamat || undefined });
    if (!ok) flash(c, 'error', 'Gagal memperbarui pelanggan.');
    else flash(c, 'success', 'Pelanggan berhasil diperbarui!');
    return c.redirect('/pelanggan');
  });

  app.post('/pelanggan/:id/delete', loginRequired(), hasPermission('pelanggan', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const pelanggan = await getPelanggan(db, id);
    if (!pelanggan) {
      flash(c, 'error', 'Pelanggan tidak ditemukan!');
      return c.redirect('/pelanggan');
    }
    const ok = await deletePelanggan(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus pelanggan.');
    else flash(c, 'success', 'Pelanggan berhasil dihapus!');
    return c.redirect('/pelanggan');
  });
}
