export const API_BASE = 'http://127.0.0.1:43821';
export const SITE_ORIGINS = Object.freeze({
  x: ['https://x.com/*', 'https://twitter.com/*'],
  reddit: ['https://www.reddit.com/*', 'https://old.reddit.com/*', 'https://reddit.com/*'],
});

const PRIVATE_SEGMENTS = /^(?:login|log-?in|signin|sign-in|signup|sign-up|sso|auth\d*|oauth\d*|authorize|callback|password|reset-password|account|accounts|settings|security|billing|checkout|payment|payments|wallet|mail|webmail|inbox|messages?|messaging|direct|dm|chat|chats|compose|notifications?)$/i;
const PRIVATE_HOSTS = /(?:^|\.)(?:mail\.google\.com|mail\.yahoo\.com|chat\.google\.com|outlook\.(?:live|office|office365)\.com|fastmail\.com|hey\.com|proton\.me|protonmail\.com|icloud\.com|whatsapp\.com|telegram\.org|messenger\.com|discord\.com|discordapp\.com|slack\.com|meet\.google\.com|teams\.(?:microsoft|live)\.com)$/i;

export function identifyBrowser({brands = [], isBrave = false, userAgent = ''} = {}) {
  const names = Array.isArray(brands) ? brands.map(item => typeof item === 'string' ? item : item?.brand) : [];
  if (isBrave || names.includes('Brave')) return 'com.brave.Browser';
  if (names.includes('Microsoft Edge') || /\bEdg\//.test(userAgent)) return 'com.microsoft.edgemac';
  // A generic Chrome UA is shared by Arc/Opera/Brave; do not guess its native app.
  if (names.includes('Google Chrome')) return 'com.google.Chrome';
  return null;
}

export function cleanText(value, limit = 160) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

export function isExcludedDomain(host, excluded = []) {
  const normalized = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  return excluded.some(item => {
    if (typeof item !== 'string') return false;
    const candidate = item.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/^\*\./, '').replace(/^www\./, '').replace(/\.$/, '');
    return candidate && (normalized === candidate || normalized.endsWith(`.${candidate}`));
  });
}

export function sanitizeURL(value, excluded = []) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host) || PRIVATE_HOSTS.test(host) || isExcludedDomain(host, excluded)) return null;
    let segments;
    try { segments = decodeURIComponent(url.pathname).split('/').filter(Boolean); } catch { return null; }
    if (segments.some(segment => PRIVATE_SEGMENTS.test(segment))) return null;
    // Keep only a public YouTube video identity, never tracking/search parameters.
    // Duplicate IDs are ambiguous and fail closed, even if their values match.
    const videoIDs = url.searchParams.getAll('v');
    const videoID = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
      && url.pathname === '/watch' && videoIDs.length === 1 && /^[A-Za-z0-9_-]{11}$/.test(videoIDs[0])
      ? videoIDs[0] : null;
    url.search = '';
    if (videoID) url.searchParams.set('v', videoID);
    url.hash = '';
    if (url.pathname.length > 1024) return null;
    return {url: url.href, domain: host.replace(/^www\./, '')};
  } catch { return null; }
}

export function siteForHost(host) {
  if (['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(host)) return 'x';
  if (['reddit.com', 'www.reddit.com', 'old.reddit.com'].includes(host)) return 'reddit';
  return null;
}

export function canonicalPostURL(value, excluded = []) {
  const safe = sanitizeURL(value, excluded);
  if (!safe) return null;
  const url = new URL(safe.url);
  const site = siteForHost(url.hostname);
  if (site === 'x') {
    const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,30})\/status\/(\d+)(?:\/|$)/);
    if (!match || /^(?:i|messages|settings)$/i.test(match[1])) return null;
    return {url: `https://x.com/${match[1]}/status/${match[2]}`, domain: 'x.com', site};
  }
  if (site === 'reddit') {
    const match = url.pathname.match(/^\/r\/([A-Za-z0-9_]+)\/comments\/([a-zA-Z0-9]+)(?:\/|$)/);
    if (!match) return null;
    return {url: `https://www.reddit.com/r/${match[1]}/comments/${match[2]}/`, domain: 'reddit.com', site};
  }
  return null;
}

export function classifyDomain(domain) {
  if (/(^|\.)(x\.com|twitter\.com|reddit\.com|facebook\.com|instagram\.com|tiktok\.com|linkedin\.com)$/.test(domain)) return 'social';
  if (/(^|\.)(github\.com|gitlab\.com|figma\.com|notion\.so|linear\.app|docs\.google\.com|slack\.com|stackoverflow\.com)$/.test(domain)) return 'work';
  if (/(^|\.)(wikipedia\.org|developer\.[a-z.]+|dev\.to|medium\.com|coursera\.org|udemy\.com|arxiv\.org|khanacademy\.org)$/.test(domain)) return 'learn';
  return 'life';
}

// No credit for a service-worker suspension or a long gap between observations.
export function elapsedSeconds(previous, now, maxGapMs = 20000) {
  const gap = now - previous;
  return Number.isFinite(gap) && gap > 0 && gap <= maxGapMs ? gap / 1000 : 0;
}

export function makeInteraction(message, context, id, now) {
  if (!message || !['like', 'comment', 'save', 'share'].includes(message.action)) return null;
  const post = canonicalPostURL(message.url, context.excludedDomains);
  const current = sanitizeURL(context.tabURL, context.excludedDomains);
  if (!post || !current || siteForHost(new URL(current.url).hostname) !== post.site) return null;
  return {
    id, kind: 'interaction', app: 'Browser', category: 'social', action: message.action,
    url: post.url, domain: post.domain, title: cleanText(message.title, 160) || 'Bài viết trên mạng xã hội',
    excerpt: cleanText(message.excerpt, 240), startedAt: now, duration: 0,
  };
}
