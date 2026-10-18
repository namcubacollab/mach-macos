'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EXTENSION_BROWSERS } = require('./policy.cjs');
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

class PairingAuth {
  constructor(filename) {
    this.filename = filename;
    try {
      const stored = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (!/^[A-Za-z0-9_-]{43}$/.test(stored.token) || (stored.origin && !EXTENSION_ORIGIN.test(stored.origin)) || (stored.browserBundleId && !EXTENSION_BROWSERS.has(stored.browserBundleId))) throw new Error('Invalid token');
      this.token = stored.token;
      this.origin = stored.origin || null;
      this.browserBundleId = stored.browserBundleId || null;
    } catch { this.rotate(); }
  }
  persist() {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true, mode: 0o700 });
    const temporary = `${this.filename}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ token: this.token, origin: this.origin, browserBundleId: this.browserBundleId }), { mode: 0o600 });
    fs.renameSync(temporary, this.filename);
    fs.chmodSync(this.filename, 0o600);
  }
  rotate() {
    this.token = crypto.randomBytes(32).toString('base64url');
    this.origin = null;
    this.browserBundleId = null;
    this.persist();
    return this.token;
  }
  validOrigin(origin) { return typeof origin === 'string' && EXTENSION_ORIGIN.test(origin) && (!this.origin || this.origin === origin); }
  authenticate(origin, authorization, { claim = true, browserBundleId = null } = {}) {
    if (!this.validOrigin(origin) || typeof authorization !== 'string') return false;
    if (this.browserBundleId && this.browserBundleId !== browserBundleId) return false;
    if (browserBundleId && !EXTENSION_BROWSERS.has(browserBundleId)) return false;
    const provided = Buffer.from(authorization);
    const expected = Buffer.from(`Bearer ${this.token}`);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return false;
    if (claim && (!this.origin || (!this.browserBundleId && browserBundleId))) { this.origin = origin; this.browserBundleId = browserBundleId; this.persist(); }
    return true;
  }
}

module.exports = { PairingAuth, EXTENSION_ORIGIN };
