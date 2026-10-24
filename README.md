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

## Status Fase B — SELESAI (2026-10-24)

- **Repo GitHub:** https://github.com/hafazahh/testopencode-cloudflare (public,
  branch `main`, remote `origin` via SSH)
- **D1:** `testopencode-db`, id `016434ea-d911-4825-b20d-128df18c826b`, region APAC
- **Sudah di-seed ke remote:** 12 tabel + 3 role + 4 kategori + 1 user admin
  (tanpa kolom `password_plain`)
- **Belum:** `wrangler deploy` + custom domain (Fase F, menunggu persetujuan user)

Custom domain diatur **lewat dashboard**, bukan lewat `routes` di `wrangler.toml`
(menambah `routes` tidak bisa diandalkan mengaktifkan routing custom domain —
lihat skill `cloudflare-worker-api`). Target domain: `crud.choirulhaq.com`
(cutover setelah user menyetujui; Render lama dilepas lebih dulu).

`wrangler dev` memakai **D1 lokal (SQLite)** — pengembangan dan pengujian Fase C–E
tidak bergantung pada resource Cloudflare.

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
