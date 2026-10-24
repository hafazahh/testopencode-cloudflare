/**
 * Worker entry point (Hono) — testopencode.
 *
 * SKELETON Fase B. Baru memuat `/health` dan `/healthz`; 43 route Flask
 * di-port bertahap di Fase C (lihat task_plan.md).
 */

import { Hono } from "hono";
import type { Env } from "./db";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "testopencode-worker" });
});

app.get("/healthz", async (c) => {
  // D1 readiness: satu query ringan. Gagal di sini = binding tidak terpasang.
  let d1 = "unknown";
  try {
    const r = await c.env.DB.prepare("SELECT 1 AS ok").first();
    d1 = r ? "ok" : "empty";
  } catch (e) {
    d1 = `error: ${String(e).slice(0, 120)}`;
  }
  return c.json({ status: "ok", d1 });
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },
};
