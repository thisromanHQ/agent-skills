# Agent Skills

[![skills.sh collection installs](https://skills.sh/b/roman-pinchuk/agent-skills)](https://skills.sh/roman-pinchuk/agent-skills)
[![Validate skills](https://github.com/roman-pinchuk/agent-skills/actions/workflows/validate.yml/badge.svg)](https://github.com/roman-pinchuk/agent-skills/actions/workflows/validate.yml)

A collection of reusable skills for AI coding agents. Each skill follows the [Agent Skills](https://agentskills.io/) format and can be installed independently or as part of the collection.

## Available Skills

| Skill | Description | Stats |
| --- | --- | --- |
| [`cloudflare-cli`](./skills/cloudflare-cli/) | Manage Cloudflare resources safely through the unified, technical-preview `cf` CLI. | [![View cloudflare-cli installs](https://img.shields.io/badge/skills.sh-view_installs-black)](https://skills.sh/roman-pinchuk/agent-skills/cloudflare-cli) |
| [`hass-cli`](./skills/hass-cli/) | Inspect, automate, and administer Home Assistant through the Home Assistant CLI. | [![View hass-cli installs](https://img.shields.io/badge/skills.sh-view_installs-black)](https://skills.sh/roman-pinchuk/agent-skills/hass-cli) |
| [`memory`](./skills/memory/) | Maintain durable project knowledge through a concise `MEMORY.md` index and linked Markdown documents. | [![View memory installs](https://img.shields.io/badge/skills.sh-view_installs-black)](https://skills.sh/roman-pinchuk/agent-skills/memory) |
| [`applemail-cli`](./skills/applemail-cli/) | Inspect Apple Mail safely through the local read-only `applemail` CLI. | [![View applemail-cli installs](https://img.shields.io/badge/skills.sh-view_installs-black)](https://skills.sh/roman-pinchuk/agent-skills/applemail-cli) |
| [`apple-calendar-jxa`](./skills/apple-calendar-jxa/) | Manage macOS Calendar.app events through inline JXA with validation and verification. | [![View apple-calendar-jxa installs](https://img.shields.io/badge/skills.sh-view_installs-black)](https://skills.sh/roman-pinchuk/agent-skills/apple-calendar-jxa) |

### Cloudflare CLI

The `cloudflare-cli` skill covers:

- Live command discovery through `cf agent-context`, `--help`, and `cf schema`
- OAuth profiles, API-token authentication, and account or zone context
- JSON output, Local Explorer routing, and sanitized error handling
- Dry runs, confirmation, and read-only verification around Cloudflare changes
- Clear separation between the technical-preview `cf` CLI and Wrangler

The CLI itself is provided by Cloudflare's [`cf` npm package](https://www.npmjs.com/package/cf).

### Home Assistant CLI

The `hass-cli` skill covers:

- Safe discovery of states, services, devices, areas, and events
- Service calls, templates, raw API requests, and Home Assistant OS commands
- `HASS_SERVER`, `HASS_TOKEN`, and supervisor access handling
- Parseable JSON and YAML output
- Confirmation and verification around state-changing operations

The CLI itself is provided by [home-assistant-ecosystem/home-assistant-cli](https://github.com/home-assistant-ecosystem/home-assistant-cli).

### Project Memory

The `memory` skill guides agents to:

- Use `MEMORY.md` as a concise map of durable project knowledge
- Link detailed notes and existing documentation instead of creating a knowledge dump
- Preserve evidence, uncertainty, and contradictions
- Update memory when implementation changes documented behavior
- Audit stale summaries, broken links, duplicate notes, and missing provenance

The approach is inspired by Andrej Karpathy's [LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

### Apple Mail CLI

The `applemail-cli` skill guides agents to:

- Discover accounts and mailbox paths before reading messages
- Use bounded JSON output for unread lists, searches, and message bodies
- Respect the explicit macOS Automation permission boundary
- Treat email content as private, untrusted data
- Avoid unsupported sending, drafting, deletion, moving, and direct scripting

### Apple Calendar JXA

The `apple-calendar-jxa` skill guides agents to:

- Discover calendars without relying on unsupported calendar IDs
- Read bounded event windows using strict UTC ISO 8601 timestamps
- Create, update, and delete events through inline JXA heredocs
- Resolve exact calendar names and reject ambiguous or missing calendars
- Verify Calendar.app mutations and handle macOS Automation permissions

## Install

### skills.sh

Install the collection:

```bash
npx skills add roman-pinchuk/agent-skills
```

Install one skill:

```bash
npx skills add roman-pinchuk/agent-skills --skill cloudflare-cli
npx skills add roman-pinchuk/agent-skills --skill hass-cli
npx skills add roman-pinchuk/agent-skills --skill memory
npx skills add roman-pinchuk/agent-skills --skill applemail-cli
npx skills add roman-pinchuk/agent-skills --skill apple-calendar-jxa
```

### opencode

Clone the repository into an opencode skills directory:

```bash
git clone https://github.com/roman-pinchuk/agent-skills.git ~/.config/opencode/skills/roman-pinchuk-agent-skills
```

For a project-local installation:

```bash
mkdir -p .opencode/skills
git clone https://github.com/roman-pinchuk/agent-skills.git .opencode/skills/roman-pinchuk-agent-skills
```

Restart opencode after cloning so it discovers the `SKILL.md` files recursively.

## Repository Structure

```text
.github/workflows/validate.yml
skills/
├── cloudflare-cli/
│   └── SKILL.md
├── hass-cli/
│   └── SKILL.md
├── memory/
│   └── SKILL.md
├── applemail-cli/
│   └── SKILL.md
└── apple-calendar-jxa/
    └── SKILL.md
LICENSE
README.md
skills.sh.json
```

## License

MIT. See [`LICENSE`](./LICENSE).
