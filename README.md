# SkillStack Plugin for Claude Code

Set up, install, and manage paid Claude Code plugins distributed through [SkillStack](https://github.com/kenneth-liao/skillstack).

## What This Does

This plugin connects Claude Code to the SkillStack distribution system. It provides skills and MCP tools that handle:

- **Registry configuration** — points npm to the SkillStack registry
- **License activation** — validates your Polar.sh license key and sets up authentication
- **Plugin installation** — guides you through installing plugins from creator storefronts
- **Update management** — checks for and applies plugin updates

## How It Works

Creator storefronts automatically include this plugin, so you get it when you add any SkillStack-powered marketplace. No manual installation needed.

```
/plugin marketplace add https://github.com/<creator>/storefront
```

Once installed, run `/setup` to configure your system and activate any license keys you have.

## Skills

| Skill | Description |
|-------|-------------|
| `/setup` | Configure the SkillStack registry and activate license keys. Run this first. |
| `/install-plugin` | Guided plugin installation from a creator's marketplace. |
| `/update-plugins` | Check for and apply updates to your installed plugins. |

## MCP Tools

These tools are available to Claude Code automatically via the included MCP connection:

| Tool | Description |
|------|-------------|
| `skillstack_list` | Browse all available plugins with metadata and pricing info |
| `skillstack_activate` | Validate a license key and get an auth token for paid plugins |
| `skillstack_check_updates` | Compare installed versions against latest available |

## Quick Start

**Free plugins:**

```
1. /plugin marketplace add <creator-storefront-url>
2. /setup
3. /plugin install <plugin-name>@<marketplace-name>
```

**Paid plugins:**

```
1. /plugin marketplace add <creator-storefront-url>
2. /setup                          ← activates your Polar.sh license key
3. /plugin install <plugin-name>@<marketplace-name>
```

The `/setup` skill handles all the npm configuration and license activation — you just provide your license key when prompted.

## Multi-Plugin Support

One SkillStack token works for all your purchased plugins. When you activate a second license key, `/setup` automatically links it to your existing token. No need to reconfigure `~/.npmrc`.

## License

MIT
