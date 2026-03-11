---
name: update-plugins
description: Check for and apply updates to installed SkillStack plugins.
---

## Update SkillStack Plugins

### Step 1: Find installed SkillStack plugins

SkillStack plugins come from TWO sources — identify both:

1. **The SkillStack buyer plugin** — installed from the `skillstack-marketplace`
   (e.g., `skillstack@skillstack-marketplace` in `installed_plugins.json`)

2. **Plugins from SkillStack storefronts** — installed from creator marketplaces hosted on
   `store.skillstack.sh`. To find these:
   a. Read `~/.claude/plugins/known_marketplaces.json`
   b. Find any marketplace with a `source.url` containing `store.skillstack.sh`
   c. Read that marketplace manifest file (the `installLocation` path or the file at
      `~/.claude/plugins/marketplaces/<marketplace-name>`)
   d. For each plugin in the manifest, extract the SkillStack slug from the npm package name
      (e.g., `@skillstack/kenneth-liao-selling-skills` → slug is `kenneth-liao-selling-skills`)
   e. Cross-reference with `installed_plugins.json` to find installed ones and their versions
      (the key format is `<plugin-name>@<marketplace-name>`)

### Step 1b: Check for updates

Call `skillstack_check_updates` with ALL identified SkillStack plugins — both the buyer plugin
and any storefront-distributed plugins. Use the SkillStack slug (not the local plugin name) and
the currently installed version for each.

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

#### 3b. Reinstall

Tell the user to run:

```
/plugin install <plugin-name>@<marketplace-name>
```

This triggers a fresh npm resolution against the registry, pulling the latest version.

**Important**: Do NOT use `/plugin update` — it does not work correctly for npm-sourced plugins.

If the user has multiple plugins to update, clean all npm cache entries first (step 3a for all),
then have the user reinstall each one sequentially.

### Step 4: Confirm

After reinstall, verify the update by reading `~/.claude/plugins/installed_plugins.json` and
confirming the new version matches the expected latest version.

Summarize what was updated:
- Plugin name: old version -> new version (confirmed)
