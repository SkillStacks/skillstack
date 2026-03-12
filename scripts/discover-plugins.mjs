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
import {
  getInstalledPlugins,
  getSkillStackMarketplaces,
  readMarketplaceManifest,
} from './claude-plugins-adapter.mjs';

/**
 * Discover installed plugins from SkillStack storefronts.
 * Returns an array of { slug, currentVersion, marketplace, pluginName }.
 */
export function discoverPlugins(pluginDir) {
  const { plugins: installedPlugins } = getInstalledPlugins(pluginDir);
  const skillstackMarketplaces = getSkillStackMarketplaces(pluginDir);

  if (skillstackMarketplaces.length === 0) {
    return [];
  }

  const results = [];

  for (const marketplaceName of skillstackMarketplaces) {
    const manifest = readMarketplaceManifest(pluginDir, marketplaceName);
    if (!manifest) continue;

    const plugins = manifest.plugins || [];

    for (const plugin of plugins) {
      const pluginName = plugin.name;
      const installedKey = `${pluginName}@${marketplaceName}`;

      const pluginEntry = installedPlugins[installedKey];
      if (!pluginEntry) continue;

      // Extract slug from npm package name: @skillstack/<slug> -> <slug>
      const npmPackage = plugin.source?.package || '';
      const slug = npmPackage.replace(/^@skillstack\//, '');
      if (!slug) continue;

      results.push({
        slug,
        currentVersion: pluginEntry.version,
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
