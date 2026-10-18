# tobor-voice-session — backend requirements

`backend`: **elixir** (Guide API). The element never talks to a provider with a long-lived key.

Production implementations: `elixir/` (reference) and `go/`. Examples under this family **call** `POST /voice/token`; they do not reimplement minting.

## What the host must provide

1. A Guide API mounted at `/api/tobor-kit` (or another origin passed as `ToborKitClient.baseUrl`).
2. A loaded guide whose `voice.adapter` is one of `realtime` | `native` | `backend` | `none`.
3. A `ToborKitClient` instance assigned to the element's `client` property (JS-only). Bearer tokens, if any, live on that client — never as element attributes.
4. Browser mic permission when the adapter records audio (`realtime` default, `backend`).

## Endpoint

`POST /voice/token` — OpenAPI `mintVoiceToken` in `openapi/tobor-kit.openapi.yaml`.

| | |
|---|---|
| Method / path | `POST {baseUrl}/voice/token` (default `{baseUrl}` = `/api/tobor-kit`) |
| Request body | none (`ToborKitClient.mintVoiceToken()` sends no JSON) |
| Auth | Opaque bearer when the guide's `auth.required` is true. `GET /guide` stays public. Host verifies the token; this element does not. |
| Success | **201** `VoiceCredential` |
| Native adapter | **409** — no server-minted credential is needed. The client treats this as `{ok: false, reason: "not_required"}`, not a throw. |
| Disabled / unconfigured | **503** `{code, message}` — `{ok: false, reason: "unavailable"}` |
| No guide loaded | **404** `{code: "not_found", message}` |
| Missing bearer (when required) | **401** `{code: "unauthorized", message}` |

### 201 `VoiceCredential`

```json
{
  "adapter": "realtime",
  "expires_at": "2026-01-01T00:05:00Z",
  "realtime": {
    "token": "<ephemeral provider secret>",
    "url": "https://api.openai.com/v1/realtime/calls",
    "model": "gpt-realtime-2.1-mini",
    "voice": "marin"
  }
}
```

`expires_at` is exact ISO-8601 — clients compare it to their clock with no skew padding. `realtime.token` is an ephemeral client secret, never the host's provider API key.

Backend adapter shape:

```json
{
  "adapter": "backend",
  "expires_at": "2026-01-01T00:05:00Z",
  "backend": {
    "stt_url": "https://host.example/stt",
    "tts_url": "https://host.example/tts"
  }
}
```

### Adapter dispatch (Elixir reference)

`elixir/lib/tobor_kit/components/voice/voice.ex` + `POST` in `elixir/lib/tobor_kit/endpoint.ex`:

| `voice.adapter` | Mint result | HTTP |
|---|---|---|
| `realtime` | Ephemeral OpenAI Realtime client secret (`POST https://api.openai.com/v1/realtime/client_secrets` on the server) | 201 |
| `backend` | `stt_url` / `tts_url` from guide config (no secret material) | 201, or 503 if URLs missing |
| `native` | `{:error, :no_credential_needed}` | **409** `no_credential_needed` |
| `none` | `{:error, :unavailable}` | **503** `voice_unavailable` |
| unknown | `{:error, :unavailable}` | **503** |

Elixir 409 body: `{code: "no_credential_needed", message: "The configured voice adapter needs no server-minted credential."}`.

Elixir 503 body: `{code: "voice_unavailable", message: "Voice is disabled or the provider is unconfigured."}`.

Go (`go/internal/server`) answers the same **status codes** with different `code` strings (`voice_native`, `voice_disabled`). The Lit client keys off **status**, not `code`.

### Client vs server default

The **element** treats an omitted `voice.adapter` as `realtime` (schema default). Elixir `Voice.mint/2` treats a missing adapter as `"none"` → 503. Hosts must set `voice.adapter` explicitly on the loaded guide.

## Auth

- Bearer on `Authorization` when `auth.required` is true.
- Token *verification* is host-owned (`config :tobor_kit, ToborKit.Endpoint, current_user: …`).
- Never put provider keys, client secrets, or session cookies on the element.

## What this component does **not** do

- Redirects, `Set-Cookie`, payment, CSRF tokens
- Holding or reflecting a provider API key
- Implementing `POST /voice/token` itself
- Talking to the Node voice-agent gateway (`POST /voice/sessions`) — that is `<tobor-voice-agent>`, not this tag

## Production vs examples

| Tree | Role |
|---|---|
| `elixir/lib/tobor_kit/components/voice/` | Reference minting |
| `elixir/lib/tobor_kit/endpoint.ex` | `POST /api/tobor-kit/voice/token` |
| `go/internal/server` | Port of the same contract |
| `examples/*` | Copy-paste host mount; elixir/go **forward** to those trees; python/rust show the documented status codes only |
