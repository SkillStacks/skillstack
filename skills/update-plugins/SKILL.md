---
name: update-plugins
description: Check for and apply updates to installed SkillStack plugins.
---

## Update SkillStack Plugins

### Step 1: Check for updates

Call `skillstack_check_updates` with the user's installed SkillStack plugins.

To find installed SkillStack plugins, check `/plugin` output for plugins from the "skillstack" marketplace.

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

For each plugin the user wants to update, instruct them to run:

```
/plugin update <plugin-name>@<marketplace-name>
```

If `/plugin update` is not supported, they can uninstall and reinstall:

```
/plugin uninstall <plugin-name>@<marketplace-name>
/plugin install <plugin-name>@<marketplace-name>
```

### Step 4: Confirm

Summarize what was updated.
