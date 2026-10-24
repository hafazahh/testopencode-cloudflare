import { createApp } from './_harness.mjs';
import { D1Mock, Client } from './_harness.mjs';

const app = await createApp();
const db = new D1Mock();
const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };

// --- GET /login: capture csrf + cookie ---
const anon = new Client(app, env);
const loginPage = await anon.get('/login');
console.log('GET /login ->', loginPage.status);
const csrf = loginPage.body.match(/name="csrf_token" value="([^"]+)"/);
console.log('csrf found:', !!csrf);
if (!csrf) { console.error('NO CSRF'); process.exit(1); }
const sid = loginPage.setCookie.split(';')[0];
console.log('cookie:', sid);

// --- POST /login with correct credentials ---
const form = new URLSearchParams({ csrf_token: csrf[1], username: 'admin', password: 'admin123' });
const ok = await anon.post('/login', form.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
console.log('POST /login correct ->', ok.status, 'loc:', ok.headers.get('location'));
console.log('has flash Authenticated:', ok.body.includes('Authenticated'));

// --- POST /login with wrong credentials ---
const a = new Client(app, env);
const pl = await a.get('/login');
const csrf2 = pl.body.match(/name="csrf_token" value="([^"]+)"/);
const wrong = await a.post('/login', new URLSearchParams({ csrf_token: csrf2[1], username: 'admin', password: 'wrong' }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
console.log('POST /login wrong ->', wrong.status, 'flash password salah:', wrong.body.includes('password salah'));

// --- HSTS + Secure over HTTPS ---
const httpsClient = new Client(app, env);
const r = await httpsClient.get('/login', { headers: { 'X-Forwarded-Proto': 'https' } });
const sc = r.setCookie || '';
console.log('Secure over https:', /Secure/i.test(sc));
const hsts = r.headers.get('strict-transport-security');
console.log('HSTS over https:', hsts);

// --- verify template render ---
const rr = await anon.get('/');
console.log('GET / (admin) ->', rr.status);
