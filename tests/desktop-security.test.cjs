'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { contentSecurityPolicy, allowRendererRequest } = require('../desktop/security.cjs');

const production = { distDirectory: '/Applications/Mach.app/Contents/Resources/app/dist' };
const file = (suffix) => `file://${production.distDirectory}/${suffix}`;
const directives = policy => Object.fromEntries(policy.split(';').map(value => value.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));

test('production CSP allows local assets and inline styles without allowing inline scripts or connections', () => {
  const policy = directives(contentSecurityPolicy());
  assert.deepEqual(policy['script-src'], ["'self'"]);
  assert.deepEqual(policy['style-src'], ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(policy['connect-src'], ["'none'"]);
  for (const directive of ['object-src', 'frame-src', 'frame-ancestors', 'form-action']) assert.deepEqual(policy[directive], ["'none'"]);
  assert.equal(contentSecurityPolicy().includes('unsafe-eval'), false);
});

test('production renderer blocks remote endpoints and file paths outside the packaged dashboard', () => {
  for (const url of [file('index.html'), file('assets/app.js'), file('assets/app.css'), 'data:image/svg+xml,icon', 'blob:file:///export']) {
    assert.equal(allowRendererRequest(url, production), true, url);
  }
  for (const url of [
    'https://example.com/track', 'http://127.0.0.1:43821/v1/status', 'ws://localhost:5173/',
    'file:///etc/passwd', file('../desktop/auth.cjs'), file('%2e%2e/desktop/auth.cjs'),
    file('../dist-private/token.json'), 'javascript:alert(1)', 'not a url',
  ]) assert.equal(allowRendererRequest(url, production), false, url);
});

test('development enables only the selected local renderer origin and its hot reload socket', () => {
  const development = { ...production, devURL: 'http://127.0.0.1:5173/' };
  for (const url of ['http://127.0.0.1:5173/src/main.tsx', 'ws://127.0.0.1:5173/']) {
    assert.equal(allowRendererRequest(url, development), true, url);
  }
  for (const url of ['http://127.0.0.1:43821/', 'http://localhost:5173/', 'https://127.0.0.1:5173/', 'wss://127.0.0.1:5173/', 'https://example.com/']) {
    assert.equal(allowRendererRequest(url, development), false, url);
  }
  assert.deepEqual(directives(contentSecurityPolicy(development.devURL))['connect-src'], ["'self'", 'ws://127.0.0.1:5173']);
  assert.deepEqual(directives(contentSecurityPolicy(development.devURL))['script-src'], ["'self'", "'unsafe-inline'"]);
});
