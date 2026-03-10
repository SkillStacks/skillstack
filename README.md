# SkillStack Plugin for Claude Code

Set up, install, and manage paid Claude Code plugins distributed through [SkillStack](https://github.com/kenneth-liao/skillstack).

## What This Does

This plugin connects Claude Code to the SkillStack distribution system. It provides skills and MCP tools that handle:

- **Registry configuration** — points npm to the SkillStack registry
- **License activation** — validates your license key and sets up authentication
- **Plugin installation** — guides you through installing plugins from creator storefronts
- **Update management** — checks for and applies plugin updates

## How It Works

Install SkillStack once as a standalone marketplace, then add creator storefronts separately:

```
/plugin marketplace add https://github.com/SkillStacks/skillstack.git
/plugin install skillstack@skillstack-marketplace
```

When prompted, select **"Install for you (user scope)"** — the first and recommended option.

Restart Claude Code, then run `/activate-license` to configure your system and activate license keys. After that, add creator storefronts and install plugins. SkillStack auto-detects which plugin your key belongs to.

## Skills

| Skill | Description |
|-------|-------------|
| `/activate-license` | Configure the SkillStack registry and activate license keys. Handles misconfigured plugin errors with creator contact info. Run this first. |
| `/install-plugin` | Guided plugin installation from a creator's marketplace. Shows creator contact for paid plugins. |
| `/update-plugins` | Check for and apply updates to your installed plugins. License-type-aware messaging. |

## MCP Tools

These tools are available to Claude Code automatically via the included MCP connection:

| Tool | Description |
|------|-------------|
| `skillstack_list` | Browse all available plugins with metadata and pricing info |
| `skillstack_activate` | Validate a license key and get an auth token for paid plugins |
| `skillstack_resolve_key` | Auto-detect which plugin a license key belongs to |
| `skillstack_check_updates` | Compare installed versions against latest available |

## Quick Start

```
1. /plugin marketplace add https://github.com/SkillStacks/skillstack.git      ← one-time
2. /plugin install skillstack@skillstack-marketplace  ← select "Install for you (user scope)"
3. Restart Claude Code
4. /activate-license                                     ← activates license keys
5. /plugin marketplace add <creator-storefront-url>     ← per creator
6. /plugin install <plugin-name>@<storefront-name>    ← select "Install for you (user scope)"
7. Restart Claude Code
```

The `/activate-license` skill handles all npm configuration and license activation. Paste your license key and SkillStack auto-detects which plugin it's for.

## Multi-Plugin Support

One SkillStack token works for all your purchased plugins. When you activate a second license key, `/activate-license` automatically links it to your existing token. No need to reconfigure `~/.npmrc`.

## License

MIT
