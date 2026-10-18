'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { ActivityStore } = require('../desktop/store.cjs');
const { PairingAuth } = require('../desktop/auth.cjs');
const { createLocalServer, MAX_BODY } = require('../desktop/server.cjs');

const now = Date.UTC(2026, 9, 17, 8);
const origin = `chrome-extension://${'a'.repeat(32)}`;
const page = (patch = {}) => ({ id: 'page:one', kind: 'page', url: 'https://example.com/article?token=secret#fragment', title: 'An article', startedAt: now - 30_000, duration: 10, ...patch });

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mach-server-test-'));
  const store = new ActivityStore(':memory:', { now: () => now });
  const auth = new PairingAuth(path.join(dir, 'auth.json'));
  const seen = [];
  let heartbeats = 0;
  let changes = 0;
  let clock = now;
  const collector = { heartbeat: () => heartbeats++, ingest: (event) => { seen.push(event); return { ...event, app: 'Google Chrome' }; } };
  const server = createLocalServer({ store, auth, collector, onChanged: () => changes++, now: () => clock });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const port = server.address().port;
  function request({ route = '/v1/status', method = 'GET', body, headers = {}, authenticated = true, chunked = false } = {}) {
    return new Promise((resolve, reject) => {
      const serialized = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
      const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers: Object.fromEntries(Object.entries({
        Origin: origin, 'X-Mach-Browser': 'com.google.Chrome', ...(authenticated ? { Authorization: `Bearer ${auth.token}` } : {}),
        ...(serialized !== undefined ? { 'Content-Type': 'application/json', ...(chunked ? { 'Transfer-Encoding': 'chunked' } : { 'Content-Length': Buffer.byteLength(serialized) }) } : {}), ...headers,
      }).filter(([,value]) => value !== undefined)) }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : null });
        });
      });
      req.on('error', reject);
      req.end(serialized);
    });
  }
  return { store, auth, request, seen, collector, counters: () => ({ heartbeats, changes }), advance: ms => { clock += ms; } };
}

test('local endpoint rejects web origins, invalid tokens, and DNS-rebinding Host values', async t => {
  const f = await fixture(t);
  assert.equal((await f.request({ authenticated: false })).status, 401);
  assert.equal((await f.request({ headers: { Authorization: 'Bearer bad' } })).status, 401);
  assert.equal((await f.request({ headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await f.request({ headers: { Host: 'evil.example' } })).status, 403);
  assert.equal((await f.request({ headers: { Origin: 'null' } })).status, 403);
  assert.deepEqual(f.counters(), { heartbeats: 0, changes: 0 });
  assert.equal(f.auth.origin, null);
  const valid = await f.request();
  assert.equal(valid.status, 200);
  assert.equal(valid.headers['access-control-allow-origin'], origin);
  assert.equal(valid.headers['cache-control'], 'no-store');
  assert.deepEqual(valid.body, { recording: false, captureSocial: false, excludedDomains: [], excludedApps: [] });
  assert.equal(f.auth.origin, origin);
  assert.equal((await f.request({ headers: { Origin: `chrome-extension://${'b'.repeat(32)}` } })).status, 403);
});

test('CORS preflight admits only extension origins and the supported method/header set', async t => {
  const f = await fixture(t);
  const headers = { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,x-mach-browser' };
  const valid = await f.request({ method: 'OPTIONS', authenticated: false, headers });
  assert.equal(valid.status, 204);
  assert.equal(valid.headers['access-control-allow-origin'], origin);
  assert.equal(f.auth.origin, null, 'preflight must not claim token ownership');
  assert.equal((await f.request({ method: 'OPTIONS', authenticated: false, headers: { ...headers, 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
  assert.equal((await f.request({ method: 'OPTIONS', authenticated: false, headers: { ...headers, 'Access-Control-Request-Headers': 'authorization,x-other' } })).status, 403);
});

test('status and ingestion require a supported browser identity and bind it to the pairing token', async t => {
  const f = await fixture(t);
  assert.equal((await f.request({ headers: { 'X-Mach-Browser': '' } })).status, 400);
  assert.equal((await f.request({ headers: { 'X-Mach-Browser': 'com.apple.Safari' } })).status, 400);
  assert.equal(f.auth.origin, null);
  assert.equal((await f.request()).status, 200);
  assert.equal(f.auth.browserBundleId, 'com.google.Chrome');
  assert.equal((await f.request({ headers: { 'X-Mach-Browser': 'com.brave.Browser' } })).status, 401);
  assert.equal((await f.request({ method: 'POST', route: '/v1/events', body: { events: [page()] }, headers: { 'X-Mach-Browser': 'com.microsoft.edgemac' } })).status, 401);
  assert.deepEqual(f.store.getEvents(), []);
});

test('paused recording does not ingest or save any browser events', async t => {
  const f = await fixture(t);
  const response = await f.request({ method: 'POST', route: '/v1/events', body: { events: [page()] } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { accepted: 0 });
  assert.deepEqual(f.store.getEvents(), []);
  assert.deepEqual(f.seen, []);
  assert.deepEqual(f.counters(), { heartbeats: 1, changes: 0 });
});

test('HTTP ingestion validates privacy settings and sanitizes data before collector verification', async t => {
  const f = await fixture(t);
  f.store.updateSettings({ recording: true, excludedDomains: ['excluded.example'] });
  const response = await f.request({ method: 'POST', route: '/v1/events', body: { events: [
    page(), page({ id: 'unsafe', url: 'file:///etc/passwd' }),
    page({ id: 'excluded', url: 'https://sub.excluded.example/path' }),
    page({ id: 'social', kind: 'interaction', action: 'like', duration: 0 }),
    page({ id: 'impossible', duration: 100 }),
  ] } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { accepted: 1 });
  assert.equal(f.seen.length, 1);
  assert.equal(f.seen[0].url, 'https://example.com/article');
  assert.equal(f.store.getEvents()[0].app, 'Google Chrome');
  assert.equal(f.store.getEvents()[0].url, 'https://example.com/article');
  assert.deepEqual(f.counters(), { heartbeats: 1, changes: 1 });
  const duplicate = await f.request({ method: 'POST', route: '/v1/events', body: { events: [page({ duration: 5 })] } });
  assert.equal(duplicate.status, 200);
  assert.equal(f.store.getEvents().length, 1);
  assert.equal(f.store.getEvents()[0].duration, 10);
});

test('collector refusal prevents unverified browser time from entering history', async t => {
  const f = await fixture(t);
  f.store.updateSettings({ recording: true });
  f.collector.ingest = () => null;
  const response = await f.request({ method: 'POST', route: '/v1/events', body: { events: [page()] } });
  assert.deepEqual(response.body, { accepted: 0 });
  assert.deepEqual(f.store.getEvents(), []);
  assert.equal(f.counters().changes, 0);
});

test('invalid and oversized request bodies are rejected without storing data', async t => {
  const f = await fixture(t);
  f.store.updateSettings({ recording: true });
  const post = options => f.request({ method: 'POST', route: '/v1/events', ...options });
  assert.equal((await post({ body: '{bad json' })).status, 400);
  assert.equal((await post({ body: {} })).status, 400);
  assert.equal((await post({ body: { events: Array(101).fill(page()) } })).status, 400);
  assert.equal((await post({ body: { events: [page()] }, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post({ body: { events: [page()] }, headers: { 'Content-Encoding': 'gzip' } })).status, 413);
  assert.equal((await post({ body: 'x'.repeat(MAX_BODY + 1) })).status, 413);
  assert.equal((await post({ body: 'x'.repeat(MAX_BODY + 1), chunked: true })).status, 413);
  assert.deepEqual(f.store.getEvents(), []);
  assert.deepEqual(f.seen, []);
});

test('per-origin rate limit recovers in the next minute', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 180; i++) assert.equal((await f.request()).status, 200);
  assert.equal((await f.request()).status, 429);
  f.advance(60_000);
  assert.equal((await f.request()).status, 200);
});


test('origin-less privileged extension fetch needs declared identity plus token; web origins cannot spoof it', async t => {
  const f = await fixture(t);
  assert.equal((await f.request({headers:{Origin:undefined}})).status,403);
  assert.equal((await f.request({authenticated:false,headers:{Origin:undefined,'X-Mach-Extension-Origin':origin}})).status,401);
  assert.equal((await f.request({headers:{Origin:undefined,'X-Mach-Extension-Origin':origin}})).status,200);
  assert.equal((await f.request({headers:{Origin:'https://evil.example','X-Mach-Extension-Origin':origin}})).status,403);
  assert.equal((await f.request({headers:{Origin:'null','X-Mach-Extension-Origin':origin}})).status,403);
  assert.equal((await f.request({headers:{Origin:origin,'X-Mach-Extension-Origin':`chrome-extension://${'b'.repeat(32)}`}})).status,403);
  assert.equal((await f.request({headers:{Origin:undefined,'X-Mach-Extension-Origin':`chrome-extension://${'b'.repeat(32)}`}})).status,403);
});
