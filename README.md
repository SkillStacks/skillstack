# SkillStack Plugin for Claude Code

Set up, install, and manage paid Claude Code plugins distributed through [SkillStack](https://github.com/kenneth-liao/skillstack).

## What This Does

This plugin connects Claude Code to the SkillStack distribution system. It provides skills and MCP tools that handle:

- **Registry configuration** — points npm to the SkillStack registry
- **License activation** — validates your license key and sets up authentication
- **Plugin installation** — guides you through installing plugins from creator marketplaces
- **Update management** — checks for and applies plugin updates

## How It Works

Install SkillStack once as a standalone marketplace:

```
/plugin marketplace add https://github.com/SkillStacks/skillstack.git
/plugin install skillstack@skillstack-marketplace
```

Select **"Install for you (user scope)"** when prompted. Restart Claude Code.

Then run `/activate-license` — it configures your system, activates license keys, and gives you the exact commands to install the plugin. Follow Claude's instructions and restart when done.

## Skills

| Skill | Description |
|-------|-------------|
| `/activate-license` | Configure the SkillStack registry and activate license keys. Handles misconfigured plugin errors with creator contact info. Run this first. |
| `/install-plugin` | Guided plugin installation from a creator's marketplace. Shows creator contact for paid plugins. |
| `/update-plugins` | Check for and apply updates to your installed plugins. License-type-aware messaging. Handles npm cache cleanup automatically. |

## MCP Tools

These tools are available to Claude Code automatically via the included MCP connection:

| Tool | Description |
|------|-------------|
| `skillstack_list` | Browse all available plugins with metadata and pricing info |
| `skillstack_activate` | Validate a license key and get an auth token for paid plugins |
| `skillstack_resolve_key` | Auto-detect which plugin a license key belongs to |
| `skillstack_check_updates` | Compare installed versions against latest available |

## Prerequisites

- [Claude Code](https://claude.ai) installed
- [Node.js](https://nodejs.org) (v18+) — includes `npm`, which SkillStack uses to deliver plugin packages

## Quick Start

```
1. /plugin marketplace add https://github.com/SkillStacks/skillstack.git
2. /plugin install skillstack@skillstack-marketplace  ← select "Install for you (user scope)"
3. Restart Claude Code
4. /activate-license                                  ← follow Claude's instructions to install
5. Restart Claude Code
```

The `/activate-license` skill handles registry config, license activation, and gives you the exact storefront + install commands.

## Multi-Plugin Support

One SkillStack token works for all your purchased plugins. When you activate a second license key, `/activate-license` automatically links it to your existing token. No need to reconfigure `~/.npmrc`.

## License

MIT
