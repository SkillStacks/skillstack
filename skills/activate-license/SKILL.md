---
name: activate-license
description: Use when the user has a license key to activate, needs to configure SkillStack registry access, or mentions purchasing a paid plugin.
---

## SkillStack License Activation

Configures npm registry access and activates license keys for paid SkillStack plugins.

### Step 1: Check registry configuration

Run the registry check script:

```bash
node <this-skill-dir>/../../../scripts/check-registry.mjs --npmrc ~/.npmrc
```

Output: `{ registryConfigured, existingToken }`

- If `registryConfigured` is false, run: `npm config set @skillstack:registry https://mcp.skillstack.sh`
- If already configured, note it and continue

### Step 2: Ask about license key

Ask if the user has a license key for a paid plugin. If no, explain they're set for free plugins — give the storefront URL pattern and `/plugin install` command. Done.

### Step 3: Get license key

Ask the user to paste their key. Mention they can find it in their purchase confirmation email, Polar.sh dashboard (Orders → License Keys), or Lemon Squeezy (My Orders).

### Step 4: Auto-resolve the plugin

Call `skillstack_resolve_key` with the license key.

- **`resolved`**: Confirm the plugin name. Save `marketplace_command` and `install_command` if present.
- **`multiple_matches`**: Show matches, ask user to pick.
- **`not_found`**: Tell user to double-check key. Loop back to Step 3.

### Step 5: Check for existing token

Use the `existingToken` from Step 1. If an `sst_*` token exists, it will be passed to activation so the new plugin links to the same account.

### Step 6: Activate the license

Call `skillstack_activate` with `plugin_slug`, `license_key`, and `existing_token` (if any).

**On success:**
1. Set the auth token: `npm config set //mcp.skillstack.sh/:_authToken <token>`
2. Confirm activation with license-type-specific context:
   - **subscription**: updates included while active
   - **lifetime**: all future updates included
   - **onetime**: locked to current version
3. Show install commands if `marketplace_command` and `install_command` are available (from this response or Step 4). Otherwise, provide the storefront URL pattern.
4. Remind user to select "Install for you (user scope)" and restart Claude Code.

**On failure** — check `status`:
- **`misconfigured`**: Creator's config is broken, not the buyer's fault. Show `creator_contact` if available. Do NOT suggest re-entering the key.
- **`not_found`**: Invalid key — check and retry
- **`revoked`**: License revoked — renew subscription
- **`expired`**: License expired — renew

### Step 7: Offer to activate another key

If user wants to activate another plugin, loop to Step 3. The existing token links all plugins.

### Step 8: Recommend auto-updates

Mention that third-party marketplaces don't auto-update by default. They can enable it via `/plugin` → Marketplaces tab → select storefront → Enable auto-update. Informational only — don't block.
