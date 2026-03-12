/**
 * integration-smoke.test.mjs — Smoke tests against real ~/.claude/plugins/ files
 *
 * Validates that the adapter module can parse the ACTUAL Claude Code file formats
 * on the user's machine. These tests are read-only (no writes) and will skip
 * gracefully if plugin files are not present.
 *
 * Run: node --test tests/integration-smoke.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getInstalledPlugins,
  getSkillStackMarketplaces,
  readMarketplaceManifest,
} from '../scripts/claude-plugins-adapter.mjs';
import { discoverPlugins } from '../scripts/discover-plugins.mjs';

const PLUGIN_DIR = path.join(process.env.HOME || '~', '.claude', 'plugins');
const hasPluginDir = fs.existsSync(path.join(PLUGIN_DIR, 'installed_plugins.json'));

describe('integration smoke (real ~/.claude/plugins/)', { skip: !hasPluginDir && 'No plugin directory found' }, () => {

  it('getInstalledPlugins parses without throwing', () => {
    const result = getInstalledPlugins(PLUGIN_DIR);
    assert.ok(result.format === 'v1' || result.format === 'v2', `unexpected format: ${result.format}`);
    assert.ok(typeof result.plugins === 'object', 'plugins should be an object');

    // Every entry should have a version field
    for (const [key, entry] of Object.entries(result.plugins)) {
      assert.ok(entry.version, `${key} missing version`);
    }
  });

  it('getSkillStackMarketplaces parses without throwing', () => {
    const result = getSkillStackMarketplaces(PLUGIN_DIR);
    assert.ok(Array.isArray(result), 'should return an array');
    // Each entry should be a string
    for (const name of result) {
      assert.ok(typeof name === 'string', `expected string, got ${typeof name}`);
    }
  });

  it('readMarketplaceManifest reads each SkillStack marketplace', () => {
    const marketplaces = getSkillStackMarketplaces(PLUGIN_DIR);

    for (const name of marketplaces) {
      const manifest = readMarketplaceManifest(PLUGIN_DIR, name);
      // Manifest may be null if file was cleaned up, but if present should have plugins
      if (manifest) {
        assert.ok(Array.isArray(manifest.plugins), `${name}: plugins should be an array`);
      }
    }
  });

  it('discoverPlugins returns valid plugin entries', () => {
    const plugins = discoverPlugins(PLUGIN_DIR);
    assert.ok(Array.isArray(plugins), 'should return an array');

    for (const p of plugins) {
      assert.ok(p.slug, `missing slug: ${JSON.stringify(p)}`);
      assert.ok(p.currentVersion, `missing currentVersion: ${JSON.stringify(p)}`);
      assert.ok(p.marketplace, `missing marketplace: ${JSON.stringify(p)}`);
      assert.ok(p.pluginName, `missing pluginName: ${JSON.stringify(p)}`);
    }
  });
});
