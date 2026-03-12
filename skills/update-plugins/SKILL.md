---
name: update-plugins
description: Use when the user wants to check for plugin updates, upgrade from free to premium, or encounters stale npm cache issues with SkillStack plugins.
---

## Update SkillStack Plugins

Manages updates for npm-sourced plugins from SkillStack storefronts. Does NOT cover the buyer or creator plugins — those are git-based and use `/plugin update` natively.

### Step 1: Discover installed plugins

Run the discovery script to find all installed SkillStack storefront plugins:

```bash
node <this-skill-dir>/../../../scripts/discover-plugins.mjs --plugin-dir ~/.claude/plugins
```

Output is a JSON array of `{ slug, currentVersion, marketplace, pluginName }`.

If empty, tell the user they have no SkillStack storefront plugins installed.

### Step 2: Check for updates

Call `skillstack_check_updates` with the slugs and current versions from Step 1.

If no updates available, tell the user all plugins are up to date.

If updates are available, list them and ask which to update. Tailor messaging by license type (from `skillstack_list`):
- **onetime**: Update available but their license covers current version only — suggest lifetime upgrade
- **subscription**: Update included while active. If 403 on install, subscription may have lapsed
- **lifetime**: Update included

Also check for:
- **Variant upgrades**: If a freemium plugin was installed free but user now has a license, suggest reinstalling via `/plugin uninstall` then `/plugin install`
- **License upgrade opportunities**: If user has onetime but plugin also offers lifetime, mention it informationally

### Step 3: Apply updates

For each plugin the user wants to update, run the update script:

```bash
node <this-skill-dir>/../../../scripts/update-plugin.mjs \
  <slug> <new-version> <marketplace-name> <plugin-name> \
  --plugin-dir ~/.claude/plugins
```

The script handles all phases automatically:
1. Cleans stale npm cache (package.json, package-lock.json, node_modules)
2. Adds exact version dependency (no caret ranges)
3. Runs `npm install` (reads ~/.npmrc for auth)
4. Copies to plugin cache (including dotfiles like `.claude-plugin/`)
5. Updates `installed_plugins.json`
6. Verifies `plugin.json` version matches

Output is JSON with `{ success, confirmedVersion, error }`.

If the script fails, show the error. Common failures:
- **403**: License issue — subscription lapsed or onetime version mismatch
- **npm install failure**: Network or registry issue — retry or check `~/.npmrc`

**Important**: Do NOT use `/plugin update` — it has a known npm lockfile bug with SkillStack plugins.

### Step 4: Confirm

Summarize what was updated (plugin: old → new version) and tell the user to **restart Claude Code**.
