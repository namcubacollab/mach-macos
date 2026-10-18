import test from 'node:test';
import assert from 'node:assert/strict';

const event = () => ({listeners: [], addListener(callback) {this.listeners.push(callback);}, fire(...args) {for (const listener of this.listeners) listener(...args);}});
const storage = seed => ({data: {...seed}, async get(keys) {return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, this.data[key]]));}, async set(value) {Object.assign(this.data,value);}, async remove(keys) {for (const key of Array.isArray(keys) ? keys : [keys]) delete this.data[key];}});

test('MV3 worker honors permission, lifecycle, focus, identity, pause and social gates', async () => {
  const original = {chrome: globalThis.chrome, fetch: globalThis.fetch, setInterval: globalThis.setInterval, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), now: Date.now};
  let now = 1800000000000;
  let idle = 'active';
  let focused = true;
  let tabsPermission = true;
  let sitePermission = false;
  let failNetwork = false;
  let failChromeAPI = false;
  let tab = {id: 1, windowId: 10, active: true, incognito: false, status:'complete',url:'https://example.com/one?secret=hidden',title:'First page'};
  const settings = {recording:true,captureSocial:false,excludedDomains:[],excludedApps:[]};
  const requests = [];
  const posts = [];
  const scripts = new Map();
  const chrome = {
    storage: {local:storage({pairingToken:'test-pairing-token-123456'}),session:storage({})},
    permissions: {async contains(query) {return query.permissions ? tabsPermission : sitePermission;},onAdded:event(),onRemoved:event()},
    idle: {async queryState(){return idle;},setDetectionInterval(){},onStateChanged:event()},
    windows: {async getLastFocused(){if (failChromeAPI) throw new Error('No window or permission'); return {id:10,focused,incognito:false,type:'normal'};},onFocusChanged:event()},
    tabs: {async query(query){return query.url ? (sitePermission ? [tab] : []) : [tab];},async sendMessage(){return {};},onActivated:event(),onUpdated:event(),onRemoved:event()},
    scripting: {async getRegisteredContentScripts(){return [...scripts.values()];},async unregisterContentScripts({ids}){ids.forEach(id => scripts.delete(id));},async registerContentScripts(values){values.forEach(value => scripts.set(value.id,value));},async executeScript(){}},
    action: {async setBadgeText(){},async setBadgeBackgroundColor(){},async setTitle(){}},
    alarms: {async create(){},onAlarm:event()},
    runtime: {id:'a'.repeat(32),getURL:path=>`chrome-extension://${'a'.repeat(32)}/${path}`,onMessage:event(),onStartup:event(),onInstalled:event()},
  };
  globalThis.chrome = chrome;
  Date.now = () => now;
  globalThis.setInterval = () => 0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgentData:{brands:[{brand:'Google Chrome'}]},userAgent:'Chrome/140'}});
  globalThis.fetch = async (url, options) => {
    requests.push({url,options});
    if (failNetwork) throw new TypeError('Connection refused');
    assert.equal(options.headers['X-Mach-Browser'],'com.google.Chrome');
    assert.equal(options.headers.Authorization,'Bearer test-pairing-token-123456');
    assert.equal(options.headers['X-Mach-Extension-Origin'],`chrome-extension://${'a'.repeat(32)}`);
    assert.ok(url.startsWith('http://127.0.0.1:43821/v1/'));
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      posts.push(...body.events);
      return {ok:true,async json(){return {accepted:body.events.length};}};
    }
    return {ok:true,async json(){return {...settings};}};
  };
  const send = (message, sender = {id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')}) => new Promise(resolve => {
    assert.equal(chrome.runtime.onMessage.listeners[0](message,sender,resolve),true);
  });
  const state = () => send({type:'GET_STATE'});
  try {
    await import(`../extension/background.mjs?test=${Math.random()}`);
    assert.equal((await state()).recording,true);
    const first = posts.at(-1);
    assert.equal(first.url,'https://example.com/one');
    assert.equal(first.duration,0);
    now += 15000;
    await state();
    assert.equal(posts.at(-1).id,first.id);
    assert.equal(posts.at(-1).duration,15);

    now += 5000;
    tab = {...tab,id:2,url:'https://example.com/two',title:'Second page'};
    chrome.tabs.onActivated.fire({tabId:2,windowId:10});
    await state();
    const second = posts.at(-1);
    assert.notEqual(second.id,first.id);
    assert.equal(posts.filter(item => item.id === first.id).at(-1).duration,20);
    assert.equal(second.duration,0);

    now += 5000;
    focused = false;
    chrome.windows.onFocusChanged.fire(-1);
    await state();
    assert.equal(posts.at(-1).id,second.id);
    assert.equal(posts.at(-1).duration,5);
    const countAfterBlur = posts.length;
    now += 15000;
    await state();
    assert.equal(posts.length,countAfterBlur,'Background browser cannot accrue tab time');

    focused = true;
    now += 1000;
    await state();
    const resumed = posts.at(-1);
    now += 30000;
    await state();
    assert.notEqual(posts.at(-1).id,resumed.id);
    assert.equal(posts.at(-1).startedAt,now,'Resumed time belongs to the current hour, not before the gap');
    assert.equal(posts.at(-1).duration,0,'Long suspension starts a separate interval');
    now += 15000;
    await state();
    assert.equal(posts.at(-1).duration,15);
    assert.equal(posts.at(-1).startedAt,now-15000);

    settings.recording = false;
    const beforePause = posts.length;
    now += 15000;
    assert.equal((await state()).recording,false);
    assert.equal(posts.length,beforePause);
    assert.equal(chrome.storage.session.data.activeSession,undefined);

    settings.recording = true;
    now += 1000;
    await state();
    const beforeFailure = posts.at(-1).id;
    failNetwork = true;
    now += 15000;
    assert.equal((await state()).connected,false);
    assert.equal(chrome.storage.session.data.activeSession,undefined,'Connection failure discards current private session');
    failNetwork = false;
    now += 15000;
    await state();
    assert.notEqual(posts.at(-1).id,beforeFailure);
    assert.equal(posts.at(-1).duration,0,'Reconnect cannot replay a backlog');

    settings.excludedDomains = ['example.com'];
    const beforeExclusion = posts.length;
    now += 15000;
    await state();
    assert.equal(posts.length,beforeExclusion);
    assert.equal(chrome.storage.session.data.activeSession,undefined);
    settings.excludedDomains = [];

    failChromeAPI = true;
    const beforeChromeError = posts.length;
    const failedChrome = await state();
    assert.equal(failedChrome.connected,false);
    assert.match(failedChrome.lastError,/Không đọc được trạng thái trình duyệt/);
    assert.equal(posts.length,beforeChromeError,'Chrome API failures do not leak stale sessions');
    assert.equal(chrome.storage.session.data.activeSession,undefined);
    failChromeAPI = false;

    tabsPermission = false;
    const beforePermissionLoss = requests.length;
    const withoutPermission = await state();
    assert.equal(withoutPermission.connected,false);
    assert.equal(requests.length,beforePermissionLoss,'No heartbeat suppresses browser app fallback without tab permission');
    tabsPermission = true;

    tab = {...tab,id:7,url:'https://x.com/home',title:'Home / X'};
    settings.captureSocial = true;
    now += 1000;
    await state();
    const click = {type:'OBSERVED_INTERACTION',action:'like',url:'https://x.com/alice/status/123?tracking=1',title:'Public post',excerpt:'A'.repeat(500)};
    const sender = {id:chrome.runtime.id,url:tab.url,tab:{...tab},frameId:0};
    assert.equal((await send(click,sender)).accepted,false,'Social starts locally disabled');
    await send({type:'SET_SOCIAL',enabled:true});
    assert.equal((await send(click,sender)).accepted,false,'Local toggle does not grant site permission');
    sitePermission = true;
    await send({type:'PERMISSIONS_CHANGED'});
    assert.equal((await send(click,sender)).accepted,true);
    assert.equal(posts.at(-1).kind,'interaction');
    assert.equal(posts.at(-1).excerpt.length,240);
    assert.equal(posts.at(-1).duration,0);
    assert.equal((await send(click,sender)).accepted,false,'Duplicate clicks are debounced');
    now += 2000;
    assert.equal((await send(click,{...sender,frameId:1})).accepted,false);
    assert.equal((await send(click,{...sender,tab:{...tab,id:100}})).accepted,false);
    idle = 'idle';
    assert.equal((await send(click,sender)).accepted,false);
    idle = 'active';
    settings.captureSocial = false;
    await state();
    assert.equal((await send(click,sender)).accepted,false);

    assert.match((await send({type:'PAIR',token:'another-token-123456'},sender)).error,/không hợp lệ/,'Content scripts cannot change pairing');
    await send({type:'UNPAIR'});
    assert.equal(chrome.storage.local.data.pairingToken,undefined);
    assert.equal(chrome.storage.session.data.activeSession,undefined);
    assert.equal(scripts.size,0);

    // Recreate the module as MV3 does after suspension, preserving session storage.
    chrome.runtime.onMessage.listeners.length = 0;
    await chrome.storage.local.set({pairingToken:'test-pairing-token-123456'});
    await chrome.storage.session.set({activeSession:{tabId:7,windowId:10,event:{
      id:'restored-session',kind:'page',app:'Browser',category:'social',action:'view',
      url:'https://x.com/home',domain:'x.com',title:'Home / X',startedAt:now-600000,duration:12,
    }}});
    await import(`../extension/background.mjs?restart=${Math.random()}`);
    await state();
    assert.notEqual(posts.at(-1).id,'restored-session','Worker restart creates a new continuous segment');
    assert.equal(posts.at(-1).duration,0,'Worker restart never replays previous history or credits the dormant gap');
    assert.equal(posts.at(-1).startedAt,now,'New segment is attributed to restart time');

    chrome.runtime.onMessage.listeners.length = 0;
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgentData:{brands:[{brand:'Chromium'}]},userAgent:'Chrome/140'}});
    const beforeUnknownBrowser = requests.length;
    await import(`../extension/background.mjs?unknown=${Math.random()}`);
    const unsupported = await state();
    assert.equal(unsupported.connected,false);
    assert.match(unsupported.lastError,/Không xác định được trình duyệt/);
    assert.equal(requests.length,beforeUnknownBrowser,'Ambiguous browser identity fails closed before sending any request');
    assert.equal(chrome.storage.session.data.activeSession,undefined);
  } finally {
    globalThis.chrome = original.chrome;
    globalThis.fetch = original.fetch;
    globalThis.setInterval = original.setInterval;
    Date.now = original.now;
    if (original.navigator) Object.defineProperty(globalThis,'navigator',original.navigator);
    else delete globalThis.navigator;
  }
});
