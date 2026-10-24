import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../db';
import { RoleRow } from './render-types';
import {
  renderRolesIndex,
  renderRolesCreate,
  renderRolesEdit,
  renderRolesView,
} from '../render';
import { loginRequired, hasPermission, csrfProtect, flash } from '../auth';

const MENUS = ['items', 'kategori', 'pelanggan', 'users', 'roles', 'supplier', 'pembelian', 'penjualan', 'stok', 'laporan'];
const ACTIONS = ['view', 'create', 'edit', 'delete'];

function rows(results: unknown[]): RoleRow[] {
  return results as RoleRow[];
}

function rolePermKeys(permissions: Record<string, string[]> | undefined, menu: string): string[] {
  return permissions?.[menu]?.filter((a): a is 'view' | 'create' | 'edit' | 'delete' => ACTIONS.includes(a)) ?? [];
}

export function register(app: AppHono) {
  app.get(
    '/roles',
    loginRequired(),
    hasPermission('roles', 'view'),
    async (c) => {
      const db = c.env.DB;
      const session = c.get('session');
      const csrf = session?.csrf_token ?? '';
      const roleRows = await listRoles(db);
      const permsRow = await db.prepare("SELECT r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?")
        .bind(c.get('userId') ?? 0)
        .first();
      const perms = permsRow ? (JSON.parse(String(permsRow.permissions ?? '')) as Record<string, string[]>) : {};
      return c.html(renderRolesIndex({ roles: rows(roleRows), user_perms: perms || {}, csrf }));
    },
  );

  app.get('/roles/:id', loginRequired(), hasPermission('roles', 'view'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const role = await getRoleById(db, id);
    if (!role) {
      flash(c, 'error', 'Role tidak ditemukan!');
      return c.redirect('/roles');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const perms = role.permissions ? JSON.parse(role.permissions) : {};
    const userCount = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE role_id = ?').bind(id).first<{ n: number }>();
    return c.html(renderRolesView({ role: role as RoleRow, permissions: perms, user_count: userCount?.n ?? 0, csrf }));
  });

  app.get('/roles/create', loginRequired(), hasPermission('roles', 'create'), async (c) => {
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    return c.html(renderRolesCreate({ menus: MENUS as never, actions: ACTIONS as never, csrf }));
  });

  app.post('/roles/create', loginRequired(), hasPermission('roles', 'create'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const nama = String(form.get('nama') || '').trim();
    const deskripsi = String(form.get('deskripsi') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama role wajib diisi!');
    else {
      if (nama.length > 50) errors.push('Nama role maksimal 50 karakter!');
      const exist = await db.prepare('SELECT id FROM roles WHERE LOWER(nama) = LOWER(?)').bind(nama).first();
      if (exist) errors.push(`Role '${nama}' sudah ada!`);
    }

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect('/roles/create');
    }

    const permissions: Record<string, string[]> = {};
    for (const menu of MENUS) {
      const selected = form.getAll(`perm_${menu}`) as string[];
      permissions[menu] = selected.filter((a): a is 'view' | 'create' | 'edit' | 'delete' => ACTIONS.includes(a));
    }

    const ok = await createRole(db, { nama, deskripsi: deskripsi || undefined, permissions });
    if (!ok) flash(c, 'error', `Role '${nama}' sudah ada!`);
    else flash(c, 'success', 'Role berhasil ditambahkan!');
    return c.redirect('/roles');
  });

  app.get('/roles/:id/edit', loginRequired(), hasPermission('roles', 'edit'), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const role = await getRoleById(db, id);
    if (!role) {
      flash(c, 'error', 'Role tidak ditemukan!');
      return c.redirect('/roles');
    }
    const session = c.get('session');
    const csrf = session?.csrf_token ?? '';
    const perms = role.permissions ? JSON.parse(role.permissions) : {};
    return c.html(renderRolesEdit({ role: role as RoleRow, permissions: perms, current_perms: perms, menus: MENUS as never, actions: ACTIONS as never, csrf }));
  });

  app.post('/roles/:id/edit', loginRequired(), hasPermission('roles', 'edit'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const role = await getRoleById(db, id);
    if (!role) {
      flash(c, 'error', 'Role tidak ditemukan!');
      return c.redirect('/roles');
    }
    const form = await c.req.parseBody() as Record<string, string> & { get: (key: string) => string; getAll: (name: string) => string[] };
    const nama = String(form.get('nama') || '').trim();
    const deskripsi = String(form.get('deskripsi') || '').trim();

    const errors: string[] = [];
    if (!nama) errors.push('Nama role wajib diisi!');
    else {
      if (nama.length > 50) errors.push('Nama role maksimal 50 karakter!');
      const exist = await db.prepare('SELECT id FROM roles WHERE LOWER(nama) = LOWER(?) AND id != ?').bind(nama, id).first();
      if (exist) errors.push(`Role '${nama}' sudah ada!`);
    }

    if (errors.length > 0) {
      for (const e of errors) flash(c, 'error', e);
      return c.redirect(`/roles/${id}/edit`);
    }

    const permissions: Record<string, string[]> = {};
    for (const menu of MENUS) {
      const selected = form.getAll(`perm_${menu}`) as string[];
      permissions[menu] = selected.filter((a): a is 'view' | 'create' | 'edit' | 'delete' => ACTIONS.includes(a));
    }

    const ok = await updateRole(db, id, { nama, deskripsi: deskripsi || undefined, permissions });
    if (!ok) flash(c, 'error', `Role '${nama}' sudah ada!`);
    else flash(c, 'success', 'Role berhasil diperbarui!');
    return c.redirect('/roles');
  });

  app.post('/roles/:id/delete', loginRequired(), hasPermission('roles', 'delete'), csrfProtect(), async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const role = await getRoleById(db, id);
    if (!role) {
      flash(c, 'error', 'Role tidak ditemukan!');
      return c.redirect('/roles');
    }
    const userCount = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE role_id = ?').bind(id).first<{ n: number }>();
    if ((userCount?.n ?? 0) > 0) {
      flash(c, 'error', `Role tidak dapat dihapus! Masih ada ${userCount?.n} user yang menggunakan role ini.`);
      return c.redirect('/roles');
    }
    const ok = await deleteRole(db, id);
    if (!ok) flash(c, 'error', 'Gagal menghapus role.');
    else flash(c, 'success', 'Role berhasil dihapus!');
    return c.redirect('/roles');
  });
}
