import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeURL, canonicalPostURL, isExcludedDomain, cleanText, classifyDomain, elapsedSeconds, makeInteraction, identifyBrowser} from '../extension/helpers.mjs';
import {readFile} from 'node:fs/promises';

test('sanitizer removes query and fragments, rejects credentials and private routes', () => {
  assert.deepEqual(sanitizeURL('https://example.com/read?a=secret#token'), {url:'https://example.com/read',domain:'example.com'});
  for (const url of [
    'chrome://history', 'file:///Users/me/secret', 'https://me:secret@example.com/',
    'http://127.0.0.1/admin', 'https://[::1]/', 'http://localhost/', 'http://localhost.test.local/',
    'https://example.com/messages/123', 'https://x.com/i/chat', 'https://example.com/%69nbox/',
    'https://mail.google.com/mail/u/0/', 'https://web.whatsapp.com/', 'https://discord.com/channels/1/2',
    'https://acme.slack.com/client/T/C', 'https://example.com/%XX', 'not a url',
    'https://example.com/oauth2/authorize', 'https://example.com/sso/return',
    'https://mail.yahoo.com/d/folders/1', 'https://outlook.office365.com/',
  ]) assert.equal(sanitizeURL(url), null, url);
});

test('native browser identity is exact and an ambiguous Chromium UA fails closed', () => {
  assert.equal(identifyBrowser({brands:[{brand:'Google Chrome'},{brand:'Chromium'}]}),'com.google.Chrome');
  assert.equal(identifyBrowser({brands:[{brand:'Microsoft Edge'},{brand:'Chromium'}]}),'com.microsoft.edgemac');
  assert.equal(identifyBrowser({brands:[{brand:'Brave'},{brand:'Chromium'}]}),'com.brave.Browser');
  assert.equal(identifyBrowser({brands:[{brand:'Google Chrome'}],isBrave:true}),'com.brave.Browser');
  assert.equal(identifyBrowser({userAgent:'Mozilla Chrome/140 Safari/537 Edg/140'}),'com.microsoft.edgemac');
  assert.equal(identifyBrowser({brands:[{brand:'Chromium'}],userAgent:'Mozilla Chrome/140 Safari/537'}),null);
  assert.equal(identifyBrowser(),null);
});

test('YouTube watch preserves one valid video identity without tracking or private parameters', () => {
  for (const host of ['youtube.com', 'www.youtube.com', 'm.youtube.com']) {
    assert.deepEqual(sanitizeURL(`https://${host}/watch?list=private&v=aB_-0123456&t=99&search=secret#token`), {
      url: `https://${host}/watch?v=aB_-0123456`, domain: host.replace(/^www\./, ''),
    });
  }
  for (const query of ['v=short', 'v=012345678901', 'v=1234567890!', 'v=', 'v=12345678901&v=12345678901', 'v=12345678901&v=ABCDEFGHIJK', 'V=12345678901', 'q=secret']) {
    assert.equal(sanitizeURL(`https://youtube.com/watch?${query}#private`).url, 'https://youtube.com/watch', query);
  }
  for (const address of ['https://youtube.com/search', 'https://youtube.com/watch/', 'https://music.youtube.com/watch', 'https://youtube.com.evil.example/watch', 'https://example.com/watch']) {
    assert.equal(sanitizeURL(`${address}?v=12345678901`).url, address);
  }
  assert.equal(sanitizeURL('https://youtube.com/watch?v=12345678901', ['youtube.com']), null);
  assert.notEqual(sanitizeURL('https://youtube.com/watch?v=12345678901').url, sanitizeURL('https://youtube.com/watch?v=ABCDEFGHIJK').url);
});

test('excluded domains match suffix boundaries without blocking unrelated domains', () => {
  assert.equal(isExcludedDomain('docs.example.com', ['https://www.example.com/path']), true);
  assert.equal(isExcludedDomain('example.com', ['*.example.com']), true);
  assert.equal(isExcludedDomain('notexample.com', ['example.com']), false);
  assert.equal(sanitizeURL('https://child.example.com/page', ['example.com']), null);
});

test('canonical post URLs cannot point to inboxes, arbitrary pages, or other origins', () => {
  assert.deepEqual(canonicalPostURL('https://twitter.com/alice/status/12345/photo/1?s=20'), {url:'https://x.com/alice/status/12345',domain:'x.com',site:'x'});
  assert.deepEqual(canonicalPostURL('https://old.reddit.com/r/mac/comments/ab12cd/title/comment?context=3'), {url:'https://www.reddit.com/r/mac/comments/ab12cd/',domain:'reddit.com',site:'reddit'});
  for (const url of ['https://x.com/messages/123', 'https://x.com/home', 'https://x.com/i/status/123', 'https://evil.com/a/status/123', 'https://www.reddit.com/user/me/', 'https://www.reddit.com/message/inbox']) assert.equal(canonicalPostURL(url), null, url);
});

test('interaction validation enforces host, known actions, bounded text and zero duration', () => {
  const message = {action:'like',url:'https://x.com/me/status/123?q=private',title:'a'.repeat(400),excerpt:'b'.repeat(900)};
  const context = {tabURL:'https://x.com/home',excludedDomains:[]};
  const event = makeInteraction(message, context, 'event-1', 1000);
  assert.equal(event.kind, 'interaction');
  assert.equal(event.url, 'https://x.com/me/status/123');
  assert.equal(event.duration, 0);
  assert.equal(event.title.length,160);
  assert.equal(event.excerpt.length,240);
  assert.equal(makeInteraction({...message,action:'password'}, context,'a',1),null);
  assert.equal(makeInteraction(message, {...context,tabURL:'https://reddit.com/'},'a',1),null);
  assert.equal(makeInteraction(message, {...context,tabURL:'https://x.com/messages/1'},'a',1),null);
  assert.equal(makeInteraction(message, {...context,excludedDomains:['x.com']},'a',1),null);
});

test('timing does not credit sleep, suspension, invalid values or a backwards clock', () => {
  assert.equal(elapsedSeconds(1000,16000),15);
  assert.equal(elapsedSeconds(1000,21000),20);
  assert.equal(elapsedSeconds(1000,21001),0);
  assert.equal(elapsedSeconds(2000,1000),0);
  assert.equal(elapsedSeconds(NaN,1000),0);
  assert.equal(elapsedSeconds(1000,Infinity),0);
});

test('text and category helpers remain conservative', () => {
  assert.equal(cleanText(' hello\n\tworld '),'hello world');
  assert.equal(cleanText({sensitive:true}),'');
  assert.equal(classifyDomain('docs.google.com'),'work');
  assert.equal(classifyDomain('x.com'),'social');
  assert.equal(classifyDomain('unknown.example'),'life');
});

test('manifest has no broad page access and disallows incognito', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url),'utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.incognito,'not_allowed');
  assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:43821/*']);
  assert.equal(manifest.permissions.includes('tabs'),false);
  assert.equal(manifest.optional_permissions.includes('tabs'),true);
  assert.equal(manifest.optional_host_permissions.some(pattern => pattern.includes('<all_urls>') || pattern === '*://*/*'),false);
});
