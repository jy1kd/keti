/**
 * Generate placeholder icons for electron-builder
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * This script creates simple placeholder icons for testing.
 * For production, replace with actual icons.
 */

const fs = require('fs');
const path = require('path');

// Create a simple 1x1 pixel PNG as placeholder
// In production, use actual icon files
const createPlaceholderPNG = () => {
  // Minimal PNG file (1x1 pixel, transparent)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // 8-bit RGBA
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, // compressed data
    0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, // IEND chunk
    0x60, 0x82
  ]);
  return pngHeader;
};

const buildDir = path.join(__dirname, '..', 'build');

// Create placeholder icons
const iconPNG = createPlaceholderPNG();

// Write PNG icon
fs.writeFileSync(path.join(buildDir, 'icon.png'), iconPNG);
console.log('Created build/icon.png');

// For ICO and ICNS, we'll create empty files as placeholders
// In production, use proper conversion tools
fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.from([]));
console.log('Created build/icon.ico (empty placeholder)');

fs.writeFileSync(path.join(buildDir, 'icon.icns'), Buffer.from([]));
console.log('Created build/icon.icns (empty placeholder)');

console.log('\nNote: Replace these with actual icons for production builds.');
console.log('Use https://icoconvert.com/ to convert PNG to ICO/ICNS formats.');
