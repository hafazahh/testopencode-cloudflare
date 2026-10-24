import { createApp } from './_harness.mjs';
import { D1Mock, Client } from './_harness.mjs';

const app = await createApp();
const db = new D1Mock();
const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };
const client = new Client(app, env);

const r = await client.get('/login');
console.log('GET /login ->', r.status, r.headers.get('content-security-policy') ? 'has csp' : 'no csp');
console.log('cookie:', r.setCookie ? r.setCookie.slice(0, 80) : '(none)');

const form = new URLSearchParams({ csrf_token: '', username: 'admin', password: 'wrong0' });
try {
  const rr = await client.post('/login', form.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  console.log('POST /login ->', rr.status, 'loc:', rr.headers.get('location'));
} catch (e) {
  console.error('POST threw:', e.message);
  console.error('stack:', e.stack);
}
