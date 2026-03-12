import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { discoverPlugins } from '../scripts/discover-plugins.mjs';

// --- Test Fixtures ---

function createFixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skillstack-discover-'));

  // known_marketplaces.json
  const marketplaces = overrides.marketplaces ?? {
    'test-marketplace': {
      source: {
        type: 'url',
        url: 'https://store.skillstack.sh/s/test-creator/test-marketplace/marketplace.json',
      },
    },
    'git-marketplace': {
      source: {
        type: 'git',
        url: 'https://github.com/someone/some-plugin.git',
      },
    },
    'other-marketplace': {
      source: {
        type: 'url',
        url: 'https://store.skillstack.sh/s/other-creator/other-marketplace/marketplace.json',
      },
    },
  };
  fs.writeFileSync(
    path.join(root, 'known_marketplaces.json'),
    JSON.stringify(marketplaces, null, 2)
  );

  // Marketplace manifest files
  const marketplacesDir = path.join(root, 'marketplaces');
  fs.mkdirSync(marketplacesDir, { recursive: true });

  const testManifest = overrides.testManifest ?? {
    name: 'test-marketplace',
    plugins: [
      {
        name: 'my-plugin',
        source: { type: 'npm', package: '@skillstack/test-creator-my-plugin' },
        version: '1.0.0',
      },
      {
        name: 'another-plugin',
        source: { type: 'npm', package: '@skillstack/test-creator-another-plugin' },
        version: '2.0.0',
      },
    ],
  };
  fs.writeFileSync(
    path.join(marketplacesDir, 'test-marketplace'),
    JSON.stringify(testManifest, null, 2)
  );

  const otherManifest = overrides.otherManifest ?? {
    name: 'other-marketplace',
    plugins: [
      {
        name: 'third-plugin',
        source: { type: 'npm', package: '@skillstack/other-creator-third-plugin' },
        version: '3.0.0',
      },
    ],
  };
  fs.writeFileSync(
    path.join(marketplacesDir, 'other-marketplace'),
    JSON.stringify(otherManifest, null, 2)
  );

  // installed_plugins.json
  const installed = overrides.installed ?? {
    'my-plugin@test-marketplace': {
      installPath: path.join(root, 'cache', 'test-marketplace', 'my-plugin', '1.0.0'),
      version: '1.0.0',
      lastUpdated: '2026-01-01T00:00:00.000Z',
    },
    'another-plugin@test-marketplace': {
      installPath: path.join(root, 'cache', 'test-marketplace', 'another-plugin', '2.0.0'),
      version: '2.0.0',
      lastUpdated: '2026-01-15T00:00:00.000Z',
    },
    'third-plugin@other-marketplace': {
      installPath: path.join(root, 'cache', 'other-marketplace', 'third-plugin', '3.0.0'),
      version: '3.0.0',
      lastUpdated: '2026-02-01T00:00:00.000Z',
    },
    // A non-SkillStack plugin (should be excluded)
    'some-git-plugin@git-marketplace': {
      installPath: path.join(root, 'cache', 'git-marketplace', 'some-git-plugin', '1.0.0'),
      version: '1.0.0',
      lastUpdated: '2026-01-01T00:00:00.000Z',
    },
  };
  fs.writeFileSync(
    path.join(root, 'installed_plugins.json'),
    JSON.stringify(installed, null, 2)
  );

  return root;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- Tests ---

describe('discoverPlugins', () => {
  let pluginDir;
  beforeEach(() => { pluginDir = createFixture(); });
  afterEach(() => { cleanup(pluginDir); });

  it('finds plugins from SkillStack storefronts', () => {
    const result = discoverPlugins(pluginDir);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  it('returns correct slug for each plugin', () => {
    const result = discoverPlugins(pluginDir);
    const slugs = result.map(p => p.slug);
    assert.ok(slugs.includes('test-creator-my-plugin'));
    assert.ok(slugs.includes('test-creator-another-plugin'));
    assert.ok(slugs.includes('other-creator-third-plugin'));
  });

  it('returns current installed version for each plugin', () => {
    const result = discoverPlugins(pluginDir);
    const myPlugin = result.find(p => p.slug === 'test-creator-my-plugin');
    assert.equal(myPlugin.currentVersion, '1.0.0');

    const another = result.find(p => p.slug === 'test-creator-another-plugin');
    assert.equal(another.currentVersion, '2.0.0');
  });

  it('returns marketplace name for each plugin', () => {
    const result = discoverPlugins(pluginDir);
    const myPlugin = result.find(p => p.slug === 'test-creator-my-plugin');
    assert.equal(myPlugin.marketplace, 'test-marketplace');

    const third = result.find(p => p.slug === 'other-creator-third-plugin');
    assert.equal(third.marketplace, 'other-marketplace');
  });

  it('returns plugin name for each plugin', () => {
    const result = discoverPlugins(pluginDir);
    const myPlugin = result.find(p => p.slug === 'test-creator-my-plugin');
    assert.equal(myPlugin.pluginName, 'my-plugin');
  });

  it('excludes non-SkillStack marketplaces (git-based)', () => {
    const result = discoverPlugins(pluginDir);
    const slugs = result.map(p => p.slug);
    // git-marketplace plugins should NOT appear
    assert.ok(!slugs.includes('some-git-plugin'));
  });

  it('excludes plugins not in installed_plugins.json', () => {
    // Remove one plugin from installed
    const installedPath = path.join(pluginDir, 'installed_plugins.json');
    const installed = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));
    delete installed['my-plugin@test-marketplace'];
    fs.writeFileSync(installedPath, JSON.stringify(installed, null, 2));

    const result = discoverPlugins(pluginDir);
    const slugs = result.map(p => p.slug);
    assert.ok(!slugs.includes('test-creator-my-plugin'));
    assert.ok(slugs.includes('test-creator-another-plugin'));
  });

  it('returns empty array when no SkillStack marketplaces exist', () => {
    const dir = createFixture({
      marketplaces: {
        'git-only': {
          source: { type: 'git', url: 'https://github.com/foo/bar.git' },
        },
      },
    });

    const result = discoverPlugins(dir);
    assert.deepEqual(result, []);
    cleanup(dir);
  });

  it('handles missing known_marketplaces.json', () => {
    fs.unlinkSync(path.join(pluginDir, 'known_marketplaces.json'));

    assert.throws(
      () => discoverPlugins(pluginDir),
      { message: /known_marketplaces\.json.*not found/ }
    );
  });

  it('handles missing marketplace manifest file gracefully', () => {
    // Remove one marketplace manifest
    fs.unlinkSync(path.join(pluginDir, 'marketplaces', 'other-marketplace'));

    // Should still return plugins from the remaining marketplace
    const result = discoverPlugins(pluginDir);
    const slugs = result.map(p => p.slug);
    assert.ok(slugs.includes('test-creator-my-plugin'));
    assert.ok(!slugs.includes('other-creator-third-plugin'));
  });

  it('handles missing installed_plugins.json', () => {
    fs.unlinkSync(path.join(pluginDir, 'installed_plugins.json'));

    assert.throws(
      () => discoverPlugins(pluginDir),
      { message: /installed_plugins\.json.*not found/ }
    );
  });

  it('finds plugins across multiple SkillStack storefronts', () => {
    const result = discoverPlugins(pluginDir);
    const marketplaces = [...new Set(result.map(p => p.marketplace))];
    assert.ok(marketplaces.includes('test-marketplace'));
    assert.ok(marketplaces.includes('other-marketplace'));
  });
});
