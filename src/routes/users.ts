import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listUsers,
  getUserById,
  createUser as insertUser,
  updateUser,
  deleteUser,
  listRoles,
  getUserPermissions
} from '../db';
import { UserRow } from './render-types';
import {
  renderUsersIndex,
  renderUsersCreate,
  renderUsersEdit,
  renderUsersView,
} from '../render';
import {loginRequired, hasPermission, csrfProtect, flash, currentUser } from '../auth';
import { hashPassword } from '../auth';

function toRows(results: unknown[]): UserRow[] {
  return results as UserRow[];
}

export function register(app: AppHono) {
  app.get(
    '/users',
    loginRequired(),
    hasPermission('users', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const rows = (await db.prepare('SELECT u.*, r.nama as role_nama FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id DESC').all<UserRow>()).results;
      const permsRow = await db.prepare("SELECT r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?").bind(c.get('userId') ?? 0).first();
      const perms = permsRow ? (JSON.parse(String(permsRow.permissions ?? '')) as Record<string, string[]>) : {};
      // current_user_id: supaya renderUsersIndex bisa menyembunyikan tombol
      // Hapus di baris user yang sedang login (lihat Temuan 2 di render.ts).
      return c.html(renderUsersIndex({current_user: currentUser(c),  users: toRows(rows), user_perms: perms || {}, csrf, current_user_id: c.get('userId') ?? undefined }));
    },
  );
  app.get('/users/create', loginRequired(), hasPermission('users', 'create'), async (c) => {
    const db = c.env.DB;
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const roles = await listRoles(db);
    return c.html(renderUsersCreate({current_user: currentUser(c),  roles: roles.map((r) => ({ id: r.id, nama: r.nama })), csrf }));
  });
  app.post('/users/create', loginRequired(), hasPermission('users', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    const role_id = Number(form.get('role_id') || 0);

    const errors: string[] = [];
    if (!username) errors.push('Username wajib diisi!');
    else {
      if (username.length < 3) errors.push('Username minimal 3 karakter!');
      if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.push('Username hanya boleh huruf, angka, dan underscore!');
    }
    if (!password) errors.push('Password wajib diisi!');
    else if (password.length < 6) errors.push('Password minimal 6 karakter!');
    if (!role_id) errors.push('Role wajib dipilih!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/users/create');
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existing) {
      flash(c, 'error', `Username '${username}' sudah digunakan!`);
      return c.redirect('/users/create');
    }

    const hash = await hashPassword(password);
    const ok = await insertUser(db, { username, password_hash: hash, role_id });
    if (!ok) flash(c, 'error', 'Gagal menyimpan user.');
    else flash(c, 'success', 'User berhasil ditambahkan!');
    return c.redirect('/users');
  });
  app.get('/users/:id', loginRequired(), hasPermission('users', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const user = await getUserById(db, id);
    if (!user) {
      flash(c, 'error', 'User tidak ditemukan!');
      return c.redirect('/users');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const role = await db.prepare('SELECT nama as role_nama FROM roles WHERE id = ?').bind(user.role_id).first();
    const userView = {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      created_at: user.created_at,
      role_nama: role?.role_nama ?? '',
    } as UserRow;
    return c.html(renderUsersView({current_user: currentUser(c),  user: userView, csrf }));
  });
  app.get('/users/:id/edit', loginRequired(), hasPermission('users', 'edit'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const user = await getUserById(db, id);
    if (!user) {
      flash(c, 'error', 'User tidak ditemukan!');
      return c.redirect('/users');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const roles = await listRoles(db);
    const userView: UserRow = {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      created_at: user.created_at,
      role_nama: '',
    };
    return c.html(renderUsersEdit({current_user: currentUser(c),  user: userView, roles: roles.map((r) => ({ id: r.id, nama: r.nama })), csrf }));
  });
  app.post('/users/:id/edit', loginRequired(), hasPermission('users', 'edit'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const user = await getUserById(db, id);
    if (!user) {
      flash(c, 'error', 'User tidak ditemukan!');
      return c.redirect('/users');
    }
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    const role_id = Number(form.get('role_id') || 0);

    const errors: string[] = [];
    if (!username) errors.push('Username wajib diisi!');
    else {
      if (username.length < 3) errors.push('Username minimal 3 karakter!');
      if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.push('Username hanya boleh huruf, angka, dan underscore!');
    }
    if (password && password.length < 6) errors.push('Password minimal 6 karakter!');
    if (!role_id) errors.push('Role wajib dipilih!');

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect(`/users/${id}/edit`);
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(username, id).first();
    if (existing) {
      flash(c, 'error', `Username '${username}' sudah digunakan!`);
      return c.redirect(`/users/${id}/edit`);
    }

    if (password) {
      const ok = await updateUser(db, id, { username, role_id, password_hash: await hashPassword(password) });
      flash(c, 'success', 'User berhasil diperbarui!');
    } else {
      const ok = await updateUser(db, id, { username, role_id });
      flash(c, 'success', 'User berhasil diperbarui!');
    }
    return c.redirect('/users');
  });
  app.post('/users/:id/delete', loginRequired(), hasPermission('users', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    if (id === c.get('userId')) {
      flash(c, 'error', 'Anda tidak dapat menghapus akun sendiri!');
      return c.redirect('/users');
    }
    const user = await getUserById(db, id);
    if (!user) {
      flash(c, 'error', 'User tidak ditemukan!');
      return c.redirect('/users');
    }
    const ok = await deleteUser(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus user.');
    else flash(c, 'success', 'User berhasil dihapus!');
    return c.redirect('/users');
  });
}

