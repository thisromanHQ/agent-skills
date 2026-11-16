---
name: cloudflare-cli
description: Use when operating Cloudflare through its unified `cf` CLI, including command discovery, authentication, account and zone selection, API resources, local simulations, and Workers static-site deployment or custom domains. Consult this skill for `cf` tasks even when a command looks familiar; the CLI changes quickly.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.1.0"
  repository: https://github.com/thisromanHQ/agent-skills
---

# Cloudflare CLI

Retrieve syntax from the actual CLI version you will execute. The unified Cloudflare CLI changes quickly, and older previews differ substantially from current releases.

## Scope

- Use `cf` for Cloudflare API resources, Workers deployment, authentication profiles, account/zone selection, and supported local simulations.
- Do not confuse Cloudflare's `cf` with Cloud Foundry. Cloudflare also provides the `cloudflare` executable.
- Do not silently replace a requested `cf` workflow with direct Wrangler commands. `cf` can delegate builds to Wrangler or Vite; explain that distinction when relevant.
- When the user explicitly requests Wrangler, use its current documentation and configuration rather than translating flags by analogy.

## Safety

- Never print, log, or expose tokens, OAuth credentials, cookies, secret files, or environment variable values. Use authentication status and sanitized errors instead.
- Keep command and documentation search queries anonymous: describe only the action and resource type. Exclude domains, names, email addresses, resource/account IDs, and credentials.
- Prefer read-only discovery. Verify the intended account, zone, profile, and local-versus-remote target before writes.
- Read the exact command help before a write and the schema for API mutations. High-level build/deploy commands may have no API schema; use their help and official project documentation instead.
- Dry-run first when supported. A dry run of a project command can still install dependencies or change local configuration; it is not necessarily filesystem-read-only.
- Ask before destructive, security-sensitive, billing-related, credential-management, or production-impacting actions unless the user explicitly approved that exact change.
- General approval to deploy or bind a hostname is not approval to delete conflicting DNS records. Identify the records and request explicit replacement approval first.
- Never create, rotate, or delete credentials as incidental setup. Do not change persistent profile/account defaults without approval.
- Verify mutations with a read-only API command and, where relevant, an actual HTTP request. Report partial failures without claiming success.

## Setup And Version Selection

1. Run `cf --version`, `node --version`, and `command -v cf`. Check project dependencies before assuming which CLI will run.
2. A project-local `cf` may differ from the global installation. Current global `cf` can delegate to the project version; `npx cf` can also select it. Verify the version from the intended working directory and use that executable consistently.
3. If installation or upgrading is necessary, ask first. Use `npm install -g cf@latest` for an approved global upgrade, or a project-local dependency for an approved project setup. Do not silently upgrade global tools or Node.js.
4. Check the target package's current Node `engines` requirement, for example with `npm view cf@latest engines --json`. A supported major alone may not suffice: minor-version minimums also matter.
5. Read `cf --help` once to identify capabilities. Older previews may lack modern search commands; report the mismatch instead of repeatedly running nonexistent commands.
6. Check `cf auth whoami`; summarize status, account names, and permissions only as needed. Never dump credential configuration.

## Command And Documentation Discovery

Use this order on current releases:

1. `cf cli search "<anonymous task>"` for up to five candidate commands.
2. Select the relevant result and run its exact `--help` for arguments, defaults, and enum values. Avoid chains of nested help calls or repeated near-identical searches.
3. `cf schema <command-path>` for API endpoint, path/query parameters, request fields, and body shape.
4. `cf docs search "<anonymous question>"` for product semantics and project configuration. Fetch a returned documentation URL with `Accept: text/markdown`, or use the available documentation-fetching tool.
5. Consult official `https://developers.cloudflare.com/` documentation for anything the installed CLI does not explain.

Example:

```bash
cf cli search "create a DNS record"
cf dns records create --help
cf schema dns records create
```

Search discovers commands; actual resource operations use the verified IDs and explicit target. Never put those identifying values into discovery search queries.

Do not assume `cf agent-context`, `cf context show`, or `.cfrc` exists. These are not the current discovery/account workflow. If modern search is unavailable, inspect the installed CLI's top-level help and official version-appropriate docs, or propose an upgrade.

Prefer public CLI introspection over reading generated package internals. Do not treat announcements as command references.

## Authentication And Profiles

Credentials resolve from `CLOUDFLARE_API_TOKEN`, then an explicit `--profile`, a directory-bound profile, or the default profile. Current `cf` has its own login; do not assume Wrangler credentials are reused.

- Inspect with `cf auth whoami` and `cf auth list` after checking their help.
- If unauthenticated, explain the OAuth flow and use `cf auth login` with approval. Discover current flags for remote/no-browser login instead of guessing.
- Use the requested `--profile <name>` for one-off operations.
- Profile creation, activation, deactivation, and deletion are writes. Directory bindings affect subdirectories; change them only when requested.
- An environment token takes precedence over profiles. Diagnose precedence without printing its value or changing credentials.
- Keep `.env` and other credential files out of source control and public asset directories.

## Account And Zone Selection

Current account selection order:

1. `CLOUDFLARE_ACCOUNT_ID`
2. `accountId` in `cloudflare.config.ts`
3. A cached project account
4. Single-account selection or an interactive choice

Non-interactive commands can fail when several accounts exist and none is selected. Prefer a command-scoped account environment assignment for an approved one-off target, or an explicitly approved `accountId` in project configuration. Do not read or change stored credential files.

Zone-scoped commands use `--zone <zone-id-or-domain>` / `-z`, taking precedence over `CLOUDFLARE_ZONE_ID`. A domain lookup is scoped to the selected account. Verify the zone belongs to the intended account before mutating it.

`cloudflare.config.ts` can execute code and imports when loaded, even for API commands. Inspect unfamiliar project configuration before executing commands in that directory. Do not run untrusted configurations or installation scripts casually.

## Static Sites And Workers Deployment

1. Discover the installed deployment command and inspect its help. Current releases support `cf deploy [directory]` for prebuilt static assets; code-backed projects use a delegated build.
2. Inventory public files. Use an allowlisted asset directory, excluding original/private documents, obsolete PDFs, test artifacts, secrets, source configuration, and dependencies.
3. Inspect existing project configuration and build tooling. `cloudflare.config.ts` holds Worker/account settings; its `worker.assets` configures runtime routing, not the asset source directory. Vite supplies build assets; Wrangler-backed projects can use `wrangler.config.ts` with `assetsDirectory`. Follow current documentation, not guessed Wrangler JSON fields in cf config.
4. Beware automatic configuration: without `cloudflare.config.ts`, project commands including `cf deploy --dry-run` may create files and install packages without prompting in non-interactive environments. Review and approve the intended local changes first.
5. A pure static site needs no backend Worker script. Do not add one just to serve files. Avoid introducing paid bindings or services as incidental setup.
6. Run the confirmed dry-run command, then deploy only to the approved target. Deploying on workers.dev is publicly reachable, not private access control. Verify the account subdomain; do not claim it is absent solely from a stale CLI error or guess outdated dashboard onboarding URLs.
7. Verify the reported deployment through a read-only Worker list/get and HTTPS requests for the page, images, CV/downloads, and SEO files. A successful upload is not proof of working TLS.
8. Protect public previews from indexing with response headers; JavaScript-inserted robots metadata alone is insufficient. Scope `X-Robots-Tag: noindex` to preview hosts, and verify the production response does not inherit it.
9. Report the URL and distinguish uploaded, bound, HTTPS-verified, and still-pending states.

Only static asset requests/storage are free under the documented static-assets pricing. Do not generalize that to backend invocations, paid plans, or domain registration.

## Custom Domains And DNS Conflicts

- Inventory current DNS and Worker/domain bindings before changes. Save a targeted rollback snapshot outside public assets and source control.
- Bind only approved hostnames. Treat apex, `www`, and wildcard names separately; do not silently bind or redirect the others.
- Current configuration supports `worker.domains` for custom domains. Confirm current syntax and dry-run before deployment.
- If A/AAAA/CNAME records conflict, stop and explain which records need replacing. Obtain explicit approval, inspect delete/create help and schemas, and dry-run supported API mutations before applying them.
- Preserve MX, SPF, DKIM, DMARC, verification records, and unrelated hostnames. Do not bulk-delete a zone's records.
- If deployment partially applies triggers or DNS, inspect the result before retrying; keep enough data to restore approved removed records if binding fails.
- Verify the bound hostname through Cloudflare's API and HTTPS, confirm production indexing headers, and compare mail/unrelated DNS records with the snapshot.

## Local Resources

Current supported `--local` commands can start a short-lived local runtime; a running dev server is not a universal prerequisite.

- Discover support through exact help and current docs. Not every API command has a local equivalent; D1 `raw` may support local execution where `query` does not.
- Use `--persist-to` when an explicit local state directory is needed. State defaults and dev-server state locations can differ by version/tool.
- Do not assume `--local-endpoint` exists. Supply it only when the installed command documents it.
- Keep local and remote targets explicit. Never remove `--local` or fall back to remote writes after a local error without approval.

## Output And Troubleshooting

- API commands generally emit JSON on stdout; progress, pagination metadata, and status can appear on stderr. Build/deploy commands may emit human-readable progress rather than a JSON result.
- Parse structured stdout directly. Do not infer success from partial output or suppress context diagnostics while resolving a target.
- Unknown command/flag: recheck version and current discovery/help; do not keep guessing renamed commands.
- Missing API request field: inspect `cf schema` and use `--body` or file input only when exact help supports it.
- 401: verify authentication/profile/permissions without exposing credentials.
- Multiple accounts: explicitly resolve account selection; do not assume a zone flag selects the account.
- Build-output mismatch: check CLI/build-tool versions and declared dependencies. Propose a scoped upgrade rather than silently modifying global tools.
- TLS/hostname failure: inspect binding and certificate status; report that verification is pending. Never disable TLS validation to claim success.

## Official References

- Getting started, credentials, account and zone selection: https://developers.cloudflare.com/cf/get-started/
- Build/deploy and local simulations: https://developers.cloudflare.com/cf/projects/
- Programmatic configuration: https://developers.cloudflare.com/cf/projects/cloudflare-config/
- Static asset pricing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
