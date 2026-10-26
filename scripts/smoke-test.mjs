#!/usr/bin/env node
/**
 * End-to-end smoke test against a running stack (docker compose up).
 *
 *   node scripts/smoke-test.mjs [--url http://localhost:8080] [--email x --password y] [--format docx] file1.pdf file2.pdf ...
 *
 * Signs in (or stays a guest), opens the live WebSocket exactly like the browser,
 * uploads all PDFs in parallel, prints every live event, waits until all
 * conversions finish, then downloads them as one ZIP.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// reuse the web app's socket.io client (no extra install)
const { io } = createRequire(path.join(here, '../apps/web/package.json'))('socket.io-client');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const base = opt('url', 'http://localhost:8080');
const email = opt('email');
const password = opt('password');
const format = opt('format', 'docx');
const files = args;
if (!files.length) {
  console.error('usage: node scripts/smoke-test.mjs [--email e --password p] [--format docx] a.pdf b.pdf');
  process.exit(2);
}

const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
async function call(p, init = {}) {
  const res = await fetch(base + '/api' + p, { ...init, headers: { ...(init.headers ?? {}), cookie: cookieHeader() } });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return res;
}
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);

await call('/auth/session'); // sets the guest cookie
if (email) {
  const r = await call('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(`login failed: ${r.status} ${await r.text()}`);
  log('signed in as', email);
}

const socket = io(base, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { cookie: cookieHeader() } });
await new Promise((ok, fail) => {
  socket.once('connect', ok);
  socket.once('connect_error', fail);
});
log('websocket connected', socket.id);

const jobs = new Map();
const events = { 'job:update': 0, 'credits:update': 0 };
socket.on('job:update', (j) => {
  events['job:update']++;
  const prev = jobs.get(j.id);
  if (!prev || prev.status !== j.status || prev.progress !== j.progress) {
    log(`job ${j.id.slice(0, 8)} ${j.originalName.padEnd(28).slice(0, 28)} ${j.status.padEnd(10)} ${String(j.progress).padStart(3)}% ${j.stage ?? ''}`);
  }
  jobs.set(j.id, j);
});
socket.on('credits:update', ({ credits }) => {
  events['credits:update']++;
  log('credits now', credits);
});

const created = await Promise.all(
  files.map(async (f) => {
    const form = new FormData();
    form.append('targetFormat', format);
    form.append('file', new Blob([await readFile(f)], { type: 'application/pdf' }), path.basename(f));
    const r = await call('/conversions', { method: 'POST', body: form });
    const body = await r.json();
    if (!r.ok) throw new Error(`${f}: ${r.status} ${JSON.stringify(body)}`);
    log('uploaded', path.basename(f), '->', body.id.slice(0, 8));
    return body.id;
  }),
);

const deadline = Date.now() + 10 * 60_000;
while (created.some((id) => !['COMPLETED', 'FAILED'].includes(jobs.get(id)?.status))) {
  if (Date.now() > deadline) throw new Error('timeout waiting for conversions');
  await new Promise((r) => setTimeout(r, 300));
}
socket.close();

const done = created.filter((id) => jobs.get(id).status === 'COMPLETED');
const zip = await call(`/conversions/archive?ids=${done.join(',')}`);
const bytes = Buffer.from(await zip.arrayBuffer());
log(`zip: HTTP ${zip.status}, ${bytes.length} bytes, ${zip.headers.get('content-disposition')}`);
log('live events received:', events);
const failed = created.filter((id) => jobs.get(id).status !== 'COMPLETED');
if (failed.length || zip.status !== 200 || bytes.subarray(0, 2).toString() !== 'PK') {
  console.error('SMOKE TEST FAILED', failed.map((id) => jobs.get(id)));
  process.exit(1);
}
log(`OK: ${done.length} file(s) converted to ${format} with live updates`);
