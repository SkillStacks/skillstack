#!/usr/bin/env node

/**
 * discover-plugins.mjs — Find installed SkillStack storefront plugins
 *
 * Usage:
 *   node discover-plugins.mjs [--plugin-dir <dir>]
 *
 * Output (JSON array):
 *   [{ slug, currentVersion, marketplace, pluginName }]
 *
 * Only returns plugins from SkillStack storefronts (store.skillstack.sh),
 * NOT git-based plugins like the buyer or creator plugins.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Discover installed plugins from SkillStack storefronts.
 * Returns an array of { slug, currentVersion, marketplace, pluginName }.
 */
export function discoverPlugins(pluginDir) {
  const knownPath = path.join(pluginDir, 'known_marketplaces.json');
  const installedPath = path.join(pluginDir, 'installed_plugins.json');

  if (!fs.existsSync(knownPath)) {
    throw new Error(`known_marketplaces.json not found at ${knownPath}`);
  }
  if (!fs.existsSync(installedPath)) {
    throw new Error(`installed_plugins.json not found at ${installedPath}`);
  }

  const knownMarketplaces = JSON.parse(fs.readFileSync(knownPath, 'utf-8'));
  const installedPlugins = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));

  // Find SkillStack storefronts (URL-based sources containing store.skillstack.sh)
  const skillstackMarketplaces = [];
  for (const [name, config] of Object.entries(knownMarketplaces)) {
    const url = config?.source?.url || '';
    if (url.includes('store.skillstack.sh')) {
      skillstackMarketplaces.push(name);
    }
  }

  if (skillstackMarketplaces.length === 0) {
    return [];
  }

  const results = [];

  for (const marketplaceName of skillstackMarketplaces) {
    // Read the marketplace manifest
    const manifestPath = path.join(pluginDir, 'marketplaces', marketplaceName);
    if (!fs.existsSync(manifestPath)) {
      // Manifest missing — skip this marketplace silently
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const plugins = manifest.plugins || [];

    for (const plugin of plugins) {
      const pluginName = plugin.name;
      const installedKey = `${pluginName}@${marketplaceName}`;

      // Only include if actually installed
      if (!installedPlugins[installedKey]) {
        continue;
      }

      // Extract slug from npm package name: @skillstack/<slug> -> <slug>
      const npmPackage = plugin.source?.package || '';
      const slug = npmPackage.replace(/^@skillstack\//, '');

      if (!slug) {
        continue;
      }

      results.push({
        slug,
        currentVersion: installedPlugins[installedKey].version,
        marketplace: marketplaceName,
        pluginName,
      });
    }
  }

  return results;
}

// --- CLI Entry Point ---

const isDirectExecution = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isDirectExecution) {
  const args = process.argv.slice(2);

  let pluginDir = path.join(process.env.HOME || '~', '.claude', 'plugins');
  const dirIdx = args.indexOf('--plugin-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    pluginDir = args[dirIdx + 1];
  }

  try {
    const result = discoverPlugins(pluginDir);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}
