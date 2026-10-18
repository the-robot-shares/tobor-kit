# Backend requirements — noizu-model-config

None required.

This island is host-only. It does not persist settings, set cookies, redirect,
or attach `Authorization`. Optional `catalog-url` is a GET the host may point
at its own catalog. Events are the persistence API.

## What the component does

| Input | Behavior |
|---|---|
| `catalog` property | Render picker options. Wins over `catalog-url` when nonempty. |
| `catalog-url` | `GET` JSON, `Accept: application/json`, `credentials: 'same-origin'`. No bearer header. |
| Events | Host writes its settings store. |

## Catalog GET (optional)

```
GET {catalog-url}
Accept: application/json
credentials: same-origin
```

**200** — one of:

```json
[{ "provider": "openai", "model": "gpt-4o", "label": "GPT-4o" }]
```

```json
{
  "models": [
    {
      "provider": "openrouter",
      "model": "stealth/ox-alpha",
      "label": "stealth/ox-alpha (default)",
      "spec": "openrouter:stealth/ox-alpha"
    }
  ]
}
```

`catalog` / `entries` keys are also accepted. Unknown / failed GET → empty
picker + error notice. Abort is silent.

Optional custom echo (masked key only):

```json
{
  "models": [],
  "custom": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "apiKey": "••••1234"
  }
}
```

`customEndpoint` / `custom_endpoint`, `base_url`, and `api_key` aliases are
accepted. If the body echoes `••••1234`, the key field displays that mask.
**Never return a live key in GET JSON.**

## Host persistence (example, not a kit dependency)

The kit does **not** call a settings API. A host such as TRK
(therobotknows.com) can persist events with this shape:

### `GET /api/v1/ai/settings`

Session or bearer is **host-owned** (not sent by the element).

**200**

```json
{
  "ai": {
    "model": "openai:gpt-4o",
    "monthly_budget_cents": 1000,
    "used_cents": 0,
    "custom_endpoint": {
      "base_url": "https://api.openai.com/v1",
      "model": "gpt-4o-mini",
      "api_key": "••••1234"
    }
  }
}
```

Map `ai.model` → `value`, `ai.monthly_budget_cents` → `budget`. Empty /
`"inherit"` / `"default"` at a nested scope is host inherit
(nearest-ancestor-wins).

### `PATCH /api/v1/ai/settings`

```json
{
  "ai": {
    "model": "anthropic:claude-3-5",
    "monthly_budget_cents": 1500,
    "custom_endpoint": {
      "base_url": "https://api.openai.com/v1",
      "model": "local-7b",
      "api_key": ""
    }
  }
}
```

| Event | Host write |
|---|---|
| `model-change` `{value}` | `ai.model` (`""` = inherit at this layer) |
| `budget-change` `{amount}` | `ai.monthly_budget_cents` (or whatever unit the host uses) |
| `custom-endpoint-save` `{baseUrl, model, apiKey}` | `ai.custom_endpoint`. **`apiKey: ''` means keep the stored key** — do not overwrite with empty. |

### `GET /api/v1/ai/models`

Optional `catalog-url`. TRK:

```json
{
  "models": [{ "provider": "qwen", "model": "qwen3.8-max", "label": "qwen3.8-max", "spec": "qwen:qwen3.8-max" }],
  "default": { "provider": "openrouter", "model": "stealth/ox-alpha" }
}
```

The island ignores `default`; the host may seed `value`.

### Status codes (host)

| Status | Typical |
|---|---|
| 200 | GET/PATCH ok |
| 401 | Missing host session — island is not involved |
| 400 / 422 | Invalid body — host surfaces the error |

## Auth

Not this element's job. `catalog-url` sends cookies only on same-origin
requests. Do not put provider API keys, session cookies, or bearer tokens on
the tag.

## What the component does not do

- Persist settings (no `localStorage`, no PATCH)
- `Set-Cookie`, CSRF, payment, redirects
- Authorization headers
- Nearest-ancestor resolution (host owns inherit)
- Logging `apiKey` (plaintext or masked)

## Production vs examples

| Tree | Role |
|---|---|
| Host app (e.g. TRK `/api/v1/ai/settings`) | Production persistence |
| `examples/{elixir,go,python,rust}/` | Copy-paste: serve the island + echo GET/PATCH |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
