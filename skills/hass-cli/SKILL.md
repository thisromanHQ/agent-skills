---
name: hass-cli
description: Use when working with the Home Assistant CLI (`hass-cli`) to inspect, automate, or administer Home Assistant from the command line.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.0.0"
  repository: https://github.com/roman-pinchuk/agent-skills
---

# Home Assistant CLI

Use this skill when the user wants to interact with Home Assistant through the upstream `hass-cli` command-line tool from `home-assistant-ecosystem/home-assistant-cli`.

## When To Use

Use this skill for requests involving `hass-cli`, Home Assistant CLI, Home Assistant command-line automation, entities, states, services, devices, areas, events, templates, raw API calls, or Home Assistant Operating System supervisor/core commands.

Do not use this skill for the separate `ha` command-line tool unless the user specifically asks to use `hass-cli ha ...` commands.

## Safety

- Never print or expose `HASS_TOKEN`, `HASS_SUPERVISOR_TOKEN`, `HASS_PASSWORD`, long-lived access tokens, or API keys.
- Do not read, print, dump, or expose environment variables. Avoid commands such as `env`, `printenv`, `export`, `set`, `declare`, or `echo $HASS_TOKEN`. Never inspect token values directly.
- When checking Home Assistant access, run `hass-cli` commands and report success or sanitized errors. If authentication appears missing, ask the user to confirm that `HASS_SERVER`, `HASS_TOKEN`, or `HASS_SUPERVISOR_TOKEN` are set without revealing their values.
- Prefer read-only discovery commands before making changes.
- Ask for confirmation before commands that change state, call services, update/delete areas, assign devices, create backups, update Home Assistant Core, or use `raw` endpoints with non-GET behavior.
- Avoid `--insecure` unless the user explicitly accepts connecting with ignored TLS certificate validation.
- Use `--output=json` or `--output=yaml` for data that will be parsed or summarized.

## Setup Checks

1. Check whether `hass-cli` is installed with `hass-cli --version`.
2. If missing, suggest one upstream-supported install method: `pip install homeassistant-cli`, `brew install homeassistant-cli`, `dnf install home-assistant-cli`, NixOS package, or Docker.
3. Confirm connection configuration without revealing secrets. `hass-cli` uses `HASS_SERVER` and `HASS_TOKEN`, or `--server` and `--token` per command.
4. For Home Assistant Operating System `hass-cli ha ...` commands, verify that supervisor access is available through `HASS_SUPERVISOR_TOKEN` or `--supervisor-token`.
5. Use `hass-cli --help` and subcommand `--help` output when command syntax is uncertain.

## Common Commands

Read-only commands:

```bash
hass-cli config release
hass-cli state list
hass-cli state get light.example
hass-cli service list
hass-cli device list
hass-cli area list
hass-cli event watch
hass-cli ha core info
hass-cli ha supervisor info
```

State and service changes:

```bash
hass-cli service call homeassistant.toggle --arguments entity_id=light.office_light
hass-cli service call backup.create
hass-cli state edit sensor.test --json='{ "state": "off" }'
```

Formatting and filtering:

```bash
hass-cli --output=json state get light.example
hass-cli --output=yaml service list homeassistant.toggle
hass-cli --no-headers state list
hass-cli --columns=ENTITY=entity_id,STATE=state state list light
hass-cli --sort-by last_changed state history --since 50m light.kitchen
```

Templates and raw API:

```bash
hass-cli template motionlight.yaml.j2 motiondata.yaml
hass-cli template --local lovelace-template.yaml
hass-cli raw get /api/
```

## Workflow

1. Identify whether the task is inspection, automation, configuration, or administration.
2. Start with discovery commands such as `state list`, `service list`, `device list`, `area list`, or the relevant `--help` command.
3. Use exact entity IDs, service names, device names, or area names from discovery output rather than guessing.
4. Choose parseable output with `--output=json` or `--output=yaml` when consuming results programmatically.
5. Before making changes, show the exact `hass-cli` command and get confirmation unless the user has already explicitly requested that action.
6. After changes, verify with a read-only command such as `state get`, `area list`, `device list`, or `ha core info`.

## Command Groups

- `config`: configuration and release information.
- `state`: list, inspect, edit, and view history for entity states.
- `service`: list and call Home Assistant services.
- `area`: list, create, and delete areas.
- `device`: list devices and assign devices to areas.
- `entity`: inspect entity registry data.
- `event`: watch Home Assistant events.
- `integration`: inspect and operate on config entries.
- `map`: open the Home Assistant location or entity location on a map.
- `template`: render templates on the server or locally.
- `raw`: call Home Assistant API endpoints directly; treat as advanced and confirm before modifying calls.
- `ha`: Home Assistant Operating System commands for supervisor/core operations; requires supervisor token access.

## Notes

- `hass-cli` defaults to table or auto output; use `--output=json`, `--output=yaml`, or `--output=ndjson` when reliability matters.
- `--columns` uses JSONPath expressions such as `ENTITY=entity_id` and `NAME=attributes.friendly_name`.
- `--sort-by` sorts by underlying JSON/YAML properties, not displayed table column names.
- Autocompletion can be enabled with `_HASS_CLI_COMPLETE` for bash, zsh, or fish, but do not modify shell startup files unless the user asks.
