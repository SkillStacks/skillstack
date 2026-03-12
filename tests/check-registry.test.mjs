import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { checkRegistry } from '../scripts/check-registry.mjs';

// --- Test Fixtures ---

function createFixture(npmrcContent) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skillstack-registry-'));
  if (npmrcContent !== undefined) {
    fs.writeFileSync(path.join(root, '.npmrc'), npmrcContent);
  }
  return root;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- Tests ---

describe('checkRegistry', () => {
  let homeDir;
  afterEach(() => { if (homeDir) cleanup(homeDir); });

  it('detects registry is configured and extracts token', () => {
    homeDir = createFixture(
      '@skillstack:registry=https://mcp.skillstack.sh\n' +
      '//mcp.skillstack.sh/:_authToken=sst_abc123def456\n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, true);
    assert.equal(result.existingToken, 'sst_abc123def456');
  });

  it('detects registry configured but no token', () => {
    homeDir = createFixture(
      '@skillstack:registry=https://mcp.skillstack.sh\n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, true);
    assert.equal(result.existingToken, null);
  });

  it('detects no registry and no token', () => {
    homeDir = createFixture(
      '# some other npm config\n' +
      'registry=https://registry.npmjs.org\n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, false);
    assert.equal(result.existingToken, null);
  });

  it('handles .npmrc with other scoped registries', () => {
    homeDir = createFixture(
      '@mycompany:registry=https://npm.mycompany.com\n' +
      '//npm.mycompany.com/:_authToken=company_token_123\n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, false);
    assert.equal(result.existingToken, null);
  });

  it('handles .npmrc that does not exist', () => {
    homeDir = createFixture(); // No .npmrc file

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, false);
    assert.equal(result.existingToken, null);
  });

  it('handles empty .npmrc', () => {
    homeDir = createFixture('');

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, false);
    assert.equal(result.existingToken, null);
  });

  it('extracts token with various sst_ formats', () => {
    homeDir = createFixture(
      '@skillstack:registry=https://mcp.skillstack.sh\n' +
      '//mcp.skillstack.sh/:_authToken=sst_a1b2c3d4e5f6g7h8i9j0\n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.existingToken, 'sst_a1b2c3d4e5f6g7h8i9j0');
  });

  it('handles token line without sst_ prefix (non-SkillStack token)', () => {
    homeDir = createFixture(
      '@skillstack:registry=https://mcp.skillstack.sh\n' +
      '//mcp.skillstack.sh/:_authToken=some_other_format_token\n'
    );

    // Should still extract it — the token is at the right URL
    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, true);
    assert.equal(result.existingToken, 'some_other_format_token');
  });

  it('handles .npmrc with Windows-style line endings', () => {
    homeDir = createFixture(
      '@skillstack:registry=https://mcp.skillstack.sh\r\n' +
      '//mcp.skillstack.sh/:_authToken=sst_win_token\r\n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, true);
    assert.equal(result.existingToken, 'sst_win_token');
  });

  it('handles registry line with trailing spaces', () => {
    homeDir = createFixture(
      '@skillstack:registry=https://mcp.skillstack.sh   \n' +
      '//mcp.skillstack.sh/:_authToken=sst_trim_test   \n'
    );

    const result = checkRegistry(path.join(homeDir, '.npmrc'));
    assert.equal(result.registryConfigured, true);
    assert.equal(result.existingToken, 'sst_trim_test');
  });
});
