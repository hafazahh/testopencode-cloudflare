import type { D1Database } from '@cloudflare/workers-types';
export type { D1Database } from '@cloudflare/workers-types';
import type { MutasiRow } from './routes/render-types';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  SITE_URL: string;
}

export interface SessionRow {
  id: string;
  user_id: number | null;
  csrf_token: string;
  expires_at: number;
  created_at: string;
}

// ---------- interfaces (disejamasikan dengan schema.ts) ----------

export interface Item {
  id: number;
  nama: string;
  harga_pokok: number;
  harga_jual: number;
  margin: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Kategori {
  id: number;
  nama: string;
  deskripsi: string;
  created_at: string;
}

export interface Pelanggan {
  id: number;
  nama: string;
  email: string;
  telepon: string;
  alamat: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  nama: string;
  kontak: string;
  alamat: string;
  created_at: string;
  updated_at: string;
}

// ---------- items ----------

export async function listItems(db: D1Database): Promise<Item[]> {
  const r = await db.prepare('SELECT * FROM items ORDER BY id').all<Item>();
  return r.results;
}

export async function getItem(db: D1Database, id: number): Promise<Item | null> {
  const r = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Item>();
  return r;
}

export async function createItem(db: D1Database, data: {
  nama: string;
  harga_pokok: number;
  harga_jual: number;
  category: string;
}): Promise<boolean> {
  const r = await db
    .prepare('INSERT INTO items (nama, harga_pokok, harga_jual, category) VALUES (?, ?, ?, ?)')
    .bind(data.nama, data.harga_pokok, data.harga_jual, data.category)
    .run();
  return r.success;
}

export async function updateItem(
  db: D1Database,
  id: number,
  data: { nama?: string; harga_pokok?: number; harga_jual?: number; category?: string },
): Promise<boolean> {
  const set = [
    data.nama !== undefined && 'nama = ?',
    data.harga_pokok !== undefined && 'harga_pokok = ?',
    data.harga_jual !== undefined && 'harga_jual = ?',
    data.category !== undefined && 'category = ?',
  ]
    .filter(Boolean)
    .join(', ');

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE items SET ${set} WHERE id = ?`)
    .bind(
      data.nama ?? '',
      data.harga_pokok ?? 0,
      data.harga_jual ?? 0,
      data.category ?? '',
      id,
    )
    .run();
  return r.success;
}

export async function deleteItem(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
  return r.success;
}

// ---------- kategori ----------

export async function listKategori(db: D1Database): Promise<Kategori[]> {
  const r = await db.prepare('SELECT * FROM kategori ORDER BY nama').all<Kategori>();
  return r.results;
}

export async function getKategori(db: D1Database, id: number): Promise<Kategori | null> {
  const r = await db.prepare('SELECT * FROM kategori WHERE id = ?').bind(id).first<Kategori>();
  return r;
}

export async function createKategori(db: D1Database, data: { nama: string; deskripsi?: string }): Promise<boolean> {
  const r = await db
    .prepare('INSERT INTO kategori (nama, deskripsi) VALUES (?, ?)')
    .bind(data.nama, data.deskripsi ?? null)
    .run();
  return r.success;
}

export async function updateKategori(
  db: D1Database,
  id: number,
  data: { nama?: string; deskripsi?: string },
): Promise<boolean> {
  const set = [
    data.nama !== undefined && 'nama = ?',
    data.deskripsi !== undefined && 'deskripsi = ?',
  ]
    .filter(Boolean)
    .join(', ');

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE kategori SET ${set} WHERE id = ?`)
    .bind(data.nama ?? '', data.deskripsi ?? null, id)
    .run();
  return r.success;
}

export async function deleteKategori(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare('DELETE FROM kategori WHERE id = ?').bind(id).run();
  return r.success;
}

// ---------- pelanggan ----------

export async function listPelanggan(db: D1Database): Promise<Pelanggan[]> {
  const r = await db.prepare('SELECT * FROM pelanggan ORDER BY id').all<Pelanggan>();
  return r.results;
}

export async function getPelanggan(db: D1Database, id: number): Promise<Pelanggan | null> {
  const r = await db.prepare('SELECT * FROM pelanggan WHERE id = ?').bind(id).first<Pelanggan>();
  return r;
}

export async function createPelanggan(db: D1Database, data: {
  nama: string;
  email?: string;
  telepon?: string;
  alamat?: string;
}): Promise<boolean> {
  const r = await db
    .prepare('INSERT INTO pelanggan (nama, email, telepon, alamat) VALUES (?, ?, ?, ?)')
    .bind(data.nama, data.email ?? null, data.telepon ?? null, data.alamat ?? null)
    .run();
  return r.success;
}

export async function updatePelanggan(
  db: D1Database,
  id: number,
  data: { nama?: string; email?: string; telepon?: string; alamat?: string },
): Promise<boolean> {
  const set = [
    data.nama !== undefined && 'nama = ?',
    data.email !== undefined && 'email = ?',
    data.telepon !== undefined && 'telepon = ?',
    data.alamat !== undefined && 'alamat = ?',
  ]
    .filter(Boolean)
    .join(', ');

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE pelanggan SET ${set} WHERE id = ?`)
    .bind(data.nama ?? '', data.email ?? null, data.telepon ?? null, data.alamat ?? null, id)
    .run();
  return r.success;
}

export async function deletePelanggan(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare('DELETE FROM pelanggan WHERE id = ?').bind(id).run();
  return r.success;
}

// ---------- supplier ----------

export async function listSupplier(db: D1Database): Promise<Supplier[]> {
  const r = await db.prepare('SELECT * FROM supplier ORDER BY id').all<Supplier>();
  return r.results;
}

export async function getSupplier(db: D1Database, id: number): Promise<Supplier | null> {
  const r = await db.prepare('SELECT * FROM supplier WHERE id = ?').bind(id).first<Supplier>();
  return r;
}

export async function createSupplier(db: D1Database, data: {
  nama: string;
  kontak?: string;
  alamat?: string;
}): Promise<boolean> {
  const r = await db
    .prepare('INSERT INTO supplier (nama, kontak, alamat) VALUES (?, ?, ?)')
    .bind(data.nama, data.kontak ?? null, data.alamat ?? null)
    .run();
  return r.success;
}

export async function updateSupplier(
  db: D1Database,
  id: number,
  data: { nama?: string; kontak?: string; alamat?: string },
): Promise<boolean> {
  const set = [
    data.nama !== undefined && 'nama = ?',
    data.kontak !== undefined && 'kontak = ?',
    data.alamat !== undefined && 'alamat = ?',
  ]
    .filter(Boolean)
    .join(', ');

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE supplier SET ${set} WHERE id = ?`)
    .bind(data.nama ?? '', data.kontak ?? null, data.alamat ?? null, id)
    .run();
  return r.success;
}

export async function deleteSupplier(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare('DELETE FROM supplier WHERE id = ?').bind(id).run();
  return r.success;
}

// ---------- init ----------

export async function initDb(db: D1Database): Promise<void> {
  // Schema telah berjalan idempotent (CREATE TABLE IF NOT EXISTS) di seed.mjs.
  // Fungsi ini masih disediakan sebagai night-of guard di worker.
}

// ============ TAMBAHAN Fase C2: pengguna, role, transaksi (PEMBELIAN / PENJUALAN) ============

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role_id: number;
  created_at: string;
}

export interface RoleRow {
  id: number;
  nama: string;
  deskripsi: string;
  permissions: string;
  created_at: string;
}

export interface PembelianRow {
  id: number;
  supplier_id: number;
  nomor_transaksi: string;
  tanggal: string;
  catatan: string;
  total: number;
  created_by: number;
  created_at: string;
}

export interface PembelianDetailRow {
  id: number;
  pembelian_id: number;
  item_id: number;
  qty: number;
  harga_beli: number;
  subtotal: number;
}

export interface PenjualanRow {
  id: number;
  pelanggan_id: number;
  nomor_transaksi: string;
  tanggal: string;
  catatan: string;
  total: number;
  created_by: number;
  created_at: string;
}

export interface PenjualanDetailRow {
  id: number;
  penjualan_id: number;
  item_id: number;
  qty: number;
  harga_jual: number;
  harga_pokok: number;
  subtotal: number;
}

export interface StokMutasiRow {
  id: number;
  item_id: number;
  jenis_mutasi: string;
  qty: number;
  harga: number;
  saldo_berjalan: number;
  referensi_tipe: string;
  referensi_id: number;
  nomor_referensi: string;
  tanggal: string;
  created_by: number;
}

// ---- pengguna ----

export async function listUsers(db: D1Database): Promise<UserRow[]> {
  const r = await db.prepare('SELECT * FROM users ORDER BY id').all<UserRow>();
  return r.results || [];
}

export async function getUserByUsername(db: D1Database, username: string): Promise<UserRow | null> {
  const r = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>();
  return r;
}

export async function getUserById(db: D1Database, id: number): Promise<UserRow | null> {
  const r = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return r;
}

export async function createUser(db: D1Database, data: { username: string; password_hash: string; role_id: number }): Promise<boolean> {
  const r = await db.prepare('INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)')
    .bind(data.username, data.password_hash, data.role_id).run();
  return r.success;
}

export async function updateUser(
  db: D1Database,
  id: number,
  data: { username?: string; role_id?: number; password_hash?: string },
): Promise<boolean> {
  const set = [
    data.username !== undefined && 'username = ?',
    data.role_id !== undefined && 'role_id = ?',
    data.password_hash !== undefined && 'password_hash = ?',
  ].filter(Boolean).join(', ');
  if (!set) return true;
  const r = await db
    .prepare(`UPDATE users SET ${set} WHERE id = ?`)
    .bind(data.username ?? '', data.role_id ?? 0, data.password_hash ?? '', id)
    .run();
  return r.success;
}

export async function deleteUser(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return r.success;
}

// ---- role (CRUD) ----

export async function createRole(db: D1Database, data: { nama: string; deskripsi?: string; permissions: Record<string, string[]> }): Promise<boolean> {
  const r = await db
    .prepare('INSERT INTO roles (nama, deskripsi, permissions) VALUES (?, ?, ?)')
    .bind(data.nama, data.deskripsi ?? null, JSON.stringify(data.permissions))
    .run();
  return r.success;
}

export async function updateRole(
  db: D1Database,
  id: number,
  data: { nama: string; deskripsi?: string; permissions: Record<string, string[]> },
): Promise<boolean> {
  const r = await db
    .prepare('UPDATE roles SET nama = ?, deskripsi = ?, permissions = ? WHERE id = ?')
    .bind(data.nama, data.deskripsi ?? null, JSON.stringify(data.permissions), id)
    .run();
  return r.success;
}

export async function deleteRole(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare('DELETE FROM roles WHERE id = ?').bind(id).run();
  return r.success;
}

// ---- role ----

export async function listRoles(db: D1Database): Promise<RoleRow[]> {
  const r = await db.prepare('SELECT * FROM roles ORDER BY id').all<RoleRow>();
  return r.results || [];
}

export async function getRoleById(db: D1Database, id: number): Promise<RoleRow | null> {
  const r = await db.prepare('SELECT * FROM roles WHERE id = ?').bind(id).first<RoleRow>();
  return r;
}

// ---- permissions ----

export async function getUserPermissions(db: D1Database, userId: number): Promise<Record<string, string[]>> {
  const row = await db
    .prepare('SELECT r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?')
    .bind(userId)
    .first<{ permissions: string }>();
  if (!row || !row.permissions) return {};
  try {
    return JSON.parse(row.permissions) as Record<string, string[]>;
  } catch {
    return {};
  }
}

// ---- non-admin users (demo) ----

export async function listNonAdminUsers(db: D1Database): Promise<{ username: string; role_nama: string }[]> {
  const r = await db
    .prepare('SELECT u.username, r.nama as role_nama FROM users u JOIN roles r ON u.role_id = r.id WHERE r.nama != "admin" ORDER BY u.username ASC')
    .all<{ username: string; role_nama: string }>();
  return r.results || [];
}

// ---- nomor transaksi otomatis (PB-YYYY-NNNN / PJ-YYYY-NNNN) ----

export async function generateNomorTransaksi(db: D1Database, prefix: 'PB' | 'PJ'): Promise<string> {
  const table = prefix === 'PB' ? 'pembelian' : 'penjualan';
  const year = new Date().getFullYear();
  const r = await db
    .prepare(`SELECT nomor_transaksi FROM ${table} WHERE nomor_transaksi LIKE ? ORDER BY nomor_transaksi DESC LIMIT 1`)
    .bind(`${prefix}-${year}-%`)
    .all();
  const last = r.results && r.results.length > 0 ? r.results[0] : undefined;
  const seq = last ? parseInt(String(last.nomor_transaksi).split('-').pop() || '0', 10) + 1 : 1;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

// ---- stok ----

export async function getStokTersedia(db: D1Database, itemId: number): Promise<number> {
  const row = await db.prepare('SELECT qty_akhir FROM stok_akhir WHERE item_id = ?').bind(itemId).first<{ qty_akhir: number }>();
  return row ? row.qty_akhir : 0;
}

export async function listMutasiByItem(db: D1Database, itemId: number): Promise<MutasiRow[]> {
  const r = await db
    .prepare('SELECT * FROM stok_mutasi WHERE item_id = ? ORDER BY tanggal DESC, id DESC')
    .bind(itemId)
    .all<MutasiRow>();
  return r.results;
}

// ---- transaksi pembelian (batch, atomic) ----

export async function createPembelianTx(db: D1Database, data: {
  supplier_id: number;
  tanggal: string;
  catatan?: string;
  items: { item_id: number; qty: number; harga_beli: number }[];
  userId: number;
}): Promise<{ nomor: string; id: number }> {
  const total = data.items.reduce((sum, it) => sum + it.qty * it.harga_beli, 0);
  const nomor = await generateNomorTransaksi(db, 'PB');

  const insertPembelian = db.prepare(
    'INSERT INTO pembelian (supplier_id, nomor_transaksi, tanggal, catatan, total, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(data.supplier_id, nomor, data.tanggal, data.catatan ?? null, total, data.userId);

  const insertDetails = data.items.map((item) =>
    db.prepare('INSERT INTO pembelian_detail (pembelian_id, item_id, qty, harga_beli, subtotal) VALUES (?, ?, ?, ?, ?)')
      .bind(item.item_id, item.qty, item.harga_beli, item.qty * item.harga_beli),
  );

  const insertMutasis = data.items.map((item) =>
    db.prepare(
      'INSERT INTO stok_mutasi (item_id, jenis_mutasi, qty, harga, saldo_berjalan, referensi_tipe, referensi_id, nomor_referensi, tanggal, created_by) VALUES (?, \'IN\', ?, ?, ?, \'pembelian\', ?, ?, ?, ?)',
    )
      .bind(item.item_id, item.qty, item.harga_beli, 0, 'pembelian', 0, nomor, data.tanggal, data.userId),
  );

  const parent = await insertPembelian.run();
  const id = Number(parent.meta?.last_row_id ?? 0);
  if (id === 0) throw new Error('Gagal membuat pembelian');

  try {
    await db.batch([...insertDetails, ...insertMutasis]);
  } catch (err) {
    await db.prepare('DELETE FROM pembelian WHERE id = ?').bind(id).run();
    throw err;
  }

  return { nomor, id };
}

export async function deletePembelian(db: D1Database, id: number): Promise<boolean> {
  const results = await db.batch([
    db.prepare('DELETE FROM stok_mutasi WHERE referensi_tipe = ? AND referensi_id = ?').bind('pembelian', id),
    db.prepare('DELETE FROM pembelian_detail WHERE pembelian_id = ?').bind(id),
    db.prepare('DELETE FROM pembelian WHERE id = ?').bind(id),
  ]);
  return results.every((r) => r.success);
}

// ---- transaksi penjualan (batch, atomic) ----

export async function createPenjualanTx(db: D1Database, data: {
  pelanggan_id: number;
  tanggal: string;
  catatan?: string;
  items: { item_id: number; qty: number; harga_jual: number }[];
  userId: number;
}): Promise<{ nomor: string; id: number }> {
  const total = data.items.reduce((sum, it) => sum + it.qty * it.harga_jual, 0);
  const nomor = await generateNomorTransaksi(db, 'PJ');

  const insertPenjualan = db.prepare(
    'INSERT INTO penjualan (pelanggan_id, nomor_transaksi, tanggal, catatan, total, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(data.pelanggan_id, nomor, data.tanggal, data.catatan ?? null, total, data.userId);

  const insertDetails = [];
  const insertMutasis = [];
  const updateStokStmts = [];

  for (const item of data.items) {
    // Snapshot HPP dari stok_akhir (sebelum decrement)
    const stok = await db.prepare('SELECT COALESCE(harga_pokok_rata, 0) as harga_pokok FROM stok_akhir WHERE item_id = ?')
      .bind(item.item_id)
      .first<{ harga_pokok: number }>();
    const hargaPokok = stok?.harga_pokok ?? 0;

    insertDetails.push(
      db.prepare('INSERT INTO penjualan_detail (penjualan_id, item_id, qty, harga_jual, harga_pokok, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(item.item_id, item.qty, item.harga_jual, hargaPokok, item.qty * hargaPokok),
    );

    const stokSebelum = await db.prepare('SELECT qty_akhir FROM stok_akhir WHERE item_id = ?').bind(item.item_id).first<{ qty_akhir: number }>();
    const qtySebelum = stokSebelum?.qty_akhir ?? 0;
    const qtySesudah = Math.max(qtySebelum - item.qty, 0);

    updateStokStmts.push(
      db.prepare(
        'UPDATE stok_akhir SET qty_akhir = ?, harga_pokok_rata = CASE WHEN qty_akhir - ? = 0 THEN 0 ELSE (qty_akhir * harga_pokok_rata + ? * ? - ? * qty_akhir) / (qty_akhir - ?) END, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?',
      )
        .bind(qtySesudah, item.qty, item.harga_jual, qtySesudah, item.qty, item.item_id),
    );

    // Saldo berjalan (berjalan per item)
    const lastMutasi = await db.prepare('SELECT saldo_berjalan FROM stok_mutasi WHERE item_id = ? ORDER BY id DESC LIMIT 1')
      .bind(item.item_id)
      .first<{ saldo_berjalan: number }>();
    const saldo = (lastMutasi?.saldo_berjalan ?? 0) + item.qty;

    insertMutasis.push(
      db.prepare(
        'INSERT INTO stok_mutasi (item_id, jenis_mutasi, qty, harga, saldo_berjalan, referensi_tipe, referensi_id, nomor_referensi, tanggal, created_by) VALUES (?, \'OUT\', ?, ?, ?, \'penjualan\', ?, ?, ?, ?)',
      )
        .bind(item.item_id, item.qty, item.harga_jual, saldo, 'penjualan', 0, nomor, data.tanggal, data.userId),
    );
  }

  const parent = await insertPenjualan.run();
  const id = Number(parent.meta?.last_row_id ?? 0);
  if (id === 0) throw new Error('Gagal membuat penjualan');

  try {
    await db.batch([insertPenjualan, ...insertDetails, ...insertMutasis, ...updateStokStmts]);
  } catch (err) {
    await db.prepare('DELETE FROM penjualan WHERE id = ?').bind(id).run();
    throw err;
  }

  return { nomor, id };
}

export async function deletePenjualan(db: D1Database, id: number): Promise<boolean> {
  const results = await db.batch([
    db.prepare('DELETE FROM stok_mutasi WHERE referensi_tipe = ? AND referensi_id = ?').bind('penjualan', id),
    db.prepare('DELETE FROM penjualan_detail WHERE penjualan_id = ?').bind(id),
    db.prepare('DELETE FROM penjualan WHERE id = ?').bind(id),
  ]);
  return results.every((r) => r.success);
}

// ---- bantuan stok ----

export async function updateStokAkhirSetelahPembelian(db: D1Database, itemId: number, qtyBeli: number, hargaBeli: number): Promise<void> {
  const stok = await db.prepare('SELECT qty_akhir, harga_pokok_rata FROM stok_akhir WHERE item_id = ?').bind(itemId).first<{ qty_akhir: number; harga_pokok_rata: number }>();
  const qtyLama = stok?.qty_akhir ?? 0;
  const hppLama = stok?.harga_pokok_rata ?? 0;
  const hppBaru = (qtyLama * hppLama + qtyBeli * hargaBeli) / (qtyLama + qtyBeli);
  const qtyBaru = qtyLama + qtyBeli;

  await db.prepare(
    `INSERT INTO stok_akhir (item_id, qty_akhir, harga_pokok_rata, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(item_id) DO UPDATE SET qty_akhir = excluded.qty_akhir, harga_pokok_rata = excluded.harga_pokok_rata, updated_at = CURRENT_TIMESTAMP`,
  ).bind(itemId, qtyBaru, hppBaru).run();
}

export async function updateStokAkhirSetelahPenjualan(db: D1Database, itemId: number, qtyJual: number): Promise<void> {
  const stok = await db.prepare('SELECT qty_akhir, harga_pokok_rata FROM stok_akhir WHERE item_id = ?').bind(itemId).first<{ qty_akhir: number; harga_pokok_rata: number }>();
  if (!stok) return;
  const qtyBaru = Math.max(stok.qty_akhir - qtyJual, 0);
  await db.prepare('UPDATE stok_akhir SET qty_akhir = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?').bind(qtyBaru, itemId).run();
}

export async function updateStokAkhirSetelahHapus(db: D1Database, itemId: number, qtyKembalikan: number): Promise<void> {
  const stok = await db.prepare('SELECT qty_akhir FROM stok_akhir WHERE item_id = ?').bind(itemId).first<{ qty_akhir: number }>();
  if (!stok) return;
  const qtyBaru = stok.qty_akhir + qtyKembalikan;
  await db.prepare('UPDATE stok_akhir SET qty_akhir = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?').bind(qtyBaru, itemId).run();
}

export async function hitungSaldoBerjalan(db: D1Database, itemId: number, jenis: 'IN' | 'OUT', qty: number): Promise<number> {
  const row = await db.prepare('SELECT saldo_berjalan FROM stok_mutasi WHERE item_id = ? ORDER BY id DESC LIMIT 1').bind(itemId).first<{ saldo_berjalan: number }>();
  const sebelumnya = row?.saldo_berjalan ?? 0;
  return jenis === 'IN' ? sebelumnya + qty : sebelumnya - qty;
}

export async function hitungHppMovingAverage(db: D1Database, itemId: number, qtyBeli: number, hargaBeli: number): Promise<number> {
  const stok = await db.prepare('SELECT qty_akhir, harga_pokok_rata FROM stok_akhir WHERE item_id = ?').bind(itemId).first<{ qty_akhir: number; harga_pokok_rata: number }>();
  const qtyLama = stok?.qty_akhir ?? 0;
  const hppLama = stok?.harga_pokok_rata ?? 0;
  const total = qtyLama + qtyBeli;
  return total === 0 ? 0 : ((qtyLama * hppLama) + (qtyBeli * hargaBeli)) / total;
}

export async function validasiStokCukup(db: D1Database, itemId: number, qtyDiminta: number): Promise<{ cukup: boolean; pesan: string }> {
  const row = await db.prepare('SELECT qty_akhir FROM stok_akhir WHERE item_id = ?').bind(itemId).first<{ qty_akhir: number }>();
  const saldo = row ? row.qty_akhir : 0;
  if (saldo < qtyDiminta) {
    return { cukup: false, pesan: `Stok tidak cukup. Tersedia: ${saldo}, Diminta: ${qtyDiminta}` };
  }
  return { cukup: true, pesan: '' };
}
