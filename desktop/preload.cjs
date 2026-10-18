'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('mach', Object.freeze({
  getState: () => invoke('mach:get-state'),
  updateSettings: (partial) => invoke('mach:update-settings', partial),
  deleteEvent: (id) => invoke('mach:delete-event', id),
  clearHistory: () => invoke('mach:clear-history'),
  bookmark: (id, value) => invoke('mach:bookmark', id, value),
  getPairingToken: () => invoke('mach:get-pairing-token'),
  openExternal: (url) => invoke('mach:open-external', url),
  onStateChanged: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('Expected a callback');
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('mach:state-changed', listener);
    return () => ipcRenderer.removeListener('mach:state-changed', listener);
  },
}));

ipcRenderer.on('mach:open-settings', () => window.dispatchEvent(new Event('mach:open-settings')));
