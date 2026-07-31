#!/usr/bin/env node

/**
 * Build script for Electron application
 *
 * Usage:
 *   node scripts/build-electron.cjs [platform]
 *
 * Platforms:
 *   win     - Windows (NSIS installer)
 *   mac     - macOS (DMG)
 *   linux   - Linux (AppImage)
 *   all     - All platforms
 *
 * Examples:
 *   node scripts/build-electron.cjs win
 *   node scripts/build-electron.cjs mac
 *   node scripts/build-electron.cjs linux
 *   node scripts/build-electron.cjs all
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const platform = process.argv[2] || 'win';

console.log(`Building Electron application for ${platform}...`);

// Check if build resources exist
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(path.join(buildDir, 'icon.png'))) {
  console.warn('Warning: build/icon.png not found. Run scripts/generate-icons.cjs first.');
}

// Build commands
const commands = {
  win: 'npm run electron:build -- --win',
  mac: 'npm run electron:build -- --mac',
  linux: 'npm run electron:build -- --linux',
  all: 'npm run electron:build -- --win --mac --linux',
};

const command = commands[platform];
if (!command) {
  console.error(`Unknown platform: ${platform}`);
  console.error('Valid platforms: win, mac, linux, all');
  process.exit(1);
}

try {
  console.log(`Running: ${command}`);
  execSync(command, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
