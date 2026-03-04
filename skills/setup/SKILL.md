---
name: setup
description: Set up SkillStack for first-time use or activate a new license key. Configures npm registry access and handles license activation.
---

## SkillStack Setup

This skill configures your system to install paid Claude Code plugins via SkillStack. It handles npm registry configuration and license key activation.

### Step 1: Check if SkillStack registry is configured

Read `~/.npmrc` and check if it contains `@skillstack:registry`.

- If **already configured** → tell the user "SkillStack registry is already configured." and continue to Step 2.
- If **not configured** → run:

```bash
npm config set @skillstack:registry https://skillstack-mcp.kennyliao22.workers.dev
```

Tell the user: "SkillStack registry configured."

### Step 2: Ask about license key

Ask the user: "Do you have a license key for a paid plugin? (If you only want to install free plugins, you can skip this.)"

- If **no** → tell them:
  > "You're all set for free plugins! To install a plugin, first add a creator's marketplace:"
  >
  > `/plugin marketplace add <creator-marketplace-url>`
  >
  > Then install the plugin:
  >
  > `/plugin install <plugin-name>@<marketplace-name>`
  >
  > When you purchase a paid plugin later, run `/setup` again to activate your license key."

  → Done.

- If **yes** → continue to Step 3.

### Step 3: Get license key

Ask the user to paste their Polar.sh license key.

### Step 4: Identify the plugin

Ask the user which plugin the key is for. If they're unsure, call `skillstack_list` to show available plugins and help them identify the right one.

### Step 5: Check for existing SkillStack token

Read `~/.npmrc` and look for an existing auth token line:
```
//skillstack-mcp.kennyliao22.workers.dev/:_authToken=sst_...
```

If found, extract the `sst_*` token value. This will be passed to `skillstack_activate` as `existing_token` so the new plugin is linked to the same token.

### Step 6: Activate the license

Call `skillstack_activate` with:
- `plugin_slug`: the plugin slug from Step 4
- `license_key`: the Polar key from Step 3
- `existing_token`: the `sst_*` token from Step 5 (if one exists)

**If activation succeeds:**

The response includes a `token` field (the SkillStack token) and `npmrc_instructions`.

Set the auth token in npm:

```bash
npm config set //skillstack-mcp.kennyliao22.workers.dev/:_authToken <token-from-response>
```

Tell the user:
> "License activated for **<plugin-name>**!
>
> Now install the plugin:
>
> `/plugin install <plugin-slug>@<marketplace-name>`
>
> Want to activate another license key? Just say so, or you're all set."

**If activation fails:**

Show the error message from the response. Common issues:
- Invalid key → "Check your license key and try again. You can find it in your Polar.sh purchase confirmation."
- Revoked → "Your license has been revoked. Contact the plugin creator or renew your subscription."
- Plugin not found → "That plugin slug wasn't found. Call skillstack_list to see available plugins."

### Step 7: Offer to activate another key

If the user wants to activate another key for a different plugin, loop back to Step 3. The existing `sst_*` token from Step 5 will be reused, linking all plugins to the same auth token.
