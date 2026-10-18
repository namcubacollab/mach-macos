'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

if (process.platform !== 'darwin') {
  console.error('The foreground helper must be built on macOS with Xcode Command Line Tools.');
  process.exitCode = 1;
} else {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mach-helper-'));
  try {
    const source = path.join(__dirname, 'helpers', 'foreground.swift');
    const outputs = ['arm64', 'x86_64'].map((arch) => {
      const destination = path.join(temporary, `foreground-${arch}`);
      execFileSync('xcrun', ['swiftc', '-O', '-target', `${arch}-apple-macosx12.0`, source, '-o', destination], { stdio: 'inherit' });
      return destination;
    });
    const destination = path.join(__dirname, 'helpers', 'mach-foreground');
    execFileSync('xcrun', ['lipo', '-create', ...outputs, '-output', destination], { stdio: 'inherit' });
    fs.chmodSync(destination, 0o755);
    console.log('Built universal macOS foreground helper.');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
