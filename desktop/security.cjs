'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');

function contentSecurityPolicy(devURL = null) {
  return `default-src 'self'; script-src 'self'${devURL ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${devURL ? `'self' ws://${new URL(devURL).host}` : "'none'"}; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`;
}

function allowRendererRequest(url, { distDirectory, devURL = null }) {
  try {
    const target = new URL(url);
    if (['data:', 'blob:'].includes(target.protocol)) return true;
    if (target.protocol === 'file:') {
      const relative = path.relative(distDirectory, fileURLToPath(target));
      return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    }
    if (devURL) {
      const local = new URL(devURL);
      return target.origin === local.origin || (target.protocol === 'ws:' && target.host === local.host);
    }
  } catch {}
  return false;
}

module.exports = { contentSecurityPolicy, allowRendererRequest };
