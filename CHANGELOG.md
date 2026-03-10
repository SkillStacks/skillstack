# Changelog

All notable changes to the SkillStack buyer plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.5.0] - 2026-03-10

### Changed

- **`/activate-license`**: Now shows the exact `/plugin install` command after activation when the storefront is known (from `install_command` field in worker response), instead of generic placeholder instructions

## [1.4.1] - 2026-03-10

### Changed

- **Custom domain**: All registry and MCP URLs updated from `skillstack-mcp.kennyliao22.workers.dev` to `mcp.skillstack.sh`

## [1.4.0] - 2026-03-10

### Changed

- **Renamed `/setup` to `/activate-license`** — more descriptive and avoids collisions with other plugins' setup skills
- All cross-references in `/install-plugin` and `/update-plugins` updated to use `/activate-license`

## [1.3.0] - 2026-03-10

### Added

- **Standalone marketplace** — SkillStack is now its own marketplace (`/plugin marketplace add SkillStacks/skillstack`), no longer bundled in every creator's storefront
- **Auto-resolve license keys** in `/activate-license` — Step 4 now calls `skillstack_resolve_key` to automatically detect which plugin a key belongs to, eliminating the "which plugin is this key for?" question
- **`skillstack_resolve_key` MCP tool** — three-phase resolution: DB lookup, Lemon Squeezy product_id match, Polar org enumeration

### Changed

- `/activate-license` Step 2 updated wording to "storefront marketplace" language
- `/activate-license` Step 4 no longer calls `skillstack_list` for plugin identification

## [1.2.0] - 2026-03-07

### Added

- **Misconfigured plugin handling** in `/setup` — when a plugin's license config is broken (e.g., missing store_id), buyers now see a clear message that it's NOT their license key, with creator contact info or GitHub repo link
- **`creator_contact` display** in `/install-plugin` — shows creator's support email/URL for paid plugins so buyers can reach them with purchase or license questions
- **`expired` status handling** in `/setup` — distinct message for expired licenses (previously lumped with generic errors)

## [1.1.0] - 2026-03-07

### Added

- **Multi-license support** in `/install-plugin` — displays available purchase options (one-time, lifetime, subscription) with a comparison table when a plugin offers multiple license types
- **License-type-aware update messaging** in `/update-plugins` — shows per-buyer context (subscription includes update, one-time locked to version, lifetime includes all updates)
- **License upgrade detection** in `/update-plugins` — notifies one-time buyers when a lifetime upgrade is available
- **403 error handling** in `/install-plugin` — guides users who have a SkillStack token but haven't activated a license for the specific plugin

### Changed

- `/setup` Step 3 now provides provider-agnostic key hints (Polar.sh, Lemon Squeezy) instead of generic text
- `/setup` Step 6 shows license-type-specific activation messages (subscription, lifetime, one-time)
- `/install-plugin` Step 4 corrected marketplace name from `@skillstack` to `@<marketplace-name>`
- `/update-plugins` Step 3 corrected marketplace name from `@skillstack` to `@<marketplace-name>`

### Fixed

- Fixed "Polar key" reference in `/setup` Step 6 to provider-agnostic "license key"

## [1.0.0] - 2026-02-20

### Added

- Initial release with `/setup`, `/install-plugin`, and `/update-plugins` skills
- MCP tools: `skillstack_list`, `skillstack_activate`, `skillstack_check_updates`
- Freemium plugin support with variant detection and upgrade flow
