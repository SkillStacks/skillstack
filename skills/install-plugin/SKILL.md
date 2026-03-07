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

From `skillstack_list` results, check the plugin's `license_model`, `is_freemium`, and `license_options`:

- **free** (no `license_options`): No license needed. Proceed to install.

- **Freemium** (`is_freemium` is true): Tell the user:
  > "This plugin offers a free tier with [free_skill_count] skills you can try right now, or you can activate a license key for the full experience.
  >
  > Free skills included: [list free_skills names]
  >
  > Would you like to install the free version, or do you have a license key?"

  - If they choose free: Proceed to install (no auth needed).
  - If they have a key: Run activation via `/setup`, then install.

- **Multi-license** (`license_options` has multiple keys, e.g., `{ "onetime": {...}, "lifetime": {...} }`): Tell the user what purchase options the creator offers:
  > "This plugin offers multiple purchase options:
  >
  > | Option | What you get |
  > |--------|-------------|
  > | **One-time** | Access to the current version (v<version>). Future updates not included. |
  > | **Lifetime** | All current and future updates included. |
  > | **Subscription** | Updates while your subscription is active. |
  >
  > (Only show the options that exist in `license_options`)
  >
  > If you already purchased, provide your license key and SkillStack will auto-detect which option you bought."

  - If they have a key: Run activation via `/setup`, then install.
  - If they don't have a key: Direct them to the creator's purchase page.

- **Single paid** (`subscription`, `onetime`, or `lifetime`, not freemium): Ask for license key.
  - If yes: Run activation via `/setup`, then install.
  - If no: Direct them to the creator's purchase page.

**Handling 403 errors:** If the user already has an `sst_*` token in `~/.npmrc` (from a previous purchase) but hasn't activated a license for THIS plugin, the install will fail with 403 ("no access to this plugin"). If this happens:
> "It looks like you have a SkillStack account but haven't activated a license for this plugin yet. Run `/setup` to activate your license key for **<plugin-name>**, then try installing again."

### Step 4: Install via Claude Code

Instruct the user to run:

```
/plugin install <plugin-name>@<marketplace-name>
```

For example:
```
/plugin install linear-pm@my-storefront
```

**Note:** The `<marketplace-name>` is the name of the creator's storefront, not "skillstack". Check which marketplaces the user has added with `/plugin` if they're unsure.

This uses Claude Code's native plugin installer, which:
1. Reads the creator's storefront marketplace
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
