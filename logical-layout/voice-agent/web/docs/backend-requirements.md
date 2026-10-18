# tobor-voice-agent backend requirements

`backend`: **voice**. Production tree: repository **`backend/`** (Node gateway). This is not the Guide API (`elixir/`, `go/`, `POST /voice/token`). Examples under `examples/` proxy or stub the contract; they are not the service.

**Elixir inclusion:** `ToborKit.VoiceGateway` (`elixir/lib/tobor_kit/components/voice_gateway/`) implements this same contract as an embeddable Plug + supervisor for Phoenix/Plug hosts — `forward "/api/voice", to: ToborKit.VoiceGateway.Plug` plus one supervisor child and a `config :tobor_kit, ToborKit.VoiceGateway` block. The Node gateway stays the reference implementation; the Elixir library is the embeddable equivalent. Nothing on this page changes for the element.

The element carries **no provider secrets**, MCP credentials, or tool catalogs. `credentials: "include"` is sent so the host can authenticate with a cookie; the host may also wrap the gateway with bearer auth. Never put API keys on attributes or in playground markup.

## Session create

`POST {backendUrl}/voice/sessions`

`backendUrl` is the component transport origin. `backend` in the JSON body is a logical provider name from server policy, not a URL.

Request JSON (component `config`):

```json
{
  "organization": "acme",
  "project": "app",
  "backend": "litellm",
  "engine": "tts",
  "model": "gpt-4o-mini",
  "tools": [],
  "mcpTools": [],
  "systemPrompt": "You are a helpful voice assistant.",
  "voice": "",
  "ttsModel": ""
}
```

`organization`, `project`, `backend`, `engine`, and `model` are required strings (≤256). `tools` / `mcpTools` are name arrays. Optional `voice`, `ttsModel` (≤128).

Success **201**:

```json
{
  "sessionId": "uuid",
  "websocketUrl": "ws://127.0.0.1:8081/voice/sessions/{sessionId}/socket?ticket=…",
  "expiresAt": "2026-09-07T12:00:00.000Z",
  "realtime": { "token": "ephemeral", "url": "…", "model": "…", "voice": "…", "expiresAt": "…" }
}
```

The element requires `sessionId` and `websocketUrl`. `realtime` is present only for `engine: "openai-realtime"` (ephemeral WebRTC credential). `http:`/`https:` websocket URLs are rewritten to `ws:`/`wss:`.

Reference path: `POST /voice/sessions` then upgrade `GET /voice/sessions/{sessionId}/socket?ticket=…` (single-use ticket).

| Status | `code` | When |
|--------|--------|------|
| 201 | — | Session created |
| 400 | `invalid_config` / `invalid_request` / `invalid_message` | Bad JSON or fields |
| 401 | `unauthorized` | `authorize` returned null |
| 403 | `forbidden` / `origin_denied` | Policy or `Origin` not allowlisted |
| 404 | `not_found` | Other paths |
| 429 | `capacity` | `maxSessions` |
| 204 | — | `OPTIONS` CORS preflight |

`GET /health` → `{ok: true}` is host/ops only; the element does not call it.

## WebSocket frames

After `websocketUrl` connects, the server sends `{type:"ready",sessionId}` (or `session.ready`). Handshake timeout on the element: 15s.

Audio bytes are base64. PCM is little-endian signed 16-bit mono (`mimeType: "audio/pcm"`, typically `sampleRate: 24000`).

| Direction | Type | Payload |
|-----------|------|---------|
| Client → server | `input.text` | `{text}` |
| Client → server | `input.image` | `{dataUrl, text?}` PNG/JPEG/WebP data URL |
| Client → server | `input.screenshot` | same as image |
| Client → server | `input.audio` | `{data, mimeType, final:true}` complete recording |
| Client → server | `interrupt` | `{turnId?}` |
| Both | `animation` | `{state}` canonical guide state |
| Both | `realtime.event` | `{event}` provider envelope |
| Server → client | `ready` / `session.ready` | `{sessionId}` |
| Server → client | `transcript` | `{turnId, role, text, final, delta?}` |
| Server → client | `text` | `{turnId, text, final?, delta?}` |
| Server → client | `audio` | `{turnId, data, mimeType, sampleRate?}` |
| Server → client | `interrupted` | `{turnId}` |
| Server → client | `error` | `{code, message, turnId?}` |

Canonical `state` values: `idle`, `listening`, `thinking`, `speaking`, `tool_running`, `error`, `offline`.

Reference limits: 8 MiB payloads, 40-message history, 30-minute session TTL. A new input supersedes the previous turn. Cancelled-turn and obsolete-connection frames must be ignored (the element does this).

## Auth and trust

Production gateway (`backend/`): `authorize(request, requestedConfiguration)` returns the **authenticated user's** policy or `null`. Browser `Origin` must be listed (`VOICE_ALLOWED_ORIGINS`). `VOICE_AUTH_TOKEN` (or host session/OIDC) authenticates session create. Provider keys (`LITELLM_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, …) stay on the server. Requested `tools` / `mcpTools` select names from the server catalog only.

Fixture (`npm --prefix backend run test:debug`): `127.0.0.1:8081`, organization `noizu-labs`, project `noizu-infra`, backend `litellm`, engine `tts`, model `fixture-model` / `fixture-model-2`. No live provider calls.

## What the element does not do

- Redirects, `Set-Cookie`, payment, CSRF tokens
- Minting provider API keys or MCP endpoint credentials
- Authorizing tools (hiding a context action is UX, not auth)
- Calling Guide API `POST /voice/token` or SSE turn routes

## Production vs examples

| Tree | Role |
|------|------|
| `backend/` | Production voice gateway |
| `examples/elixir\|go\|python\|rust` | Host snippets: reverse-proxy `/voice/` to the Node gateway **or** stub `POST /voice/sessions` |
| `elixir/` `go/` | Guide API (separate product). Do not point this element at them for voice sessions. |
