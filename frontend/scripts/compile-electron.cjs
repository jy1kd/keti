#!/usr/bin/env node

/**
 * Compile Electron TypeScript and rename .js to .cjs
 * Also updates require/import paths to use .cjs extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.join(__dirname, '..', 'dist-electron');

// Step 1: Compile TypeScript
console.log('[compile] Compiling TypeScript...');
try {
  execSync('npx tsc -p electron/tsconfig.json', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
} catch (error) {
  console.error('[compile] TypeScript compilation failed');
  process.exit(1);
}

// Step 2: Fix require paths and rename .js to .cjs
console.log('[compile] Fixing require paths and renaming to .cjs...');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix require paths: './foo' -> './foo.cjs', './foo.js' -> './foo.cjs'
  // Handle both single and double quotes
  content = content.replace(/require\(['"]\.\/([^'"]+?)['"]\)/g, (match, p1) => {
    // Don't add .cjs if it already has an extension
    if (p1.endsWith('.cjs') || p1.endsWith('.js')) {
      return match;
    }
    return `require('./${p1}.cjs')`;
  });

  // Fix import paths (for ES modules converted to CJS)
  content = content.replace(/from ['"]\.\/([^'"]+?)['"]/g, (match, p1) => {
    if (p1.endsWith('.cjs') || p1.endsWith('.js')) {
      return match;
    }
    return `from './${p1}.cjs'`;
  });

  fs.writeFileSync(filePath, content);
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.endsWith('.js')) {
      // Fix paths first
      processFile(fullPath);
      // Rename to .cjs
      const newPath = fullPath.replace('.js', '.cjs');
      fs.renameSync(fullPath, newPath);
      console.log(`[compile] ${path.relative(DIST_DIR, fullPath)} -> ${path.relative(DIST_DIR, newPath)}`);
    }
  }
}

processDirectory(DIST_DIR);

console.log('[compile] Done!');
