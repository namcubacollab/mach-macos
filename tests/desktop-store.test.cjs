'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ActivityStore } = require('../desktop/store.cjs');

const now = Date.UTC(2026, 9, 17, 8);
const day = 86_400_000;
const event = (patch = {}) => ({ id: 'page:one', kind: 'page', title: 'Design reference', url: 'https://figma.com/file/one', domain: 'figma.com', app: 'Google Chrome', category: 'work', startedAt: now - 60_000, duration: 10, ...patch });

function fixture(t, options = {}) {
  const store = new ActivityStore(':memory:', { now: () => now, ...options });
  t.after(() => store.close());
  return store;
}

test('duration updates are cumulative idempotent upserts, including out-of-order delivery', (t) => {
  const store = fixture(t);
  assert.equal(store.upsert(event({ duration: 10 })), true);
  assert.equal(store.upsert(event({ duration: 20 })), true);
  assert.equal(store.upsert(event({ duration: 20 })), true);
  assert.equal(store.upsert(event({ duration: 5 })), true);
  assert.equal(store.getEvents().length, 1);
  assert.equal(store.getEvents()[0].duration, 20);
  assert.equal(store.getEntry('page:one').observedAt, now);
});

test('an id cannot be reused for another activity identity', (t) => {
  const store = fixture(t);
  const original = event();
  store.upsert(original);
  for (const change of [{ startedAt: original.startedAt + 1 }, { kind: 'interaction', action: 'like' }, { url: 'https://another.example/' }, { app: 'Safari' }, { action: 'save' }]) {
    assert.equal(store.upsert(event({ ...change, duration: 40 })), false, JSON.stringify(change));
    assert.deepEqual(store.getEntry(original.id).event, original);
  }
});

test('bookmarks survive subsequent session updates and can be explicitly removed', (t) => {
  const store = fixture(t);
  store.upsert(event());
  store.bookmark('page:one', true);
  store.upsert(event({ duration: 35 }));
  assert.equal(store.getEntry('page:one').event.bookmarked, true);
  store.bookmark('page:one', false);
  assert.equal(store.getEntry('page:one').event.bookmarked, false);
  assert.throws(() => store.bookmark('page:one', 'true'));
  store.bookmark('does-not-exist', true);
  assert.equal(store.getEvents().length, 1);
});

test('retention applies on reads and setting changes, including bookmarked events', (t) => {
  let clock = now;
  const store = fixture(t, { now: () => clock });
  store.upsert(event({ id: 'old', startedAt: now - 20 * day, bookmarked: true }));
  store.upsert(event({ id: 'boundary', startedAt: now - 7 * day }));
  store.upsert(event({ id: 'new', startedAt: now - day }));
  assert.equal(store.getEvents().length, 3);
  store.updateSettings({ retentionDays: 7 });
  assert.deepEqual(store.getEvents().map(e => e.id), ['new', 'boundary']);
  clock += 1;
  assert.deepEqual(store.getEvents().map(e => e.id), ['new']);
});

test('deleting one event and clearing history leave settings intact', (t) => {
  const store = fixture(t);
  store.updateSettings({ recording: true, excludedDomains: ['example.com'], focusGoalMinutes: 95 });
  store.upsert(event());
  store.upsert(event({ id: 'second' }));
  store.deleteEvent('page:one');
  assert.deepEqual(store.getEvents().map(e => e.id), ['second']);
  store.clearHistory();
  assert.deepEqual(store.getEvents(), []);
  assert.equal(store.getSettings().recording, true);
  assert.equal(store.getSettings().focusGoalMinutes, 95);
  assert.deepEqual(store.getSettings().excludedDomains, ['example.com']);
});

test('persistent database retains validated preferences and event bookmarks across restart', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mach-store-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'activity.sqlite');
  const original = new ActivityStore(file, { now: () => now });
  original.updateSettings({ recording: true, excludedApps: ['com.apple.Terminal'], retentionDays: 14 });
  original.upsert(event());
  original.bookmark('page:one', true);
  original.close();
  const restored = new ActivityStore(file, { now: () => now });
  t.after(() => restored.close());
  assert.equal(restored.getSettings().retentionDays, 14);
  assert.equal(restored.allowsApp('Terminal', 'com.apple.Terminal'), false);
  assert.equal(restored.allowsApp('Code', 'com.microsoft.VSCode'), true);
  assert.equal(restored.getEvents()[0].bookmarked, true);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('late browser snapshots cannot resurrect deleted events or cleared history', (t) => {
  let clock = now;
  const store = fixture(t, { now: () => clock });
  store.upsert(event());
  store.deleteEvent('page:one');
  clock += 15000;
  assert.equal(store.upsert(event({ duration: 25 })), false);
  assert.deepEqual(store.getEvents(), []);
  store.upsert(event({ id: 'second', startedAt: clock - 1000 }));
  store.clearHistory();
  clock += 15000;
  assert.equal(store.upsert(event({ id: 'second', startedAt: clock - 16000, duration: 15 })), false);
  assert.equal(store.upsert(event({ id: 'new', startedAt: clock - 1000, duration: 1 })), true);
  assert.deepEqual(store.getEvents().map(item => item.id), ['new']);
});

test('clear preserves deletion barriers for sessions accepted with positive clock skew', (t) => {
  let clock = now;
  const store = fixture(t, { now: () => clock });
  const future = event({ startedAt: now + 5000, duration: 0 });
  const deleted = event({ id: 'already-deleted', startedAt: now + 4000, duration: 0 });
  store.upsert(future);
  store.upsert(deleted);
  store.deleteEvent(deleted.id);
  store.clearHistory();
  clock += 10_000;
  assert.equal(store.upsert({ ...future, duration: 5 }), false);
  assert.equal(store.upsert({ ...deleted, duration: 6 }), false);
  assert.deepEqual(store.getEvents(), []);
  assert.equal(store.upsert(event({ id: 'new-session', startedAt: clock, duration: 0 })), true);
});

test('a tombstone lasts through the complete one-day ingestion window with clock skew', (t) => {
  let clock = now;
  const store = fixture(t, { now: () => clock });
  const future = event({ startedAt: now + 5000, duration: 0 });
  store.upsert(future);
  store.deleteEvent(future.id);
  clock += day + 1;
  store.prune();
  assert.equal(store.upsert({ ...future, duration: 1 }), false);
  clock = now + day + 5001;
  store.prune();
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM deleted_events').get().count, 0);
});

test('full history reads include more than 20,000 events for complete exports', (t) => {
  const store = fixture(t);
  store.db.exec('BEGIN');
  for (let index = 0; index < 20001; index++) store.upsert(event({ id: `event:${index}`, startedAt: now - index }));
  store.db.exec('COMMIT');
  const events = store.getEvents();
  assert.equal(events.length, 20001);
  assert.equal(events[0].id, 'event:0');
  assert.equal(events.at(-1).id, 'event:20000');
});
