/**
 * Fase C1 — Data layer D1 testopencode.
 *
 * Query functions (prepared statements) untuk operasi dasar:
 *   item, kategori, pelanggan, supplier (list/get/insert/update/delete).
 *
 * Hanya query — tidak ada route HTTP di sini. Route HTTP ada di src/index.ts
 * (Fase C2).
 */

import { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  SITE_URL: string;
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
  const r = await db.prepare("SELECT * FROM items ORDER BY id").all<Item>();
  return r.results;
}

export async function getItem(db: D1Database, id: number): Promise<Item | null> {
  const r = await db.prepare("SELECT * FROM items WHERE id = ?").bind(id).first<Item>();
  return r;
}

export async function createItem(db: D1Database, data: {
  nama: string;
  harga_pokok: number;
  harga_jual: number;
  category: string;
}): Promise<boolean> {
  const r = await db
    .prepare("INSERT INTO items (nama, harga_pokok, harga_jual, category) VALUES (?, ?, ?, ?)")
    .bind(data.nama, data.harga_pokok, data.harga_jual, data.category)
    .run();
  return r.success;
}

export async function updateItem(
  db: D1Database,
  id: number,
  data: { nama?: string; harga_pokok?: number; harga_jual?: number; category?: string }
): Promise<boolean> {
  const set = [
    data.nama !== undefined && "nama = ?",
    data.harga_pokok !== undefined && "harga_pokok = ?",
    data.harga_jual !== undefined && "harga_jual = ?",
    data.category !== undefined && "category = ?",
  ]
    .filter(Boolean)
    .join(", ");

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE items SET ${set} WHERE id = ?`)
    .bind(
      data.nama ?? "",
      data.harga_pokok ?? 0,
      data.harga_jual ?? 0,
      data.category ?? "",
      id
    )
    .run();
  return r.success;
}

export async function deleteItem(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return r.success;
}

// ---------- kategori ----------

export async function listKategori(db: D1Database): Promise<Kategori[]> {
  const r = await db.prepare("SELECT * FROM kategori ORDER BY nama").all<Kategori>();
  return r.results;
}

export async function getKategori(db: D1Database, id: number): Promise<Kategori | null> {
  const r = await db.prepare("SELECT * FROM kategori WHERE id = ?").bind(id).first<Kategori>();
  return r;
}

export async function createKategori(db: D1Database, data: { nama: string; deskripsi?: string }): Promise<boolean> {
  const r = await db
    .prepare("INSERT INTO kategori (nama, deskripsi) VALUES (?, ?)")
    .bind(data.nama, data.deskripsi ?? null)
    .run();
  return r.success;
}

export async function updateKategori(
  db: D1Database,
  id: number,
  data: { nama?: string; deskripsi?: string }
): Promise<boolean> {
  const set = [
    data.nama !== undefined && "nama = ?",
    data.deskripsi !== undefined && "deskripsi = ?",
  ]
    .filter(Boolean)
    .join(", ");

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE kategori SET ${set} WHERE id = ?`)
    .bind(data.nama ?? "", data.deskripsi ?? null, id)
    .run();
  return r.success;
}

export async function deleteKategori(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare("DELETE FROM kategori WHERE id = ?").bind(id).run();
  return r.success;
}

// ---------- pelanggan ----------

export async function listPelanggan(db: D1Database): Promise<Pelanggan[]> {
  const r = await db.prepare("SELECT * FROM pelanggan ORDER BY id").all<Pelanggan>();
  return r.results;
}

export async function getPelanggan(db: D1Database, id: number): Promise<Pelanggan | null> {
  const r = await db.prepare("SELECT * FROM pelanggan WHERE id = ?").bind(id).first<Pelanggan>();
  return r;
}

export async function createPelanggan(db: D1Database, data: {
  nama: string;
  email?: string;
  telepon?: string;
  alamat?: string;
}): Promise<boolean> {
  const r = await db
    .prepare("INSERT INTO pelanggan (nama, email, telepon, alamat) VALUES (?, ?, ?, ?)")
    .bind(data.nama, data.email ?? null, data.telepon ?? null, data.alamat ?? null)
    .run();
  return r.success;
}

export async function updatePelanggan(
  db: D1Database,
  id: number,
  data: { nama?: string; email?: string; telepon?: string; alamat?: string }
): Promise<boolean> {
  const set = [
    data.nama !== undefined && "nama = ?",
    data.email !== undefined && "email = ?",
    data.telepon !== undefined && "telepon = ?",
    data.alamat !== undefined && "alamat = ?",
  ]
    .filter(Boolean)
    .join(", ");

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE pelanggan SET ${set} WHERE id = ?`)
    .bind(data.nama ?? "", data.email ?? null, data.telepon ?? null, data.alamat ?? null, id)
    .run();
  return r.success;
}

export async function deletePelanggan(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare("DELETE FROM pelanggan WHERE id = ?").bind(id).run();
  return r.success;
}

// ---------- supplier ----------

export async function listSupplier(db: D1Database): Promise<Supplier[]> {
  const r = await db.prepare("SELECT * FROM supplier ORDER BY id").all<Supplier>();
  return r.results;
}

export async function getSupplier(db: D1Database, id: number): Promise<Supplier | null> {
  const r = await db.prepare("SELECT * FROM supplier WHERE id = ?").bind(id).first<Supplier>();
  return r;
}

export async function createSupplier(db: D1Database, data: {
  nama: string;
  kontak?: string;
  alamat?: string;
}): Promise<boolean> {
  const r = await db
    .prepare("INSERT INTO supplier (nama, kontak, alamat) VALUES (?, ?, ?)")
    .bind(data.nama, data.kontak ?? null, data.alamat ?? null)
    .run();
  return r.success;
}

export async function updateSupplier(
  db: D1Database,
  id: number,
  data: { nama?: string; kontak?: string; alamat?: string }
): Promise<boolean> {
  const set = [
    data.nama !== undefined && "nama = ?",
    data.kontak !== undefined && "kontak = ?",
    data.alamat !== undefined && "alamat = ?",
  ]
    .filter(Boolean)
    .join(", ");

  if (!set) return true;

  const r = await db
    .prepare(`UPDATE supplier SET ${set} WHERE id = ?`)
    .bind(data.nama ?? "", data.kontak ?? null, data.alamat ?? null, id)
    .run();
  return r.success;
}

export async function deleteSupplier(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare("DELETE FROM supplier WHERE id = ?").bind(id).run();
  return r.success;
}

// ---------- init ----------

export async function initDb(db: D1Database): Promise<void> {
  // Schema telah berjalan idempotent (CREATE TABLE IF NOT EXISTS) di seed.mjs.
  // Fungsi ini tetap disediakan sebagai night-of guard di worker.
}
