'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, powerMonitor, dialog, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ActivityStore } = require('./store.cjs');
const { PairingAuth } = require('./auth.cjs');
const { ForegroundCollector } = require('./collector.cjs');
const { createLocalServer } = require('./server.cjs');
const { sanitizeURL } = require('./policy.cjs');
const { contentSecurityPolicy, allowRendererRequest } = require('./security.cjs');

let window, tray, store, auth, collector, server, pruneTimer;
let quitting = false;
let notifyTimer = null;
let lastBroadcast = 0;
let serverError = null;
const indexFile = path.join(__dirname, '..', 'dist', 'index.html');
const indexURL = pathToFileURL(indexFile).href;
let devURL = null;
if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
  const candidate = new URL(process.env.VITE_DEV_SERVER_URL);
  if (candidate.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(candidate.hostname) || candidate.username || candidate.password) throw new Error('Development renderer must use a local HTTP server.');
  devURL = candidate.href;
}

app.setName('Mạch');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => showWindow());
  app.on('activate', () => showWindow());
  app.on('window-all-closed', () => { /* Menu bar app remains available. */ });
  app.on('before-quit', () => {
    quitting = true;
    clearTimeout(notifyTimer); clearInterval(pruneTimer);
    collector?.stop(); server?.close(); server?.closeAllConnections();
    if (store) { store.close(); store = null; }
  });
  app.whenReady().then(boot).catch((error) => {
    dialog.showErrorBox('Mạch chưa thể khởi động', error.message);
    app.quit();
  });
}

function getState() {
  return { events: store.getEvents(), settings: store.getSettings(), collector: { ...collector.getState(), ...(serverError ? { error: serverError } : {}) } };
}

function broadcast() {
  clearTimeout(notifyTimer);
  notifyTimer = null;
  if (!store) return;
  lastBroadcast = Date.now();
  if (window && !window.isDestroyed() && window.webContents.isLoading() === false) window.webContents.send('mach:state-changed', getState());
  updateTray();
}

function scheduleBroadcast() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(broadcast, Math.max(0, 1500 - (Date.now() - lastBroadcast)));
}

function trustedSender(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted renderer');
  const source = event.senderFrame.url.split('#')[0];
  if (devURL) {
    if (new URL(source).origin !== new URL(devURL).origin) throw new Error('Untrusted renderer origin');
  } else if (source !== indexURL) throw new Error('Untrusted renderer origin');
}

function registerIPC() {
  const handle = (channel, handler) => ipcMain.handle(channel, async (event, ...args) => { trustedSender(event); return handler(...args); });
  handle('mach:get-state', getState);
  handle('mach:update-settings', (partial) => { store.updateSettings(partial); collector.reset(); if (!store.getSettings().recording) collector.stopHelper(); broadcast(); return getState(); });
  handle('mach:delete-event', (id) => { store.deleteEvent(id); if (collector.session?.event.id === id) collector.reset(); broadcast(); return getState(); });
  handle('mach:clear-history', () => { store.clearHistory(); collector.reset(); broadcast(); return getState(); });
  handle('mach:bookmark', (id, value) => {
    if (typeof id !== 'string' || id.length > 128) throw new Error('Mã hoạt động không hợp lệ.');
    store.bookmark(id, value); broadcast(); return getState();
  });
  handle('mach:get-pairing-token', () => auth.token);
  handle('mach:open-external', async (value) => {
    const safe = sanitizeURL(value);
    if (!safe) throw new Error('Chỉ có thể mở liên kết HTTP hoặc HTTPS hợp lệ.');
    await shell.openExternal(safe.url, { activate: true });
  });
}

async function boot() {
  const userData = app.getPath('userData');
  store = new ActivityStore(path.join(userData, 'activity.sqlite'));
  auth = new PairingAuth(path.join(userData, 'pairing.json'));
  collector = new ForegroundCollector({ store, powerMonitor, resourcesPath: process.resourcesPath, packaged: app.isPackaged, onChanged: scheduleBroadcast });
  // The dashboard itself does not need browser permission requests, downloads or child windows.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !allowRendererRequest(details.url, { distDirectory: path.join(__dirname, '..', 'dist'), devURL }) });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [contentSecurityPolicy(devURL)] } });
  });
  session.defaultSession.on('will-download', (event, item) => {
    // Renderer exports use Blob URLs and Electron's native save dialog.
    // Network downloads cannot originate from this local dashboard.
    if (!item.getURL().startsWith('blob:')) event.preventDefault();
  });
  registerIPC();
  collector.start();
  server = createLocalServer({ store, auth, collector, onChanged: scheduleBroadcast });
  server.on('error', (error) => {
    serverError = error.code === 'EADDRINUSE'
      ? 'Cổng 43821 đang được ứng dụng khác sử dụng. Tiện ích trình duyệt chưa thể kết nối.'
      : 'Không khởi động được kết nối với tiện ích trình duyệt.';
    scheduleBroadcast();
  });
  server.listen(43821, '127.0.0.1');
  createTray();
  createWindow();
  pruneTimer = setInterval(() => { store?.prune(); scheduleBroadcast(); }, 3600000);
  pruneTimer.unref();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Mạch', submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Cài đặt…', accelerator: 'CommandOrControl+,', click: () => { showWindow(); window.webContents.send('mach:open-settings'); } }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Sửa', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Cửa sổ', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
  ]));
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1100, minHeight: 720,
    title: 'Mạch', backgroundColor: '#F7F8FA', show: false,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 20 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false, devTools: !app.isPackaged },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.on('close', (event) => { if (!quitting) { event.preventDefault(); window.hide(); } });
  window.on('closed', () => { window = null; });
  window.once('ready-to-show', () => window.show());
  if (devURL) void window.loadURL(devURL);
  else void window.loadFile(indexFile);
}

function showWindow() {
  if (!app.isReady() || !store) return;
  if (!window || window.isDestroyed()) createWindow();
  if (window.isMinimized()) window.restore();
  window.show(); window.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png')).resize({ width: 18, height: 18 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Mạch · Dấu vết số của bạn');
  tray.on('double-click', showWindow);
  updateTray();
}

function updateTray() {
  if (!tray || !store) return;
  const { recording } = store.getSettings();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: recording ? '● Đang ghi hoạt động' : '○ Đã tạm dừng', enabled: false },
    { label: 'Mở Mạch', click: showWindow },
    { label: recording ? 'Tạm dừng ghi' : (store.hasRecordingConsent() ? 'Tiếp tục ghi' : 'Bật ghi trong Cài đặt…'), click: () => {
      if (!recording && !store.hasRecordingConsent()) { showWindow(); window.webContents.send('mach:open-settings'); return; }
      store.updateSettings({ recording: !recording }); collector.reset();
      if (recording) collector.stopHelper();
      broadcast();
    } },
    { type: 'separator' },
    { label: 'Ngắt ghép nối tiện ích…', click: async () => {
      const answer = await dialog.showMessageBox(window || undefined, { type: 'question', buttons: ['Hủy', 'Ngắt ghép nối'], defaultId: 0, cancelId: 0, title: 'Ngắt ghép nối', message: 'Tạo mã ghép nối mới và ngắt tiện ích đang kết nối?', detail: 'Lịch sử vẫn được giữ. Bạn có thể ghép nối lại bằng mã mới trong phần Cài đặt.' });
      if (answer.response === 1) { auth.rotate(); collector.lastExtensionSeen = 0; collector.reset(); broadcast(); }
    } },
    { type: 'separator' }, { label: 'Thoát Mạch', role: 'quit' },
  ]));
}
