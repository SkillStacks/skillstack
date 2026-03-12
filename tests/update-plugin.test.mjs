import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Import the functions we'll implement
import {
  cleanNpmCache,
  addDependency,
  copyToCache,
  updateInstalledPlugins,
  verify,
} from '../scripts/update-plugin.mjs';

// --- Test Fixtures ---

/** Create a realistic ~/.claude/plugins/ structure in a temp dir */
function createFixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skillstack-test-'));
  const npmCache = path.join(root, 'npm-cache');
  const cache = path.join(root, 'cache');

  // npm-cache directory
  fs.mkdirSync(npmCache, { recursive: true });
  fs.mkdirSync(path.join(npmCache, 'node_modules', '@skillstack'), { recursive: true });

  // Default package.json
  const packageJson = overrides.packageJson ?? {
    name: 'claude-plugins',
    dependencies: {
      '@skillstack/test-creator-my-plugin': '^1.0.0',
      '@skillstack/other-plugin': '^2.0.0',
    },
  };
  fs.writeFileSync(
    path.join(npmCache, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Default package-lock.json
  const packageLock = overrides.packageLock ?? {
    name: 'claude-plugins',
    lockfileVersion: 3,
    packages: {
      '': {
        dependencies: {
          '@skillstack/test-creator-my-plugin': '^1.0.0',
          '@skillstack/other-plugin': '^2.0.0',
        },
      },
      'node_modules/@skillstack/test-creator-my-plugin': {
        version: '1.0.0',
        resolved: 'https://mcp.skillstack.sh/@skillstack/test-creator-my-plugin/-/test-creator-my-plugin-1.0.0.tgz',
      },
      'node_modules/@skillstack/other-plugin': {
        version: '2.0.0',
        resolved: 'https://mcp.skillstack.sh/@skillstack/other-plugin/-/other-plugin-2.0.0.tgz',
      },
    },
  };
  fs.writeFileSync(
    path.join(npmCache, 'package-lock.json'),
    JSON.stringify(packageLock, null, 2)
  );

  // Old plugin files in node_modules (simulating previous install)
  const oldPluginDir = path.join(npmCache, 'node_modules', '@skillstack', 'test-creator-my-plugin');
  fs.mkdirSync(oldPluginDir, { recursive: true });
  fs.mkdirSync(path.join(oldPluginDir, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(oldPluginDir, 'skills', 'my-skill'), { recursive: true });
  fs.writeFileSync(
    path.join(oldPluginDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'my-plugin', version: '1.0.0' })
  );
  fs.writeFileSync(
    path.join(oldPluginDir, 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\n---\nOld content'
  );

  // Plugin cache directory (simulating current installed state)
  const cachedPlugin = path.join(cache, 'test-marketplace', 'my-plugin', '1.0.0');
  fs.mkdirSync(cachedPlugin, { recursive: true });
  fs.mkdirSync(path.join(cachedPlugin, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cachedPlugin, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'my-plugin', version: '1.0.0' })
  );

  // installed_plugins.json — supports both v1 (flat) and v2 (wrapped) formats
  const defaultV1 = {
    'my-plugin@test-marketplace': {
      installPath: path.join(cache, 'test-marketplace', 'my-plugin', '1.0.0'),
      version: '1.0.0',
      lastUpdated: '2026-01-01T00:00:00.000Z',
    },
    'other-plugin@other-marketplace': {
      installPath: path.join(cache, 'other-marketplace', 'other-plugin', '2.0.0'),
      version: '2.0.0',
      lastUpdated: '2026-01-15T00:00:00.000Z',
    },
  };
  const installedPlugins = overrides.installedPlugins ?? defaultV1;
  fs.writeFileSync(
    path.join(root, 'installed_plugins.json'),
    JSON.stringify(installedPlugins, null, 2)
  );

  return root;
}

/** Simulate npm install by placing new version files in node_modules */
function simulateNpmInstall(pluginDir, slug, version) {
  const dest = path.join(pluginDir, 'npm-cache', 'node_modules', '@skillstack', slug);
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(path.join(dest, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'skills', 'my-skill'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'skills', 'new-skill'), { recursive: true });
  fs.writeFileSync(
    path.join(dest, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'my-plugin', version })
  );
  fs.writeFileSync(
    path.join(dest, 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\n---\nUpdated content v' + version
  );
  fs.writeFileSync(
    path.join(dest, 'skills', 'new-skill', 'SKILL.md'),
    '---\nname: new-skill\n---\nBrand new skill'
  );
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- Tests ---

describe('cleanNpmCache', () => {
  let pluginDir;
  beforeEach(() => { pluginDir = createFixture(); });
  afterEach(() => { cleanup(pluginDir); });

  it('removes the target plugin from package.json dependencies', () => {
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');

    const pkg = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8'
    ));
    assert.equal(pkg.dependencies['@skillstack/test-creator-my-plugin'], undefined);
  });

  it('preserves other plugins in package.json dependencies', () => {
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');

    const pkg = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8'
    ));
    assert.equal(pkg.dependencies['@skillstack/other-plugin'], '^2.0.0');
  });

  it('removes the target plugin from package-lock.json packages', () => {
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');

    const lock = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package-lock.json'), 'utf-8'
    ));
    assert.equal(lock.packages['node_modules/@skillstack/test-creator-my-plugin'], undefined);
  });

  it('removes the target plugin from package-lock.json root dependencies', () => {
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');

    const lock = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package-lock.json'), 'utf-8'
    ));
    assert.equal(lock.packages['']?.dependencies?.['@skillstack/test-creator-my-plugin'], undefined);
  });

  it('preserves other plugins in package-lock.json', () => {
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');

    const lock = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package-lock.json'), 'utf-8'
    ));
    assert.ok(lock.packages['node_modules/@skillstack/other-plugin']);
    assert.equal(lock.packages[''].dependencies['@skillstack/other-plugin'], '^2.0.0');
  });

  it('deletes the node_modules directory for the target plugin', () => {
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');

    const modulePath = path.join(
      pluginDir, 'npm-cache', 'node_modules', '@skillstack', 'test-creator-my-plugin'
    );
    assert.equal(fs.existsSync(modulePath), false);
  });

  it('does not error if plugin is not in package.json', () => {
    assert.doesNotThrow(() => {
      cleanNpmCache(pluginDir, 'nonexistent-plugin');
    });
  });

  it('does not error if package-lock.json is missing', () => {
    fs.unlinkSync(path.join(pluginDir, 'npm-cache', 'package-lock.json'));
    assert.doesNotThrow(() => {
      cleanNpmCache(pluginDir, 'test-creator-my-plugin');
    });
  });
});

describe('addDependency', () => {
  let pluginDir;
  beforeEach(() => { pluginDir = createFixture(); });
  afterEach(() => { cleanup(pluginDir); });

  it('adds the plugin with exact version (no caret)', () => {
    addDependency(pluginDir, 'test-creator-my-plugin', '1.5.0');

    const pkg = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8'
    ));
    assert.equal(pkg.dependencies['@skillstack/test-creator-my-plugin'], '1.5.0');
  });

  it('overwrites existing version entry', () => {
    addDependency(pluginDir, 'test-creator-my-plugin', '2.0.0');

    const pkg = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8'
    ));
    assert.equal(pkg.dependencies['@skillstack/test-creator-my-plugin'], '2.0.0');
  });

  it('preserves other dependencies', () => {
    addDependency(pluginDir, 'test-creator-my-plugin', '1.5.0');

    const pkg = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8'
    ));
    assert.equal(pkg.dependencies['@skillstack/other-plugin'], '^2.0.0');
  });

  it('creates dependencies object if it does not exist', () => {
    // Write a package.json without dependencies
    fs.writeFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'),
      JSON.stringify({ name: 'claude-plugins' }, null, 2)
    );

    addDependency(pluginDir, 'new-plugin', '1.0.0');

    const pkg = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8'
    ));
    assert.equal(pkg.dependencies['@skillstack/new-plugin'], '1.0.0');
  });
});

describe('copyToCache', () => {
  let pluginDir;
  beforeEach(() => {
    pluginDir = createFixture();
    // Simulate npm install put new files in node_modules
    simulateNpmInstall(pluginDir, 'test-creator-my-plugin', '1.5.0');
  });
  afterEach(() => { cleanup(pluginDir); });

  it('removes the old cached version directory', () => {
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');

    const oldPath = path.join(pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.0.0');
    assert.equal(fs.existsSync(oldPath), false);
  });

  it('creates the new version directory', () => {
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');

    const newPath = path.join(pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0');
    assert.equal(fs.existsSync(newPath), true);
  });

  it('copies dotfiles (.claude-plugin/plugin.json)', () => {
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');

    const pluginJson = path.join(
      pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0', '.claude-plugin', 'plugin.json'
    );
    assert.equal(fs.existsSync(pluginJson), true);

    const content = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'));
    assert.equal(content.version, '1.5.0');
  });

  it('copies skill files', () => {
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');

    const skillPath = path.join(
      pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0', 'skills', 'my-skill', 'SKILL.md'
    );
    assert.equal(fs.existsSync(skillPath), true);

    const content = fs.readFileSync(skillPath, 'utf-8');
    assert.ok(content.includes('v1.5.0'), 'Should contain updated content');
  });

  it('copies new skills that did not exist before', () => {
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');

    const newSkill = path.join(
      pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0', 'skills', 'new-skill', 'SKILL.md'
    );
    assert.equal(fs.existsSync(newSkill), true);
  });

  it('works when no previous cache directory exists', () => {
    // Remove the old cache
    fs.rmSync(path.join(pluginDir, 'cache', 'test-marketplace'), { recursive: true, force: true });

    assert.doesNotThrow(() => {
      copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');
    });

    const pluginJson = path.join(
      pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0', '.claude-plugin', 'plugin.json'
    );
    assert.equal(fs.existsSync(pluginJson), true);
  });
});

describe('updateInstalledPlugins', () => {
  let pluginDir;
  beforeEach(() => { pluginDir = createFixture(); });
  afterEach(() => { cleanup(pluginDir); });

  it('updates the version for the target plugin', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.equal(installed['my-plugin@test-marketplace'].version, '1.5.0');
  });

  it('updates the installPath with the new version', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.ok(
      installed['my-plugin@test-marketplace'].installPath.includes('1.5.0'),
      'installPath should contain new version'
    );
  });

  it('updates lastUpdated to a recent ISO timestamp', () => {
    const before = Date.now();
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    const after = Date.now();

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    const ts = new Date(installed['my-plugin@test-marketplace'].lastUpdated).getTime();
    assert.ok(ts >= before && ts <= after, 'lastUpdated should be within test execution window');
  });

  it('preserves other plugin entries', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.equal(installed['other-plugin@other-marketplace'].version, '2.0.0');
  });

  it('preserves extra fields on the plugin entry', () => {
    // Add an extra field to the entry
    const installedPath = path.join(pluginDir, 'installed_plugins.json');
    const installed = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));
    installed['my-plugin@test-marketplace'].someExtraField = 'keep-me';
    fs.writeFileSync(installedPath, JSON.stringify(installed, null, 2));

    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const updated = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));
    assert.equal(updated['my-plugin@test-marketplace'].someExtraField, 'keep-me');
  });

  it('throws if plugin entry does not exist in installed_plugins.json', () => {
    assert.throws(
      () => updateInstalledPlugins(pluginDir, 'nonexistent-marketplace', 'ghost', '1.0.0'),
      { message: /not found in installed_plugins\.json/ }
    );
  });
});

describe('verify', () => {
  let pluginDir;
  beforeEach(() => {
    pluginDir = createFixture();
    simulateNpmInstall(pluginDir, 'test-creator-my-plugin', '1.5.0');
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');
  });
  afterEach(() => { cleanup(pluginDir); });

  it('returns success with correct version', () => {
    const result = verify(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    assert.equal(result.success, true);
    assert.equal(result.version, '1.5.0');
  });

  it('returns failure if plugin.json is missing', () => {
    // Remove the plugin.json
    fs.unlinkSync(path.join(
      pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0', '.claude-plugin', 'plugin.json'
    ));

    const result = verify(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('plugin.json'));
  });

  it('returns failure if version does not match', () => {
    // Write a wrong version
    const pluginJsonPath = path.join(
      pluginDir, 'cache', 'test-marketplace', 'my-plugin', '1.5.0', '.claude-plugin', 'plugin.json'
    );
    fs.writeFileSync(pluginJsonPath, JSON.stringify({ name: 'my-plugin', version: '1.0.0' }));

    const result = verify(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('mismatch'));
  });
});

describe('idempotency', () => {
  let pluginDir;
  beforeEach(() => { pluginDir = createFixture(); });
  afterEach(() => { cleanup(pluginDir); });

  it('produces identical state when run twice', () => {
    // First run
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');
    addDependency(pluginDir, 'test-creator-my-plugin', '1.5.0');
    simulateNpmInstall(pluginDir, 'test-creator-my-plugin', '1.5.0');
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    // Snapshot state
    const pkg1 = fs.readFileSync(path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8');
    const installed1 = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));

    // Second run (same version — should be safe to re-run)
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');
    addDependency(pluginDir, 'test-creator-my-plugin', '1.5.0');
    simulateNpmInstall(pluginDir, 'test-creator-my-plugin', '1.5.0');
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    // Compare
    const pkg2 = fs.readFileSync(path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8');
    const installed2 = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));

    assert.equal(pkg1, pkg2);
    assert.equal(installed1['my-plugin@test-marketplace'].version, installed2['my-plugin@test-marketplace'].version);
    assert.equal(
      installed1['other-plugin@other-marketplace'].version,
      installed2['other-plugin@other-marketplace'].version
    );

    // Verify final state is correct
    const result = verify(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    assert.equal(result.success, true);
  });
});

describe('edge cases', () => {
  let pluginDir;

  it('handles missing npm-cache directory gracefully', () => {
    pluginDir = createFixture();
    fs.rmSync(path.join(pluginDir, 'npm-cache'), { recursive: true });

    assert.throws(
      () => cleanNpmCache(pluginDir, 'test-creator-my-plugin'),
      { message: /npm-cache.*not found|package\.json.*not found/ }
    );

    cleanup(pluginDir);
  });

  it('handles empty dependencies in package.json', () => {
    pluginDir = createFixture({
      packageJson: { name: 'claude-plugins', dependencies: {} },
    });

    assert.doesNotThrow(() => {
      cleanNpmCache(pluginDir, 'test-creator-my-plugin');
    });

    cleanup(pluginDir);
  });

  it('handles missing installed_plugins.json', () => {
    pluginDir = createFixture();
    fs.unlinkSync(path.join(pluginDir, 'installed_plugins.json'));

    assert.throws(
      () => updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0'),
      { message: /installed_plugins\.json.*not found/ }
    );

    cleanup(pluginDir);
  });
});

// --- v2 format tests (Claude Code's actual format) ---

/** Create a v2 format installed_plugins.json */
function createV2InstalledPlugins(cache) {
  return {
    version: 2,
    plugins: {
      'my-plugin@test-marketplace': [
        {
          scope: 'user',
          installPath: path.join(cache, 'test-marketplace', 'my-plugin', '1.0.0'),
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      ],
      'other-plugin@other-marketplace': [
        {
          scope: 'user',
          installPath: path.join(cache, 'other-marketplace', 'other-plugin', '2.0.0'),
          version: '2.0.0',
          installedAt: '2026-01-15T00:00:00.000Z',
          lastUpdated: '2026-01-15T00:00:00.000Z',
        },
      ],
    },
  };
}

describe('updateInstalledPlugins (v2 format)', () => {
  let pluginDir;
  beforeEach(() => {
    pluginDir = createFixture();
    const cache = path.join(pluginDir, 'cache');
    // Overwrite with v2 format
    fs.writeFileSync(
      path.join(pluginDir, 'installed_plugins.json'),
      JSON.stringify(createV2InstalledPlugins(cache), null, 2)
    );
  });
  afterEach(() => { cleanup(pluginDir); });

  it('updates the version in v2 array entry', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.equal(installed.plugins['my-plugin@test-marketplace'][0].version, '1.5.0');
  });

  it('updates the installPath in v2 array entry', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.ok(
      installed.plugins['my-plugin@test-marketplace'][0].installPath.includes('1.5.0'),
      'installPath should contain new version'
    );
  });

  it('preserves the version field and plugins wrapper', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.equal(installed.version, 2);
    assert.ok(installed.plugins, 'plugins wrapper should be preserved');
  });

  it('preserves scope and installedAt fields', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    const entry = installed.plugins['my-plugin@test-marketplace'][0];
    assert.equal(entry.scope, 'user');
    assert.equal(entry.installedAt, '2026-01-01T00:00:00.000Z');
  });

  it('preserves other plugin entries in v2 format', () => {
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    assert.equal(installed.plugins['other-plugin@other-marketplace'][0].version, '2.0.0');
  });

  it('throws if plugin entry does not exist in v2 format', () => {
    assert.throws(
      () => updateInstalledPlugins(pluginDir, 'nonexistent-marketplace', 'ghost', '1.0.0'),
      { message: /not found in installed_plugins\.json/ }
    );
  });

  it('updates lastUpdated to a recent ISO timestamp in v2 format', () => {
    const before = Date.now();
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    const after = Date.now();

    const installed = JSON.parse(fs.readFileSync(
      path.join(pluginDir, 'installed_plugins.json'), 'utf-8'
    ));
    const ts = new Date(installed.plugins['my-plugin@test-marketplace'][0].lastUpdated).getTime();
    assert.ok(ts >= before && ts <= after, 'lastUpdated should be within test execution window');
  });
});

describe('idempotency (v2 format)', () => {
  let pluginDir;
  beforeEach(() => {
    pluginDir = createFixture();
    const cache = path.join(pluginDir, 'cache');
    fs.writeFileSync(
      path.join(pluginDir, 'installed_plugins.json'),
      JSON.stringify(createV2InstalledPlugins(cache), null, 2)
    );
  });
  afterEach(() => { cleanup(pluginDir); });

  it('produces identical state when run twice with v2 format', () => {
    // First run
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');
    addDependency(pluginDir, 'test-creator-my-plugin', '1.5.0');
    simulateNpmInstall(pluginDir, 'test-creator-my-plugin', '1.5.0');
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const pkg1 = fs.readFileSync(path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8');

    // Second run
    cleanNpmCache(pluginDir, 'test-creator-my-plugin');
    addDependency(pluginDir, 'test-creator-my-plugin', '1.5.0');
    simulateNpmInstall(pluginDir, 'test-creator-my-plugin', '1.5.0');
    copyToCache(pluginDir, 'test-creator-my-plugin', '1.5.0', 'test-marketplace', 'my-plugin');
    updateInstalledPlugins(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');

    const pkg2 = fs.readFileSync(path.join(pluginDir, 'npm-cache', 'package.json'), 'utf-8');
    assert.equal(pkg1, pkg2);

    const result = verify(pluginDir, 'test-marketplace', 'my-plugin', '1.5.0');
    assert.equal(result.success, true);
  });
});
