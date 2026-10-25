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

export type AppState = {
  session: SessionRow | null;
  userId: number | null;
  user: UserRow | null;
  flash: { category: string; message: string }[];
};

export type AppEnv = { Bindings: Env; Variables: AppState };

export type AppContext = Context<AppEnv>;

export type AppHono = Hono<AppEnv>;
