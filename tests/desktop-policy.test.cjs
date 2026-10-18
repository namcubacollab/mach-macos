'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SETTINGS, sanitizeURL, normalizeDomain, isDomainExcluded,
  isAppExcluded, validateSettings, normalizeEvent,
} = require('../desktop/policy.cjs');

const now = Date.UTC(2026, 9, 17, 8);
const settings = { ...DEFAULT_SETTINGS, recording: true, captureSocial: true, excludedDomains: [], excludedApps: [] };
const page = (patch = {}) => ({ id: 'page:abc-1', kind: 'page', url: 'https://Example.com/article?token=secret#private', title: 'An article', startedAt: now - 30_000, duration: 15.1259, ...patch });

test('general page URLs lose all query and fragment data before entering the activity store', () => {
  assert.deepEqual(sanitizeURL('https://EXAMPLE.com/a%20b?token=secret&email=x%40y.com#private'), {
    url: 'https://example.com/a%20b', domain: 'example.com',
  });
  const normalized = normalizeEvent(page({ excerpt: 'Must not retain arbitrary content', unknown: 'ignored' }), settings, now);
  assert.equal(normalized.url, 'https://example.com/article');
  assert.equal(normalized.duration, 15.125);
  assert.equal(normalized.app, 'Browser');
  assert.equal('excerpt' in normalized, false);
  assert.equal('unknown' in normalized, false);
});

test('YouTube watch URLs retain only one valid public video ID so saved links reopen the video', () => {
  const id = 'dQw4w9WgXcQ';
  for (const host of ['youtube.com', 'www.youtube.com', 'm.youtube.com']) {
    const safe = sanitizeURL(`https://${host}/watch?utm_source=private&v=${id}&token=secret&t=90#fragment`);
    assert.equal(safe.url, `https://${host}/watch?v=${id}`);
    assert.equal(safe.domain, host);
    assert.equal(normalizeEvent(page({ url: safe.url }), settings, now).url, safe.url);
  }
  for (const url of [
    `https://youtube.com/watch?v=${id}&v=${id}`, `https://youtube.com/watch?v=${id}&v=invalid`,
    'https://youtube.com/watch?v=short', 'https://youtube.com/watch?v=bad%2FvideoID',
    `https://youtube.com/results?v=${id}&search_query=private`, `https://example.com/watch?v=${id}`,
    `https://youtube.com.evil.example/watch?v=${id}`, `https://music.youtube.com/watch?v=${id}`,
  ]) assert.equal(new URL(sanitizeURL(url).url).search, '', url);
});

test('rejects credentials, unsafe protocols, invalid and oversized URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/plain,password', 'file:///Users/me/private.txt', 'ftp://example.com', 'https://user:pass@example.com/a', 'https://user@example.com', '//example.com', 'not a url', null, `https://example.com/${'a'.repeat(9000)}`]) {
    assert.equal(sanitizeURL(url), null, `accepted ${String(url).slice(0, 80)}`);
    assert.equal(normalizeEvent(page({ url }), settings, now), null);
  }
});

test('exclusions match a domain and its subdomains without matching unrelated suffixes', () => {
  assert.equal(normalizeDomain(' *.Example.COM. '), 'example.com');
  assert.equal(normalizeDomain('https://example.com'), null);
  assert.equal(normalizeDomain('example.com/private'), null);
  assert.equal(normalizeDomain('example.com:443'), null);
  assert.equal(isDomainExcluded('a.example.com', ['example.com']), true);
  assert.equal(isDomainExcluded('example.com', ['example.com']), true);
  assert.equal(isDomainExcluded('notexample.com', ['example.com']), false);
  assert.equal(isDomainExcluded('example.com.evil.test', ['example.com']), false);
  assert.equal(normalizeEvent(page({ url: 'https://account.example.com/settings' }), { ...settings, excludedDomains: ['example.com'] }, now), null);
  assert.equal(isAppExcluded('Google Chrome', 'com.google.Chrome', ['COM.GOOGLE.CHROME']), true);
  assert.equal(isAppExcluded('Chrome Remote Desktop', 'other.bundle', ['Chrome']), false);
});

test('event timestamps and duration cannot manufacture future or impossible history', () => {
  for (const patch of [
    { startedAt: now + 5001 }, { startedAt: now - 86_400_001 }, { startedAt: NaN },
    { startedAt: String(now) }, { startedAt: now - 0.5 },
    { duration: -1 }, { duration: NaN }, { duration: Infinity }, { duration: '10' },
    { duration: 32.001 }, { duration: 86_401 }, { kind: 'app' }, { id: '../escape' },
    { id: '' }, { id: 'x'.repeat(129) },
  ]) assert.equal(normalizeEvent(page(patch), settings, now), null, JSON.stringify(patch));
  assert.ok(normalizeEvent(page({ startedAt: now, duration: 0 }), settings, now));
  assert.ok(normalizeEvent(page({ startedAt: now - 86_400_000, duration: 1 }), settings, now));
});

test('social clicks require explicit opt-in and a known action with zero duration', () => {
  const social = page({ kind: 'interaction', action: 'like', duration: 0, url: 'https://www.reddit.com/r/programming/comments/abc' });
  assert.equal(normalizeEvent(social, { ...settings, captureSocial: false }, now), null);
  assert.equal(normalizeEvent({ ...social, action: 'typing' }, settings, now), null);
  assert.equal(normalizeEvent({ ...social, duration: 1 }, settings, now), null);
  const normalized = normalizeEvent(social, settings, now);
  assert.equal(normalized.action, 'like');
  assert.equal(normalized.category, 'social');
  assert.equal(normalized.duration, 0);
  assert.equal(normalizeEvent({ ...social, excerpt: 'Public post\u0000 excerpt' }, settings, now).excerpt, 'Public post  excerpt');
});

test('sensitive routes, private services and local network URLs are rejected at the desktop boundary', () => {
  for (const url of ['https://x.com/messages/42', 'https://example.com/oauth2/callback', 'https://example.com/%61ccount/security', 'https://mail.google.com/mail/u/0', 'https://app.slack.com/client', 'http://localhost:3000', 'http://192.168.1.2/private', 'http://dev.internal/page', 'http://[::1]/', 'https://example.com/%zz']) {
    assert.equal(normalizeEvent(page({ url }), settings, now), null, url);
  }
  assert.ok(normalizeEvent(page({ url: 'https://example.com/articles/password-manager-review' }), settings, now));
  assert.equal(isDomainExcluded('example.com', ['www.example.com']), true);
  assert.equal(normalizeDomain('www.example.com'), 'example.com');
  assert.throws(() => validateSettings(JSON.parse('{"__proto__":true}')));
  assert.throws(() => validateSettings({ toString: true }));
});

test('settings validation rejects malformed values atomically and does not mutate defaults', () => {
  const next = validateSettings({ recording: true, excludedDomains: ['*.EXAMPLE.com', 'example.com'], excludedApps: ['Code\u0000', 'Code'], retentionDays: 7, focusGoalMinutes: 90 });
  assert.deepEqual(next.excludedDomains, ['example.com']);
  assert.deepEqual(next.excludedApps, ['Code']);
  assert.equal(DEFAULT_SETTINGS.recording, false);
  assert.deepEqual(DEFAULT_SETTINGS.excludedDomains, []);
  for (const value of [null, [], 'settings', { recording: 1 }, { captureSocial: 'true' }, { retentionDays: 0 }, { retentionDays: 366 }, { retentionDays: 1.2 }, { focusGoalMinutes: 1441 }, { excludedDomains: ['https://example.com'] }, { excludedDomains: ['good.example', null] }, { excludedApps: [''] }, { excludedApps: [42] }, { surprise: true }]) {
    assert.throws(() => validateSettings(value), undefined, JSON.stringify(value));
  }
  next.excludedApps.push('Terminal');
  assert.deepEqual(validateSettings({}).excludedApps, []);
});
