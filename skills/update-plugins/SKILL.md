---
name: update-plugins
description: Check for and apply updates to installed SkillStack plugins.
---

## Update SkillStack Plugins

### Step 1: Find installed SkillStack storefront plugins

This skill manages updates for **npm-sourced plugins from SkillStack storefronts only**.
Do NOT include the SkillStack buyer plugin (`skillstack@skillstack-marketplace`) or the creator
plugin (`skillstack-creator@skillstack-creator`) — those are git-based and update normally
through Claude Code's native `/plugin update`.

To find SkillStack storefront plugins:

1. Read `~/.claude/plugins/known_marketplaces.json`
2. Find any marketplace with a `source.url` containing `store.skillstack.sh`
3. Read that marketplace manifest file (at `~/.claude/plugins/marketplaces/<marketplace-name>`)
4. For each plugin in the manifest, extract the SkillStack slug from the npm package name
   (e.g., `@skillstack/kenneth-liao-selling-skills` → slug is `kenneth-liao-selling-skills`)
5. Cross-reference with `~/.claude/plugins/installed_plugins.json` to find which ones are
   installed and their current versions (key format: `<plugin-name>@<marketplace-name>`)

### Step 1b: Check for updates

Call `skillstack_check_updates` with the identified storefront plugins.
Use the SkillStack slug (not the local plugin name) and the currently installed version for each.

### Step 2: Report results

If no updates available, tell the user all plugins are up to date.

If updates are available, list them:
- Plugin name: current version -> latest version

Ask the user which plugins they want to update (all, specific ones, or none).

#### License-type-aware update messaging

After listing available updates, check the buyer's license type for each plugin. Call `skillstack_list` and cross-reference `license_options` with the buyer's installed state.

For **onetime** buyers with available updates:
> "**<plugin-name>**: v<current> → v<latest> available, but your one-time license covers v<current> only.
>
> To get v<latest>, you can upgrade to a lifetime license from the creator — this includes all future updates."

For **subscription** buyers:
> "**<plugin-name>**: v<current> → v<latest> available. Your subscription includes this update."
>
> If the subscription has lapsed (update fails with 403):
> "Your subscription for **<plugin-name>** appears to have lapsed. Renew with the creator to restore access to updates."

For **lifetime** buyers:
> "**<plugin-name>**: v<current> → v<latest> available. Your lifetime license includes this update."

If the buyer's license type is unknown (no `license_type` in response), fall back to the generic update message without license-specific context.

### Detecting variant upgrades

After checking for version updates, also check if the user has activated a license for any plugin they previously installed as the free variant.

To detect this: call `skillstack_list` and cross-reference with installed plugins. If a plugin is freemium (`is_freemium` is true) and the user now has a valid license key (check ~/.npmrc for sst_* token, then check if the plugin slug is activated), but they currently have the free variant installed (fewer skills than the total):

Tell the user:
> "**[plugin-name]** can be upgraded to premium! You have a valid license.
>
> This will unlock [total - free_skill_count] additional skills:
>   [list of premium skill names if available, or just the count]
>
> To upgrade, reinstall the plugin:
>   /plugin uninstall [plugin-name]@[marketplace]
>   /plugin install [plugin-name]@[marketplace]
>
> Then restart Claude Code for the changes to take effect."

After the user reinstalls, confirm the upgrade:
> "**[plugin-name]** upgraded to premium — all [total] skills unlocked!"

### Detecting license upgrade opportunities

After checking for variant upgrades, also check if the buyer has a **onetime** license for a plugin that also offers **lifetime**.

To detect this: call `skillstack_list` and check each plugin's `license_options`. If a plugin has both `onetime` and `lifetime` in `license_options`, and the buyer's current license type is `onetime` (check via `skillstack_check_updates` response or prior activation data):

> "**<plugin-name>** offers a lifetime license upgrade. Your current one-time license covers v<purchased_version>. A lifetime license would include all future updates.
>
> Contact the creator to upgrade, then run `/activate-license` to activate your new key."

This is informational — don't block on it. Show it alongside other update info.

### Step 3: Apply updates

SkillStack plugins are npm-sourced. Claude Code's native `/plugin update` has a known issue where
npm's lockfile prevents version resolution even when a newer version is available. To work around
this, the skill must clean the npm cache before reinstalling.

For each plugin the user wants to update:

#### 3a. Clean stale npm cache

The npm cache lives at `~/.claude/plugins/npm-cache/`. For each plugin being updated:

1. **Read** `~/.claude/plugins/npm-cache/package.json` and `package-lock.json`
2. **Remove** the package entry from `package.json` dependencies (e.g., `@skillstack/<slug>`)
3. **Remove** the corresponding `node_modules/@skillstack/<slug>` entry from `package-lock.json`
   (both the root `dependencies` reference AND the `packages["node_modules/..."]` entry)
4. **Delete** the stale `node_modules` directory:
   ```bash
   rm -rf ~/.claude/plugins/npm-cache/node_modules/@skillstack/<slug>
   ```

#### 3b. Install the new version

Do this automatically — do NOT ask the user to run `/plugin install` manually.

1. **Add the new dep** to `~/.claude/plugins/npm-cache/package.json` with the exact version:
   ```json
   "@skillstack/<slug>": "<new-version>"
   ```
   Use the exact version (e.g., `"1.10.2"`), NOT a caret range.

2. **Run npm install** in the npm-cache directory:
   ```bash
   cd ~/.claude/plugins/npm-cache && npm install
   ```
   npm reads `~/.npmrc` for the `@skillstack` registry URL and auth token automatically.
   The SkillStack registry enforces license checks server-side during this step.

3. **Copy installed files** to the plugin cache:
   ```bash
   rm -rf ~/.claude/plugins/cache/<marketplace-name>/<plugin-name>
   cp -r ~/.claude/plugins/npm-cache/node_modules/@skillstack/<slug> \
     ~/.claude/plugins/cache/<marketplace-name>/<plugin-name>/<new-version>
   ```

4. **Update `~/.claude/plugins/installed_plugins.json`**: Edit the entry for
   `<plugin-name>@<marketplace-name>` — update `installPath` (with new version in path),
   `version`, and `lastUpdated` (ISO timestamp).

**Important**: Do NOT use `/plugin update` — it does not work correctly for npm-sourced plugins.

### Step 4: Confirm

Verify the update by reading the newly installed `plugin.json` at
`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/.claude-plugin/plugin.json`
and confirming the version matches.

Summarize what was updated:
- Plugin name: old version -> new version (confirmed)

Tell the user to **restart Claude Code** for the updated skills to take effect.
