/**
 * claude-plugins-adapter.mjs — Abstraction layer for Claude Code's internal file formats
 *
 * All reads/writes to Claude Code's plugin system files go through this module.
 * Single point of change when Claude Code updates its internal formats.
 *
 * Supported formats:
 *   - installed_plugins.json v1 (flat: { key: { version, installPath, ... } })
 *   - installed_plugins.json v2 (wrapped: { version: 2, plugins: { key: [{ scope, version, ... }] } })
 *   - known_marketplaces.json (source.source or source.type for format variant)
 *
 * Runtime validation: Every read validates the structure and throws descriptive errors
 * naming the specific assumption that broke, so format changes are caught immediately.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---- Helpers ----

function readJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse ${label}: ${err.message}`);
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// ---- installed_plugins.json ----

/**
 * Read and normalize installed_plugins.json.
 * Returns { format: 'v1'|'v2', plugins: { key: { version, installPath, ... } } }
 * All entries are normalized to plain objects (v2 arrays unwrapped to first element).
 */
export function getInstalledPlugins(pluginDir) {
  const filePath = path.join(pluginDir, 'installed_plugins.json');
  const raw = readJSON(filePath, 'installed_plugins.json');

  // Detect format
  if (raw.version && raw.version !== 2) {
    throw new Error(
      `Unsupported installed_plugins.json version: ${raw.version}. ` +
      `This adapter supports v1 (flat) and v2 (wrapped). Claude Code may have introduced a new format.`
    );
  }

  const isV2 = raw.version === 2 && raw.plugins;

  if (isV2) {
    return parseV2(raw);
  } else {
    return parseV1(raw);
  }
}

function parseV2(raw) {
  const normalized = {};

  for (const [key, value] of Object.entries(raw.plugins)) {
    if (!Array.isArray(value)) {
      throw new Error(
        `installed_plugins.json v2: expected array for "${key}", got ${typeof value}. ` +
        `Claude Code may have changed its internal format.`
      );
    }
    if (value.length === 0) {
      throw new Error(
        `installed_plugins.json v2: empty array for "${key}". ` +
        `Expected at least one entry (scope).`
      );
    }
    // Use first entry (user scope)
    const entry = value[0];
    validateEntry(key, entry);
    normalized[key] = entry;
  }

  return { format: 'v2', plugins: normalized };
}

function parseV1(raw) {
  const normalized = {};

  for (const [key, value] of Object.entries(raw)) {
    // Skip non-plugin keys (unlikely in v1, but defensive)
    if (typeof value !== 'object' || value === null) continue;
    validateEntry(key, value);
    normalized[key] = value;
  }

  return { format: 'v1', plugins: normalized };
}

function validateEntry(key, entry) {
  if (!entry.version) {
    throw new Error(
      `installed_plugins.json: missing required field "version" in "${key}". ` +
      `Claude Code may have changed its internal format.`
    );
  }
}

/**
 * Get a single plugin entry by marketplace and plugin name.
 * Returns the normalized entry object.
 */
export function getPluginEntry(pluginDir, marketplace, pluginName) {
  const { plugins } = getInstalledPlugins(pluginDir);
  const key = `${pluginName}@${marketplace}`;

  if (!plugins[key]) {
    throw new Error(`${key} not found in installed_plugins.json`);
  }

  return plugins[key];
}

/**
 * Update a plugin entry's version, installPath, and lastUpdated.
 * Writes directly to the raw file, preserving the original format (v1 or v2).
 */
export function updatePluginEntry(pluginDir, marketplace, pluginName, newVersion) {
  const filePath = path.join(pluginDir, 'installed_plugins.json');
  const raw = readJSON(filePath, 'installed_plugins.json');
  const key = `${pluginName}@${marketplace}`;

  const isV2 = raw.version === 2 && raw.plugins;
  const container = isV2 ? raw.plugins : raw;

  if (!container[key]) {
    throw new Error(`${key} not found in installed_plugins.json`);
  }

  // Get the entry to update (v2: first array element, v1: direct object)
  const entry = Array.isArray(container[key]) ? container[key][0] : container[key];

  // Update version segment in path
  if (entry.installPath) {
    entry.installPath = entry.installPath.replace(/\/[^/]+$/, `/${newVersion}`);
  }
  entry.version = newVersion;
  entry.lastUpdated = new Date().toISOString();

  writeJSON(filePath, raw);
}

// ---- known_marketplaces.json ----

/**
 * Find all marketplace names that use SkillStack storefronts.
 * Returns array of marketplace name strings.
 * Handles both source.source and source.type format variants.
 */
export function getSkillStackMarketplaces(pluginDir) {
  const filePath = path.join(pluginDir, 'known_marketplaces.json');
  const raw = readJSON(filePath, 'known_marketplaces.json');

  const results = [];

  for (const [name, config] of Object.entries(raw)) {
    const url = config?.source?.url || '';
    if (url.includes('store.skillstack.sh')) {
      results.push(name);
    }
  }

  return results;
}

// ---- Marketplace manifests ----

/**
 * Read a marketplace manifest file.
 * Returns the parsed manifest or null if the file doesn't exist.
 */
export function readMarketplaceManifest(pluginDir, marketplaceName) {
  const filePath = path.join(pluginDir, 'marketplaces', marketplaceName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse marketplace manifest "${marketplaceName}": ${err.message}`);
  }
}
