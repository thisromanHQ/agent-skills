# Client Configuration and Profiles

This fork adds a deployment-agnostic configuration convention around the
upstream Camofox CLI/API workflow. It contains no personal hosts, API keys, or
cookies.

## Files and precedence

```text
~/.camofox-browser/
├── config.json
└── .env

<project>/.camofox-browser/
├── config.json
└── .env
```

Explicit task values override project values, which override user values. For a
project, use the nearest project-root configuration only; do not walk through
unrelated parent projects. Keep `.env` files mode `0600` and ignore project
`.camofox-browser/.env`. These are client files; they do not replace the
Camofox server's deployment `.env`.

When operating through an agent, perform these checks before making a request:
resolve the selected profile, verify its endpoint, and verify the selected API
key is available. If configuration or credentials are missing, stop and ask the
user to configure them. Do not launch a server automatically. An explicitly
unauthenticated localhost request should be allowed only when the user clearly
requests that exception.

## Configuration shape

```json
{
  "defaultProfile": "local",
  "defaultUserId": "default",
  "defaultSessionKey": "default",
  "profiles": {
    "local": {
      "apiUrl": "http://localhost:9377",
      "apiKeyEnv": "CAMOFOX_LOCAL_API_KEY",
      "vncBaseUrl": "http://localhost:6080"
    },
    "remote": {
      "apiUrl": "https://browser.example.test",
      "apiKeyEnv": "CAMOFOX_REMOTE_API_KEY",
      "vncBaseUrl": "https://browser-vnc.example.test"
    }
  }
}
```

`apiKeyEnv` names an environment variable; it is not the secret itself. Resolve
only that variable for the selected profile. Do not silently substitute a key
from another profile. If the selected profile intentionally uses the generic
name `CAMOFOX_API_KEY`, that is the selected variable and is valid.

If a dotenv file is used, support only simple `KEY=VALUE` lines and comments;
do not execute shell syntax, command substitutions, or variable interpolation.
Prefer an already-exported variable over a file value and never display the
resolved value.

## Resolution and request flow

1. Read user configuration from `~/.camofox-browser/`.
2. Read the nearest project configuration, if applicable.
3. Merge profiles by name, with project values winning.
4. Select the explicit profile or `defaultProfile`.
5. Validate the selected `apiUrl` as an HTTP(S) origin and require HTTPS for
   remote hosts.
6. Resolve the selected profile's `apiKeyEnv`, preferring an already-exported
   environment variable. A dotenv file is an optional convenience and must be
   treated as data—not sourced as shell code—when the environment supports
   reading it safely.
7. Check `<apiUrl>/health` with `Authorization: Bearer $API_KEY` when configured.
8. Use that profile's API URL, user ID, and session key for every request.

Do not silently fall back from remote to localhost or vice versa. A configured
key must be sent on every protected request:

```bash
curl -fsS "$CAMOFOX_API_URL/health" \
  -H "Authorization: Bearer $CAMOFOX_API_KEY"
```

Stop and report 401/403 responses rather than retrying without the header or
switching to another profile. Do not use a global token for a project endpoint
that changed origin without explicit user approval.

## Local versus remote

- Local is normally `http://localhost:9377`; use its VNC base URL only for a
  virtual display.
- Remote uses its configured HTTPS API and VNC origins. Cloudflare Access or
  another front door may additionally protect the VNC page.
- A remote API URL does not imply that the CLI is installed locally; REST API
  operation is sufficient.
- A shared `userId` does not synchronize state between servers.

## VNC URL normalization

When `toggle-display` returns a tokenized URL with an internal hostname or
explicit port, preserve the returned `/vnc.html?...` path and token but replace
only the origin with `vncBaseUrl`. Switching display mode invalidates tab IDs
and element references: recreate the tab and take a fresh snapshot afterward.
Return the session to headless mode when finished.

## Secrets and credential vault

API keys protect HTTP routes. The upstream CLI Auth Vault is separate and stores
website credentials under `~/.camofox/vault` in encrypted files. A vault
password does not grant API access, and an API key does not decrypt vault
entries. Never put website passwords, bearer tokens, or cookies in
`config.json`.
