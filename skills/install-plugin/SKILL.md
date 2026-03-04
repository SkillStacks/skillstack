---
name: install-plugin
description: Install a plugin from SkillStack via the native Claude Code plugin system.
---

## Install a SkillStack Plugin

### Step 1: Check SkillStack is configured

Verify `~/.npmrc` contains `@skillstack:registry`. If not, run the setup skill first.

### Step 2: Identify the plugin

Ask the user which plugin they want to install. If they don't know what's available, call `skillstack_list` to show the catalog.

### Step 3: Check license requirements

From `skillstack_list` results, check the plugin's `license_model`:

- **free**: No license needed. Proceed to install.
- **subscription** or **onetime_snapshot**: Ask the user if they have a license key.
  - If yes: call `skillstack_activate` with the plugin slug and key to register access
  - If no: direct them to the creator's purchase page

### Step 4: Install via Claude Code

Instruct the user to run:

```
/plugin install <plugin-name>@skillstack
```

For example:
```
/plugin install linear-pm@skillstack
```

This uses Claude Code's native plugin installer, which:
1. Reads the SkillStack marketplace
2. Downloads the plugin via npm from the SkillStack registry
3. Validates the license key via the auth token in .npmrc
4. Installs the plugin locally

### Step 5: Confirm installation

After the user confirms the install succeeded:
- Tell them the plugin is now available
- Suggest they check `/plugin` to see it listed
- Mention they can use the plugin's skills immediately
