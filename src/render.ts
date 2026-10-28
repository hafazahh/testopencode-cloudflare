/**
 * Fase D — port template Jinja2 + static JS + CSP headers.
 *
 * Setiap template `templates/*.html` terkecil diubah menjadi fungsi render yang
 * mengembalikan string HTML. Data pengguna di-escape otomatis lewat tagged
 * template `html` (escape & < > " ') sehingga XSS tidak mungkin. HTML tidak
 * disusun dengan `+` terhadap data user.
 *
 * route HTTP (src/index.ts) memanggil fungsi-fungsi ini nanti (Fase E). Di sini
 * HANYA fungsi render yang dipakai oleh route.
 */
import { DEMO_USERS } from './context';

// ---------- helpers umum ----

// Tagged template: escape setiap interpolasi (string). Angka/null/boolean
// di-String() aman; objek tidak diperbolehkan melewati ini.

// Raw = penanda "ini HTML mentah, jangan di-escape".
export class Raw {
  constructor(public readonly value: string) {}
}
export function raw(htmlText: string): Raw {
  return new Raw(htmlText);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  let out = '';
  for (let i = 0; i < values.length; i++) {
    out += strings[i];
    const v = values[i];
    out += v instanceof Raw
      ? v.value
      : typeof v === 'string'
        ? escapeHtml(v)
        : String(v ?? '');
  }
  out += strings[strings.length - 1];
  return out;
}

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Rp 0';
  const rounded = Math.round(value);
  return 'Rp ' + rounded.toLocaleString('id-ID');
}

export function formatPercent(margin: number, pokok: number): string {
  if (pokok <= 0) return '0.0';
  return ((margin / pokok) * 100).toFixed(1);
}

// ---------- props & navigasi ----

export interface Flash {
  category: string;
  message: string;
}

export interface LayoutProps {
  title: string;
  user_perms: Record<string, string[]>;
  current_user?: { username: string; role_nama?: string };
  csrf_token: string;
  flashMessages?: Flash[];
  content: string;
  contentScripts?: string;
}

const MENU_LABELS: Record<string, string> = {
  items: 'Daftar Item',
  kategori: 'Data Kategori',
  pelanggan: 'Data Pelanggan',
  users: 'Data User',
  roles: 'Data Role',
  supplier: 'Data Supplier',
  pembelian: 'Pembelian',
  penjualan: 'Penjualan',
  stok: 'Kartu Stok',
  laporan: 'Laporan',
};

const MENU_HREF: Record<string, string> = {
  items: '/',
  kategori: '/kategori',
  pelanggan: '/pelanggan',
  users: '/users',
  roles: '/roles',
  supplier: '/supplier',
  pembelian: '/pembelian',
  penjualan: '/penjualan',
  stok: '/stok/kartu',
  laporan: '/laporan/penjualan',
};

function navLinks(user_perms: Record<string, string[]>): Raw {
  // Peran menyimpan permission per modul (items, kategori, ...) dan TIDAK punya
  // kunci `menu` terpisah — jadi menu diturunkan dari kunci permission itu.
  const menu = user_perms.menu ?? Object.keys(user_perms);
  const parts: string[] = [];
  for (const m of menu) {
    const label = MENU_LABELS[m] ?? m;
    if (m === 'laporan') {
      parts.push(
        `<a href="/laporan/penjualan" class="btn btn-nav">Laporan Penjualan</a>`
      );
      parts.push(
        `<a href="/laporan/stok" class="btn btn-nav">Laporan Stok</a>`
      );
      continue;
    }
    const href = MENU_HREF[m] ?? '/' + m;
    parts.push(`<a href="${href}" class="btn btn-nav">${label}</a>`);
  }
  return raw(parts.join(''));
}

function flashHtml(flashMessages?: Flash[]): Raw {
  if (!flashMessages || flashMessages.length === 0) return raw('');
  const alerts = flashMessages.map(
    (f) => `<div class="alert alert-${f.category}">${f.message}</div>`
  );
  return raw('<div class="flash-messages">' + alerts.join('') + '</div>');
}

export function renderBase(props: LayoutProps): string {
  return html`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${props.title}</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>
        <div class="container">
            <header>
                <h1>Manajemen Item</h1>
                <nav>${navLinks(props.user_perms)}</nav>
                <div class="user-info">
                    ${props.current_user
                        ? raw(html`
                             <span>${props.current_user.username}${props.current_user.role_nama ? ` (${props.current_user.role_nama})` : ''}</span>
                             <form method="POST" action="/logout" style="display:inline;">
                                 <input type="hidden" name="csrf_token" value="${props.csrf_token}">
                                 <button type="submit" class="btn btn-small">Logout</button>
                             </form>
                          `)
                        : ''}
                </div>
            </header>
            ${flashHtml(props.flashMessages)}
            <main>
                ${raw(props.content)}
            </main>
            <footer>
                <p>CRUD Item &copy; 2024 - Cloudflare Workers + D1</p>
            </footer>
        </div>
        <script src="/confirm.js"></script>
        ${raw(props.contentScripts ?? '')}
    </body>
    </html>
  `;
}

// Overload: default contentScripts empty (kelas yang tidak perlu script).
export interface BaseLayoutProps extends LayoutProps {
  contentScripts?: string;
}

/** Props bersama halaman: siapa yang sedang login (untuk info user + Logout). */
export type PageProps = {
  current_user?: { username: string; role_nama?: string };
};

export function renderBaseItem(props: BaseLayoutProps): string {
  return renderBase({
    ...props,
    contentScripts: props.contentScripts ?? '',
  });
}

// ---------- halaman ----------

type ItemRow = { id: number; nama: string; category: string; harga_pokok: number; harga_jual: number; margin: number; created_at?: string; updated_at?: string };
type KategoriRow = { id: number; nama: string; deskripsi?: string; item_count?: number };
type PelangganRow = { id: number; nama: string; email?: string; telepon?: string; alamat?: string; created_at?: string; };
type SupplierRow = { id: number; nama: string; kontak?: string; alamat?: string; created_at?: string; };
type PembelianRow = { id: number; nomor_transaksi: string; tanggal: string; supplier_nama: string; total: number; };
type PembelianDetailRow = { item_nama: string; qty: number; harga_beli: number; subtotal: number; };
type PenjualanRow = { id: number; nomor_transaksi: string; tanggal: string; pelanggan_nama: string; total: number; };
type PenjualanDetailRow = { item_nama: string; qty: number; harga_jual: number; harga_pokok: number; subtotal: number; };
type StokItemRow = { id: number; nama: string; category: string; qty_akhir: number; harga_pokok_rata: number; };
type MutasiRow = { tanggal: string; nomor_referensi: string; jenis_mutasi: string; qty: number; harga: number; saldo_berjalan: number; };
type LaporanDetailRow = { nomor_transaksi: string; tanggal: string; pelanggan_nama: string; item_nama: string; qty: number; harga_jual: number; harga_pokok: number; subtotal: number; };
type UserRow = { id: number; username: string; role_nama: string; role_id: number; created_at: string };
type RoleRow = { id: number; nama: string; deskripsi?: string; user_count?: number; created_at?: string };

function identity<T>(t: T): T { return t; }

function csrfField(csrf: string): Raw {
  return raw(`<input type="hidden" name="csrf_token" value="${escapeHtml(csrf)}">`);
}

export function renderIndex(props: { items: ItemRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { items, user_perms, csrf } = props;
  const rows = items.map((item, i) => {
    const marginPct = formatPercent(item.margin, item.harga_pokok);
    const marginCls = item.margin > 0 ? 'margin-positive' : item.margin < 0 ? 'margin-negative' : 'margin-zero';
    const edit = user_perms.items?.includes('edit')
      ? html`<a href="/item/${item.id}/edit" class="btn btn-sm btn-edit">Edit</a>`
      : '';
    const del = user_perms.items?.includes('delete')
      ? html`<form action="/item/${item.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus item ini?">${csrfField(csrf)}<button type="submit" class="btn btn-sm btn-delete">Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${i + 1}</td>
        <td>${item.nama}</td>
        <td><span class="category-badge">${item.category}</span></td>
        <td class="numeric">${formatRupiah(item.harga_pokok)}</td>
        <td class="numeric">${formatRupiah(item.harga_jual)}</td>
        <td class="numeric ${marginCls}">${formatRupiah(item.margin)}${raw(item.margin > 0 ? html`<span class="margin-badge">+${marginPct}%</span>` : '')}</td>
        <td class="actions">
          <a href="/item/${item.id}" class="btn btn-sm btn-view">Lihat</a>
          ${raw(edit)}
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');

  const add = user_perms.items?.includes('create')
    ? html`<a href="/item/create" class="btn btn-primary">+ Tambah Item</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Daftar Item</h2>${raw(add)}</div>`;

  const table = items.length
    ? html`
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">No</th><th>Nama Item</th><th>Kategori</th>
              <th scope="col">Harga Pokok</th><th scope="col">Harga Jual</th>
              <th scope="col">Margin</th><th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>${raw(rows)}</tbody>
        </table>`
    : html`<div class="empty-state"><p>Belum ada item. <a href="/item/create">Tambah item pertama</a></p></div>`;

  return renderBaseItem({ current_user: props.current_user,  title: 'Daftar Item - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderViewItem(props: { item: ItemRow; csrf: string } & PageProps): string {
  const { item, csrf } = props;
  const marginPct = formatPercent(item.margin, item.harga_pokok);
  const marginCls = item.margin > 0 ? 'margin-positive' : item.margin < 0 ? 'margin-negative' : '';
  return renderBaseItem({ current_user: props.current_user, 
    title: item.nama + ' - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Item</h2></div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">${item.id}</span></div>
        <div class="detail-row"><span class="detail-label">Nama Item</span><span class="detail-value">${item.nama}</span></div>
        <div class="detail-row"><span class="detail-label">Kategori</span><span class="detail-value"><span class="category-badge">${item.category}</span></span></div>
        <div class="detail-row"><span class="detail-label">Harga Pokok</span><span class="detail-value">${formatRupiah(item.harga_pokok)}</span></div>
        <div class="detail-row"><span class="detail-label">Harga Jual</span><span class="detail-value">${formatRupiah(item.harga_jual)}</span></div>
        <div class="detail-row"><span class="detail-label">Margin</span><span class="detail-value ${marginCls}">${formatRupiah(item.margin)}${raw(item.harga_pokok > 0 ? html` <span class="margin-badge">(${marginPct}%)</span>` : '')}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat</span><span class="detail-value">${item.created_at ?? ''}</span></div>
        <div class="detail-row"><span class="detail-label">Diupdate</span><span class="detail-value">${item.updated_at ?? ''}</span></div>
      </div>
      <div class="form-actions">
        <a href="/item/${item.id}/edit" class="btn btn-primary">Edit</a>
        <form action="/item/${item.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus item ini?">${csrfField(csrf)}<button type="submit" class="btn btn-delete">Hapus</button></form>
        <a href="/" class="btn btn-secondary">Kembali</a>
      </div>
    `
  });
}

export function renderCreateItem(props: { nama?: string; harga_pokok?: number; harga_jual?: number; category?: string; categories?: { nama: string }[]; csrf: string } & PageProps): string {
  const { nama = '', harga_pokok = 0, harga_jual = 0, category = '', categories = [] } = props;
  const catOptions = categories.map((c) => {
    const selected = category === c.nama ? 'selected' : '';
    return html`<option value="${c.nama}" ${selected}>${c.nama}</option>`;
  }).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah Item - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/item/create" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="nama">Nama Item</label>
          <input type="text" id="nama" name="nama" value="${nama}" required placeholder="Masukkan nama item">
        </div>
        <div class="form-group">
          <label for="category">Kategori</label>
          <select id="category" name="category" required>
            <option value="">-- Pilih Kategori --</option>${raw(catOptions)}
          </select>
        </div>
        <div class="form-group">
          <label for="harga_pokok">Harga Pokok (Rp)</label>
          <input type="number" id="harga_pokok" name="harga_pokok" value="${harga_pokok}" required placeholder="Masukkan harga pokok" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label for="harga_jual">Harga Jual (Rp)</label>
          <input type="number" id="harga_jual" name="harga_jual" value="${harga_jual}" required placeholder="Masukkan harga jual" min="0" step="0.01">
        </div>
        <div class="form-group"><label>Margin (Otomatis)</label><div class="margin-preview" id="marginPreview">Rp 0</div></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/" class="btn btn-secondary">Batal</a>
        </div>
      </form>
      <script src="/margin.js"></script>
    `
  });
}

export function renderEditItem(props: { item: ItemRow; categories: { nama: string }[]; csrf: string } & PageProps): string {
  const { item, categories, csrf } = props;
  const catOptions = categories.map((c) => {
    const selected = item.category === c.nama ? 'selected' : '';
    return html`<option value="${c.nama}" ${selected}>${c.nama}</option>`;
  }).join('');
  const marginVal = item.harga_jual - item.harga_pokok;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Edit Item - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <form method="POST" action="/item/${item.id}/edit" class="form">${csrfField(csrf)}
        <div class="form-group">
          <label for="nama">Nama Item</label>
          <input type="text" id="nama" name="nama" value="${item.nama}" required placeholder="Masukkan nama item">
        </div>
        <div class="form-group">
          <label for="category">Kategori</label>
          <select id="category" name="category" required>
            <option value="">-- Pilih Kategori --</option>${raw(catOptions)}
          </select>
        </div>
        <div class="form-group">
          <label for="harga_pokok">Harga Pokok (Rp)</label>
          <input type="number" id="harga_pokok" name="harga_pokok" value="${item.harga_pokok}" required placeholder="Masukkan harga pokok" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label for="harga_jual">Harga Jual (Rp)</label>
          <input type="number" id="harga_jual" name="harga_jual" value="${item.harga_jual}" required placeholder="Masukkan harga jual" min="0" step="0.01">
        </div>
        <div class="form-group"><label>Margin (Otomatis)</label><div class="margin-preview" id="marginPreview">Rp ${marginVal}</div></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update</button>
          <a href="/" class="btn btn-secondary">Batal</a>
        </div>
      </form>
      <script src="/margin.js"></script>
    `
  });
}

export function renderError(props: { code: string; title: string; message: string; current_user?: boolean; csrf: string }): string {
  const { code, title, message, current_user, csrf } = props;
  const label = current_user ? 'Kembali ke Daftar Item' : 'Ke Halaman Login';
  const href = current_user ? '/index' : '/login';
  return renderBaseItem({
    title: code + ' - ' + title,
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="container">
        <main>
          <div class="error-page">
            <div class="error-code">${code}</div>
            <h1>${title}</h1>
            <p>${message}</p>
            <a href="${href}" class="btn btn-primary">${label}</a>
          </div>
        </main>
      </div>
    `
  });
}

export function renderLogin(props: { csrf: string; non_admin_users?: { username: string; role_nama: string }[]; flashMessages?: Flash[] }): string {
  const { csrf, non_admin_users = [], flashMessages } = props;
  const usersRows = non_admin_users.map(u => html`
    <tr>
      <td>${u.username}</td>
      <td>${u.role_nama}</td>
    </tr>
  `).join('');
  // Tabel kredensial demo portfolio. Password sengaja ditampilkan polos agar
  // pengunjung bisa langsung mencoba login — persetujuan user, dan TIDAK ada
  // plaintext yang disimpan ke D1 (D1 hanya menyimpan hash PBKDF2; seed di
  // scripts/seed.mjs menuruti pola admin). Sumber data: DEMO_USERS di
  // context.ts (satu tempat) supaya seed dan tampilan tidak pernah beda.
  // Pola html + raw() mengikuti tabel non_admin_users di atas.
  const demoRows = DEMO_USERS.map(u => html`
    <tr>
      <td>${u.role}</td>
      <td>${u.username}</td>
      <td>${u.password}</td>
    </tr>
  `).join('');
  const demoTable = raw(html`<table class="data-table"><thead><tr><th scope="col">Peran</th><th scope="col">Username</th><th scope="col">Password</th></tr></thead><tbody>${raw(demoRows)}</tbody></table>`);
  return renderBaseItem({
    title: 'Login - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    // Tanpa ini pesan error (login gagal, lockout, dsb) tidak pernah tampil di
    // halaman login — flash disimpan di cookie tapi tidak dirender.
    flashMessages,
    content: html`
      <div class="container">
        <header><h1>Login</h1></header>
        <div class="login-info-card">
          <h2>Sistem Manajemen Inventory &amp; Transaksi</h2>
          <p class="description">Kelola stok barang, pembelian, penjualan, dan laporan dalam satu sistem terpadu.</p>
          <div class="feature-grid">
            <div class="feature-item"><span class="icon">📦</span><div><div class="feature-title">Master Data</div><div class="feature-desc">Item, Kategori, Pelanggan, Supplier</div></div></div>
            <div class="feature-item"><span class="icon">🛒</span><div><div class="feature-title">Transaksi</div><div class="feature-desc">Pembelian &amp; Penjualan dengan validasi stok</div></div></div>
            <div class="feature-item"><span class="icon">📊</span><div><div class="feature-title">Laporan</div><div class="feature-desc">Kartu Stok, Laporan Penjualan &amp; Stok</div></div></div>
            <div class="feature-item"><span class="icon">🔐</span><div><div class="feature-title">Multi-User</div><div class="feature-desc">Role-Based Access Control (RBAC)</div></div></div>
          </div>
        </div>
        <form method="POST" action="/login" class="form-login">${csrfField(csrf)}
          <div class="form-group"><label for="username">Username</label><input type="text" id="username" name="username" required autofocus></div>
          <div class="form-group"><label for="password">Password</label><input type="password" id="password" name="password" required></div>
          <button type="submit" class="btn btn-primary">Login</button>
        </form>
        <div class="login-info">
          <h3>Informasi Login</h3>
          <p>User yang terdaftar (selain admin):</p>
          ${non_admin_users.length
              ? raw(html`<table class="data-table"><thead><tr><th scope="col">Username</th><th scope="col">Role</th></tr></thead><tbody>${raw(usersRows)}</tbody></table>`)
              : raw(html`<p>Belum ada user non-admin. Buat user baru melalui akun admin.</p>`)}
          <h3>Akun Demo</h3>
          <p>Silakan login dengan salah satu akun berikut untuk mencoba aplikasi:</p>
          ${demoTable}
          <p class="login-info-note">Ganti password default setelah login pertama untuk keamanan.</p>
        </div>
      </div>
    `
  });
}

function emptyStateLink(href: string, text: string): string {
  return html`<div class="empty-state"><p>Belum ada data. <a href="${href}">${text}</a></p></div>`;
}

// ---------- kategori ----------
type KategoriFormProps = { id?: number; nama: string; deskripsi?: string; created_at?: string };

export function renderKategoriIndex(props: { kategori: KategoriRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { kategori, user_perms, csrf } = props;
  const rows = kategori.map((k, i) => {
    const edit = user_perms.kategori?.includes('edit')
      ? html`<a href="/kategori/${k.id}/edit" class="btn btn-sm btn-edit">Edit</a>`
      : '';
    const del = user_perms.kategori?.includes('delete')
      ? html`<form action="/kategori/${k.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus kategori ini?">${csrfField(csrf)}<button type="submit" class="btn btn-sm btn-delete" ${k.item_count && k.item_count > 0 ? 'disabled title="Tidak dapat dihapus: masih dipakai item"' : ''}>Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${i + 1}</td>
        <td>${k.nama}</td>
        <td>${k.deskripsi || '-'}</td>
        <td>${k.item_count ?? 0}</td>
        <td class="actions">
          <a href="/kategori/${k.id}" class="btn btn-sm btn-view">Lihat</a>
          ${raw(edit)}
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.kategori?.includes('create')
    ? html`<a href="/kategori/create" class="btn btn-primary">+ Tambah Kategori</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Daftar Kategori</h2>${raw(add)}</div>`;
  const table = kategori.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>Nama</th><th>Deskripsi</th>
            <th scope="col">Jumlah Item</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : emptyStateLink('/kategori/create', 'Tambah kategori pertama');
  return renderBaseItem({ current_user: props.current_user,  title: 'Daftar Kategori - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderKategoriCreate(props: { nama?: string; deskripsi?: string; csrf: string } & PageProps): string {
  const { nama = '', deskripsi = '' } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah Kategori - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/kategori/create" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="nama">Nama Kategori</label>
          <input type="text" id="nama" name="nama" value="${nama}" required placeholder="Masukkan nama kategori">
        </div>
        <div class="form-group">
          <label for="deskripsi">Deskripsi</label>
          <textarea id="deskripsi" name="deskripsi" rows="3" placeholder="Masukkan deskripsi (opsional)">${deskripsi}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/kategori" class="btn btn-secondary">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderKategoriEdit(props: { kategori: KategoriFormProps; csrf: string } & PageProps): string {
  const { kategori, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Edit Kategori - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <form method="POST" action="/kategori/${kategori.id}/edit" class="form">${csrfField(csrf)}
        <div class="form-group">
          <label for="nama">Nama Kategori</label>
          <input type="text" id="nama" name="nama" value="${kategori.nama}" required placeholder="Masukkan nama kategori">
        </div>
        <div class="form-group">
          <label for="deskripsi">Deskripsi</label>
          <textarea id="deskripsi" name="deskripsi" rows="3" placeholder="Masukkan deskripsi (opsional)">${kategori.deskripsi || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update</button>
          <a href="/kategori" class="btn btn-secondary">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderKategoriView(props: { kategori: KategoriFormProps; item_count: number; csrf: string } & PageProps): string {
  const { kategori, item_count, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: kategori.nama + ' - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Kategori</h2></div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">${kategori.id}</span></div>
        <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${kategori.nama}</span></div>
        <div class="detail-row"><span class="detail-label">Deskripsi</span><span class="detail-value">${kategori.deskripsi || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Jumlah Item</span><span class="detail-value">${item_count}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat</span><span class="detail-value">${kategori.created_at ?? ''}</span></div>
      </div>
      <div class="form-actions">
        <a href="/kategori/${kategori.id}/edit" class="btn btn-primary">Edit</a>
        <form action="/kategori/${kategori.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus kategori ini?">${csrfField(csrf)}<button type="submit" class="btn btn-delete" ${item_count > 0 ? 'disabled title="Tidak dapat dihapus: masih dipakai item"' : ''}>Hapus</button></form>
        <a href="/kategori" class="btn btn-secondary">Kembali</a>
      </div>
    `
  });
}

// ---------- pelanggan ----------
type PelangganForm = { id: number; nama: string; email?: string; telepon?: string; alamat?: string; created_at?: string };

export function renderPelangganIndex(props: { pelanggan: PelangganRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { pelanggan, user_perms, csrf } = props;
  const rows = pelanggan.map((p, i) => {
    const edit = user_perms.pelanggan?.includes('edit')
      ? html`<a href="/pelanggan/${p.id}/edit" class="btn btn-sm btn-edit">Edit</a>`
      : '';
    const del = user_perms.pelanggan?.includes('delete')
      ? html`<form action="/pelanggan/${p.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus pelanggan ini?">${csrfField(csrf)}<button type="submit" class="btn btn-sm btn-delete">Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${i + 1}</td>
        <td>${p.nama}</td>
        <td>${p.email || '-'}</td>
        <td>${p.telepon || '-'}</td>
        <td class="actions">
          <a href="/pelanggan/${p.id}" class="btn btn-sm btn-view">Lihat</a>
          ${raw(edit)}
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.pelanggan?.includes('create')
    ? html`<a href="/pelanggan/create" class="btn btn-primary">+ Tambah Pelanggan</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Daftar Pelanggan</h2>${raw(add)}</div>`;
  const table = pelanggan.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>Nama</th><th>Email</th><th>Telepon</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : emptyStateLink('/pelanggan/create', 'Tambah pelanggan pertama');
  return renderBaseItem({ current_user: props.current_user,  title: 'Daftar Pelanggan - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderPelangganCreate(props: { nama?: string; email?: string; telepon?: string; alamat?: string; csrf: string } & PageProps): string {
  const { nama = '', email = '', telepon = '', alamat = '' } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah Pelanggan - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/pelanggan/create" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="nama">Nama Pelanggan</label>
          <input type="text" id="nama" name="nama" value="${nama}" required placeholder="Masukkan nama pelanggan">
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" value="${email}" placeholder="Masukkan email (opsional)">
        </div>
        <div class="form-group">
          <label for="telepon">Telepon</label>
          <input type="text" id="telepon" name="telepon" value="${telepon}" placeholder="Masukkan nomor telepon (opsional)">
        </div>
        <div class="form-group">
          <label for="alamat">Alamat</label>
          <textarea id="alamat" name="alamat" rows="3" placeholder="Masukkan alamat (opsional)">${alamat}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/pelanggan" class="btn btn-secondary">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderPelangganEdit(props: { pelanggan: PelangganForm; csrf: string } & PageProps): string {
  const { pelanggan, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Edit Pelanggan - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <form method="POST" action="/pelanggan/${pelanggan.id}/edit" class="form">${csrfField(csrf)}
        <div class="form-group">
          <label for="nama">Nama Pelanggan</label>
          <input type="text" id="nama" name="nama" value="${pelanggan.nama}" required placeholder="Masukkan nama pelanggan">
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" value="${pelanggan.email || ''}" placeholder="Masukkan email (opsional)">
        </div>
        <div class="form-group">
          <label for="telepon">Telepon</label>
          <input type="text" id="telepon" name="telepon" value="${pelanggan.telepon || ''}" placeholder="Masukkan nomor telepon (opsional)">
        </div>
        <div class="form-group">
          <label for="alamat">Alamat</label>
          <textarea id="alamat" name="alamat" rows="3" placeholder="Masukkan alamat (opsional)">${pelanggan.alamat || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update</button>
          <a href="/pelanggan" class="btn btn-secondary">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderPelangganView(props: { pelanggan: PelangganForm; csrf: string } & PageProps): string {
  const { pelanggan, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: pelanggan.nama + ' - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Pelanggan</h2></div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">${pelanggan.id}</span></div>
        <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${pelanggan.nama}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${pelanggan.email || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Telepon</span><span class="detail-value">${pelanggan.telepon || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Alamat</span><span class="detail-value">${pelanggan.alamat || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat</span><span class="detail-value">${pelanggan.created_at ?? ''}</span></div>
      </div>
      <div class="form-actions">
        <a href="/pelanggan/${pelanggan.id}/edit" class="btn btn-primary">Edit</a>
        <form action="/pelanggan/${pelanggan.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus pelanggan ini?">${csrfField(csrf)}<button type="submit" class="btn btn-delete">Hapus</button></form>
        <a href="/pelanggan" class="btn btn-secondary">Kembali</a>
      </div>
    `
  });
}

// ---------- supplier ----------
type SupplierForm = { id: number; nama: string; kontak?: string; alamat?: string; created_at?: string };

export function renderSupplierIndex(props: { suppliers: SupplierRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { suppliers, user_perms, csrf } = props;
  const rows = suppliers.map((s, i) => {
    const edit = user_perms.supplier?.includes('edit')
      ? html`<a href="/supplier/${s.id}/edit" class="btn btn-sm btn-edit">Edit</a>`
      : '';
    const del = user_perms.supplier?.includes('delete')
      ? html`<form action="/supplier/${s.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus supplier ini?">${csrfField(csrf)}<button type="submit" class="btn btn-sm btn-delete">Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${i + 1}</td>
        <td>${s.nama}</td>
        <td>${s.kontak || '-'}</td>
        <td class="actions">
          <a href="/supplier/${s.id}" class="btn btn-sm btn-view">Lihat</a>
          ${raw(edit)}
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.supplier?.includes('create')
    ? html`<a href="/supplier/create" class="btn btn-primary">+ Tambah Supplier</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Daftar Supplier</h2>${raw(add)}</div>`;
  const table = suppliers.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>Nama</th><th>Kontak</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : emptyStateLink('/supplier/create', 'Tambah supplier pertama');
  return renderBaseItem({ current_user: props.current_user,  title: 'Daftar Supplier - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderSupplierCreate(props: { nama?: string; kontak?: string; alamat?: string; csrf: string } & PageProps): string {
  const { nama = '', kontak = '', alamat = '' } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah Supplier - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/supplier/create" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="nama">Nama Supplier</label>
          <input type="text" id="nama" name="nama" value="${nama}" required placeholder="Masukkan nama supplier">
        </div>
        <div class="form-group">
          <label for="kontak">Kontak Person</label>
          <input type="text" id="kontak" name="kontak" value="${kontak}" placeholder="Masukkan nama kontak (opsional)">
        </div>
        <div class="form-group">
          <label for="alamat">Alamat</label>
          <textarea id="alamat" name="alamat" rows="3" placeholder="Masukkan alamat (opsional)">${alamat}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/supplier" class="btn btn-secondary">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderSupplierEdit(props: { supplier: SupplierForm; csrf: string } & PageProps): string {
  const { supplier, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Edit Supplier - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <form method="POST" action="/supplier/${supplier.id}/edit" class="form">${csrfField(csrf)}
        <div class="form-group">
          <label for="nama">Nama Supplier</label>
          <input type="text" id="nama" name="nama" value="${supplier.nama}" required placeholder="Masukkan nama supplier">
        </div>
        <div class="form-group">
          <label for="kontak">Kontak Person</label>
          <input type="text" id="kontak" name="kontak" value="${supplier.kontak || ''}" placeholder="Masukkan nama kontak (opsional)">
        </div>
        <div class="form-group">
          <label for="alamat">Alamat</label>
          <textarea id="alamat" name="alamat" rows="3" placeholder="Masukkan alamat (opsional)">${supplier.alamat || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update</button>
          <a href="/supplier" class="btn btn-secondary">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderSupplierView(props: { supplier: SupplierForm; csrf: string } & PageProps): string {
  const { supplier, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: supplier.nama + ' - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Supplier</h2></div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">${supplier.id}</span></div>
        <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${supplier.nama}</span></div>
        <div class="detail-row"><span class="detail-label">Kontak</span><span class="detail-value">${supplier.kontak || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Alamat</span><span class="detail-value">${supplier.alamat || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat</span><span class="detail-value">${supplier.created_at ?? ''}</span></div>
      </div>
      <div class="form-actions">
        <a href="/supplier/${supplier.id}/edit" class="btn btn-primary">Edit</a>
        <form action="/supplier/${supplier.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus supplier ini?">${csrfField(csrf)}<button type="submit" class="btn btn-delete">Hapus</button></form>
        <a href="/supplier" class="btn btn-secondary">Kembali</a>
      </div>
    `
  });
}

// ---------- pembelian ----------
type PembelianForm = { id: number; nomor_transaksi: string; tanggal: string; supplier_nama: string; total: number; catatan?: string; created_by_username?: string; created_at?: string };

export function renderPembelianIndex(props: { pembelian: PembelianRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { pembelian, user_perms, csrf } = props;
  const rows = pembelian.map((p, i) => {
    const del = user_perms.pembelian?.includes('delete')
      ? html`<form action="/pembelian/${p.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus pembelian ini? Stok akan di-rollback.">${csrfField(csrf)}<button type="submit" class="btn btn-sm btn-delete">Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${i + 1}</td>
        <td>${p.nomor_transaksi}</td>
        <td>${p.tanggal}</td>
        <td>${p.supplier_nama}</td>
        <td class="numeric">Rp ${p.total.toLocaleString('id-ID')}</td>
        <td class="actions">
          <a href="/pembelian/${p.id}" class="btn btn-sm btn-view">Lihat</a>
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.pembelian?.includes('create')
    ? html`<a href="/pembelian/create" class="btn btn-primary">+ Tambah Pembelian</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Daftar Pembelian</h2>${raw(add)}</div>`;
  const table = pembelian.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>No. Transaksi</th><th>Tanggal</th><th>Supplier</th>
            <th scope="col">Total</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : emptyStateLink('/pembelian/create', 'Tambah pembelian pertama');
  return renderBaseItem({ current_user: props.current_user,  title: 'Daftar Pembelian - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderPembelianCreate(props: { items?: { id: number; nama: string; harga_pokok: number }[]; suppliers?: { id: number; nama: string }[]; supplier_id?: number; tanggal?: string; catatan?: string; csrf: string } & PageProps): string {
  const { items = [], suppliers = [], tanggal = '', catatan = '' } = props;
  // Supplier wajib dari prop terpisah (bukan query item) — sebelumnya dropdown
  // hanya berisi placeholder `-- Pilih Supplier --` sehingga form ber-`required`
  // tidak bisa disubmit (pembelian mati total). Pola opsi mengikuti
  // `catOptions` di renderCreateItem: string opsi mentah → raw() supaya
  // tidak ter-escape ganda oleh tagged template `html`.
  const supplierOptions = suppliers.map((s) => {
    const selected = props.supplier_id === s.id ? 'selected' : '';
    return `<option value="${s.id}" ${selected}>${escapeHtml(s.nama)}</option>`;
  }).join('');
  const itemsJson = items.map(i => JSON.stringify({ id: i.id, nama: i.nama, harga_pokok: i.harga_pokok })).join(',');
  return renderBaseItem({ current_user: props.current_user,
    title: 'Tambah Pembelian - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/pembelian/create" class="form" id="pembelian-form">${csrfField(props.csrf)}
        <div class="form-row">
          <div class="form-group">
            <label for="supplier_id">Supplier</label>
            <select id="supplier_id" name="supplier_id" required>
              <option value="">-- Pilih Supplier --</option>${raw(supplierOptions)}
            </select>
          </div>
          <div class="form-group">
            <label for="tanggal">Tanggal</label>
            <input type="date" id="tanggal" name="tanggal" value="${tanggal}" required>
          </div>
        </div>
        <div class="form-group">
          <label for="catatan">Catatan</label>
          <textarea id="catatan" name="catatan" rows="2" placeholder="Masukkan catatan (opsional)">${catatan}</textarea>
        </div>
        <h3>Detail Item</h3>
        <table class="data-table" id="detail-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Harga Beli</th>
              <th scope="col">Subtotal</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody id="detail-rows">
            <!-- Dynamic rows will be added here -->
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right;"><strong>Total:</strong></td>
              <td colspan="2"><strong id="total-display">Rp 0</strong></td>
            </tr>
          </tfoot>
        </table>
        <button type="button" class="btn btn-secondary" id="add-row-btn">+ Tambah Item</button>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan Pembelian</button>
          <a href="/pembelian" class="btn btn-secondary">Batal</a>
        </div>
      </form>
      <script type="application/json" id="items-data">[${itemsJson}]</script>
      <script src="/pembelian.js"></script>
    `
  });
}

export function renderPembelianView(props: { pembelian: PembelianForm; detail: PembelianDetailRow[]; csrf: string } & PageProps): string {
  const { pembelian, detail, csrf } = props;
  const detailRows = detail.map((d, i) => html`
    <tr>
      <td>${i + 1}</td>
      <td>${d.item_nama}</td>
      <td>${d.qty}</td>
      <td class="numeric">Rp ${d.harga_beli.toLocaleString('id-ID')}</td>
      <td class="numeric">Rp ${d.subtotal.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: pembelian.nomor_transaksi + ' - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Pembelian</h2></div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">No. Transaksi</span><span class="detail-value">${pembelian.nomor_transaksi}</span></div>
        <div class="detail-row"><span class="detail-label">Tanggal</span><span class="detail-value">${pembelian.tanggal}</span></div>
        <div class="detail-row"><span class="detail-label">Supplier</span><span class="detail-value">${pembelian.supplier_nama}</span></div>
        <div class="detail-row"><span class="detail-label">Catatan</span><span class="detail-value">${pembelian.catatan || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat oleh</span><span class="detail-value">${pembelian.created_by_username || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat pada</span><span class="detail-value">${pembelian.created_at ?? ''}</span></div>
      </div>
      <h3>Detail Item</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>Item</th><th>Qty</th>
            <th scope="col">Harga Beli</th><th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>${raw(detailRows)}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align: right;"><strong>Total:</strong></td>
            <td><strong>Rp ${pembelian.total.toLocaleString('id-ID')}</strong></td>
          </tr>
        </tfoot>
      </table>
      <div class="form-actions">
        <form action="/pembelian/${pembelian.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus pembelian ini? Stok akan di-rollback.">${csrfField(csrf)}<button type="submit" class="btn btn-delete">Hapus</button></form>
        <a href="/pembelian" class="btn btn-secondary">Kembali</a>
      </div>
    `
  });
}

// ---------- penjualan ----------
type PenjualanForm = { id: number; nomor_transaksi: string; tanggal: string; pelanggan_nama: string; total: number; catatan?: string; created_by_username?: string; created_at?: string };

export function renderPenjualanIndex(props: { penjualan: PenjualanRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { penjualan, user_perms, csrf } = props;
  const rows = penjualan.map((p, i) => {
    const del = user_perms.penjualan?.includes('delete')
      ? html`<form action="/penjualan/${p.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus penjualan ini? Stok akan dikembalikan.">${csrfField(csrf)}<button type="submit" class="btn btn-sm btn-delete">Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${i + 1}</td>
        <td>${p.nomor_transaksi}</td>
        <td>${p.tanggal}</td>
        <td>${p.pelanggan_nama}</td>
        <td class="numeric">Rp ${p.total.toLocaleString('id-ID')}</td>
        <td class="actions">
          <a href="/penjualan/${p.id}" class="btn btn-sm btn-view">Lihat</a>
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.penjualan?.includes('create')
    ? html`<a href="/penjualan/create" class="btn btn-primary">+ Tambah Penjualan</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Daftar Penjualan</h2>${raw(add)}</div>`;
  const table = penjualan.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>No. Transaksi</th><th>Tanggal</th><th>Pelanggan</th>
            <th scope="col">Total</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : emptyStateLink('/penjualan/create', 'Tambah penjualan pertama');
  return renderBaseItem({ current_user: props.current_user,  title: 'Daftar Penjualan - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderPenjualanCreate(props: { pelanggans?: { id: number; nama: string }[]; items?: { id: number; nama: string; stok_akhir: number; harga_pokok: number }[]; tanggal?: string; catatan?: string; csrf: string } & PageProps): string {
  const { pelanggans = [], items = [], tanggal = '', catatan = '' } = props;
  const pelangganOptions = pelanggans.map(p => `<option value="${p.id}">${p.nama}</option>`).join('');
  const itemOptions = items.map(i => `<option value="${i.id}">${i.nama}</option>`).join('');
  const itemsJson = items.map(i => JSON.stringify({ id: i.id, nama: i.nama, stok_akhir: i.stok_akhir, harga_pokok: i.harga_pokok })).join(',');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah Penjualan - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/penjualan/create" class="form" id="penjualan-form">${csrfField(props.csrf)}
        <div class="form-row">
          <div class="form-group">
            <label for="pelanggan_id">Pelanggan</label>
            <select id="pelanggan_id" name="pelanggan_id" required>
              <option value="">-- Pilih Pelanggan --</option>${raw(pelangganOptions)}
            </select>
          </div>
          <div class="form-group">
            <label for="tanggal">Tanggal</label>
            <input type="date" id="tanggal" name="tanggal" value="${tanggal}" required>
          </div>
        </div>
        <div class="form-group">
          <label for="catatan">Catatan</label>
          <textarea id="catatan" name="catatan" rows="2" placeholder="Masukkan catatan (opsional)">${catatan}</textarea>
        </div>
        <h3>Detail Item</h3>
        <table class="data-table" id="detail-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Stok Tersedia</th>
              <th scope="col">Qty</th>
              <th scope="col">Harga Jual</th>
              <th scope="col">Subtotal</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody id="detail-rows">
            <!-- Dynamic rows will be added here -->
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align: right;"><strong>Total:</strong></td>
              <td colspan="2"><strong id="total-display">Rp 0</strong></td>
            </tr>
          </tfoot>
        </table>
        <button type="button" class="btn btn-secondary" id="add-row-btn">+ Tambah Item</button>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan Penjualan</button>
          <a href="/penjualan" class="btn btn-secondary">Batal</a>
        </div>
      </form>
      <script type="application/json" id="items-data">[${itemsJson}]</script>
      <script src="/penjualan.js"></script>
    `
  });
}

export function renderPenjualanView(props: { penjualan: PenjualanForm; detail: PenjualanDetailRow[]; csrf: string } & PageProps): string {
  const { penjualan, detail, csrf } = props;
  const detailRows = detail.map((d, i) => html`
    <tr>
      <td>${i + 1}</td>
      <td>${d.item_nama}</td>
      <td>${d.qty}</td>
      <td class="numeric">Rp ${d.harga_jual.toLocaleString('id-ID')}</td>
      <td class="numeric">Rp ${d.harga_pokok.toLocaleString('id-ID')}</td>
      <td class="numeric">Rp ${d.subtotal.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: penjualan.nomor_transaksi + ' - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Penjualan</h2></div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">No. Transaksi</span><span class="detail-value">${penjualan.nomor_transaksi}</span></div>
        <div class="detail-row"><span class="detail-label">Tanggal</span><span class="detail-value">${penjualan.tanggal}</span></div>
        <div class="detail-row"><span class="detail-label">Pelanggan</span><span class="detail-value">${penjualan.pelanggan_nama}</span></div>
        <div class="detail-row"><span class="detail-label">Catatan</span><span class="detail-value">${penjualan.catatan || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat oleh</span><span class="detail-value">${penjualan.created_by_username || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Dibuat pada</span><span class="detail-value">${penjualan.created_at ?? ''}</span></div>
      </div>
      <h3>Detail Item</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">No</th><th>Item</th><th>Qty</th>
            <th scope="col">Harga Jual</th><th scope="col">HPP</th><th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>${raw(detailRows)}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align: right;"><strong>Total:</strong></td>
            <td><strong>Rp ${penjualan.total.toLocaleString('id-ID')}</strong></td>
          </tr>
        </tfoot>
      </table>
      <div class="form-actions">
        <form action="/penjualan/${penjualan.id}/delete" method="POST" class="inline-form" data-confirm="Yakin ingin hapus penjualan ini? Stok akan dikembalikan.">${csrfField(csrf)}<button type="submit" class="btn btn-delete">Hapus</button></form>
        <a href="/penjualan" class="btn btn-secondary">Kembali</a>
      </div>
    `
  });
}

// ---------- stok ----------
type KartuForm = { id?: number; nama: string; stok_akhir?: number; harga_pokok?: number };

export function renderStokKartu(props: { items: { id: number; nama: string }[]; selected_item: KartuForm; mutasi?: MutasiRow[]; csrf: string } & PageProps): string {
  const { items, selected_item, mutasi = [], csrf } = props;
  const mutasiRows = mutasi.map((m, i) => html`
    <tr>
      <td>${m.tanggal}</td>
      <td>${m.nomor_referensi}</td>
      <td>${raw(m.jenis_mutasi === 'IN' ? html`<span class="badge badge-success">Masuk</span>` : html`<span class="badge badge-danger">Keluar</span>`)}</td>
      <td class="numeric">${m.qty}</td>
      <td class="numeric">Rp ${m.harga.toLocaleString('id-ID')}</td>
      <td class="numeric">${m.saldo_berjalan}</td>
    </tr>
  `).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Kartu Stok - Sistem Inventory',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header">
        <h2>Kartu Stok</h2>
        <form method="GET" action="/stok/kartu" class="inline-form">
          <div class="form-group" style="margin-bottom:0;">
            <label for="item_id" style="display:inline; margin-right:8px;">Pilih Item</label>
            <select name="item_id" id="item_id" style="width:auto; display:inline-block;">
              ${raw(items.map(i => html`<option value="${i.id}" ${selected_item && i.id == selected_item.id ? 'selected' : ''}>${i.nama}</option>`).join(''))}
            </select>
            <button type="submit" class="btn btn-primary btn-sm" style="margin-left:8px;">Tampilkan</button>
          </div>
        </form>
      </div>
      ${selected_item
        ? raw(html`
      <div class="detail-card">
        <div class="detail-row"><span class="detail-label">Item</span><span class="detail-value">${selected_item.nama}</span></div>
        <div class="detail-row"><span class="detail-label">Stok Akhir</span><span class="detail-value">${selected_item.stok_akhir ?? 0}</span></div>
        <div class="detail-row"><span class="detail-label">HPP Rata-rata</span><span class="detail-value">Rp ${formatRupiah(selected_item.harga_pokok)}</span></div>
      </div>`)
        : raw(html`<div class="empty-state"><p>Belum ada item. Tambahkan item terlebih dahulu.</p></div>`)}
      ${mutasi.length
        ? raw(html`<table class="data-table">
            <thead>
              <tr>
                <th scope="col">Tanggal</th><th scope="col">No. Referensi</th><th scope="col">Jenis</th>
                <th scope="col">Qty</th><th scope="col">Harga</th><th scope="col">Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody>${raw(mutasiRows)}</tbody>
          </table>`)
        : raw(html`<div class="empty-state"><p>Belum ada mutasi stok untuk item ini.</p></div>`)}
      <script src="/kartu-stok.js"></script>
    `
  });
}

// ---------- laporan ----------
export function renderLaporanPenjualan(props: { details?: LaporanDetailRow[]; start_date?: string; end_date?: string; total_transaksi?: number; total_item?: number; total_penjualan?: number; total_margin?: number; csrf: string } & PageProps): string {
  const { details = [], start_date = '', end_date = '', total_transaksi = 0, total_item = 0, total_penjualan = 0, total_margin = 0, csrf } = props;
  const detailRows = details.map((d, i) => {
    const margin = d.harga_jual - d.harga_pokok;
    const cls = margin >= 0 ? 'margin-positive' : 'margin-negative';
    return html`
      <tr>
        <td>${d.nomor_transaksi}</td>
        <td>${d.tanggal}</td>
        <td>${d.pelanggan_nama}</td>
        <td>${d.item_nama}</td>
        <td class="numeric">${d.qty}</td>
        <td class="numeric">Rp ${d.harga_jual.toLocaleString('id-ID')}</td>
        <td class="numeric">Rp ${d.harga_pokok.toLocaleString('id-ID')}</td>
        <td class="numeric">Rp ${d.subtotal.toLocaleString('id-ID')}</td>
        <td class="numeric ${cls}">Rp ${margin.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Laporan Penjualan - Sistem Inventory',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header">
        <h2>Laporan Penjualan</h2>
        <form method="GET" action="/laporan/penjualan" class="inline-form" style="display:flex; gap:10px; align-items:flex-end;">
          <div class="form-group" style="margin-bottom:0;">
            <label for="start_date">Dari</label>
            <input type="date" id="start_date" name="start_date" value="${start_date}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label for="end_date">Sampai</label>
            <input type="date" id="end_date" name="end_date" value="${end_date}">
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Filter</button>
          <a href="/laporan/penjualan" class="btn btn-secondary btn-sm">Reset</a>
        </form>
      </div>
      <div class="summary-cards">
        <div class="summary-card"><div class="summary-label">Total Transaksi</div><div class="summary-value">${total_transaksi}</div></div>
        <div class="summary-card"><div class="summary-label">Item Terjual</div><div class="summary-value">${total_item}</div></div>
        <div class="summary-card"><div class="summary-label">Total Penjualan</div><div class="summary-value">Rp ${total_penjualan.toLocaleString('id-ID')}</div></div>
        <div class="summary-card"><div class="summary-label">Total Margin</div><div class="summary-value">Rp ${total_margin.toLocaleString('id-ID')}</div></div>
      </div>
      ${details.length
        ? raw(html`<table class="data-table">
            <thead>
              <tr>
                <th scope="col">No. Transaksi</th><th scope="col">Tanggal</th><th scope="col">Pelanggan</th><th scope="col">Item</th>
                <th scope="col">Qty</th><th scope="col">Harga Jual</th><th scope="col">HPP</th><th scope="col">Subtotal</th><th scope="col">Margin</th>
              </tr>
            </thead>
            <tbody>${raw(detailRows)}</tbody>
          </table>`)
        : raw(html`<div class="empty-state"><p>Belum ada data penjualan.</p></div>`)}
    `
  });
}

export function renderLaporanStok(props: { items: StokItemRow[]; total_items?: number; total_value?: number; low_stock_count?: number; out_of_stock_count?: number; csrf: string } & PageProps): string {
  const { items = [], total_items = 0, total_value = 0, low_stock_count = 0, out_of_stock_count = 0, csrf } = props;
  const itemRows = items.map((i, idx) => {
    let status = 'Aman';
    let cls = 'badge-success';
    if (i.qty_akhir === 0) { status = 'Habis'; cls = 'badge-danger'; }
    else if (i.qty_akhir < 10) { status = 'Menipis'; cls = 'badge-warning'; }
    return html`
      <tr>
        <td>${idx + 1}</td>
        <td>${i.nama}</td>
        <td>${i.category}</td>
        <td class="numeric">${i.qty_akhir}</td>
        <td class="numeric">Rp ${i.harga_pokok_rata.toLocaleString('id-ID')}</td>
        <td class="numeric">Rp ${(i.qty_akhir * i.harga_pokok_rata).toLocaleString('id-ID')}</td>
        <td><span class="badge ${cls}">${status}</span></td>
      </tr>
    `;
  }).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Laporan Stok - Sistem Inventory',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Laporan Stok</h2></div>
      <div class="summary-cards">
        <div class="summary-card"><div class="summary-label">Total Item</div><div class="summary-value">${total_items}</div></div>
        <div class="summary-card"><div class="summary-label">Total Nilai Stok</div><div class="summary-value">Rp ${total_value.toLocaleString('id-ID')}</div></div>
        <div class="summary-card"><div class="summary-label">Stok Menipis</div><div class="summary-value">${low_stock_count}</div></div>
        <div class="summary-card"><div class="summary-label">Stok Habis</div><div class="summary-value">${out_of_stock_count}</div></div>
      </div>
      ${items.length
        ? raw(html`<table class="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th><th scope="col">Kategori</th><th scope="col">Stok</th>
                <th scope="col">HPP Rata-rata</th><th scope="col">Nilai Stok</th><th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>${raw(itemRows)}</tbody>
          </table>`)
        : raw(html`<div class="empty-state"><p>Belum ada data stok.</p></div>`)}
    `
  });
}

// ---------- users ----------
export function renderUsersIndex(props: { users: UserRow[]; user_perms: Record<string, string[]>; csrf: string; current_user_id?: number } & PageProps): string {
  const { users, user_perms, csrf, current_user_id } = props;
  const rows = users.map((u, i) => {
    const edit = user_perms.users?.includes('edit')
      ? html`<a href="/users/${u.id}/edit" class="btn btn-small btn-edit">Edit</a>`
      : '';
    // Bandingkan id baris dengan id user yang SEDANG LOGIN. Versi lama salah:
    // membandingkan `Number(u.id)` dengan `Number(csrf)` — `csrf` adalah token
    // random sehingga `Number(csrf)` = NaN, kondisi selalu true ALAIHAL
    // maksudnya (sembunyikan tombol hapus untuk diri sendiri) tidak tercapai.
    // Handler delete sudah benar menolak hapus diri sendiri (id === userId),
    // tapi UI harus konsisten: tombol hapus disembunyikan di baris sendiri.
    const del = user_perms.users?.includes('delete') && u.id !== current_user_id
      ? html`<form method="POST" action="/users/${u.id}/delete" style="display:inline;" data-confirm="Hapus user ini?">${csrfField(csrf)}<button type="submit" class="btn btn-small btn-danger">Hapus</button></form>`
      : '';
    return html`
      <tr>
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.role_nama}</td>
        <td>${u.created_at}</td>
        <td class="actions">
          <a href="/users/${u.id}" class="btn btn-small btn-view">Lihat</a>
          ${raw(edit)}
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.users?.includes('create')
    ? html`<a href="/users/create" class="btn btn-primary">+ Tambah User</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Data User</h2>${raw(add)}</div>`;
  const table = users.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">ID</th><th>Username</th><th>Role</th><th>Dibuat</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : html`<div class="empty-state"><p>Belum ada user. <a href="/users/create">Tambah user pertama</a></p></div>`;
  return renderBaseItem({ current_user: props.current_user,  title: 'Data User - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderUsersCreate(props: { roles?: { id: number; nama: string }[]; username?: string; role_id?: number; csrf: string } & PageProps): string {
  const { roles = [], username = '', role_id } = props;
  const roleOptions = roles.map(r => `<option value="${r.id}" ${role_id == r.id ? 'selected' : ''}>${r.nama}</option>`).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah User - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/users/create" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" value="${username}" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required>
        </div>
        <div class="form-group">
          <label for="role_id">Role</label>
          <select id="role_id" name="role_id" required>
            <option value="">-- Pilih Role --</option>${raw(roleOptions)}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/users" class="btn">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderUsersEdit(props: { user: UserRow; roles: { id: number; nama: string }[]; csrf: string } & PageProps): string {
  const { user, roles, csrf } = props;
  const roleOptions = roles.map(r => `<option value="${r.id}" ${user.role_id == r.id ? 'selected' : ''}>${r.nama}</option>`).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Edit User - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <form method="POST" action="/users/${user.id}/edit" class="form">${csrfField(csrf)}
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" value="${user.username}" required>
        </div>
        <div class="form-group">
          <label for="password">Password (kosongkan jika tidak diubah)</label>
          <input type="password" id="password" name="password">
        </div>
        <div class="form-group">
          <label for="role_id">Role</label>
          <select id="role_id" name="role_id" required>
            <option value="">-- Pilih Role --</option>${raw(roleOptions)}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/users" class="btn">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderUsersView(props: { user: UserRow; csrf: string } & PageProps): string {
  const { user, csrf } = props;
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Detail User - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail User</h2></div>
      <table class="data-table">
        <tbody>
          <tr><th scope="col">ID</th><td>${user.id}</td></tr>
          <tr><th scope="col">Username</th><td>${user.username}</td></tr>
          <tr><th scope="col">Role</th><td>${user.role_nama}</td></tr>
          <tr><th scope="col">Dibuat</th><td>${user.created_at}</td></tr>
        </tbody>
      </table>
      <div class="form-actions" style="margin-top: 20px;">
        <a href="/users" class="btn">Kembali</a>
        <a href="/users/${user.id}/edit" class="btn btn-primary">Edit</a>
      </div>
    `
  });
}

// ---------- roles ----------
type RoleForm = { id?: number; nama: string; deskripsi?: string; user_count?: number; created_at?: string };

export function renderRolesIndex(props: { roles: RoleRow[]; user_perms: Record<string, string[]>; csrf: string } & PageProps): string {
  const { roles, user_perms, csrf } = props;
  const rows = roles.map((r, i) => {
    const edit = user_perms.roles?.includes('edit')
      ? html`<a href="/roles/${r.id}/edit" class="btn btn-small btn-edit">Edit</a>`
      : '';
    const del = user_perms.roles?.includes('delete') && r.user_count == 0
      ? html`<form method="POST" action="/roles/${r.id}/delete" style="display:inline;" data-confirm="Hapus role ini?">${csrfField(csrf)}<button type="submit" class="btn btn-small btn-danger">Hapus</button></form>`
      : html`<button type="button" class="btn btn-small btn-danger" disabled title="Tidak dapat dihapus: masih dipakai ${r.user_count} user">Hapus</button>`;
    return html`
      <tr>
        <td>${r.id}</td>
        <td>${r.nama}</td>
        <td>${r.deskripsi || '-'}</td>
        <td>${r.user_count ?? 0}</td>
        <td class="actions">
          <a href="/roles/${r.id}" class="btn btn-small btn-view">Lihat</a>
          ${raw(edit)}
          ${raw(del)}
        </td>
      </tr>
    `;
  }).join('');
  const add = user_perms.roles?.includes('create')
    ? html`<a href="/roles/create" class="btn btn-primary">+ Tambah Role</a>`
    : '';
  const listHeader = html`<div class="list-header"><h2>Data Role</h2>${raw(add)}</div>`;
  const table = roles.length
    ? html`<table class="data-table">
        <thead>
          <tr>
            <th scope="col">ID</th><th>Nama</th><th>Deskripsi</th><th scope="col">User Count</th><th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>${raw(rows)}</tbody>
      </table>`
    : html`<div class="empty-state"><p>Belum ada role. <a href="/roles/create">Tambah role pertama</a></p></div>`;
  return renderBaseItem({ current_user: props.current_user,  title: 'Data Role - CRUD Item', user_perms, csrf_token: csrf, content: listHeader + table });
}

export function renderRolesCreate(props: { menus?: string[]; actions?: string[]; nama?: string; deskripsi?: string; permissions?: Record<string, string[]>; csrf: string } & PageProps): string {
  const { menus = ['items','kategori','pelanggan','users','roles','supplier','pembelian','penjualan','stok','laporan'], actions = ['view','create','edit','delete'], nama = '', deskripsi = '', permissions = {} } = props;
  const menuRows = menus.map(menu => {
    const checked = permissions[menu] ?? [];
    const cells = actions.map(a => {
      const checkedAttr = checked.includes(a) ? 'checked' : '';
      return html`<td><input type="checkbox" name="perm_${menu}" value="${a}" ${checkedAttr}></td>`;
    }).join('');
    return html`<tr><td><strong>${MENU_LABELS[menu] || menu}</strong></td>${raw(cells)}</tr>`;
  }).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Tambah Role - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/roles/create" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="nama">Nama Role</label>
          <input type="text" id="nama" name="nama" value="${nama}" required>
        </div>
        <div class="form-group">
          <label for="deskripsi">Deskripsi</label>
          <textarea id="deskripsi" name="deskripsi" rows="2">${deskripsi}</textarea>
        </div>
        <div class="form-group">
          <label>Permissions</label>
          <table class="data-table table-perms">
            <thead>
              <tr>
                <th scope="col">Menu</th>
                ${raw(actions.map(a => html`<th scope="col">${a}</th>`).join(''))}
              </tr>
            </thead>
            <tbody>${raw(menuRows)}</tbody>
          </table>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/roles" class="btn">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderRolesEdit(props: { role: RoleForm; menus?: string[]; actions?: string[]; permissions?: Record<string, string[]>; current_perms?: Record<string, string[]>; csrf: string } & PageProps): string {
  const { role, menus = ['items','kategori','pelanggan','users','roles','supplier','pembelian','penjualan','stok','laporan'], actions = ['view','create','edit','delete'], permissions = {}, current_perms = {} } = props;
  const menuRows = menus.map(menu => {
    const checked = permissions[menu] ?? current_perms[menu] ?? [];
    const cells = actions.map(a => {
      const checkedAttr = checked.includes(a) ? 'checked' : '';
      return html`<td><input type="checkbox" name="perm_${menu}" value="${a}" ${checkedAttr}></td>`;
    }).join('');
    return html`<tr><td><strong>${MENU_LABELS[menu] || menu}</strong></td>${raw(cells)}</tr>`;
  }).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Edit Role - CRUD Item',
    user_perms: {},
    csrf_token: props.csrf,
    content: html`
      <form method="POST" action="/roles/${role.id}/edit" class="form">${csrfField(props.csrf)}
        <div class="form-group">
          <label for="nama">Nama Role</label>
          <input type="text" id="nama" name="nama" value="${role.nama}" required>
        </div>
        <div class="form-group">
          <label for="deskripsi">Deskripsi</label>
          <textarea id="deskripsi" name="deskripsi" rows="2">${role.deskripsi || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Permissions</label>
          <table class="data-table table-perms">
            <thead>
              <tr>
                <th scope="col">Menu</th>
                ${raw(actions.map(a => html`<th scope="col">${a}</th>`).join(''))}
              </tr>
            </thead>
            <tbody>${raw(menuRows)}</tbody>
          </table>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan</button>
          <a href="/roles" class="btn">Batal</a>
        </div>
      </form>
    `
  });
}

export function renderRolesView(props: { role: RoleForm; permissions?: Record<string, string[]>; user_count?: number; csrf: string; actions?: string[] } & PageProps): string {
  const { role, permissions = {}, user_count = 0, csrf, actions = ['view','create','edit','delete'] } = props;
  const permRows = ['items','kategori','pelanggan','users','roles'].map(menu => {
    const cell = actions.map(a => html`<td>${permissions[menu]?.includes(a) ? '✅' : '—'}</td>`).join('');
    return html`<tr><td><strong>${menu}</strong></td>${raw(cell)}</tr>`;
  }).join('');
  return renderBaseItem({ current_user: props.current_user, 
    title: 'Detail Role - CRUD Item',
    user_perms: {},
    csrf_token: csrf,
    content: html`
      <div class="list-header"><h2>Detail Role</h2></div>
      <table class="data-table">
        <tbody>
          <tr><th scope="col">ID</th><td>${role.id}</td></tr>
          <tr><th scope="col">Nama</th><td>${role.nama}</td></tr>
          <tr><th scope="col">Deskripsi</th><td>${role.deskripsi || '-'}</td></tr>
          <tr><th scope="col">User Count</th><td>${user_count}</td></tr>
          <tr><th scope="col">Dibuat</th><td>${role.created_at ?? ''}</td></tr>
        </tbody>
      </table>
      <h3>Permissions</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Menu</th>
            <th scope="col">View</th><th scope="col">Create</th><th scope="col">Edit</th><th scope="col">Delete</th>
          </tr>
        </thead>
        <tbody>${raw(permRows)}</tbody>
      </table>
      <div class="form-actions" style="margin-top: 20px;">
        <a href="/roles" class="btn">Kembali</a>
        <a href="/roles/${role.id}/edit" class="btn btn-primary">Edit</a>
      </div>
    `
  });
}
