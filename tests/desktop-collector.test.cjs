'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ForegroundLedger, ForegroundCollector } = require('../desktop/collector.cjs');
const { ActivityStore } = require('../desktop/store.cjs');
const { EventEmitter } = require('node:events');

const now = Date.UTC(2026, 9, 17, 8);
const chrome = { name: 'Google Chrome', bundleId: 'com.google.Chrome' };
const code = { name: 'Code', bundleId: 'com.microsoft.VSCode' };
const credit = (ledger, event, existing, time, browser = chrome.bundleId) => ledger.credit(event, existing, time, browser);
const page = (patch = {}) => ({ id: 'page:one', kind: 'page', title: 'An article', app: 'Browser', url: 'https://example.com/', domain: 'example.com', category: 'life', startedAt: now, duration: 20, ...patch });

test('foreground evidence excludes idle, app transitions, non-browser apps, and suspended polling gaps', () => {
  const ledger = new ForegroundLedger();
  assert.equal(ledger.observe(chrome, now, true), null);
  assert.equal(credit(ledger, page(), null, now), null);
  assert.equal(ledger.observe(chrome, now + 1000, false), null);
  assert.equal(ledger.observe(chrome, now + 2000, true), null);
  assert.equal(ledger.observe(code, now + 3000, true), null);
  assert.ok(ledger.observe(code, now + 4000, true));
  assert.equal(credit(ledger, page(), null, now + 4000), null);
  assert.equal(ledger.observe(chrome, now + 5000, true), null);
  assert.equal(ledger.observe(chrome, now + 12_000, true), null);
  assert.equal(credit(ledger, page(), null, now + 12_000), null);
});

test('browser duration is capped by observed foreground seconds and incremental credit since last persistence', () => {
  const ledger = new ForegroundLedger();
  for (let i = 0; i <= 5; i++) ledger.observe(chrome, now + i * 1000, true);
  const first = credit(ledger, page({ duration: 9999 }), null, now + 5000);
  assert.equal(first.duration, 5);
  assert.equal(first.app, 'Google Chrome');
  const existing = { event: first, observedAt: now + 5000 };
  for (let i = 6; i <= 8; i++) ledger.observe(chrome, now + i * 1000, true);
  const update = credit(ledger, page({ duration: 9999 }), existing, now + 8000);
  assert.equal(update.duration, 8);
  const slower = credit(ledger, page({ duration: 6 }), existing, now + 8000);
  assert.equal(slower.duration, 6);
  assert.equal(credit(ledger, page({ duration: 9999 }), { event: update, observedAt: now + 8000 }, now + 8000), null);
});

test('zero-duration snapshots and clicks need a recent browser foreground observation', () => {
  const ledger = new ForegroundLedger();
  const click = page({ kind: 'interaction', action: 'like', duration: 0 });
  assert.equal(credit(ledger, click, null, now), null);
  ledger.observe(chrome, now, true);
  assert.equal(credit(ledger, page({ duration: 0 }), null, now).app, 'Google Chrome');
  assert.equal(credit(ledger, click, null, now).duration, 0);
  assert.equal(credit(ledger, page({ duration: 0 }), null, now + 6000), null);
  assert.equal(credit(ledger, click, null, now + 6000), null);
  ledger.reset();
  assert.equal(credit(ledger, click, null, now), null);
});

test('collector counts app time only while opted in and skips browser sessions with a live extension', async t => {
  let clock = now;
  let idle = 0;
  const store = new ActivityStore(':memory:', { now: () => clock });
  const powerMonitor = new EventEmitter();
  powerMonitor.getSystemIdleTime = () => idle;
  const collector = new ForegroundCollector({ store, powerMonitor, now: () => clock, platform: 'darwin' });
  collector.foregroundApp = async () => code;
  t.after(() => { collector.stop(); store.close(); });
  await collector.tick();
  assert.equal(store.getEvents().length, 0);
  store.updateSettings({ recording: true });
  await collector.tick();
  clock += 1000;
  await collector.tick();
  assert.equal(store.getEvents()[0].duration, 1);
  idle = 60;
  clock += 60_000;
  await collector.tick();
  idle = 0;
  clock += 1000;
  await collector.tick();
  assert.equal(store.getEvents().length, 1, 'first active tick after idle has no elapsed evidence');
  assert.equal(store.getEvents()[0].duration, 1);
  collector.foregroundApp = async () => chrome;
  collector.heartbeat(chrome.bundleId);
  clock += 1000;
  await collector.tick();
  clock += 1000;
  await collector.tick();
  assert.equal(store.getEvents().length, 1, 'connected extension suppresses duplicate browser-app time');
  store.updateSettings({ recording: false });
  assert.equal(collector.ingest(page({ startedAt: clock - 1000, duration: 1 }), clock), null);
  assert.equal(collector.getState().extensionConnected, true);
  clock += 45_000;
  assert.equal(collector.getState().extensionConnected, false);
});

test('turning recording off while the native foreground read is pending prevents a late write', async t => {
  let clock = now;
  const store = new ActivityStore(':memory:', { now: () => clock });
  store.updateSettings({ recording: true });
  const powerMonitor = new EventEmitter();
  powerMonitor.getSystemIdleTime = () => 0;
  const collector = new ForegroundCollector({ store, powerMonitor, now: () => clock, platform: 'darwin' });
  t.after(() => { collector.stop(); store.close(); });
  collector.foregroundApp = async () => code;
  await collector.tick();
  let resolveRead;
  collector.foregroundApp = () => new Promise(resolve => { resolveRead = resolve; });
  clock += 1000;
  const pending = collector.tick();
  store.updateSettings({ recording: false });
  resolveRead(code);
  await pending;
  assert.deepEqual(store.getEvents(), []);
  assert.equal(collector.ledger.previous.eligible, false);
});

test('a Chrome extension can only credit Chrome intervals even when another browser is foreground', () => {
  const ledger = new ForegroundLedger();
  const brave = { name: 'Brave Browser', bundleId: 'com.brave.Browser' };
  for (let second = 0; second <= 4; second++) ledger.observe(brave, now + second * 1000, true);
  assert.equal(credit(ledger, page({ duration: 4 }), null, now + 4000), null);
  assert.equal(credit(ledger, page({ duration: 0 }), null, now + 4000), null);
  assert.equal(credit(ledger, page({ kind: 'interaction', action: 'like', duration: 0, startedAt: now + 4000 }), null, now + 4000), null);
  assert.equal(credit(ledger, page({ duration: 4 }), null, now + 4000, brave.bundleId).duration, 4);
});

test('each supported browser credits only its own foreground intervals', () => {
  const browsers = [chrome, { name: 'Microsoft Edge', bundleId: 'com.microsoft.edgemac' }, { name: 'Brave Browser', bundleId: 'com.brave.Browser' }];
  for (const foreground of browsers) {
    const ledger = new ForegroundLedger();
    for (let second = 0; second <= 4; second++) ledger.observe(foreground, now + second * 1000, true);
    for (const paired of browsers) {
      const result = credit(ledger, page({ duration: 4 }), null, now + 4000, paired.bundleId);
      if (paired.bundleId === foreground.bundleId) {
        assert.equal(result?.app, foreground.name);
        assert.equal(result?.duration, 4);
      } else assert.equal(result, null, `${paired.name} must not borrow ${foreground.name} time`);
    }
  }
});

test('a paired Chrome extension preserves native Safari time and respects bundle exclusions', async t => {
  let clock = now;
  const store = new ActivityStore(':memory:', { now: () => clock });
  store.updateSettings({ recording: true });
  const powerMonitor = new EventEmitter();
  powerMonitor.getSystemIdleTime = () => 0;
  const collector = new ForegroundCollector({ store, powerMonitor, now: () => clock, platform: 'darwin' });
  t.after(() => { collector.stop(); store.close(); });
  collector.foregroundApp = async () => ({ name: 'Safari', bundleId: 'com.apple.Safari' });
  collector.heartbeat(chrome.bundleId);
  await collector.tick();
  clock += 1000;
  await collector.tick();
  assert.equal(store.getEvents()[0].app, 'Safari');
  assert.equal(store.getEvents()[0].duration, 1);
  collector.foregroundApp = async () => chrome;
  clock += 1000; await collector.tick();
  clock += 1000; await collector.tick();
  assert.equal(store.getEvents().length, 1);
  assert.equal(collector.ingest(page({ startedAt: now + 2000, duration: 1 }), clock, chrome.bundleId)?.duration, 1);
  store.updateSettings({ excludedApps: [chrome.bundleId] });
  assert.equal(collector.ingest(page({ startedAt: now + 2000, duration: 1 }), clock, chrome.bundleId), null);
});

test('shutdown during an in-flight native read cannot write to a closed database', async t => {
  const store = new ActivityStore(':memory:', { now: () => now });
  store.updateSettings({ recording: true });
  const powerMonitor = new EventEmitter();
  powerMonitor.getSystemIdleTime = () => 0;
  const collector = new ForegroundCollector({ store, powerMonitor, now: () => now, platform: 'darwin' });
  let resolveRead;
  let changes = 0;
  collector.onChanged = () => changes++;
  collector.foregroundApp = () => new Promise(resolve => { resolveRead = resolve; });
  const pending = collector.tick();
  collector.stop();
  store.close();
  resolveRead(chrome);
  await pending;
  assert.equal(changes, 0);
});
