'use strict';

const http = require('node:http');
const { normalizeEvent, EXTENSION_BROWSERS } = require('./policy.cjs');
const MAX_BODY = 128 * 1024;

function createLocalServer({ store, auth, collector, onChanged = () => {}, now = () => Date.now() }) {
  const buckets = new Map();
  const server = http.createServer((req, res) => {
    const suppliedOrigin = req.headers.origin;
    const declaredOrigin = req.headers['x-mach-extension-origin'];
    // Privileged extension GET requests can omit Origin. A declared extension
    // ID still requires the secret token and its persisted binding. Explicit
    // web Origins are never replaced by a caller-supplied header.
    const origin = suppliedOrigin ?? declaredOrigin;
    const respond = (status, payload) => {
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(auth.validOrigin(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
      res.end(JSON.stringify(payload));
    };
    // Defend against DNS rebinding even though the listener only binds to loopback.
    const expectedHost = `127.0.0.1:${server.address()?.port}`;
    if (req.headers.host !== expectedHost || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) { respond(403, { error: 'Loopback access required' }); return; }
    if (suppliedOrigin && declaredOrigin && suppliedOrigin !== declaredOrigin) { respond(403, { error: 'Extension origin mismatch' }); return; }
    if (!auth.validOrigin(origin)) { respond(403, { error: 'Extension origin required' }); return; }
    if (req.method === 'OPTIONS') {
      const headers = String(req.headers['access-control-request-headers'] || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
      if (!['GET', 'POST'].includes(req.headers['access-control-request-method']) || headers.some((header) => !['authorization', 'content-type', 'x-mach-browser', 'x-mach-extension-origin'].includes(header))) { respond(403, { error: 'Preflight denied' }); return; }
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Mach-Browser, X-Mach-Extension-Origin', 'Access-Control-Max-Age': '600', Vary: 'Origin', 'Cache-Control': 'no-store' });
      res.end(); return;
    }
    const browserBundleId = req.headers['x-mach-browser'];
    if (!EXTENSION_BROWSERS.has(browserBundleId)) { respond(400, { error: 'Supported browser identity required' }); return; }
    if (!auth.authenticate(origin, req.headers.authorization, { browserBundleId })) { respond(401, { error: 'Invalid pairing token or browser binding' }); return; }
    const minute = Math.floor(now() / 60000);
    const bucket = buckets.get(origin);
    const count = bucket?.minute === minute ? bucket.count + 1 : 1;
    buckets.set(origin, { minute, count });
    if (count > 180) { respond(429, { error: 'Too many requests' }); return; }
    if (req.url === '/v1/status' && req.method === 'GET') {
      collector.heartbeat(browserBundleId);
      const { recording, captureSocial, excludedDomains, excludedApps } = store.getSettings();
      respond(200, { recording, captureSocial, excludedDomains, excludedApps }); return;
    }
    if (req.url !== '/v1/events' || req.method !== 'POST') { respond(404, { error: 'Not found' }); return; }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) { respond(415, { error: 'JSON required' }); return; }
    if (req.headers['content-encoding'] || Number(req.headers['content-length'] || 0) > MAX_BODY) { respond(413, { error: 'Payload too large' }); req.resume(); return; }
    const chunks = [];
    let size = 0;
    let exceeded = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { exceeded = true; chunks.length = 0; respond(413, { error: 'Payload too large' }); }
      else if (!exceeded) chunks.push(chunk);
    });
    req.on('end', () => {
      if (exceeded) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { respond(400, { error: 'Invalid JSON' }); return; }
      if (!body || !Array.isArray(body.events) || body.events.length > 100) { respond(400, { error: 'Expected at most 100 events' }); return; }
      collector.heartbeat(browserBundleId);
      const settings = store.getSettings();
      let accepted = 0;
      if (settings.recording) {
        const timestamp = now();
        for (const raw of body.events) {
          const normalized = normalizeEvent(raw, settings, timestamp);
          if (!normalized) continue;
          const verified = collector.ingest(normalized, timestamp, browserBundleId);
          if (verified && store.upsert(verified, timestamp)) accepted++;
        }
      }
      if (accepted) onChanged();
      respond(200, { accepted });
    });
    req.on('error', () => respond(400, { error: 'Incomplete request' }));
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 30;
  server.on('clientError', (_error, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  return server;
}

module.exports = { createLocalServer, MAX_BODY };
