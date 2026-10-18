import { API_BASE, SITE_ORIGINS, sanitizeURL, classifyDomain, cleanText, elapsedSeconds, makeInteraction, siteForHost, identifyBrowser } from './helpers.mjs';

const HEARTBEAT_MS = 15000;
let token = '';
let socialOptIn = false;
let status = null;
let checkedAt = 0;
let connected = false;
let lastError = '';
let session = null;
let lastTick = 0;
let grantedTabs = false;
let grantedSites = {x: false, reddit: false};
let browserBundleId = null;
let queue = Promise.resolve();
let timer;
const recentClicks = new Map();

const ready = (async () => {
  const local = await chrome.storage.local.get(['pairingToken', 'socialOptIn']);
  token = typeof local.pairingToken === 'string' ? local.pairingToken : '';
  socialOptIn = local.socialOptIn === true;
  let isBrave = false;
  try { isBrave = await navigator.brave?.isBrave() === true; } catch { /* Brand hints remain available. */ }
  browserBundleId = identifyBrowser({brands: navigator.userAgentData?.brands, isBrave, userAgent: navigator.userAgent});
  // An activity is a continuous interval. A restarted worker starts a new
  // segment so later usage is never compressed into time before suspension.
  session = null;
  lastTick = 0;
  await chrome.storage.session.remove('activeSession');
  await readPermissions();
})();

function serial(task) {
  const result = queue.then(() => ready).then(task);
  queue = result.catch(() => {});
  return result;
}

async function readPermissions() {
  grantedTabs = await chrome.permissions.contains({permissions: ['tabs']});
  for (const [site, origins] of Object.entries(SITE_ORIGINS)) {
    grantedSites[site] = await chrome.permissions.contains({origins});
  }
}

async function api(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {Authorization: `Bearer ${token}`, 'X-Mach-Browser': browserBundleId, 'X-Mach-Extension-Origin': `chrome-extension://${chrome.runtime.id}`, ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}),
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? 'Mã ghép nối không hợp lệ hoặc extension chưa được cho phép. Ghép nối lại trong Mạch.'
    : `Mạch phản hồi lỗi ${response.status}.`);
  return response.json();
}

function captureEnabled() {
  return connected && grantedTabs && status?.recording === true && Date.now() - checkedAt < 20000;
}

function socialEnabled() {
  return captureEnabled() && status?.captureSocial === true && socialOptIn;
}

async function persistSession() {
  if (session) await chrome.storage.session.set({activeSession: session});
  else await chrome.storage.session.remove('activeSession');
}

async function disconnect(error = '') {
  connected = false;
  checkedAt = 0;
  status = null;
  session = null;
  lastTick = 0;
  recentClicks.clear();
  lastError = error;
  await persistSession();
}

async function refreshStatus() {
  if (!browserBundleId) {
    await disconnect('Không xác định được trình duyệt. Bản này hỗ trợ Chrome, Edge và Brave bản ổn định; hãy thử cập nhật trình duyệt.');
    return;
  }
  if (!token || !grantedTabs) {
    await disconnect(token ? 'Cấp quyền đọc tab để kết nối.' : 'Chưa ghép nối với ứng dụng Mạch.');
    return;
  }
  try {
    const result = await api('/v1/status');
    if (typeof result.recording !== 'boolean' || typeof result.captureSocial !== 'boolean') throw new Error('Phiên bản ứng dụng Mạch chưa tương thích.');
    status = {recording: result.recording, captureSocial: result.captureSocial,
      excludedDomains: Array.isArray(result.excludedDomains) ? result.excludedDomains.filter(x => typeof x === 'string') : [],
      excludedApps: Array.isArray(result.excludedApps) ? result.excludedApps.filter(x => typeof x === 'string') : []};
    connected = true;
    checkedAt = Date.now();
    lastError = '';
  } catch (error) {
    await disconnect(error instanceof TypeError || error?.name === 'TimeoutError'
      ? 'Không kết nối được. Hãy mở Mạch trên máy Mac này.' : error.message || 'Kết nối bị gián đoạn.');
  }
}

async function activeContext() {
  if (!grantedTabs || await chrome.idle.queryState(60) !== 'active') return null;
  const window = await chrome.windows.getLastFocused();
  if (!window?.focused || window.incognito || window.type !== 'normal') return null;
  const [tab] = await chrome.tabs.query({active: true, windowId: window.id});
  if (!tab || tab.incognito || !Number.isInteger(tab.id) || tab.status === 'loading') return null;
  const safe = sanitizeURL(tab.url, status?.excludedDomains);
  if (!safe) return null;
  return {tab, windowId: window.id, safe};
}

async function publishState() {
  const active = captureEnabled();
  const badge = !token ? '' : !connected ? '!' : active ? 'ON' : 'Ⅱ';
  await chrome.action.setBadgeText({text: badge});
  await chrome.action.setBadgeBackgroundColor({color: active ? '#39755b' : '#8a7053'});
  await chrome.action.setTitle({title: `Mạch — ${!connected ? 'chưa kết nối' : active ? 'đang ghi tab đang xem' : 'đã tạm dừng'}`});
  // Only permission-granted social sites receive a gate update, never arbitrary tabs.
  const matches = Object.entries(SITE_ORIGINS).filter(([site]) => grantedSites[site]).flatMap(([, origins]) => origins);
  if (matches.length) {
    try {
      const tabs = await chrome.tabs.query({url: matches});
      await Promise.allSettled(tabs.filter(tab => !tab.incognito).map(tab => chrome.tabs.sendMessage(tab.id, {type: 'CAPTURE_STATE', enabled: socialEnabled()})));
    } catch { /* A concurrent permission revocation leaves content-script gates to expire. */ }
  }
}

async function tick({refresh = true} = {}) {
  if (refresh) await refreshStatus();
  if (!captureEnabled()) {
    session = null;
    lastTick = 0;
    await persistSession();
    await publishState();
    return;
  }
  const now = Date.now();
  let context;
  try { context = await activeContext(); }
  catch {
    await disconnect('Không đọc được trạng thái trình duyệt. Đã dừng ghi; hãy kiểm tra quyền extension.');
    await publishState();
    return;
  }
  const snapshots = [];
  if (session && (!lastTick || now - lastTick > 20000 || now < lastTick)) {
    session = null;
    lastTick = 0;
  }
  if (session) {
    const seconds = elapsedSeconds(lastTick, now);
    session.event.duration = Math.round((session.event.duration + seconds) * 1000) / 1000;
    // A changed exclusion takes effect before a previously open page can be sent again.
    if (sanitizeURL(session.event.url, status.excludedDomains)) snapshots.push({...session.event});
  }
  const same = context && session && session.tabId === context.tab.id && session.windowId === context.windowId && session.event.url === context.safe.url;
  if (!same) {
    session = context ? {
      tabId: context.tab.id, windowId: context.windowId,
      event: {id: crypto.randomUUID(), kind: 'page', app: 'Browser', ...context.safe,
        category: classifyDomain(context.safe.domain), title: cleanText(context.tab.title) || context.safe.domain,
        startedAt: now, duration: 0, action: 'view'},
    } : null;
    if (session) snapshots.push({...session.event});
  } else {
    session.event.title = cleanText(context.tab.title) || context.safe.domain;
    if (snapshots.length) snapshots[snapshots.length - 1].title = session.event.title;
  }
  lastTick = context ? now : 0;
  if (snapshots.length) {
    try {
      await api('/v1/events', {events: snapshots});
      await persistSession();
    } catch (error) {
      // Never queue browsing events for later delivery while the desktop is unreachable.
      await disconnect('Mất kết nối với Mạch. Đã dừng ghi; không lưu hàng đợi hoạt động.');
    }
  } else await persistSession();
  await publishState();
}

async function syncContentScripts() {
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const ids = existing.filter(script => script.id.startsWith('mach-social-')).map(script => script.id);
  if (ids.length) await chrome.scripting.unregisterContentScripts({ids});
  if (!socialOptIn) return;
  for (const [site, matches] of Object.entries(SITE_ORIGINS)) {
    if (!grantedSites[site]) continue;
    await chrome.scripting.registerContentScripts([{
      id: `mach-social-${site}`, matches, js: ['social-content.js'], runAt: 'document_idle',
      allFrames: false, persistAcrossSessions: true,
    }]);
    // Activate on already-open pages after the user grants this site's permission.
    const tabs = await chrome.tabs.query({url: matches});
    await Promise.allSettled(tabs.filter(tab => !tab.incognito).map(tab => chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['social-content.js']})));
  }
}

async function publicState() {
  return {paired: Boolean(token), connected, recording: captureEnabled(), desktopSocial: status?.captureSocial === true,
    socialOptIn, grantedTabs, grantedSites, lastError, checkedAt, browserBundleId};
}

async function interaction(message, sender) {
  if (!socialEnabled() || !sender.tab || sender.tab.incognito || sender.frameId !== 0) return {accepted: false};
  const context = await activeContext();
  if (!context || context.tab.id !== sender.tab.id) return {accepted: false};
  const site = siteForHost(new URL(context.safe.url).hostname);
  if (!site || !grantedSites[site]) return {accepted: false};
  const event = makeInteraction(message, {tabURL: context.safe.url, excludedDomains: status.excludedDomains}, crypto.randomUUID(), Date.now());
  if (!event) return {accepted: false};
  const key = `${sender.tab.id}:${event.action}:${event.url}`;
  if (Date.now() - (recentClicks.get(key) || 0) < 1200) return {accepted: false};
  recentClicks.set(key, Date.now());
  for (const [key, time] of recentClicks) if (Date.now() - time > 10000) recentClicks.delete(key);
  try { await api('/v1/events', {events: [event]}); return {accepted: true}; }
  catch { await disconnect('Mất kết nối với Mạch. Đã dừng ghi tương tác.'); await publishState(); return {accepted: false}; }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  serial(async () => {
    if (message?.type === 'GET_CAPTURE_STATE') return {enabled: socialEnabled()};
    if (message?.type === 'OBSERVED_INTERACTION') return interaction(message, sender);
    // Pairing and settings can only be changed by the extension popup.
    if (sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) throw new Error('Yêu cầu không hợp lệ.');
    switch (message?.type) {
      case 'GET_STATE': await readPermissions(); await tick(); return publicState();
      case 'PAIR': {
        const input = typeof message.token === 'string' ? message.token.trim() : '';
        if (!/^[A-Za-z0-9_=-]{16,256}$/.test(input)) throw new Error('Dán mã ghép nối từ phần Cài đặt của Mạch.');
        await disconnect(); token = input;
        await chrome.storage.local.set({pairingToken: token});
        await readPermissions(); await tick(); return publicState();
      }
      case 'UNPAIR':
        token = ''; socialOptIn = false;
        await chrome.storage.local.remove(['pairingToken', 'socialOptIn']);
        await disconnect(); await syncContentScripts(); await publishState(); return publicState();
      case 'SET_SOCIAL':
        socialOptIn = message.enabled === true;
        await chrome.storage.local.set({socialOptIn});
        await readPermissions(); await syncContentScripts(); await publishState(); return publicState();
      case 'PERMISSIONS_CHANGED':
        await readPermissions(); await syncContentScripts(); await tick(); return publicState();
      default: throw new Error('Yêu cầu không hợp lệ.');
    }
  }).then(respond).catch(error => respond({error: error.message || 'Không thực hiện được thao tác.'}));
  return true;
});

function observeBoundary() { void serial(() => tick()).catch(() => {}); }
chrome.tabs.onActivated.addListener(observeBoundary);
chrome.tabs.onUpdated.addListener((_tabId, changes) => {
  if (changes.url || changes.status === 'complete') observeBoundary();
});
chrome.tabs.onRemoved.addListener(observeBoundary);
chrome.windows.onFocusChanged.addListener(observeBoundary);
chrome.idle.onStateChanged.addListener(observeBoundary);
chrome.permissions.onAdded.addListener(() => void serial(async () => {await readPermissions(); await syncContentScripts(); await tick();}).catch(() => {}));
chrome.permissions.onRemoved.addListener(() => void serial(async () => {await readPermissions(); await syncContentScripts(); await tick();}).catch(() => {}));
chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === 'mach-heartbeat') observeBoundary();});
chrome.runtime.onStartup.addListener(observeBoundary);
chrome.runtime.onInstalled.addListener(observeBoundary);

void serial(async () => {
  chrome.idle.setDetectionInterval(60);
  await chrome.alarms.create('mach-heartbeat', {periodInMinutes: 0.5});
  await syncContentScripts();
  await tick();
}).catch(() => {});
// MV3 may suspend this timer. The alarm wakes the worker; suspension earns zero time.
timer = setInterval(observeBoundary, HEARTBEAT_MS);
