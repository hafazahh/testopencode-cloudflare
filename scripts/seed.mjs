/**
 * SKELETON Fase B — seed D1 testopencode.
 *
 * Fase C mengisi: baca `schema.sql`, jalankan sebagai batch D1, lalu isi data
 * awal (role admin/kasir/gudang, kategori, user admin) secara idempoten.
 *
 * Idempotensi: schema `CREATE TABLE IF NOT EXISTS`, tulisan `INSERT OR IGNORE`.
 *
 * PITFALL: `wrangler dev` tanpa `--remote` membaca D1 LOKAL. Lokal dan remote
 * bisa divergen — selalu sebutkan store mana yang diuji sebelum menyimpulkan
 * port sudah benar.
 *
 * Usage:
 *   node scripts/seed.mjs              # D1 lokal (wrangler dev)
 *   node scripts/seed.mjs --remote     # D1 produksi
 */

import { spawnSync } from "node:child_process";

const remote = process.argv.includes("--remote");

function d1(sql, params = []) {
  const args = ["d1", "execute", "testopencode-db", "--yes"];
  if (remote) args.push("--remote");
  args.push("--command", sql);
  for (const p of params) args.push(String(p));
  const r = spawnSync("npx", ["wrangler", ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`d1 execute gagal: ${(r.stderr || r.stdout || "").slice(0, 400)}`);
  }
  return r.stdout;
}

console.log(`[seed] target: ${remote ? "REMOTE" : "LOCAL"} (Fase C mengisi isinya)`);
console.log("[seed] selesai — belum ada tabel dibuat di skeleton ini");
