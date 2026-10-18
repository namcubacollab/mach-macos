'use strict';

const CATEGORIES = new Set(['work', 'learn', 'social', 'life']);
const ACTIONS = new Set(['view', 'like', 'comment', 'save', 'share', 'click']);
const DEFAULT_SETTINGS = Object.freeze({
  recording: false, captureSocial: false, retentionDays: 30,
  excludedDomains: [], excludedApps: [], focusGoalMinutes: 120,
});
const BROWSERS = new Set([
  'com.google.Chrome', 'com.google.Chrome.canary', 'com.microsoft.edgemac',
  'com.brave.Browser', 'company.thebrowser.Browser', 'com.operasoftware.Opera',
  'com.vivaldi.Vivaldi', 'org.chromium.Chromium', 'com.apple.Safari', 'org.mozilla.firefox',
]);
// Transport identity must be detected by the extension, and verified against native foreground evidence.
const EXTENSION_BROWSERS = new Set(['com.google.Chrome', 'com.microsoft.edgemac', 'com.brave.Browser']);
const PRIVATE_SEGMENTS = /^(?:login|log-?in|signin|sign-in|signup|sign-up|sso|auth\d*|oauth\d*|authorize|callback|password|reset-password|account|accounts|settings|security|billing|checkout|payment|payments|wallet|mail|webmail|inbox|messages?|messaging|direct|dm|chat|chats|compose|notifications?)$/i;
const PRIVATE_HOSTS = /(?:^|\.)(?:mail\.google\.com|mail\.yahoo\.com|chat\.google\.com|outlook\.(?:live|office|office365)\.com|fastmail\.com|hey\.com|proton\.me|protonmail\.com|icloud\.com|whatsapp\.com|telegram\.org|messenger\.com|discord\.com|discordapp\.com|slack\.com|meet\.google\.com|teams\.(?:microsoft|live)\.com)$/i;

function cleanText(value, max = 240) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

function normalizeDomain(value) {
  if (typeof value !== 'string') return null;
  const source = value.trim().toLowerCase().replace(/^\*\./, '').replace(/^www\./, '').replace(/\.$/, '');
  if (!source || /[\s/:?#@]/.test(source)) return null;
  try {
    const hostname = new URL(`https://${source}`).hostname;
    return hostname && hostname.length <= 253 ? hostname : null;
  } catch { return null; }
}

function sanitizeURL(value) {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    if (!parsed.hostname || parsed.href.length > 4096) return null;
    // A video ID identifies the public page itself; all tracking/search/token
    // parameters are still removed. Duplicate IDs are ambiguous and discarded.
    const videoIDs = parsed.searchParams.getAll('v');
    const videoID = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname)
      && parsed.pathname === '/watch' && videoIDs.length === 1 && /^[A-Za-z0-9_-]{11}$/.test(videoIDs[0])
      ? videoIDs[0] : null;
    parsed.search = '';
    parsed.hash = '';
    if (videoID) parsed.searchParams.set('v', videoID);
    return { url: parsed.href.slice(0, 4096), domain: parsed.hostname.toLowerCase() };
  } catch { return null; }
}

function isDomainExcluded(domain, exclusions) {
  const hostname = domain.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  return exclusions.some((item) => { const excluded = item.replace(/^www\./, ''); return hostname === excluded || hostname.endsWith(`.${excluded}`); });
}

function isPrivateCaptureURL(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('.') || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host) || PRIVATE_HOSTS.test(host) || parsed.pathname.length > 1024) return true;
    return decodeURIComponent(parsed.pathname).split('/').some((segment) => PRIVATE_SEGMENTS.test(segment));
  } catch { return true; }
}

function isAppExcluded(app, bundleId, exclusions) {
  const names = [app, bundleId].filter(Boolean).map((name) => name.toLowerCase());
  return exclusions.some((name) => names.includes(name.toLowerCase()));
}

function validateSettings(partial, current = DEFAULT_SETTINGS) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) throw new Error('Cài đặt không hợp lệ.');
  const next = { ...current, excludedDomains: [...current.excludedDomains], excludedApps: [...current.excludedApps] };
  for (const [key, value] of Object.entries(partial)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) throw new Error(`Cài đặt không được hỗ trợ: ${key}`);
    if (key === 'recording' || key === 'captureSocial') {
      if (typeof value !== 'boolean') throw new Error('Cài đặt bật/tắt không hợp lệ.');
      next[key] = value;
    } else if (key === 'retentionDays' || key === 'focusGoalMinutes') {
      const max = key === 'retentionDays' ? 365 : 1440;
      if (!Number.isInteger(value) || value < 1 || value > max) throw new Error('Giá trị nằm ngoài phạm vi cho phép.');
      next[key] = value;
    } else if (key === 'excludedDomains') {
      if (!Array.isArray(value) || value.length > 100) throw new Error('Danh sách tên miền không hợp lệ.');
      const domains = value.map(normalizeDomain);
      if (domains.some((domain) => !domain)) throw new Error('Chỉ nhập tên miền, ví dụ youtube.com.');
      next[key] = [...new Set(domains)];
    } else if (key === 'excludedApps') {
      if (!Array.isArray(value) || value.length > 100 || value.some((name) => typeof name !== 'string' || !cleanText(name, 160))) throw new Error('Danh sách ứng dụng không hợp lệ.');
      next[key] = [...new Set(value.map((name) => cleanText(name, 160)))];
    }
  }
  return next;
}

function categorize(domain = '', app = '') {
  if (/(^|\.)(facebook|instagram|x|twitter|tiktok|reddit|threads|linkedin)\.(com|net)$/.test(domain)) return 'social';
  if (/(^|\.)(youtube|coursera|udemy|wikipedia|developer\.apple|stackoverflow|medium)\./.test(domain)) return 'learn';
  if (/code|terminal|xcode|figma|notion|slack|linear|studio|zed|cursor/i.test(app) || /github|gitlab|figma|notion|linear|docs\.google/.test(domain)) return 'work';
  return 'life';
}

function normalizeEvent(value, settings, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.id)) return null;
  if (!['page', 'interaction'].includes(value.kind)) return null;
  if (!Number.isSafeInteger(value.startedAt) || value.startedAt > now + 5000 || value.startedAt < now - Math.min(settings.retentionDays, 1) * 86400000) return null;
  if (!Number.isFinite(value.duration) || value.duration < 0 || value.duration > 86400) return null;
  if (value.duration > Math.max(0, (now - value.startedAt) / 1000) + 2) return null;
  const location = sanitizeURL(value.url);
  if (!location || isPrivateCaptureURL(location.url) || isDomainExcluded(location.domain, settings.excludedDomains)) return null;
  if (value.kind === 'interaction' && (!settings.captureSocial || !ACTIONS.has(value.action))) return null;
  if (value.kind === 'interaction' && value.duration !== 0) return null;
  const title = cleanText(value.title, 300) || location.domain;
  return {
    id: value.id, title, ...location, app: 'Browser',
    category: categorize(location.domain), kind: value.kind,
    startedAt: value.startedAt, duration: value.kind === 'page' ? Math.floor(value.duration * 1000) / 1000 : 0,
    ...(value.kind === 'interaction' ? { action: value.action, ...(cleanText(value.excerpt, 240) ? { excerpt: cleanText(value.excerpt, 240) } : {}) } : {}),
  };
}

module.exports = { DEFAULT_SETTINGS, BROWSERS, EXTENSION_BROWSERS, CATEGORIES, cleanText, normalizeDomain, sanitizeURL, isDomainExcluded, isPrivateCaptureURL, isAppExcluded, validateSettings, normalizeEvent, categorize };
