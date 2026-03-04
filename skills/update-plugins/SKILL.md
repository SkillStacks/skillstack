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
