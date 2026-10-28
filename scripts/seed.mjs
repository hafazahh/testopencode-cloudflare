/**
 * Fase C1 — Seed D1 testopencode.
 *
 * Jalankan `SCHEMA_SQL` sebagai batch D1, lalu isi data awal secara idempoten:
 *   - 3 role (admin / kasir / gudang) + permissions JSON persis dari app.py
 *   - 4 kategori
 *   - user demo admin / kasir / gudang (password_hash PBKDF2 saja; tanpa
 *     password_plain; password plaintext tetap ada di src/context.ts
 *     DEMO_USERS untuk ditampilkan di halaman login)
 *
 * Usage:
 *   node scripts/seed.mjs             # D1 lokal (wrangler dev / d1 execute --local)
 *   node scripts/seed.mjs --remote    # D1 produksi
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes, pbkdf2Sync } from "node:crypto";

const remote = process.argv.includes("--remote");

// baca skema dari src/schema.ts (plain `node` tidak bisa import .ts)
const schemaSrc = readFileSync(new URL("../src/schema.ts", import.meta.url), "utf8");
const m = schemaSrc.match(/export const SCHEMA_SQL = `([\s\S]*?)`;/);
const SCHEMA_SQL = m ? m[1] : "";

// Akun demo dari src/context.ts (DEMO_USERS) — satu sumber kebenaran dengan
// halaman login. Plain `node` tidak bisa import .ts, jadi array-nya diparsing
// dari sumbernya. Field plaintext password sengaja TIDAK ditulis ke D1; hanya
// hash-nya (lihat loop user demo di bawah).
const contextSrc = readFileSync(new URL("../src/context.ts", import.meta.url), "utf8");
const demoBlock = contextSrc.match(/export const DEMO_USERS[^=]*=\s*(\[[\s\S]*?\]);/);
const DEMO_USERS = demoBlock
  ? [...demoBlock[1].matchAll(/\{\s*username:\s*'([^']+)',\s*password:\s*'([^']+)',\s*role:\s*'([^']+)'\s*\}/g)]
      .map(([, username, password, role]) => ({ username, password, role }))
  : [];
if (DEMO_USERS.length === 0) {
  throw new Error("DEMO_USERS tidak terbaca dari src/context.ts — seed user demo dilewati.");
}

/** Render a value as a SQL literal. */
function sqlLiteral(v) {
  if (typeof v === "string") {
    return "'" + v.replace(/'/g, "''") + "'";
  }
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v === null || v === undefined) return "NULL";
  return JSON.stringify(v); // objects / booleans
}

function d1(sql, params = []) {
  // wrangler `d1 execute --command` takes ONE sql string; interpolate params.
  let sqlFilled = sql;
  for (const p of params) {
    const rendered = sqlLiteral(p);
    sqlFilled = sqlFilled.replace(/(?<!\\)\?/, rendered);
  }
  const args = ["d1", "execute", "testopencode-db", "--yes"];
  if (remote) args.push("--remote");
  args.push("--command", sqlFilled);
  const r = spawnSync("npx", ["wrangler", ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    const e = new Error(
      `d1 execute gagal (status ${r.status}): ${(r.stderr || r.stdout || "").slice(0, 400)}`
    );
    e["status"] = r.status;
    throw e;
  }
  const t = (r.stdout || "").trim();
  if (t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  return t;
}

// PBKDF2-SHA256 sungguhan. Format `pbkdf2$<iter>$<saltB64url>$<hashB64url>`
// dibaca oleh verifyPassword() di src/auth.ts — jangan ubah bentuknya.
//
// PITFALL: versi sebelumnya mengembalikan randomBytes(32) dan mengabaikan
// argumen `password`, sehingga hash yang tersimpan tidak pernah cocok dengan
// password apa pun dan login selalu gagal.
function pbkdf2Hash(password, saltB64) {
  const salt = Buffer.from(saltB64, "base64url");
  const hash = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2$100000$${saltB64}$${hash.toString("base64url")}`;
}

function log(...args) {
  console.log("[seed]", ...args);
}

async function main() {
  // 1. Schema (idempoten: CREATE TABLE IF NOT EXISTS)
  log("Menjalankan SCHEMA_SQL...");
  const statements = SCHEMA_SQL.trimEnd().split(";").filter((s) => s.trim());
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    d1(stmt);
  }

  // 2. Role (INSERT OR IGNORE, nama UNIQUE)
  const roles = [
    {
      nama: "admin",
      deskripsi: "Full access to all menus",
      permissions: JSON.stringify({
        items: ["view", "create", "edit", "delete"],
        kategori: ["view", "create", "edit", "delete"],
        pelanggan: ["view", "create", "edit", "delete"],
        users: ["view", "create", "edit", "delete"],
        roles: ["view", "create", "edit", "delete"],
        supplier: ["view", "create", "edit", "delete"],
        pembelian: ["view", "create", "delete"],
        penjualan: ["view", "create", "delete"],
        stok: ["view"],
        laporan: ["view"],
      }),
    },
    {
      nama: "kasir",
      deskripsi: "Akses kasir: penjualan + laporan",
      permissions: JSON.stringify({
        items: ["view"],
        kategori: ["view"],
        pelanggan: ["view", "create", "edit"],
        supplier: ["view"],
        pembelian: ["view"],
        penjualan: ["view", "create", "delete"],
        stok: ["view"],
        laporan: ["view"],
      }),
    },
    {
      nama: "gudang",
      deskripsi: "Akses gudang: supplier + pembelian + stok",
      permissions: JSON.stringify({
        items: ["view", "create", "edit"],
        kategori: ["view", "create", "edit"],
        pelanggan: ["view"],
        supplier: ["view", "create", "edit", "delete"],
        pembelian: ["view", "create", "delete"],
        penjualan: ["view"],
        stok: ["view"],
        laporan: ["view"],
      }),
    },
  ];

  for (const role of roles) {
    d1(
      `INSERT OR IGNORE INTO roles (nama, deskripsi, permissions) VALUES (?, ?, ?)`,
      [role.nama, role.deskripsi, role.permissions]
    );
  }

  // 3. Kategori (INSERT OR IGNORE, nama UNIQUE)
  const kategori = [
    { nama: "Elektronik", deskripsi: "Barang elektronik dan gadget" },
    { nama: "Makanan", deskripsi: "Makanan dan minuman" },
    { nama: "Pakaian", deskripsi: "Pakaian dan aksesoris" },
    { nama: "Lainnya", deskripsi: "Kategori lainnya" },
  ];
  for (const k of kategori) {
    d1(`INSERT OR IGNORE INTO kategori (nama, deskripsi) VALUES (?, ?)`, [k.nama, k.deskripsi]);
  }

  // 4. User demo (password_hash PBKDF2 saja)
  // Sumber daftar akun: DEMO_USERS di src/context.ts (dipakai juga halaman
  // login). Password plaintext TIDAK disimpan di D1 — hanya hash-nya di sini.
  //
  // ON CONFLICT DO UPDATE supaya hash acak dari seed lama (yang tidak pernah
  // cocok dengan password apa pun) tertimpa, bukan diabaikan oleh OR IGNORE.
  // Idempoten: jalankan 2x tetap 3 user.
  const seedUsers = DEMO_USERS.map((u) => ({
    username: u.username,
    password: u.password,
    role: u.username, // username === nama role (admin/kasir/gudang)
  }));
  for (const u of seedUsers) {
    // Salt baru tiap user -> hash baru-tetap-valid; password benar-benar
    // diverifikasi oleh verifyPassword() di src/auth.ts.
    const salt = randomBytes(16).toString("base64url");
    const hash = pbkdf2Hash(u.password, salt);
    d1(
      `INSERT INTO users (username, password_hash, role_id)
       SELECT ?, ?, id FROM roles WHERE nama = ?
       ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role_id = excluded.role_id`,
      [u.username, hash, u.role]
    );
  }

  // 5. Verifikasi ringkas
  const out = d1(
    `SELECT (SELECT COUNT(*) FROM roles) AS roles,
            (SELECT COUNT(*) FROM kategori) AS kategori,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT GROUP_CONCAT(username) FROM users) AS usernames`
  );
  log("Jumlah baris:", typeof out === "string" ? out : JSON.stringify(out));

  log("Seed selesai (target: " + (remote ? "REMOTE" : "LOCAL") + ")");
}

main().catch((e) => {
  console.error("[seed] ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
