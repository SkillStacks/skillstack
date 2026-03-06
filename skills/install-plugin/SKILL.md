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

From `skillstack_list` results, check the plugin's `license_model` and `is_freemium`:

- **free**: No license needed. Proceed to install.
- **Freemium** (`is_freemium` is true): Tell the user:
  > "This plugin offers a free tier with [free_skill_count] skills you can try right now, or you can activate a license key for the full experience.
  >
  > Free skills included: [list free_skills names]
  >
  > Would you like to install the free version, or do you have a license key?"

  - If they choose free: Proceed to install (no auth needed).
  - If they have a key: Run activation via `/setup`, then install.
- **subscription**, **onetime**, or **lifetime** (not freemium): Existing behavior — ask for license key.
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

After the user confirms the install succeeded, check if this was a freemium plugin installed without a license:

If the plugin is freemium and was installed without a license (free variant):
> "Installed **[plugin-name]** (free tier — [free_skill_count] of [total from catalog] skills)
>   Included: [list free skill names]
>
>   [remaining count] premium skills available with a [license_model].
>   Run /setup to activate your license key when you're ready to upgrade."

If the plugin was installed with a valid license (full variant):
> "Installed **[plugin-name]** — all [total] skills unlocked!"
