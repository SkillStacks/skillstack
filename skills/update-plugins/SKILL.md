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
>   /reload-plugins"

After the user reinstalls, confirm the upgrade:
> "**[plugin-name]** upgraded to premium — all [total] skills unlocked!"

### Step 3: Apply updates

For each plugin the user wants to update, instruct them to run:

```
/plugin update <plugin-name>@skillstack
```

If `/plugin update` is not supported, they can uninstall and reinstall:

```
/plugin uninstall <plugin-name>@skillstack
/plugin install <plugin-name>@skillstack
```

### Step 4: Confirm

Summarize what was updated.
