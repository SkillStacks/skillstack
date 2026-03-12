#!/usr/bin/env node

/**
 * check-registry.mjs — Check SkillStack npm registry configuration
 *
 * Usage:
 *   node check-registry.mjs [--npmrc <path>]
 *
 * Output (JSON):
 *   { registryConfigured: boolean, existingToken: string | null }
 *
 * Reads ~/.npmrc to check if the @skillstack registry is configured
 * and extracts any existing auth token for mcp.skillstack.sh.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Check if the SkillStack registry is configured and extract existing token.
 * Returns { registryConfigured, existingToken }.
 */
export function checkRegistry(npmrcPath) {
  if (!fs.existsSync(npmrcPath)) {
    return { registryConfigured: false, existingToken: null };
  }

  const content = fs.readFileSync(npmrcPath, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim());

  let registryConfigured = false;
  let existingToken = null;

  for (const line of lines) {
    // Check for @skillstack:registry=...
    if (line.startsWith('@skillstack:registry=')) {
      registryConfigured = true;
    }

    // Check for auth token at mcp.skillstack.sh
    const tokenMatch = line.match(/^\/\/mcp\.skillstack\.sh\/:_authToken=(.+)$/);
    if (tokenMatch) {
      existingToken = tokenMatch[1].trim();
    }
  }

  return { registryConfigured, existingToken };
}

// --- CLI Entry Point ---

const __filename = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  const args = process.argv.slice(2);

  let npmrcPath = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.npmrc');
  const pathIdx = args.indexOf('--npmrc');
  if (pathIdx !== -1 && args[pathIdx + 1]) {
    npmrcPath = args[pathIdx + 1];
  }

  const result = checkRegistry(npmrcPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
