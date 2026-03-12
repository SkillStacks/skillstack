import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  getInstalledPlugins,
  getPluginEntry,
  updatePluginEntry,
  getSkillStackMarketplaces,
  readMarketplaceManifest,
} from '../scripts/claude-plugins-adapter.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- getInstalledPlugins ----

describe('getInstalledPlugins', () => {
  let dir;
  afterEach(() => { if (dir) cleanup(dir); });

  it('parses v1 flat format', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      'my-plugin@my-market': { version: '1.0.0', installPath: '/a/b/1.0.0' },
    }));

    const result = getInstalledPlugins(dir);
    assert.equal(result.format, 'v1');
    assert.equal(result.plugins['my-plugin@my-market'].version, '1.0.0');
  });

  it('parses v2 wrapped format', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'my-plugin@my-market': [
          { scope: 'user', version: '2.0.0', installPath: '/a/b/2.0.0', installedAt: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:00Z' },
        ],
      },
    }));

    const result = getInstalledPlugins(dir);
    assert.equal(result.format, 'v2');
    assert.equal(result.plugins['my-plugin@my-market'].version, '2.0.0');
    assert.equal(result.plugins['my-plugin@my-market'].scope, 'user');
  });

  it('normalizes v2 entries from arrays to objects', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'a@b': [{ scope: 'user', version: '1.0.0', installPath: '/x' }],
        'c@d': [{ scope: 'user', version: '3.0.0', installPath: '/y' }],
      },
    }));

    const result = getInstalledPlugins(dir);
    assert.equal(result.plugins['a@b'].version, '1.0.0');
    assert.equal(result.plugins['c@d'].version, '3.0.0');
  });

  it('throws descriptive error if file is missing', () => {
    dir = tmpDir();
    assert.throws(
      () => getInstalledPlugins(dir),
      { message: /installed_plugins\.json not found/ }
    );
  });

  it('throws descriptive error if JSON is malformed', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), 'not json {{{');
    assert.throws(
      () => getInstalledPlugins(dir),
      { message: /Failed to parse installed_plugins\.json/ }
    );
  });

  it('throws descriptive error if v2 entry is not an array', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'bad@entry': { version: '1.0.0' }, // should be an array
      },
    }));
    assert.throws(
      () => getInstalledPlugins(dir),
      { message: /expected array.*bad@entry.*Claude Code may have changed/ }
    );
  });

  it('throws descriptive error if v2 entry is an empty array', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'empty@entry': [],
      },
    }));
    assert.throws(
      () => getInstalledPlugins(dir),
      { message: /empty array.*empty@entry/ }
    );
  });

  it('throws descriptive error for unknown version', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 99,
      plugins: {},
    }));
    assert.throws(
      () => getInstalledPlugins(dir),
      { message: /Unsupported installed_plugins\.json version: 99/ }
    );
  });

  it('throws if v1 entry is missing version field', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      'bad@entry': { installPath: '/a/b' }, // no version
    }));
    assert.throws(
      () => getInstalledPlugins(dir),
      { message: /missing required field "version".*bad@entry/ }
    );
  });
});

// ---- getPluginEntry ----

describe('getPluginEntry', () => {
  let dir;
  afterEach(() => { if (dir) cleanup(dir); });

  it('returns normalized entry from v2 format', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'my-plugin@market': [
          { scope: 'user', version: '1.0.0', installPath: '/a/1.0.0' },
        ],
      },
    }));

    const entry = getPluginEntry(dir, 'market', 'my-plugin');
    assert.equal(entry.version, '1.0.0');
  });

  it('throws descriptive error if plugin not found', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {},
    }));

    assert.throws(
      () => getPluginEntry(dir, 'market', 'ghost'),
      { message: /ghost@market not found/ }
    );
  });
});

// ---- updatePluginEntry ----

describe('updatePluginEntry', () => {
  let dir;
  afterEach(() => { if (dir) cleanup(dir); });

  it('updates version and installPath in v2 format', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'my-plugin@market': [
          { scope: 'user', version: '1.0.0', installPath: '/cache/market/my-plugin/1.0.0', installedAt: '2026-01-01T00:00:00Z' },
        ],
      },
    }));

    updatePluginEntry(dir, 'market', 'my-plugin', '2.0.0');

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'installed_plugins.json'), 'utf-8'));
    const entry = raw.plugins['my-plugin@market'][0];
    assert.equal(entry.version, '2.0.0');
    assert.ok(entry.installPath.includes('2.0.0'));
    assert.equal(entry.scope, 'user'); // preserved
    assert.equal(raw.version, 2); // wrapper preserved
  });

  it('updates version and installPath in v1 format', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      'my-plugin@market': { version: '1.0.0', installPath: '/cache/market/my-plugin/1.0.0' },
    }));

    updatePluginEntry(dir, 'market', 'my-plugin', '2.0.0');

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'installed_plugins.json'), 'utf-8'));
    assert.equal(raw['my-plugin@market'].version, '2.0.0');
    assert.ok(raw['my-plugin@market'].installPath.includes('2.0.0'));
  });

  it('preserves other plugin entries', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'my-plugin@market': [{ scope: 'user', version: '1.0.0', installPath: '/a/1.0.0' }],
        'other@market': [{ scope: 'user', version: '3.0.0', installPath: '/b/3.0.0' }],
      },
    }));

    updatePluginEntry(dir, 'market', 'my-plugin', '2.0.0');

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'installed_plugins.json'), 'utf-8'));
    assert.equal(raw.plugins['other@market'][0].version, '3.0.0');
  });

  it('sets lastUpdated to recent ISO timestamp', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      'my-plugin@market': { version: '1.0.0', installPath: '/a/1.0.0', lastUpdated: '2025-01-01T00:00:00Z' },
    }));

    const before = Date.now();
    updatePluginEntry(dir, 'market', 'my-plugin', '2.0.0');
    const after = Date.now();

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'installed_plugins.json'), 'utf-8'));
    const ts = new Date(raw['my-plugin@market'].lastUpdated).getTime();
    assert.ok(ts >= before && ts <= after);
  });

  it('throws if plugin not found', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
      version: 2, plugins: {},
    }));

    assert.throws(
      () => updatePluginEntry(dir, 'market', 'ghost', '1.0.0'),
      { message: /ghost@market not found/ }
    );
  });
});

// ---- getSkillStackMarketplaces ----

describe('getSkillStackMarketplaces', () => {
  let dir;
  afterEach(() => { if (dir) cleanup(dir); });

  it('finds marketplaces with store.skillstack.sh URL (source.source format)', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'known_marketplaces.json'), JSON.stringify({
      'my-store': {
        source: { source: 'url', url: 'https://store.skillstack.sh/s/creator/market/marketplace.json' },
      },
      'git-repo': {
        source: { source: 'git', url: 'https://github.com/foo/bar.git' },
      },
    }));

    const result = getSkillStackMarketplaces(dir);
    assert.deepEqual(result, ['my-store']);
  });

  it('finds marketplaces with store.skillstack.sh URL (source.type format)', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'known_marketplaces.json'), JSON.stringify({
      'my-store': {
        source: { type: 'url', url: 'https://store.skillstack.sh/s/creator/market/marketplace.json' },
      },
    }));

    const result = getSkillStackMarketplaces(dir);
    assert.deepEqual(result, ['my-store']);
  });

  it('returns empty array when no SkillStack marketplaces', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'known_marketplaces.json'), JSON.stringify({
      'git-only': { source: { source: 'git', url: 'https://github.com/foo/bar.git' } },
    }));

    const result = getSkillStackMarketplaces(dir);
    assert.deepEqual(result, []);
  });

  it('throws if file is missing', () => {
    dir = tmpDir();
    assert.throws(
      () => getSkillStackMarketplaces(dir),
      { message: /known_marketplaces\.json not found/ }
    );
  });

  it('throws if JSON is malformed', () => {
    dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'known_marketplaces.json'), '<<<bad>>>');
    assert.throws(
      () => getSkillStackMarketplaces(dir),
      { message: /Failed to parse known_marketplaces\.json/ }
    );
  });
});

// ---- readMarketplaceManifest ----

describe('readMarketplaceManifest', () => {
  let dir;
  afterEach(() => { if (dir) cleanup(dir); });

  it('reads and returns manifest plugins', () => {
    dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'marketplaces'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'marketplaces', 'my-market'), JSON.stringify({
      name: 'my-market',
      plugins: [
        { name: 'plugin-a', source: { type: 'npm', package: '@skillstack/slug-a' }, version: '1.0.0' },
      ],
    }));

    const result = readMarketplaceManifest(dir, 'my-market');
    assert.equal(result.plugins.length, 1);
    assert.equal(result.plugins[0].name, 'plugin-a');
  });

  it('returns null if manifest file does not exist', () => {
    dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'marketplaces'), { recursive: true });

    const result = readMarketplaceManifest(dir, 'nonexistent');
    assert.equal(result, null);
  });

  it('throws if JSON is malformed', () => {
    dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'marketplaces'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'marketplaces', 'bad-market'), '{{{bad');

    assert.throws(
      () => readMarketplaceManifest(dir, 'bad-market'),
      { message: /Failed to parse marketplace manifest.*bad-market/ }
    );
  });
});
