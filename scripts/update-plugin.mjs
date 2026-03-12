#!/usr/bin/env node

/**
 * update-plugin.mjs — Programmatic npm cache cleanup + plugin reinstall for SkillStack
 *
 * Usage:
 *   node update-plugin.mjs <slug> <version> <marketplace> <plugin-name> [--plugin-dir <dir>]
 *
 * Phases:
 *   1. cleanNpmCache   — Remove stale entries from package.json, package-lock.json, node_modules
 *   2. addDependency   — Add exact version to package.json
 *   3. (npm install)   — Caller runs `npm install` in npm-cache dir
 *   4. copyToCache     — Copy from node_modules to plugin cache (including dotfiles)
 *   5. updateInstalled — Update installed_plugins.json with new version
 *   6. verify          — Confirm plugin.json exists with correct version
 *
 * Exit codes:
 *   0 = success (JSON output with version info)
 *   1 = error (JSON output with error message)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { updatePluginEntry } from './claude-plugins-adapter.mjs';

// --- Exported functions (testable individually) ---

/**
 * Remove a plugin's stale entries from the npm-cache directory.
 * Cleans package.json, package-lock.json, and node_modules.
 */
export function cleanNpmCache(pluginDir, slug) {
  const npmCacheDir = path.join(pluginDir, 'npm-cache');
  const pkgPath = path.join(npmCacheDir, 'package.json');
  const lockPath = path.join(npmCacheDir, 'package-lock.json');
  const scopedName = `@skillstack/${slug}`;

  // Validate npm-cache exists
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`npm-cache directory not found: ${pkgPath} does not exist`);
  }

  // Clean package.json
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (pkg.dependencies) {
    delete pkg.dependencies[scopedName];
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // Clean package-lock.json (if it exists)
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));

    // Remove from packages entries
    if (lock.packages) {
      delete lock.packages[`node_modules/${scopedName}`];

      // Remove from root dependencies
      if (lock.packages['']?.dependencies) {
        delete lock.packages[''].dependencies[scopedName];
      }
    }

    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }

  // Remove stale node_modules directory
  const moduleDir = path.join(npmCacheDir, 'node_modules', '@skillstack', slug);
  if (fs.existsSync(moduleDir)) {
    fs.rmSync(moduleDir, { recursive: true, force: true });
  }
}

/**
 * Add a plugin dependency with an exact version (no caret) to package.json.
 */
export function addDependency(pluginDir, slug, version) {
  const pkgPath = path.join(pluginDir, 'npm-cache', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const scopedName = `@skillstack/${slug}`;

  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }

  pkg.dependencies[scopedName] = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Copy installed plugin files from node_modules to the plugin cache directory.
 * Uses recursive copy to preserve dotfiles like .claude-plugin/.
 */
export function copyToCache(pluginDir, slug, version, marketplace, pluginName) {
  const source = path.join(pluginDir, 'npm-cache', 'node_modules', '@skillstack', slug);
  const pluginCacheBase = path.join(pluginDir, 'cache', marketplace, pluginName);
  const dest = path.join(pluginCacheBase, version);

  // Remove ALL old versions of this plugin (not just the target version dir)
  if (fs.existsSync(pluginCacheBase)) {
    fs.rmSync(pluginCacheBase, { recursive: true, force: true });
  }

  // Create destination and copy recursively
  fs.mkdirSync(dest, { recursive: true });
  copyDirRecursive(source, dest);
}

/**
 * Recursively copy a directory, preserving dotfiles and structure.
 * Pure Node.js — no shell commands needed.
 */
function copyDirRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Update installed_plugins.json with the new version, path, and timestamp.
 * Delegates to the adapter module which handles v1/v2 format detection.
 */
export function updateInstalledPlugins(pluginDir, marketplace, pluginName, version) {
  updatePluginEntry(pluginDir, marketplace, pluginName, version);
}

/**
 * Verify the plugin was installed correctly by checking plugin.json.
 * Returns { success, version, error }.
 */
export function verify(pluginDir, marketplace, pluginName, version) {
  const pluginJsonPath = path.join(
    pluginDir, 'cache', marketplace, pluginName, version, '.claude-plugin', 'plugin.json'
  );

  if (!fs.existsSync(pluginJsonPath)) {
    return {
      success: false,
      version: null,
      error: `plugin.json not found at ${pluginJsonPath}`,
    };
  }

  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));

  if (pluginJson.version !== version) {
    return {
      success: false,
      version: pluginJson.version,
      error: `Version mismatch: expected ${version}, got ${pluginJson.version}`,
    };
  }

  return {
    success: true,
    version: pluginJson.version,
    error: null,
  };
}

// --- CLI Entry Point ---

function printUsage() {
  console.error('Usage: node update-plugin.mjs <slug> <version> <marketplace> <plugin-name> [--plugin-dir <dir>]');
  console.error('');
  console.error('  slug           SkillStack slug (e.g., kenneth-liao-selling-skills)');
  console.error('  version        Target version (e.g., 1.5.0)');
  console.error('  marketplace    Marketplace name (e.g., my-marketplace)');
  console.error('  plugin-name    Local plugin name (e.g., selling-skills)');
  console.error('  --plugin-dir   Plugin base directory (default: ~/.claude/plugins)');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(1);
  }

  const [slug, version, marketplace, pluginName] = args;

  // Parse --plugin-dir
  let pluginDir = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.claude', 'plugins');
  const dirIdx = args.indexOf('--plugin-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    pluginDir = args[dirIdx + 1];
  }

  const result = { slug, version, marketplace, pluginName, pluginDir };

  try {
    // Phase 1: Clean
    cleanNpmCache(pluginDir, slug);
    result.phase = 'clean';

    // Phase 2: Add dependency
    addDependency(pluginDir, slug, version);
    result.phase = 'dependency';

    // Phase 3: npm install
    const npmCacheDir = path.join(pluginDir, 'npm-cache');
    execSync('npm install', { cwd: npmCacheDir, stdio: 'pipe' });
    result.phase = 'install';

    // Phase 4: Copy to cache
    copyToCache(pluginDir, slug, version, marketplace, pluginName);
    result.phase = 'copy';

    // Phase 5: Update installed_plugins.json
    updateInstalledPlugins(pluginDir, marketplace, pluginName, version);
    result.phase = 'update';

    // Phase 6: Verify
    const verification = verify(pluginDir, marketplace, pluginName, version);
    if (!verification.success) {
      result.success = false;
      result.error = verification.error;
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    result.success = true;
    result.confirmedVersion = verification.version;
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);

  } catch (err) {
    result.success = false;
    result.error = err.message;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run CLI when executed directly (not imported)
const __filename = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  main();
}
