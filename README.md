# testopencode-cloudflare

Port **CRUD Item (testopencode)** dari Render (Flask + SQLite + Jinja2) ke
**Cloudflare Workers + D1**.

- **Sumber (arsip):** `../testopencode/` — repo `hafazahh/testopencode`, 43 route,
  13 tabel SQLite, 24 template, 7 JS statis.
- **Task plan:** `task_plan.md`
- **Board kanban:** `testopencode-cloudflare`

## Kenapa pindah

`crud.choirulhaq.com` **503 "Service Suspended"** (terverifikasi 2026-10-24).
Akar masalah: free tier Render punya kuota **750 instance-hours/bulan yang
dibagi semua service gratis di akun**. Workers free = **100.000 request/hari
tanpa batas jam bulanan**.

## Status Fase B — skeleton lokal (2026-10-24)

**Fase B resmi (repo GitHub baru + D1 remote) DI-SKIP** atas permintaan user.
Yang dibuat sekarang hanya **skeleton lokal** supaya Fase C–E tetap bisa jalan:

- `wrangler.toml` memakai `database_id` **placeholder**. `wrangler dev` memakai
  **D1 lokal (SQLite)** — tidak perlu resource Cloudflare untuk mengembangkan
  dan menguji.
- Belum ada `git init`, belum ada remote, belum ada D1 remote.

Saat Fase B dikerjakan: `git init` → repo `hafazahh/testopencode-cloudflare` →
`wrangler d1 create testopencode-db` → isi `database_id` → `wrangler deploy` →
custom domain **lewat dashboard** (bukan `routes` di `wrangler.toml`).

## Struktur

```
testopencode-cloudflare/
├── src/
│   ├── index.ts     # Hono app — /health, /healthz (43 route diisi Fase C)
│   ├── db.ts        # data layer D1 (Fase C)
│   ├── auth.ts      # session + PBKDF2 + RBAC (Fase C)
│   ├── headers.ts   # CSP nonce + security headers (Fase D)
│   └── env.d.ts     # bindings
├── scripts/
│   └── seed.mjs     # skema + data awal (Fase C)
├── task_plan.md
├── findings.md
├── progress.md
├── wrangler.toml
└── package.json
```

## Cara jalan

```bash
npm install
npm run cf-typegen     # generate src/env.d.ts penuh dari wrangler
npm run dev            # wrangler dev --port 8790 (D1 lokal)
```

## Aturan khusus

- **JANGAN commit/push ke repo lama** `hafazahh/testopencode`.
- **JANGAN deploy ke `crud.choirulhaq.com`** sebelum user bilang "ok".
- **JANGAN longgarkan CSP.** Tombol mati dan `onsubmit` mati di Flask karena
  `script-src 'self'` — port pakai nonce + JS eksternal, bukan CSP longgar.
- **JANGAN bawa kolom `password_plain`** dari Flask. Itu menampilkan password
  plaintext di halaman login publik; jangan taruh lubang yang sama di sini.
- **PBKDF2 maksimum 100.000 iterasi** (batas workerd). Lebih = login gagal senyap.
