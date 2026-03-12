---
name: install-plugin
description: Use when the user wants to install a plugin from a SkillStack storefront, browse available plugins, or encounters a 403 error during install.
---

## Install a SkillStack Plugin

### Step 1: Check registry

Run the registry check script:

```bash
node <this-skill-dir>/../../../scripts/check-registry.mjs --npmrc ~/.npmrc
```

If `registryConfigured` is false, direct the user to run `/activate-license` first.

### Step 2: Identify the plugin

Ask which plugin to install. If they don't know, call `skillstack_list` to show the catalog.

### Step 3: Check license requirements

From `skillstack_list`, check the plugin's `license_model`, `is_freemium`, and `license_options`:

- **Free** (no `license_options`): Proceed to install.
- **Freemium** (`is_freemium` true): Show free skill count and names. Offer choice: install free or activate a key for full access.
- **Multi-license** (multiple `license_options`): Show available options as a table (onetime/lifetime/subscription with what each includes). Ask which they bought, or direct to creator's purchase page.
- **Single paid**: Ask for license key or direct to purchase page.

If `creator_contact` is available, show it for paid plugins.

**403 handling**: If user has an `sst_*` token but install fails with 403, they need to activate a license for THIS specific plugin → run `/activate-license`.

### Step 4: Install

Instruct the user to run:

```
/plugin install <plugin-name>@<marketplace-name>
```

Tell them to select **"Install for you (user scope)"** when prompted.

### Step 5: Confirm

After install succeeds:
- **Freemium (free variant)**: Show free tier skill count, list included skills, mention premium upgrade path via `/activate-license`
- **Full install**: Confirm all skills unlocked
