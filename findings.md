# findings.md — Fase C1 (testopencode-cloudflare): skema D1 + data layer

## Sumber
- Flask archive: `/home/choirulhaq/venvProject/testopencode/app.py` (`init_db()`, 13 tabel DDL).
- Sumber data: `/home/choirulhaq/venvProject/testopencode/database.db` (SQLite).
- Target: Cloudflare Workers + D1. Local D1 (miniflare) digunakan untuk verifikasi.

## Skema D1 (12 tabel)
items, kategori, pelanggan, supplier, pembelian, pembelian_detail, penjualan,
penjualan_detail, roles, stok_akhir, stok_mutasi, users.

## Perubahan vs Flask (SQLite → D1)

### fitur yang diperiksa
| Fitur SQLite | Status di D1 | Catatan |
|---|---|---|
| `GENERATED ALWAYS AS ... STORED` (items.margin) | ✅ diterima (syntax OK) | `margin = harga_jual - harga_pokok`; perlu verifikasi SELECT di D1 |
| `INSERT OR IGNORE` / `ON CONFLICT` | ✅ | dipakai di seed untuk idempotensi |
| `CHECK(qty > 0)`, `CHECK(jenis_mutasi IN ('IN','OUT'))` | ✅ | diterima |
| `UNIQUE` (nomor_transaksi, username) | ✅ | diterima |
| `FOREIGN KEY ... ON DELETE` | ✅ | `RESTRICT` / `CASCADE`; D1 tidak aktifkan FK secara default, validasi di-handle di app layer |
| `AUTOINCREMENT` | ✅ | diterima |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | ✅ | diterima |
| PRAGMA journal_mode / busy_timeout | ❌ | tidak dipakai (urusan file lokal) |

### keputusan desain
- `users` TIDAK mengandung kolom `password_plain` (aturan keras kartu C1).
- `password_hash` berisi PBKDF2-SHA256: `pbkdf2$100000$<saltB64>$<hashB64>`.
- Schema huruf kapital/indentasi rapi (PRAGMA table_info dari app.py + sqlite_master).

## Data awal (seed)
- 3 role: admin, kasir, gudang + permissions JSON persis dari app.py.
- 4 kategori: Elektronik, Makanan, Pakaian, Lainnya.
- 1 user: admin (idempoten, username UNIQUE).

## Verifikasi (Fase C1)
- `tsc`: diagnostics total 0 (0 di own sources).
- Schema D1 lokal: 12 tabel (`items` s/d `users`).
- Baris: roles=3, kategori=4, users=1.
- Idempoten: seed 2x → baris tetap 3/4/1.

## Fase D — port tampilan (Jinja2 → template string + static JS + CSP headers)
- `src/headers.ts`: `securityHeaders(_nonce, _isSecure)` — CSP dengan `script-src 'self' 'nonce-${_nonce}'`, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, COOP/COEP, CORP, HSTS (hanya HTTPS, tanpa `preload`).
- `src/render.ts`: 37 `export function render*` — setiap template Jinja2 jadi fungsi render string HTML lewat tagged template `html` (escape otomatis). Tidak ada inline handler `on*=` (CSP-safe).
- `static/`: confirm.js, margin.js, pembelian.js, penjualan.js, kartu-stok.js, favicon.svg, style.css.
- `login.html` port: tanpa tabel `password_plain` (password plaintext dihapus dari tampilan).
- `tsc`: diagnostics total 0.
- `grep on*= static/ src/`: tidak ada inline handler.
- `grep script-src src/headers.ts`: mengandung `nonce-`, tidak ada `unsafe-inline`.
- `grep password_plain src/`: bersih.

## Fase C2b — type error users/roles (commit `56a0be2`)
- 10 diagnostic: 6 di `src/routes/users.ts` + 4 di `src/routes/roles.ts`.
- Perbaikan:
  - `users.ts`: `.all<UserRow>().results` (bukan D1Result); map UserRow eksplisit tanpa spread (`id/username/role_id/created_at/role_nama`); `c.req.parseBody()` + cast `Record<string, string> & { get, getAll }`; `JSON.parse` permissions → `Record<string, string[]>`; `user as UserRow` → objek `userView: UserRow` eksplisit.
  - `roles.ts`: rename variabel `rows` → `roleRows` (konflik dengan fungsi helper `rows`); `JSON.parse(String(permsRow.permissions ?? ''))` → `Record<string, string[]>`; `c.req.parseBody()` + cast dengan `getAll`.
- Verifikasi: `node scripts/tscheck.mjs` → `grep src/routes/users.ts src/routes/roles.ts` → kosong → `BERSIH`.
- Kriteria diterima: 0 diagnostic pada dua file; `git log` memuat commit `56a0be2` (working tree clean).

---

# Fase E — Recon: test suite (Flask archive) + Cloudflare Worker API surface
_Explorasi tanpa modifikasi. Disimpan sebagai catatan, bukan implementasi._

## 1. Python test suite — repo Flask `testopencode/` (arsip sumber)

Semua file berjalan dengan `python3` (di virtualenv), meng-impor `app` (Flask +
SQLite) dan `get_db`/`init_db`. Setiap skrip menggunakan `app.test_client()`,
kecuali yang memakai `curl via subprocess` (fase2_curl, fase3_curl; menjalankan
server Flask di background) atau server live (`fase2_live.py`).

| File | Fokus | Gagal/berhasil | Key assertions |
|---|---|---|---|
| `verify_security.py` | Security hardening (headers, cookie flags, rate limit, CSRF) | 1.1 headers: CSP `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, **tidak ada `unsafe-inline`**; X-Content-Type-Options `nosniff`; X-Frame-Options `DENY`; Referrer-Policy, Permissions-Policy, COOP, CORP. 1.2 cookie: `HttpOnly`, `SameSite`, `SESSION_COOKIE_SECURE=True` (dikonfigurasi, Flask emit `Secure` hanya saat request HTTPS). 1.3 Secure cookie + HSTS `max-age=31536000; includeSubDomains` atas simulated HTTPS (`base_url='https://...'`); HSTS **tidak** dikirim over `http://`. 1.4 Login rate limit: 7 wrong password → lockout message `Terlalu banyak percobaan gagal`/`terkunci`; `login_locked_for('admin') > 0`. 1.5 CSRF: POST tanpa token → 403; token `bogus` → 403. 1.6 403 real status + body HTML `Akses Ditolak`. 1.7 anonim GET `/`, `/users`, `/roles`, `/kategori`, `/pelanggan` → 302 ke `/login`. |

| `test_fase2.py` | Fase 2: Supplier + Pembelian CRUD | ✅ | Login admin → create/list/view/edit/delete supplier; create/list/view/edit/delete pembelian; nomor transaksi `PB-2026-0001`; validation: nama/tempat kosong → `wajib diisi`, qty `-5` → `lebih dari 0`, harga `-10000` → `negatif`; navigasi `Data Supplier` / `Pembelian`; header CSP/X-Frame-Options/X-Content-Type-Options. Rely on CSRF token parsing per page (`name="csrf_token" value="..."`). |
| `test_fase3.py` | Fase 3: Penjualan | ✅ | Setup: create pelanggan, items A/B, supplier + pembelian (stok), login. Create penjualan → `PJ-2026-0001`; view detail menampilkan item + HPP snapshot; `stok_akhir` item1 = 7, item2 = 3; `stok_mutasi` 2 row OUT; `penjualan_detail` 2 row; delete penjualan → stok dikembalikan 10/5, mutasi terhapus; validation: pelanggan kosong/date kosong → `wajib`, qty `-5` → `lebih dari 0`, harga `-10000` → `negatif`, qty `9999` → `tidak cukup`/`Stok`; navigasi & headers. |
| `test_fase4.py` | Fase 4: Kartu stok + laporan + login page | ✅ | Login page: info card `login-info-card`, title `Sistem Manajemen Inventory`, fitur Master Data/Transaksi/Laporan/Multi-User; CSRF token tersedia. Routes: `/stok/kartu`, `/laporan/penjualan?start_date=...&end_date=...`, `/laporan/stok` → 200 + expected text; `/stok/kartu?item_id=1` detail; nav links. (Pakai temp DB lewat env `DATABASE` + `m.DATABASE = TMP_DB`.) |
| `test_fase5.py` | Fase 5: RBAC menu baru (stok, laporan) + seed kasir/gudang | ✅ | Seed peran: `kasir` (view/create/edit penjualan, stok, laporan, items; **tidak** users/roles), `gudang` (supplier/pembelian/stok/items; penjualan view-only; **tidak** users/roles). admin punya `stok`/`laporan`. Nav:`/` menampilkan link sesuai role (admin: semua; kasir: no Data User/Data Role). Kasir `/users` → 302; gudang `/penjualan/create` → 302. `/stok/kartu` & `/laporan/penjualan` tanpa login → 302. (Buat user sementara `test_kasir`/`test_gudang` lewat `INSERT OR IGNORE` + `werkzeug.security.generate_password_hash`.) |
| `test_fase6.py` | Fase 6: seed data awal, idempotent | ✅ | Consistency: `stok_akhir.qty_akhir` = saldo `stok_mutasi` per item; ada penjualan (`PJ-` prefix) & pembelian (`PB-` prefix) > 0; `penjualan_detail.total` == `penjualan.total`; `stok_akhir` ada untuk semua item dengan mutasi; **tidak ada** user `test_kasir`/`test_gudang`; roles = admin/kasir/gudang; `stok_akhir` tidak negatif; laporan `/laporan/penjualan` & `/laporan/stok` merespons 200 + content. |
| `test_fase7.py` | Fase 7: atomicity + validasi stok | ✅ | Rollback: jual qty 99999 → stok & mutasi tetap; beli qty `-5` → tidak ada mutasi baru; jual melebihi stok → stok tidak berubah; **normal**: jual 1 → stok -1, beli 5 → mutasi +1; multi-item: 1 item OK + 1 qty 99999 → semua item tidak berubah. (SETUP: login, item stok >= 10, pelanggan ada.) |

**File terkait yang tidak ada di daftar, tapi ada di folder** (untuk konteks
naming): `test_enhancement.py` (CRUD umum + DB init + CSRF parse), `test_login_debug.py`
(login + akses penjualan via test client), `test_fase2_curl.py` /
`test_fase3_curl.py` (curl raw via subprocess, tanpa CSRF), `test_fase2_live.py` /
`test_fase3_client.py` (server live / client tanpa masalah CSRF).
Nama skrip mengikuti pola: `test_fase{N}.py` (Flask test client) dan
`verify_security.py` (security hardening). Curl-live variant: `{fase}{N}
_curl.py` / `_live.py`.

**Pola helper yang dipakai semua skrip:**
- `init_db()` sebelum client; `app.config['TESTING'] = True`;
  `WTF_CSRF_ENABLED = False` (fase2/fase3/fase7) atau `WTF_CSRF_ENABLED` tetap ON
  (verify_security, fase4, fase5, fase6).
- CSRF diekstrak dari halaman login: regex `name="csrf_token" value="([^"]+)"`.
- Validasi stok/database dicek lewat `get_db()` di `app.app_context()`.
- Password default admin: `admin123` (hash PBKDF2 `pbkdf2$100000$<salt>$<hash>`),
  role: `admin` (id 1 saat seed).

## 2. Cloudflare Worker — API surface (testopencode-cloudflare/src)

### 2.1 Entry & middleware (`src/index.ts`)
- Hono app `export const app` dibangun dari 10 `register*` + middleware global:
  `sessionMiddleware()` (D1 session) + `flashMiddleware()`.
- Per-request CSP header: nonce `crypto.getRandomValues(16)` → `securityHeaders(nonce, isSecure)`,
  dipasang pakai `app.use('*')` **sebelum** route register.
- Route register urutan: auth → items → pelanggan → kategori → users → roles →
  supplier → pembelian → penjualan → stok → laporan.
- Health: `GET /health`, `GET /healthz` → `200 ok`.

### 2.2 Route (endpoint, method, auth/middleware)
| Resource | Method + path | Auth | Middleware | Catatan |
|---|---|---|---|---|
| login | GET `/login` | publik | `sessionMiddleware` | render form + CSRF + non-admin users |
| login | POST `/login` | publik | `csrfProtect()`; `handleLogin` | redirect `/login` → `/`, error flash `password salah` / lockout |
| logout | POST `/logout` | publik | `csrfProtect()` | delete session, redirect `/login` |
| items | GET `/` | loginRequired + items:view | — | list items DESC |
| items | GET `/item/:id` | loginRequired + items:view | — | |
| items | GET `/item/create` | loginRequired + items:create | — | kategori drop-down |
| items | POST `/item/create` | loginRequired + items:create + csrfProtect | — | validate name/category/harga |
| items | GET `/item/:id/edit` | loginRequired + items:edit | — | |
| items | POST `/item/:id/edit` | loginRequired + items:edit + csrfProtect | — | |
| items | POST `/item/:id/delete` | loginRequired + items:delete + csrfProtect | — | |
| kategori | GET `/kategori` + `:id` + `/create` + `/create` POST + `/:id/edit` + `/:id/delete` | loginRequired + kategori:view|edit|create|delete | berurutan, memakai `form.getAll('perm_*')` di roles | |
| pelanggan | GET/POST `/pelanggan` (+ `/:id`, `/create`, `/:id/edit`, `/:id/delete`) | loginRequired + pelanggan:* | csrfProtect | validasi email/telepon regex |
|supplier | GET/POST `/supplier` (+ `/:id`, `/create`, `/:id/edit`, `/:id/delete`) | loginRequired + supplier:* | csrfProtect | diblokir hapus kalau ada pembelian |
| roles | GET/POST `/roles` (+ `/:id`, `/create`, `/:id/edit`, `/:id/delete`) | loginRequired + roles:* | csrfProtect | `perm_<menu>` multi-select (view/create/edit/delete) |
| pembelian | GET/POST `/pembelian` (+ `/create`, `/:id`, `/:id/delete`) | loginRequired + pembelian:* | csrfProtect | formData; batch tx `createPembelianTx` (atomic); rollback stok saat hapus |
| penjualan | GET/POST `/penjualan` (+ `/create`, `/:id`, `/:id/delete`) | loginRequired + penjualan:* | csrfProtect | formData; `createPenjualanTx` atomic (HPP snapshot, stok_akhir, stok_mutasi OUT) |
| stok | GET `/stok/kartu` (query `item_id`) | loginRequired + stok:view | — | list all items + mutasi per item terpilih |
| laporan | GET `/laporan/penjualan` (query `start_date`,`end_date`) | loginRequired + laporan:view | — | aggregate: total_transaksi, total_item, total_penjualan, total_margin |
| laporan | GET `/laporan/stok` | loginRequired + laporan:view | — | qty_akhir, total_value, low_stock_count, out_of_stock_count |

### 2.3 Auth & request handling
- Session: D1 tabel `sessions` (id UUID32, user_id nullable, csrf_token, expires_at +7 hari).
  Cookie `testopencode_sid` = `HttpOnly; SameSite=Lax; Max-Age=604800000`; `Secure` hanya
  kalau `ENVIRONMENT === 'production'` **atau** header `X-Forwarded-Proto: https`.
- Rate limit login: 5 gagal / 15 menit per `(IP, username)`, lockout 15 menit
  (konfig di `src/context.ts` `LOGIN_MAX_ATTEMPTS=5`, `LOGIN_WINDOW_SECONDS=900`,
  `LOGIN_LOCKOUT_SECONDS=900`).
- CSRF: token dari session (`sessions.csrf_token`), dibandingkan `stringsEqual`;
  POST tanpa/token salah → `403 JSON { error: 'CSRF token invalid' }` (bukan redirect).
- Body parsing: route form menggunakan `c.req.parseBody()` (cast
  `Record<string, string> & { get, getAll }`); pembelian/penjualan pakai
  `c.req.formData()` + `form.getAll('item_id[]')`, `form.getAll('qty[]')`, `form.getAll('harga_beli[]'|'harga_jual[]')`.
- Not found / error: `c.json({ error }, 403/404)` — tidak ada custom error handler.
- Render: setiap page = `c.html(renderXxx(props))` dari `src/render.ts`
  (escape otomatis via tagged template `html`; data user di-escape, tidak ada
  concatenation dengan `+`).

### 2.4 Data layer (`src/db.ts`) — D1 prepared statements
- Entity CRUD: `listItems/getItem/createItem/updateItem/deleteItem` (items),
  `listKategori/getKategori/createKategori/updateKategori/deleteKategori`,
  `listPelanggan/getPelanggan/createPelanggan/updatePelanggan/deletePelanggan`,
  `listSupplier/getSupplier/createSupplier/updateSupplier/deleteSupplier`,
  `listUsers/getUserByUsername/getUserById/createUser/updateUser/deleteUser`,
  `listRoles/getRoleById/createRole/updateRole/deleteRole`,
  `listNonAdminUsers`, `getUserPermissions`.
- Transaksi: `createPembelianTx(db, {supplier_id, tanggal, catatan, items, userId})`
  → `{ nomor, id }` (generate nomor `PB-YYYY-NNNN`/`PJ-YYYY-NNNN` via
  `generateNomorTransaksi`); `deletePembelian` atomic batch
  (stok_mutasi + pembelian_detail + pembelian).
  `createPenjualanTx(...)` → `{ nomor, id }` (atomic; HPP snapshot dari
  `stok_akhir`, `stok_akhir` decrement, `stok_mutasi` OUT); `deletePenjualan` batch.
- Stok: `getStokTersedia(itemId)`, `listMutasiByItem(itemId)`,
  `validasiStokCukup(itemId, qty)` → `{ cukup, pesan }`.
- Konvensi query: `db.prepare(sql).bind(...)`; `.all<T>()` → `{ results }`;
  `.first<T>()` → row atau null; `.run()` → `{ success, meta.last_row_id, changes }`;
  `db.batch([...])` → `{ success, results, meta }`.
- Nilai NULL dihasilkan sebagai `undefined` (bukan `null`) — handler cast ke
  `?? undefined` sebelum ke D1.

### 2.5 Env bindings & konfigurasi
- Bindings: `DB: D1Database`, `ENVIRONMENT: string`, `SITE_URL: string`
  (didefinisikan `src/env.d.ts` + `wrangler.toml` `[[d1_databases]]`).
- `wrangler.toml`: name `testopencode-worker`, main `src/index.ts`,
  `compatibility_date = "2026-10-24"`, D1 db `testopencode-db`
  (id `016434ea-d911-4825-b20d-128df18c826b`, region APAC), vars
  `ENVIRONMENT=production`, `SITE_URL=https://testopencode-worker.choirulhaq.workers.dev`.
- `src/schema.ts`: `SCHEMA_SQL` (12 tabel + index; `users` tanpa `password_plain`;
  `margin GENERATED ALWAYS AS (harga_jual-harga_pokok) STORED`; FK RESTRICT/CASCADE;
  `sessions` tak disertakan di C1 tapi tetap ada di schema.ts — perintah C1 hapus
  `sessions`? Lihat komentar di `schema.ts`; seed.mjs menjalankan batch
  CREATE TABLE IF NOT EXISTS + idempotent INSERT).
- `src/headers.ts`: `securityHeaders(_nonce, _isSecure)` → CSP
  `default-src 'self'; script-src 'self' 'nonce-<nonce>'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self';
  frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, X-Content-Type-Options,
  X-Frame-Options `DENY`, Referrer-Policy, Permissions-Policy,
  COOP/COEP/CORP; HSTS hanya atas HTTPS (`max-age=31536000; includeSubDomains`,
  tanpa `preload`).

## 3. Starter lokal Worker (tanpa deploy)

```bash
cd /home/choirulhaq/venvProject/testopencode-cloudflare
npm install                      # hono + devDeps (typescript, wrangler, @cloudflare/workers-types)
npm run cf-typegen               # generate src/env.d.ts dari wrangler (Env interface)
npm run dev                      #  ← wrangler dev --port 8790 (D1 lokal via miniflare)
```

- D1 lokal: miniflare SQLite disimpan di `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`;
  file tersebut dimulai otomatis oleh `wrangler dev` (termasuk `D1Mock`-compatible
  API: `prepare().bind().all/.first/.run/.batch`).
- Seed database lokal: `node scripts/seed.mjs` (schema batch + 3 role + 4 kategori + admin PBKDF2, idempotent).
- Uji lokal: `npm run test:local` → `node scripts/run_local.mjs` (run semua `*.test.mjs` di
  `scripts/tests/`, sorted, aggregate `RESULT: N PASS, M FAIL`; exit 0 hanya jika 0 FAIL).
- Test hanya memerlukan Node (bawaan): `node:sqlite` (DatabaseSync), esbuild bundle
  `src/index.ts` → `scripts/.tmp-bundle/index.js` (hono + @cloudflare/workers-types eksternal).

## 4. Nama berkas & konvensi (rekomendasi dari pola yang ada)

### 4.1 Worker port (`testopencode-cloudflare/`)
| Kebagian | Konvensi | Contoh |
|---|---|---|
| Source route | `src/routes/<resource>.ts` (singular, snake_case) | `items.ts`, `pembelian.ts`, `penjualan.ts`, `stok.ts`, `laporan.ts` |
| Render props | `src/routes/render-types.ts` (interfaces row) | `ItemRow`, `PenjualanRow`, `MutasiRow` |
| Render fungsi | `src/render.ts`: `export function render<Resource>*<Props>()` | `renderIndex`, `renderViewItem`, `renderPembelianCreate` |
| Schema | `src/schema.ts` | konstan `SCHEMA_SQL` |
| DB layer | `src/db.ts` | `list*`, `get*`, `create*`, `update*`, `delete*`, `tx` suffix untuk transaksi atomic |
| Middleware | `src/auth.ts` (`sessionMiddleware`, `flashMiddleware`, `loginRequired`, `hasPermission`, `csrfProtect`, `handleLogin`) |
| Config | `wrangler.toml`, `package.json`, `tsconfig.json`, `src/env.d.ts` (typegen output) |
| Seed | `scripts/seed.mjs` (juga `npm run seed`) |
| Test suite lokal | `scripts/tests/<n>_<name>.test.mjs` (urutkan angka) | `01_security.test.mjs` |
| Helper/test util | `scripts/tests/_harness.mjs` (shared D1Mock + Client + assert + createApp) |
| Helper utility | `scripts/*.mjs`: `run_local.mjs`, `probe.mjs`, `list-miniflare.mjs`, `esbuild_bundle/index.js`, `esbuild_out/index.js` (generated), `scripts/.tmp*/index.js` (esbuild cache, `.gitignore`-ed) |
| Static | `static/*.js` + `static/*.svg` + `static/style.css` (CSP safe: no inline `on*=`; `script-src` nonce + external JS) |

### 4.2 Test suite Flask archive (`testopencode/`)
- `test_fase{N}.py` — interaksi CRUD aplikasi (Flask test client + CSRF parsing,
  db assertion via `get_db()`).
- `verify_security.py` — security hardening (headers/cookie/rate-limit/CSRF).
- `test_enhancement.py` — general CRUD + DB init + CSRF parse.
- `test_login_debug.py` — login + akses penjualan.
- `*_curl.py` — raw curl via subprocess (tanpa CSRF / tanpa client).
- `*_live.py` — server live + test client.
- `*_client.py` — test client variant.

### 4.3 Catatan penting untuk test runner
- `scripts/run_local.mjs` hanya menjalankan file yang match
  `*.test.mjs` (eksklusif `_harness.mjs`) → saat ini **hanya**
  `01_security.test.mjs` yang dijalankan; `smoke.mjs`,
  `debug_post.mjs`, `dump_login.mjs`, `verify_login.mjs` adalah utilitas dan
  **tidak** dihitung. Rekomendasi: beri nama semua suite
  `*.test.mjs` (mis. `01_security.test.mjs`, `02_login.test.mjs`, …) agar
  `npm run test:local` menyeret semuanya; atau update `collectSuites` jika
  helper tetap ingin dijalankan.
- Harness `_harness.mjs` butuh Node 22+ (node:sqlite) — cek `scripts/probe.mjs`.
- Arah uji: `verify_security.py` adalah port langsung ke Worker; `01_security.test.mjs`
  menjalankannya dengan D1Mock + esbuild-loaded app. Keduanya harus konsisten
  (cookie flags, CSP nonce, HSTSHTTPS-only, rate limit, CSRF 403).

## 5. Open questions untuk follow-up (tidak dijawab di recon ini)
- `schema.ts` masih memasukkan tabel `sessions` (13 tabel) padahal task_plan
  C1 menyebut hapusnya; periksa komit C1 (`src/schema.ts` + `scripts/seed.mjs`)
  — apakah 12 atau 13 tabel yang di-seed.
- `scripts/run_local.mjs` saat ini menghitung hanya `01_security.test.mjs`;
  `smoke.mjs`, `verify_login.mjs`, `debug_post.mjs`, `dump_login.mjs` tidak
  di-count (anggap utility).
- `env.d.ts` typegen (harus `wrangler types --env-interface Env`) masih
  memaksa `ENVIRONMENT: "local"` & `SITE_URL: "http://localhost:8790"` di
  `src/env.d.ts`; `wrangler.toml` tetap `ENVIRONMENT = "production"` — tipe
  TypeScript tidak sinkron dengan config wrangler.
- Ends of D1 FK: `ON DELETE` constraint tidak aktif di D1 default; validasi
  di-handle di app (seperti `supplier` diblokir hapus kalau ada pembelian).
