---
name: hass-cli
description: Use when working with the Home Assistant CLI (`hass-cli`) to inspect, automate, or administer Home Assistant from the command line.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.0.1"
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
5. Use `hass-cli system info` or `hass-cli raw get /api/` for a read-only connectivity check when access is needed.

## Command Syntax Is Live

The installed CLI is the source of truth. Do not infer command names, option names, option placement, or argument formats from memory, examples, another CLI, or a sibling command.

Before composing a command:

1. Run `hass-cli --version` and note the installed version.
2. Run `hass-cli --help` to confirm the command group exists.
3. Run `hass-cli GROUP --help` to confirm the subcommand exists.
4. Run `hass-cli GROUP COMMAND --help` immediately before using that command.
5. Use only arguments and options shown by the exact command help. Do not transfer options between commands without verifying them.

Global options such as `--output`, `--columns`, `--sort-by`, and `--no-headers` normally belong before the command group, for example `hass-cli --output=json state list`. If the command's help shows a different placement, follow that help.

If the CLI reports an unknown command, option, or argument, stop and inspect the relevant help output. Do not retry by guessing a spelling, changing option placement, or substituting a command from another CLI. Report the installed version and sanitized error if the supported syntax is still unclear.

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

`service call` invokes Home Assistant behavior and is the normal way to control a physical device. `state edit` writes an entity state representation and is not a replacement for turning a light, switch, climate device, or other physical entity on or off. Use `state edit` only when the user explicitly needs to alter an entity state and the exact command help confirms the intended behavior.

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
2. Check the installed version and obtain help for the exact command path before writing the command.
3. Start with read-only discovery such as `state list`, `service list`, `device list`, `area list`, or entity/integration discovery.
4. Use exact entity IDs, service names, device names, area names, and command options from discovery and help output rather than guessing.
5. Choose parseable output with `--output=json` or `--output=yaml` when consuming results programmatically, and verify that the exact command accepts the selected global option.
6. For physical device control, identify the service from `service list` and use `service call`; do not substitute `state edit`.
7. Before making changes, show the exact command and get confirmation unless the user has already explicitly requested that action.
8. After changes, verify with a read-only command such as `state get`, `area list`, `device list`, or `ha core info`.

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
