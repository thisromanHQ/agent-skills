# OpenClaw Plugin Tools (18)
> Examples use `$CAMOFOX_API_URL` as a placeholder. Resolve the selected profile first and add `Authorization: Bearer $CAMOFOX_API_KEY` to protected requests.

This document describes the **OpenClaw Plugin Tools** registered in `plugin.ts`.

Important:
- These are **not MCP tools**.
- This repository exposes OpenClaw plugin registration (`api.registerTool(...)`).
- There is no MCP server implementation in this codebase.

Related:
- `../SKILL.md`
- `./api-endpoints.md`

Source of truth for development: `AGENTS.md`

## Table of Contents

1. Tool Architecture
2. Tool Catalog (18)
3. Tool-to-Endpoint Mapping
4. Operational Notes
5. Example Tool Calls

---

## 1) Tool Architecture

Plugin file: `plugin.ts`

Registration pattern:
- `api.registerTool((ctx) => ({ name, description, parameters, execute }))`

Context usage:
- `ctx.agentId` used as `userId` fallback for server calls
- `ctx.sessionKey` used when creating tabs

Transport:
- HTTP calls to server base URL (`$CAMOFOX_API_URL` default)
- JSON tool output via `content: [{ type: "text", text: ... }]`
- Screenshot tool returns image payload (`type: "image"`, base64 PNG)

---

## 2) Tool Catalog (18)

## 1. `camofox_create_tab`
Description: create new browser tab.

Parameters:
```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" }
  },
  "required": ["url"]
}
```
Execute behavior:
- Calls `POST /tabs`
- Sends `userId` and `sessionKey`

Return type: text JSON tool result.

## 2. `camofox_snapshot`
Description: accessibility snapshot with `eN` refs and pagination metadata.

Parameters:
- `tabId` (required)
- `offset` (optional number)

Execute behavior:
- Calls `GET /tabs/:tabId/snapshot?userId=...&offset=...`
- Formats output text with URL, refs count, truncation fields, snapshot body

## 3. `camofox_click`
Description: click by `ref` or CSS selector.

Parameters:
- `tabId` (required)
- `ref` (optional)
- `selector` (optional)

Execute behavior:
- Calls `POST /tabs/:tabId/click`

## 4. `camofox_type`
Description: type text into element.

Parameters:
- `tabId` (required)
- `text` (required)
- `ref` (optional)
- `selector` (optional)
- `pressEnter` (optional boolean)

Execute behavior:
- Calls `POST /tabs/:tabId/type`
- If `pressEnter` is true, then calls `POST /tabs/:tabId/press` with `key: "Enter"`

## 5. `camofox_navigate`
Description: navigate by URL or macro.

Parameters:
- `tabId` (required)
- `url` (optional)
- `macro` (optional enum)
- `query` (optional)

Macro enum listed in plugin:
- `@google_search`
- `@youtube_search`
- `@amazon_search`
- `@reddit_search`
- `@reddit_subreddit`
- `@wikipedia_search`
- `@twitter_search`
- `@yelp_search`
- `@spotify_search`
- `@netflix_search`
- `@linkedin_search`
- `@instagram_search`
- `@tiktok_search`
- `@twitch_search`

Execute behavior:
- Calls `POST /tabs/:tabId/navigate`

## 6. `camofox_go_back`
Parameters:
- `tabId` (required)

Execute behavior:
- Calls `POST /tabs/:tabId/back`

## 7. `camofox_go_forward`
Parameters:
- `tabId` (required)

Execute behavior:
- Calls `POST /tabs/:tabId/forward`

## 8. `camofox_refresh`
Parameters:
- `tabId` (required)

Execute behavior:
- Calls `POST /tabs/:tabId/refresh`

## 9. `camofox_scroll`
Parameters:
- `tabId` (required)
- `direction` (required enum: `up|down|left|right`)
- `amount` (optional number)

Execute behavior:
- Calls `POST /tabs/:tabId/scroll`

## 10. `camofox_screenshot`
Parameters:
- `tabId` (required)

Execute behavior:
- Calls `GET /tabs/:tabId/screenshot?userId=...`
- Converts response bytes to base64 image output

Return type:
```json
{
  "content": [{ "type": "image", "data": "<base64>", "mimeType": "image/png" }]
}
```

## 11. `camofox_close_tab`
Parameters:
- `tabId` (required)

Execute behavior:
- Calls `DELETE /tabs/:tabId?userId=...`

## 12. `camofox_list_tabs`
Parameters:
- none

Execute behavior:
- Calls `GET /tabs?userId=...`

## 13. `camofox_import_cookies`
Description: import Netscape cookie file into session.

Parameters:
- `cookiesPath` (required)
- `domainSuffix` (optional)

Execute behavior:
- Parses cookies from file via plugin helper
- Calls `POST /sessions/:userId/cookies` (attaches bearer auth when `CAMOFOX_API_KEY` is configured)

## Console & Error Capture

| Tool | Description |
|---|---|
| `camofox_console` | Get console messages from a tab |
| `camofox_errors` | Get page errors from a tab |
| `camofox_console_clear` | Clear console and error buffers for a tab |

## Tracing

| Tool | Description |
|---|---|
| `camofox_trace_start` | Start Playwright trace recording |
| `camofox_trace_stop` | Stop tracing and save trace ZIP file |

---

## 3) Tool-to-Endpoint Mapping

| Tool | Endpoint |
|---|---|
| `camofox_create_tab` | `POST /tabs` |
| `camofox_snapshot` | `GET /tabs/:tabId/snapshot` |
| `camofox_click` | `POST /tabs/:tabId/click` |
| `camofox_type` | `POST /tabs/:tabId/type` |
| `camofox_navigate` | `POST /tabs/:tabId/navigate` |
| `camofox_go_back` | `POST /tabs/:tabId/back` |
| `camofox_go_forward` | `POST /tabs/:tabId/forward` |
| `camofox_refresh` | `POST /tabs/:tabId/refresh` |
| `camofox_scroll` | `POST /tabs/:tabId/scroll` |
| `camofox_screenshot` | `GET /tabs/:tabId/screenshot` |
| `camofox_close_tab` | `DELETE /tabs/:tabId` |
| `camofox_list_tabs` | `GET /tabs` |
| `camofox_import_cookies` | `POST /sessions/:userId/cookies` |
| `camofox_console` | `GET /tabs/:tabId/console` |
| `camofox_errors` | `GET /tabs/:tabId/errors` |
| `camofox_console_clear` | `POST /tabs/:tabId/console/clear` |
| `camofox_trace_start` | `POST /tabs/:tabId/trace/start` |
| `camofox_trace_stop` | `POST /tabs/:tabId/trace/stop` |

---

## 4) Operational Notes

- Plugin can auto-start server (`autoStart: true` default).
- Fallback `userId` is generated (`camofox-<uuid>`) when agent context has no id.
- Health check and RPC methods are also registered (`camofox.health`, `camofox.status`), but these are plugin-level integrations, separate from tool catalog.
- If you need strict production reliability, verify route availability against `src/routes/*.ts` before using optional plugin tools.

Catalog size note:
- OpenClaw plugin currently defines 18 tools.

Compatibility boundaries:
- Tool names are fixed with `camofox_` prefix and are intended for OpenClaw-compatible agent runtimes.
- These tools are not exposed as MCP method names in this repository.
- Tool transport assumes HTTP JSON server responses; endpoint schema drift may affect output shapes.

Security notes:
- `camofox_import_cookies` sends bearer auth when `CAMOFOX_API_KEY` is configured; the server conditionally enforces the guard.
- `camofox_close_tab` includes `userId` via query string in plugin implementation.

---

## 5) Example Tool Calls

Examples below are conceptual payloads sent by an OpenClaw-compatible host.

Create tab:
```json
{
  "tool": "camofox_create_tab",
  "input": { "url": "https://example.com" }
}
```

Snapshot:
```json
{
  "tool": "camofox_snapshot",
  "input": { "tabId": "<tabId>", "offset": 0 }
}
```

Click:
```json
{
  "tool": "camofox_click",
  "input": { "tabId": "<tabId>", "ref": "e7" }
}
```

Type:
```json
{
  "tool": "camofox_type",
  "input": { "tabId": "<tabId>", "ref": "e3", "text": "hello" }
}
```

Navigate with macro:
```json
{
  "tool": "camofox_navigate",
  "input": { "tabId": "<tabId>", "macro": "@google_search", "query": "camofox" }
}
```

Scroll:
```json
{
  "tool": "camofox_scroll",
  "input": { "tabId": "<tabId>", "direction": "down", "amount": 600 }
}
```

Import cookies:
```json
{
  "tool": "camofox_import_cookies",
  "input": { "cookiesPath": "/path/to/cookies.txt", "domainSuffix": "linkedin.com" }
}
```

