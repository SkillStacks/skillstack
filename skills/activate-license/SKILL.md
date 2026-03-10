---
name: activate-license
description: Activate a SkillStack license key. Configures npm registry access and handles license activation.
---

## SkillStack License Activation

This skill configures your system to install paid Claude Code plugins via SkillStack. It handles npm registry configuration and license key activation.

### Step 1: Check if SkillStack registry is configured

Read `~/.npmrc` and check if it contains `@skillstack:registry`.

- If **already configured** → tell the user "SkillStack registry is already configured." and continue to Step 2.
- If **not configured** → run:

```bash
npm config set @skillstack:registry https://mcp.skillstack.sh
```

Tell the user: "SkillStack registry configured."

### Step 2: Ask about license key

Ask the user: "Do you have a license key for a paid plugin you'd like to activate? If you only need free plugins, you're already good to go."

- If **no** → tell them:
  > "You're all set for free plugins! To install a plugin, first add a creator's storefront marketplace:"
  >
  > `/plugin marketplace add <creator-storefront-url>`
  >
  > Then install the plugin:
  >
  > `/plugin install <plugin-name>@<storefront-name>`
  >
  > When you purchase a paid plugin later, run `/activate-license` again to activate your license key."

  → Done.

- If **yes** → continue to Step 3.

### Step 3: Get license key

Ask the user to paste their license key.

> "Great! Paste your license key here.
>
> You can usually find it in:
> - Your **purchase confirmation email** from the creator's payment provider
> - Your account dashboard on **Polar.sh** (Orders → License Keys) or **Lemon Squeezy** (My Orders)
>
> The key format varies by provider (UUID for Polar, alphanumeric with dashes for Lemon Squeezy)."

### Step 4: Auto-resolve the plugin

Call `skillstack_resolve_key` with the license key from Step 3.

**If `status: "resolved"`:**
Tell the user: "Found it — this key is for **<plugin_name>**."
Continue to Step 5 with the `plugin_slug` from the response.

**If `status: "multiple_matches"`:**
Show the matches and ask the user to pick:
> "This key matched multiple plugins:
> - **<plugin_name_1>** (`<plugin_slug_1>`)
> - **<plugin_name_2>** (`<plugin_slug_2>`)
>
> Which one would you like to activate?"

Continue to Step 5 with the chosen slug.

**If `status: "not_found"`:**
> "That key didn't match any registered plugin. Double-check your key and try again.
>
> You can find it in your purchase confirmation email or your account dashboard on **Polar.sh** (Orders → License Keys) or **Lemon Squeezy** (My Orders)."

Loop back to Step 3 to let the user re-enter the key.

### Step 5: Check for existing SkillStack token

Read `~/.npmrc` and look for an existing auth token line:
```
//mcp.skillstack.sh/:_authToken=sst_...
```

If found, extract the `sst_*` token value. This will be passed to `skillstack_activate` as `existing_token` so the new plugin is linked to the same token.

### Step 6: Activate the license

Call `skillstack_activate` with:
- `plugin_slug`: the plugin slug from Step 4
- `license_key`: the license key from Step 3
- `existing_token`: the `sst_*` token from Step 5 (if one exists)

**If activation succeeds:**

The response includes a `token` field (the SkillStack token), `npmrc_instructions`, and `license_type` (the detected license type — `subscription`, `onetime`, or `lifetime`).

Set the auth token in npm:

```bash
npm config set //mcp.skillstack.sh/:_authToken <token-from-response>
```

Tell the user, including the detected license type:

- **subscription**: "License activated for **<plugin-name>** (subscription — updates included while active)."
- **lifetime**: "License activated for **<plugin-name>** (lifetime — all future updates included)."
- **onetime**: "License activated for **<plugin-name>** (one-time purchase — locked to v<version>)."
- **unknown/null**: "License activated for **<plugin-name>**!"

Then:
> "Now install the plugin from your creator's storefront:
>
> `/plugin install <name>@<storefront-name>`
>
> Then restart Claude Code for the skills to take effect.
>
> Want to activate another license key, or are you all set?"

**If activation fails:**

Check the `status` field in the error response and show the appropriate message:

- **`misconfigured`**: This means the plugin's license configuration is broken — NOT a problem with the buyer's key. Show:
  > "This plugin's license configuration is incomplete — **this is NOT a problem with your license key.**
  >
  > [If `creator_contact` is in the response]: Contact the creator at: **<creator_contact>**
  > [If no `creator_contact`]: Report this on the plugin's GitHub repo: **<github_repo>**"

  Do NOT suggest the buyer re-enter their key or troubleshoot on their end.

- **`not_found`**: "Invalid license key. Check your key and try again. You can find it in your purchase confirmation email."
- **`revoked`**: "Your license has been revoked. Renew your subscription to regain access."
- **`expired`**: "Your license has expired. Renew to regain access."
- **Plugin not found** (plugin_slug doesn't exist): "That plugin slug wasn't found. Call `skillstack_list` to see available plugins."

### Step 7: Offer to activate another key

If the user wants to activate another key for a different plugin, loop back to Step 3. The existing `sst_*` token from Step 5 will be reused, linking all plugins to the same auth token.

### Step 8: Recommend enabling auto-updates

After setup is complete (whether the user activated a key or skipped), check if this is the user's first setup by seeing if this step has already been addressed.

Tell the user:

> "One thing to note — by default, third-party marketplaces don't auto-update. To enable auto-updates:
> 1. Run `/plugin` to open the plugin manager
> 2. Go to the **Marketplaces** tab
> 3. Select the storefront
> 4. Choose **Enable auto-update**
>
> With auto-update on, Claude Code checks for updates at startup and notifies you when new versions are available."

This step is informational — don't block on it. If the user wants to move on, let them.
