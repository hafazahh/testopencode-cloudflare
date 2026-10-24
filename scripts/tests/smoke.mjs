import { createApp } from './_harness.mjs';
import { D1Mock, Client } from './_harness.mjs';

const db = new D1Mock();
const app = await createApp();
const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };
const client = new Client(app, env);

let res = await client.get('/login');
console.log('GET /login ->', res.status);
console.log('set-cookie:', res.setCookie && res.setCookie.slice(0, 100));
const csrf = await client.getCsrf();
console.log('csrf:', csrf ? csrf.slice(0, 8) : null);

const form = new URLSearchParams({ csrf_token: csrf, username: 'admin', password: 'admin123' });
res = await client.post('/login', form.toString());
console.log('POST /login ->', res.status, 'loc:', res.headers.get('location'));
console.log('has error flash:', res.body.includes('password salah'));

const r = await client.get('/login');
console.log('CSP:', r.headers.get('content-security-policy') ? 'yes' : 'no');
console.log('XFO:', r.headers.get('x-frame-options'));
console.log('XCTO:', r.headers.get('x-content-type-options'));

// HSTS over HTTPS: need to send X-Forwarded-Proto header
const clientHttps = new Client(app, env);
const r2 = await clientHttps.get('/login', { headers: { 'X-Forwarded-Proto': 'https' } });
console.log('HSTS over https:', r2.headers.get('strict-transport-security'));

// security headers via real request (no XFP)
const r3 = await client.get('/login');
console.log('HSTS over http:', r3.headers.get('strict-transport-security'));
console.log('Referrer-Policy:', r3.headers.get('referrer-policy'));
console.log('Permissions-Policy:', r3.headers.get('permissions-policy'));
console.log('COOP:', r3.headers.get('cross-origin-opener-policy'));
console.log('CORP:', r3.headers.get('cross-origin-resource-policy'));

console.log('--- cookie flags on login ---');
const clientCookie = new Client(app, env);
const r4 = await clientCookie.get('/login');
const setCookie = r4.setCookie.split(';')[0];
console.log('cookie:', setCookie);
