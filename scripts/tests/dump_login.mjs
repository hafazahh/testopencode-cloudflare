import { createApp } from './_harness.mjs';
import { D1Mock, Client } from './_harness.mjs';

const app = await createApp();
const db = new D1Mock();
const env = { DB: db, ENVIRONMENT: 'local', SITE_URL: 'http://localhost:8790' };
const anon = new Client(app, env);
const page = await anon.get('/login');
let body = page.body;
console.log('body length:', body.length);
console.log('--- first 2000 chars ---');
console.log(body.slice(0, 2000));
console.log('--- csrf patterns ---');
console.log('name=csrf:', body.includes('name="csrf_token"'));
console.log('name=\'csrf\' count:', (body.match(/name="csrf/g) || []).length);
console.log('value= token:', body.match(/value="([A-Za-z0-9_-]+)"/g)?.[0]);

// check the renderLogin source
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/render.ts', import.meta.url), 'utf8');
const m = src.match(/export function renderLogin\(props: \{ csrf: string; non_admin_users.*?\}\): string => (.{0,600})/s);
console.log('--- renderLogin ---');
console.log(m ? m[1] : 'not found');
