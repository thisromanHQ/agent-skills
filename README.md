# Agent Skills

[![skills.sh](https://skills.sh/b/roman-pinchuk/agent-skills)](https://skills.sh/roman-pinchuk/agent-skills)
[![Validate skills](https://github.com/roman-pinchuk/agent-skills/actions/workflows/validate.yml/badge.svg)](https://github.com/roman-pinchuk/agent-skills/actions/workflows/validate.yml)

A collection of reusable skills for AI coding agents. Each skill follows the [Agent Skills](https://agentskills.io/) format and can be installed independently or as part of the collection.

## Available Skills

| Skill | Description |
| --- | --- |
| [`hass-cli`](./skills/hass-cli/) | Inspect, automate, and administer Home Assistant through the Home Assistant CLI. |
| [`memory`](./skills/memory/) | Maintain durable project knowledge through a concise `MEMORY.md` index and linked Markdown documents. |

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

## Install

### skills.sh

Install the collection:

```bash
npx skills add roman-pinchuk/agent-skills
```

Install one skill:

```bash
npx skills add roman-pinchuk/agent-skills --skill hass-cli
npx skills add roman-pinchuk/agent-skills --skill memory
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
├── hass-cli/
│   └── SKILL.md
└── memory/
    └── SKILL.md
LICENSE
README.md
skills.sh.json
```

## License

MIT. See [`LICENSE`](./LICENSE).
