'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { EXTENSION_BROWSERS, cleanText, categorize, isAppExcluded } = require('./policy.cjs');

const IDLE_SECONDS = 60;
const EXTENSION_TIMEOUT = 45000;
const JXA = `ObjC.import('AppKit'); var app = $.NSWorkspace.sharedWorkspace.frontmostApplication; app ? JSON.stringify({name:ObjC.unwrap(app.localizedName),bundleId:ObjC.unwrap(app.bundleIdentifier)}) : '{}';`;

// Evidence comes exclusively from the local foreground observer, never from browser payloads.
class ForegroundLedger {
  constructor() { this.reset(); }
  reset() { this.previous = null; this.intervals = []; }
  observe(app, now, eligible) {
    const prior = this.previous;
    this.previous = { app, at: now, eligible };
    this.intervals = this.intervals.filter((interval) => interval.end >= now - 120000);
    if (!eligible || !prior?.eligible || !app || prior.app?.bundleId !== app.bundleId || now <= prior.at || now - prior.at > 5000) return null;
    const interval = { start: prior.at, end: now, ...app };
    this.intervals.push(interval);
    return interval;
  }
  credit(event, existing, now, browserBundleId) {
    if (!EXTENSION_BROWSERS.has(browserBundleId)) return null;
    const from = Math.max(event.startedAt, existing?.observedAt || 0);
    const candidates = this.intervals.filter((span) => span.bundleId === browserBundleId && span.end > from && span.start < now && (!existing || span.name === existing.event.app));
    const latest = this.previous;
    const current = latest?.eligible && now - latest.at <= 5000 && latest.app?.bundleId === browserBundleId ? latest.app : null;
    if (event.kind === 'interaction') {
      const evidence = this.intervals.findLast((span) => span.bundleId === browserBundleId && span.start - 1500 <= event.startedAt && span.end + 1500 >= event.startedAt);
      const browser = evidence || (current && Math.abs(event.startedAt - now) < 5000 ? current : null);
      return browser ? { ...event, app: browser.name, duration: 0 } : null;
    }
    const names = new Map();
    for (const span of candidates) names.set(span.name, (names.get(span.name) || 0) + Math.max(0, Math.min(span.end, now) - Math.max(span.start, from)) / 1000);
    const match = [...names.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!match) {
      // Zero-duration initial snapshots are useful for a newly focused tab.
      if (!existing && event.duration === 0 && current && now - event.startedAt <= 5000) return { ...event, app: current.name };
      return null;
    }
    const oldDuration = existing?.event.duration || 0;
    return { ...event, app: match[0], duration: Math.min(Math.max(oldDuration, event.duration), oldDuration + match[1]) };
  }
}

class ForegroundCollector {
  constructor({ store, powerMonitor, resourcesPath, packaged = false, onChanged = () => {}, now = () => Date.now(), platform = process.platform }) {
    Object.assign(this, { store, powerMonitor, resourcesPath, packaged, onChanged, now, platform });
    this.ledger = new ForegroundLedger();
    this.lastExtensionSeen = 0;
    this.browserBundleId = null;
    this.session = null;
    this.nativeSnapshot = null;
    this.error = null;
    this.suspended = false;
    this.locked = false;
    this.busy = false;
    this.listeners = [];
  }

  start() {
    this.stopped = false;
    for (const [event, handler] of [
      ['suspend', () => { this.suspended = true; this.reset(); this.stopHelper(); }],
      ['resume', () => { this.suspended = false; this.lastExtensionSeen = 0; this.reset(); }],
      ['lock-screen', () => { this.locked = true; this.reset(); this.stopHelper(); }],
      ['unlock-screen', () => { this.locked = false; this.reset(); }],
    ]) { this.powerMonitor.on(event, handler); this.listeners.push([event, handler]); }
    if (this.platform !== 'darwin') this.error = 'Ghi ứng dụng nền chỉ hoạt động trên macOS. Bạn vẫn có thể dùng dữ liệu minh họa trong bản xem trước.';
    this.timer = setInterval(() => { void this.tick(); }, 1000);
    this.timer.unref?.();
    void this.tick();
  }

  startHelper() {
    if (this.helper) return;
    const helperPath = this.packaged
      ? path.join(this.resourcesPath, 'helpers', 'mach-foreground')
      : path.join(__dirname, 'helpers', 'mach-foreground');
    if (!fs.existsSync(helperPath)) return; // Local development can use the AppKit/JXA fallback.
    try {
      const child = spawn(helperPath, [], { stdio: ['ignore', 'pipe', 'ignore'] });
      this.helper = child;
      let pending = '';
      child.stdout.on('data', (chunk) => {
        if (this.helper !== child) return;
        pending = (pending + chunk.toString()).slice(-16384);
        let newline;
        while ((newline = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
          try { this.nativeSnapshot = { ...JSON.parse(line), receivedAt: this.now() }; } catch {}
        }
      });
      child.on('error', () => { if (this.helper === child) { this.helper = null; this.nativeSnapshot = null; } });
      child.on('exit', () => { if (this.helper === child) { this.helper = null; this.nativeSnapshot = null; } });
    } catch { this.helper = null; }
  }

  async foregroundApp() {
    if (this.helper && this.nativeSnapshot && this.now() - this.nativeSnapshot.receivedAt < 3000) return this.nativeSnapshot;
    return new Promise((resolve, reject) => {
      execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', JXA], { timeout: 1800, maxBuffer: 4096, windowsHide: true }, (error, stdout) => {
        if (error) { reject(new Error('Không đọc được ứng dụng đang mở. Thử khởi động lại Mạch.')); return; }
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Ứng dụng đang mở không trả về dữ liệu hợp lệ.')); }
      });
    });
  }

  async tick() {
    if (this.busy || this.stopped || this.platform !== 'darwin') return;
    const settings = this.store.getSettings();
    if (!settings.recording || this.suspended || this.locked || this.powerMonitor.getSystemIdleTime() >= IDLE_SECONDS) { this.reset(); this.stopHelper(); return; }
    this.busy = true;
    try {
      this.startHelper();
      const raw = await this.foregroundApp();
      if (this.stopped) return;
      const now = this.now();
      // Consent may change while the native read is in flight.
      const currentSettings = this.store.getSettings();
      const name = cleanText(raw.name, 160);
      const bundleId = cleanText(raw.bundleId, 200);
      const eligible = Boolean(currentSettings.recording && !this.suspended && !this.locked && this.powerMonitor.getSystemIdleTime() < IDLE_SECONDS && name && bundleId && !['app.mach.desktop', 'local.mach.desktop', 'com.github.Electron'].includes(bundleId) && !isAppExcluded(name, bundleId, currentSettings.excludedApps));
      const interval = this.ledger.observe({ name, bundleId }, now, eligible);
      this.error = null;
      if (!interval) { this.session = null; return; }
      if (bundleId === this.browserBundleId && this.extensionConnected()) { this.session = null; return; }
      if (!this.session || this.session.bundleId !== bundleId || this.session.event.duration >= 3600 || new Date(this.session.event.startedAt).toDateString() !== new Date(interval.start).toDateString()) {
        this.session = { bundleId, event: { id: randomUUID(), title: name, app: name, category: categorize('', name), kind: 'app', startedAt: interval.start, duration: 0 } };
      }
      this.session.event.duration += (interval.end - interval.start) / 1000;
      this.store.upsert(this.session.event, now);
      this.onChanged();
    } catch (error) { this.error = error.message; this.reset(); this.onChanged(); }
    finally { this.busy = false; }
  }

  extensionConnected() { return this.lastExtensionSeen > 0 && this.now() - this.lastExtensionSeen < EXTENSION_TIMEOUT; }
  heartbeat(browserBundleId) {
    if (!EXTENSION_BROWSERS.has(browserBundleId)) return;
    const wasConnected = this.extensionConnected();
    const changedBrowser = this.browserBundleId !== browserBundleId;
    this.browserBundleId = browserBundleId;
    this.lastExtensionSeen = this.now();
    if (!wasConnected || changedBrowser) { this.reset(); this.onChanged(); }
  }
  ingest(event, now = this.now(), browserBundleId = this.browserBundleId) {
    const settings = this.store.getSettings();
    if (!settings.recording || browserBundleId !== this.browserBundleId || !EXTENSION_BROWSERS.has(browserBundleId) || this.suspended || this.locked || this.powerMonitor.getSystemIdleTime() >= IDLE_SECONDS) return null;
    const existing = this.store.getEntry(event.id);
    const normalized = this.ledger.credit(event, existing, now, browserBundleId);
    if (!normalized || isAppExcluded(normalized.app, browserBundleId, settings.excludedApps)) return null;
    return normalized;
  }
  getState() {
    return { platform: this.platform, extensionConnected: this.extensionConnected(), ...(this.lastExtensionSeen ? { lastExtensionSeen: this.lastExtensionSeen } : {}), ...(this.error ? { error: this.error } : {}) };
  }
  reset() { this.session = null; this.ledger.reset(); }
  stopHelper() { const helper = this.helper; this.helper = null; this.nativeSnapshot = null; helper?.kill(); }
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.stopHelper();
    for (const [event, handler] of this.listeners) this.powerMonitor.removeListener(event, handler);
    this.listeners = [];
    this.reset();
  }
}

module.exports = { ForegroundCollector, ForegroundLedger, IDLE_SECONDS, EXTENSION_TIMEOUT };
