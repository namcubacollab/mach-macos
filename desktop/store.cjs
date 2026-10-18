'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DEFAULT_SETTINGS, validateSettings, isAppExcluded } = require('./policy.cjs');

class ActivityStore {
  constructor(filename, { now = () => Date.now() } = {}) {
    this.now = now;
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, observed_at INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS deleted_events (id TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS events_started_at ON events(started_at);`);
    if (filename !== ':memory:') {
      for (const file of [filename, `${filename}-wal`, `${filename}-shm`]) { try { fs.chmodSync(file, 0o600); } catch {} }
    }
    this.prune();
  }

  getSettings() {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('preferences');
    try { return row ? validateSettings(JSON.parse(row.value), DEFAULT_SETTINGS) : { ...DEFAULT_SETTINGS, excludedDomains: [], excludedApps: [] }; }
    catch { return { ...DEFAULT_SETTINGS, excludedDomains: [], excludedApps: [] }; }
  }

  updateSettings(partial) {
    const next = validateSettings(partial, this.getSettings());
    this.db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)').run('preferences', JSON.stringify(next));
    if (partial.recording === true) this.db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)').run('recordingConsent', 'true');
    this.prune();
    return next;
  }

  hasRecordingConsent() { return this.db.prepare('SELECT value FROM settings WHERE key = ?').get('recordingConsent')?.value === 'true'; }

  getEntry(id) {
    const row = this.db.prepare('SELECT payload, observed_at FROM events WHERE id = ?').get(id);
    return row ? { event: JSON.parse(row.payload), observedAt: Number(row.observed_at) } : null;
  }

  upsert(event, observedAt = this.now()) {
    const cutoff = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('historyCutoff');
    if ((cutoff && event.startedAt <= Number(cutoff.value)) || this.db.prepare('SELECT 1 FROM deleted_events WHERE id = ?').get(event.id)) return false;
    const existing = this.getEntry(event.id);
    if (existing) {
      const old = existing.event;
      if (old.startedAt !== event.startedAt || old.kind !== event.kind || old.url !== event.url || old.app !== event.app || old.action !== event.action) return false;
      event = { ...event, duration: Math.max(old.duration, event.duration), ...(old.bookmarked ? { bookmarked: true } : {}) };
    }
    this.db.prepare('INSERT INTO events(id, started_at, observed_at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET observed_at=excluded.observed_at, payload=excluded.payload')
      .run(event.id, event.startedAt, observedAt, JSON.stringify(event));
    return true;
  }

  getEvents() {
    this.prune();
    return this.db.prepare('SELECT payload FROM events ORDER BY started_at DESC').all().map((row) => JSON.parse(row.payload));
  }

  deleteEvent(id) {
    if (typeof id !== 'string' || id.length > 128) throw new Error('Mã hoạt động không hợp lệ.');
    this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
    this.db.prepare('INSERT OR REPLACE INTO deleted_events(id, deleted_at) VALUES (?, ?)').run(id, this.now());
  }

  clearHistory() {
    const now = this.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)').run('historyCutoff', String(now));
      // Preserve only IDs, never event content. A browser clock can be a few seconds
      // ahead, so the time cutoff alone cannot stop every already-known session.
      this.db.prepare('INSERT OR REPLACE INTO deleted_events(id, deleted_at) SELECT id, ? FROM events').run(now);
      this.db.exec('DELETE FROM events; COMMIT;');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
  }

  bookmark(id, value) {
    if (typeof value !== 'boolean') throw new Error('Giá trị dấu trang không hợp lệ.');
    const existing = this.getEntry(id);
    if (existing) {
      existing.event.bookmarked = value;
      this.db.prepare('UPDATE events SET payload = ? WHERE id = ?').run(JSON.stringify(existing.event), id);
    }
  }

  prune() {
    const settings = this.getSettings();
    this.db.prepare('DELETE FROM events WHERE started_at < ?').run(this.now() - settings.retentionDays * 86400000);
    // Ingestion permits one day of replay plus five seconds of clock skew.
    this.db.prepare('DELETE FROM deleted_events WHERE deleted_at < ?').run(this.now() - 86405000);
  }

  // Applied to future capture; history remains available until explicitly deleted.
  allowsApp(name, bundleId) { return !isAppExcluded(name, bundleId, this.getSettings().excludedApps); }
  close() { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); this.db.close(); }
}

module.exports = { ActivityStore };
