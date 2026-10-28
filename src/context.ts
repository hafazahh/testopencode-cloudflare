import { Context, Hono } from 'hono';
import type { Env, SessionRow, UserRow } from './db';

/** Shared app context (shared type file — avoids duplicate Context generics
 *  across src/routes/*.ts and src/index.ts). */
export const SESSION_COOKIE = 'testopencode_sid';
export const SESSION_LIFE_MILLIS = 7 * 24 * 60 * 60 * 1000; // 7 hari
export const SESSION_MAX_AGE = 900; // flash cookie, 15 menit
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_SECONDS = 900; // 15 menit
export const LOGIN_LOCKOUT_SECONDS = 900; // 15 menit

/** Akun demo portfolio — SATU sumber kebenaran.
 *
 *  Password TIDAK disimpan plaintext di D1: yang tersimpan hanya hash PBKDF2
 *  (lihat scripts/seed.mjs). Konstanta ini hanya untuk MENAMPILKAN kredensial
 *  di halaman login supaya pengunjung portfolio bisa mencoba login, dan untuk
 *  seed/monitoring yang butuh daftar akun demo. Jangan dipakai untuk auth —
 *  verifikasi password selalu lewat `verifyPassword()` di src/auth.ts. */
export const DEMO_USERS: { username: string; password: string; role: string }[] = [
  { username: 'admin', password: 'admin123', role: 'Administrator' },
  { username: 'kasir', password: 'kasir123', role: 'Kasir' },
  { username: 'gudang', password: 'gudang123', role: 'Gudang' },
];

export type AppState = {
  session: SessionRow | null;
  userId: number | null;
  user: UserRow | null;
  flash: { category: string; message: string }[];
};

export type AppEnv = { Bindings: Env; Variables: AppState };

export type AppContext = Context<AppEnv>;

export type AppHono = Hono<AppEnv>;
