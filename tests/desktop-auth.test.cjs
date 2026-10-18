'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PairingAuth } = require('../desktop/auth.cjs');

const origin = `chrome-extension://${'a'.repeat(32)}`;
const anotherOrigin = `chrome-extension://${'b'.repeat(32)}`;

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mach-auth-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'pairing.json');
}

test('pairing needs both the exact Bearer token and a Chrome extension origin', (t) => {
  const auth = new PairingAuth(fixture(t));
  assert.match(auth.token, /^[A-Za-z0-9_-]{43}$/);
  for (const candidate of [undefined, null, 'null', 'https://example.com', 'http://localhost:5173', 'chrome-extension://abc', `${origin}/`, `chrome-extension://${'q'.repeat(32)}`]) {
    assert.equal(auth.authenticate(candidate, `Bearer ${auth.token}`), false);
  }
  for (const token of [undefined, '', auth.token, `bearer ${auth.token}`, 'Bearer incorrect', `Bearer ${auth.token} `]) {
    assert.equal(auth.authenticate(origin, token), false);
  }
  assert.equal(auth.origin, null, 'failed authentication must not claim the token');
  assert.equal(auth.authenticate(origin, `Bearer ${auth.token}`, { claim: false }), true);
  assert.equal(auth.origin, null, 'preflight/non-claim verification must not bind origin');
});

test('successful pairing binds one origin and survives restart with private file permissions', (t) => {
  const file = fixture(t);
  const auth = new PairingAuth(file);
  assert.equal(auth.authenticate(origin, `Bearer ${auth.token}`), true);
  assert.equal(auth.authenticate(anotherOrigin, `Bearer ${auth.token}`), false);
  const restarted = new PairingAuth(file);
  assert.equal(restarted.token, auth.token);
  assert.equal(restarted.origin, origin);
  assert.equal(restarted.authenticate(origin, `Bearer ${auth.token}`), true);
  assert.equal(restarted.authenticate(anotherOrigin, `Bearer ${auth.token}`), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('rotating a token revokes previous authorization and resets origin binding', (t) => {
  const file = fixture(t);
  const auth = new PairingAuth(file);
  const old = auth.token;
  auth.authenticate(origin, `Bearer ${old}`);
  const next = auth.rotate();
  assert.notEqual(next, old);
  assert.equal(auth.origin, null);
  assert.equal(auth.authenticate(origin, `Bearer ${old}`), false);
  assert.equal(auth.authenticate(anotherOrigin, `Bearer ${next}`), true);
  assert.equal(new PairingAuth(file).origin, anotherOrigin);
});

test('corrupt or invalid persisted pairing state is replaced with a fresh unclaimed token', (t) => {
  const file = fixture(t);
  for (const value of ['{invalid', JSON.stringify({ token: 'tiny', origin }), JSON.stringify({ token: 'a'.repeat(43), origin: 'https://example.com' })]) {
    fs.writeFileSync(file, value);
    const recovered = new PairingAuth(file);
    assert.match(recovered.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(recovered.origin, null);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).token, recovered.token);
  }
});

test('pairing browser binding persists and rotation revokes both browser and extension identity', (t) => {
  const file = fixture(t);
  const auth = new PairingAuth(file);
  assert.equal(auth.authenticate(origin, `Bearer ${auth.token}`, { browserBundleId: 'com.google.Chrome' }), true);
  const restored = new PairingAuth(file);
  assert.equal(restored.browserBundleId, 'com.google.Chrome');
  assert.equal(restored.authenticate(origin, `Bearer ${auth.token}`, { browserBundleId: 'com.brave.Browser' }), false);
  assert.equal(restored.authenticate(origin, `Bearer ${auth.token}`), false);
  restored.rotate();
  assert.equal(restored.browserBundleId, null);
  assert.equal(restored.authenticate(anotherOrigin, `Bearer ${restored.token}`, { browserBundleId: 'com.brave.Browser' }), true);
});
