---
name: cloudflare-cli
description: Use when operating Cloudflare through the technical-preview `cf` CLI, including authentication, account or zone context, API resources, local resources, command discovery, and JSON output.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.0.0"
  repository: https://github.com/thisromanHQ/agent-skills
---

# Cloudflare CLI

Use this skill when the user explicitly requests the `cf` command or wants to manage Cloudflare resources with Cloudflare's unified CLI.

`cf` is a technical preview and its command surface changes quickly. Retrieve syntax from the installed CLI before composing commands. Do not rely on a memorized command catalog.

## Scope

- Use `cf` for Cloudflare-wide API resource management, authentication profiles, account and zone context, local resource access, and tasks that explicitly name the `cf` CLI.
- Use Wrangler guidance when the user explicitly requests `wrangler` or needs its established Workers development and configuration workflows.
- Do not silently translate between `cf` and `wrangler`; their command names and behavior can differ.
- Do not confuse Cloudflare's `cf` with the Cloud Foundry CLI, which uses the same executable name.

## Safety

- Never print, log, or expose `CLOUDFLARE_API_TOKEN`, OAuth credentials, token values, or other secrets.
- Do not inspect environment variable values. Check authentication with `cf auth whoami` and report sanitized errors.
- Prefer read-only discovery before making changes.
- Before a write, retrieve the exact command help and schema. Use `--dry-run` first when the command supports it.
- Ask for confirmation before destructive, irreversible, security-sensitive, billing-related, token-management, or production-impacting commands unless the user already explicitly requested that exact action.
- Prefer least-privilege API tokens and the intended named profile. Never create, rotate, or delete credentials as an incidental setup step.
- Verify account and zone context before writes. Keep `--quiet` disabled when context resolution matters.
- After a write, verify the result with an appropriate read-only `get`, `list`, or status command.

## Setup

1. Run `cf --version`. The npm package requires Node.js 22 or newer.
2. If `cf` is unavailable, ask before installing it. Upstream supports `npm install -g cf`; `npx cf` can run the preview without a global install.
3. Run `cf --help` because top-level commands and global flags may have changed.
4. Check authentication with `cf auth whoami`. If authentication is missing, use `cf auth login` for OAuth or ask the user to configure `CLOUDFLARE_API_TOKEN` without revealing its value.
5. Inspect active defaults with `cf context show` before account- or zone-scoped work.

## Source Of Truth

Use these sources in order:

1. `cf agent-context --list` to discover current product names.
2. `cf agent-context <product>` for the product's current command inventory and operational notes.
3. `cf <command-path> --help` for exact arguments, options, defaults, and enum values.
4. `cf schema <command-path>` for API path, request fields, and parameter requirements.
5. Cloudflare's API and product documentation at `https://developers.cloudflare.com/` for product semantics, permissions, limits, and behavior not explained by the CLI.

The npm package also bundles generated command and schema metadata, but use the public introspection commands instead of reading package internals. The announcement blog post explains preview status and design intent; it is not a command reference.

## Discovery Workflow

1. Identify the Cloudflare product and whether the operation is local or remote.
2. Run `cf agent-context --list` if the product name is uncertain.
3. Run `cf agent-context <product>` and select the exact command path from its output.
4. Run `cf <command-path> --help` before supplying flags.
5. For request bodies or ambiguous fields, run `cf schema <command-path>`.
6. Resolve the intended profile, account, and zone.
7. Run read-only discovery needed to obtain exact resource IDs rather than guessing.
8. For writes, dry-run when supported, execute the approved command, then verify with a read-only command.

Example discovery sequence:

```bash
cf agent-context dns
cf dns records create --help
cf schema dns records create
```

Do not treat examples from another product as proof that a flag is accepted. Confirm every final command with its own `--help` output.

## Authentication And Profiles

Credential resolution prefers `CLOUDFLARE_API_TOKEN`, then the OAuth profile selected by `--profile`, a directory profile binding, or the default profile.

```bash
cf auth whoami
cf auth list
cf auth login
cf auth create work
cf auth activate work
cf auth deactivate
```

- Use `--profile <name>` when the user identifies a profile explicitly.
- `cf auth activate <name> [dir]` binds a profile to a directory; this changes local configuration, so do it only when requested.
- Do not display stored configuration files or credential material to diagnose authentication.

## Account And Zone Context

Inspect context with:

```bash
cf context show
```

Account resolution prioritizes `CLOUDFLARE_ACCOUNT_ID`, project `.cfrc`, user configuration, then interactive or single-account selection. Zone resolution prioritizes `--zone`, `CLOUDFLARE_ZONE_ID`, project `.cfrc`, then user configuration.

Set persistent defaults only when requested:

```bash
cf context set account-id <account-id>
cf context set zone example.com --project
cf context clear zone --project
```

- `--project` writes to the project's `.cfrc`; without it, context is stored in user configuration.
- Prefer an explicit `--zone <zone-id-or-domain>` for a one-off command instead of changing persistent context.
- Re-run `cf context show` after changing defaults.

## Output And Errors

- Resource command output is JSON on stdout. Parse it directly or use `jq` for filtering.
- Status messages and errors are written to stderr.
- A non-zero exit status indicates failure; do not infer success from partial output.
- Use `--quiet` only when suppressed context and status information is safe for the task.
- On HTTP 401 errors, check `cf auth whoami`, profile selection, and required token permissions without exposing credentials.

## Local Resources

`--local` routes supported commands to the Local Explorer API exposed by a running `wrangler dev` or `cf dev` Miniflare session.

```bash
cf <command-path> --local --local-endpoint http://localhost:8787
```

- Confirm support using the command's current help and product context.
- Supply `--local-endpoint` when required by the installed version; do not assume auto-discovery is available.
- Make the local-versus-remote target explicit before every write. Never remove `--local` or substitute a remote operation silently.

## Troubleshooting

- Unknown command: refresh with `cf --help`, `cf agent-context --list`, and the relevant product context.
- Unknown option: use the exact command's `--help`; preview flags may have changed.
- Missing request field: inspect `cf schema <command-path>` and use `--body '<json>'` when the command supports a complex raw JSON body.
- Wrong account or zone: run `cf context show` and inspect explicit profile or zone overrides.
- Local connection failure: confirm the development server is running and verify `--local-endpoint`.
- Product behavior or permission uncertainty: consult the corresponding Cloudflare developer and API documentation before executing.
