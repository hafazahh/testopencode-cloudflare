// Row types shared with src/render.ts — port Fase C2 (routes↔template).
// Dibuat terpisah agar route handler dapat memetakan baris D1 ke bentuk
// template tanpa duplikasi.

export interface ItemRow {
  id: number;
  nama: string;
  category: string;
  harga_pokok: number;
  harga_jual: number;
  margin: number;
  created_at?: string;
  updated_at?: string;
}

export interface KategoriRow {
  id: number;
  nama: string;
  deskripsi?: string;
  item_count?: number;
}

export interface PelangganRow {
  id: number;
  nama: string;
  email?: string;
  telepon?: string;
  alamat?: string;
  created_at?: string;
}

export interface SupplierRow {
  id: number;
  nama: string;
  kontak?: string;
  alamat?: string;
  created_at?: string;
}

export interface PembelianRow {
  id: number;
  nomor_transaksi: string;
  tanggal: string;
  supplier_nama: string;
  total: number;
}

export interface PembelianDetailRow {
  item_nama: string;
  qty: number;
  harga_beli: number;
  subtotal: number;
}

export interface PenjualanRow {
  id: number;
  nomor_transaksi: string;
  tanggal: string;
  pelanggan_nama: string;
  total: number;
}

export interface PenjualanDetailRow {
  item_nama: string;
  qty: number;
  harga_jual: number;
  harga_pokok: number;
  subtotal: number;
}

export interface StokItemRow {
  id: number;
  nama: string;
  category: string;
  qty_akhir: number;
  harga_pokok_rata: number;
}

export interface MutasiRow {
  tanggal: string;
  nomor_referensi: string;
  jenis_mutasi: string;
  qty: number;
  harga: number;
  saldo_berjalan: number;
}

export interface LaporanDetailRow {
  nomor_transaksi: string;
  tanggal: string;
  pelanggan_nama: string;
  item_nama: string;
  qty: number;
  harga_jual: number;
  harga_pokok: number;
  subtotal: number;
}

export interface UserRow {
  id: number;
  username: string;
  role_nama: string;
  role_id: number;
  created_at: string;
}

export interface RoleRow {
  id: number;
  nama: string;
  deskripsi?: string;
  user_count?: number;
  created_at?: string;
}
