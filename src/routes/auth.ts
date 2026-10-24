import { Hono } from 'hono';
import type { AppHono } from '../context';
import {
  loginPage,
  handleLogin,
  handleLogout,
  csrfProtect,
} from '../auth';

/** /login + /logout — public (login page is reachable by anyone). */
export function register(app: AppHono) {
  app.get('/login', loginPage);
  app.post('/login', csrfProtect(), handleLogin);
  app.post('/logout', csrfProtect(), handleLogout);
}
