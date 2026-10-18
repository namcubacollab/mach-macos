(() => {
  if (globalThis.__machSocialObserver) return;
  globalThis.__machSocialObserver = true;
  let enabled = false;
  let enabledUntil = 0;
  const privatePath = /\/(?:messages?|messaging|direct|dm|inbox|chat|settings|account|login|compose)(?:\/|$)/i;
  const allowedHosts = new Set(['x.com', 'twitter.com', 'reddit.com', 'www.reddit.com', 'old.reddit.com']);
  if (!allowedHosts.has(location.hostname)) return;

  function setGate(value) {
    enabled = value === true;
    // A page cannot continue capturing if the worker/app stops sending its heartbeat.
    enabledUntil = enabled ? Date.now() + 20000 : 0;
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'CAPTURE_STATE') setGate(message.enabled);
  });
  chrome.runtime.sendMessage({type: 'GET_CAPTURE_STATE'}).then(state => setGate(state?.enabled)).catch(() => setGate(false));

  function text(value, max) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  }

  function xInteraction(target) {
    const button = target.closest('[data-testid="like"], [data-testid="reply"], [data-testid="retweet"], [data-testid="bookmark"]');
    if (!button) return null;
    const post = button.closest('article[data-testid="tweet"]');
    if (!post) return null;
    // Prefer the post's timestamp permalink over links to a quoted post.
    const timeLink = post.querySelector('a[href*="/status/"] time')?.closest('a');
    const link = timeLink || [...post.querySelectorAll('a[href*="/status/"]')].find(a => /^\/[A-Za-z0-9_]+\/status\/\d+\/?$/.test(new URL(a.href).pathname));
    if (!link) return null;
    const excerpt = text(post.querySelector('[data-testid="tweetText"]')?.textContent || '', 240);
    return {action: {like: 'like', reply: 'comment', retweet: 'share', bookmark: 'save'}[button.dataset.testid],
      url: link.href, title: text(excerpt, 160) || 'Bài viết trên X', excerpt};
  }

  function redditInteraction(event, target) {
    const path = event.composedPath().filter(node => node instanceof Element);
    const post = target.closest('shreddit-post, .thing.link') || path.find(node => node.matches('shreddit-post, .thing.link'));
    if (!post) return null;
    let action = null;
    for (const node of path) {
      if (node === post) break;
      const label = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('data-click-id') || ''} ${node.getAttribute('name') || ''}`.trim().toLowerCase();
      if (/^(?:upvote|vote up|bình chọn lên)(?:\s|$)/.test(label) || node.matches('.arrow.up, .arrow.upmod')) action = 'like';
      else if (/^(?:save|lưu)(?:\s|$)/.test(label) || node.matches('.save-button a')) action = 'save';
      else if (/^(?:share|chia sẻ)(?:\s|$)/.test(label) || node.matches('a.share')) action = 'share';
      else if (/^(?:comments?|bình luận)(?:\s|$)/.test(label) || node.matches('a.comments')) action = 'comment';
      if (action) break;
    }
    if (!action) return null;
    const rawURL = post.getAttribute('permalink') || post.getAttribute('data-permalink') || post.querySelector('a.comments, a[href*="/comments/"]')?.getAttribute('href');
    if (!rawURL) return null;
    const title = text(post.getAttribute('post-title') || post.querySelector('a.title, [slot="title"]')?.textContent || '', 160);
    // Only the public post title is collected on Reddit; comment bodies are not read.
    return {action, url: new URL(rawURL, location.origin).href, title: title || 'Bài viết trên Reddit', excerpt: title};
  }

  document.addEventListener('click', event => {
    // Ignore synthetic clicks, background pages and input/editor regions.
    if (!event.isTrusted || !enabled || Date.now() > enabledUntil || document.visibilityState !== 'visible' || privatePath.test(location.pathname)) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || target.closest('input, textarea, [contenteditable="true"], [role="textbox"], form')) return;
    let observed;
    try {
      observed = location.hostname.includes('reddit.com') ? redditInteraction(event, target) : xInteraction(target);
    } catch { return; }
    if (observed) chrome.runtime.sendMessage({type: 'OBSERVED_INTERACTION', ...observed}).catch(() => setGate(false));
  }, {capture: true, passive: true});
})();
