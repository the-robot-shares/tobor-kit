# Tobor voice reference backend

Reusable Node 22+ backend for `<tobor-voice-agent>`. This adds a bidirectional voice/session protocol alongside the existing Elixir/Go Guide API; it does not replace that API. The `agents-voice` MCP repository is a specification, not a running dependency.

## Run and test

```sh
npm ci
npm test
npm run test:debug
```

The last command starts an **explicit test fixture** on `127.0.0.1:8081`, for the toolkit's local demo and Cypress suite. It makes no model or speech-provider calls. Fixture configuration: organization `noizu-labs`, project `noizu-infra`, backend `litellm`, engine `tts`, model `fixture-model` or `fixture-model-2`, tools `['fixture.echo']`. Messages containing `slow` delay completion so interruption can be exercised. This is library testing; no infra.noizu.com deployment is required.

`npm start` is the real provider launcher. Required server environment:

| Variable | Purpose |
| --- | --- |
| `VOICE_POLICY_FILE` | Absolute path to host-owned JSON policy (example below) |
| `VOICE_AUTH_TOKEN` | Authentication for session creation; embedding can replace this with existing session/OIDC auth |
| `VOICE_ALLOWED_ORIGINS` | Comma-separated exact browser origins |
| `VOICE_PUBLIC_URL` | Public backend origin for returned WSS URLs behind a reverse proxy |
| `LITELLM_BASE_URL` | OpenAI-compatible API root, including `/v1` (defaults to OpenAI) |
| `LITELLM_API_KEY` | Server-side chat provider credential |
| `OPENAI_API_KEY` | Server-side STT, OpenAI TTS, and Realtime credential |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | ElevenLabs server credential and default voice |
| `HOST`, `PORT` | Defaults `127.0.0.1`, `8081` |

The browser receives a single-use WS ticket and, for Realtime, a short-lived OpenAI credential. It never receives provider API keys, MCP endpoint credentials, or the server tool catalog. Do not log session-init response bodies or WebSocket ticket query strings at the proxy.

```json
{
  "organizations": ["noizu-labs"],
  "projects": ["noizu-infra"],
  "backends": ["litellm"],
  "engines": ["tts", "elevenlabs", "openai-realtime"],
  "models": ["gpt-4.1-mini", "gpt-realtime-mini", "gpt-realtime"],
  "systemPrompt": "You are a concise assistant.",
  "allowSystemPrompt": false,
  "tools": {}
}
```

`backend` selects a permitted logical provider name. The reference launcher supplies one provider; deployments serving several providers should supply a provider dispatcher. Never interpret client `backend` as an arbitrary outbound URL.

For embedding, import `createVoiceServer` from `src/server.mjs` and `OpenAICompatibleProvider` from `src/providers.mjs`. Pass `authorize(request, requestedConfiguration)`, returning the **authenticated user's** permitted scope or `null`. Use this callback to enforce organization/project membership as a pair. No built-in identity assumption or anonymous production mode is enabled. Browser origins are denied unless explicitly listed. Session creation and its one-time WS capability establish authorization; refreshing credentials/reconnecting creates a new session.

The server catalog `policy.tools` maps public tool names to trusted definitions `{description,inputSchema,endpoint,remoteName,headers}` or `{description,inputSchema,invoke(args,{signal,organization,project})}`. Requested `tools`/`mcpTools` arrays select only names from that catalog. Definitions from browsers are rejected. `invoke` is suitable for existing local application services; it must honor cancellation and enforce its own resource authorization.

For remote MCP, the default adapter initializes **Streamable HTTP 2025-11-25**, sends `notifications/initialized`, carries the negotiated session/version headers, calls `tools/call`, and closes its session. `src/mcp.mjs` also exports `MCPClient.listTools()` for server-side inventory discovery. Filter discovered names into policy before exposing them. `stateless: true` explicitly selects a preinitialized/legacy direct `tools/call` endpoint. Stdio, OAuth token refresh, elicitation, sampling and later protocol revisions need a host adapter. Remote MCP server URLs and credentials always come from the server catalog.

## Engine behavior

- `openai-realtime`: selected Realtime model and prompt initialize an ephemeral WebRTC session. The browser streams mic/audio and sends text/images over that same data channel. Function calls are relayed to this backend over WS and executed against the selected tool allowlist. Backend results return as Realtime client events. Server VAD enables interruption; the browser also cancels/truncates local playback immediately.
- `elevenlabs`: selected OpenAI-compatible/LiteLLM model handles text, image and screenshot turns. Recorded audio is transcribed by OpenAI. ElevenLabs emits streamed PCM speech. `voice` is the ElevenLabs voice ID; `ttsModel` defaults to `eleven_flash_v2_5`.
- `tts`: same text/vision/STT path, with OpenAI TTS (`gpt-4o-mini-tts` by default).

TTS output is signed 16-bit little-endian mono PCM at 24 kHz, not an MP3 file per network chunk. The browser schedules PCM samples through Web Audio and stops its queue on interrupt. The server preserves sample alignment across provider chunks, aborts active fetch/tool work, and drops all late output from superseded turns. Recorded input is a complete MediaRecorder file; it is not a continuous STT stream. The browser owns voice-activity detection/barge-in and sends `interrupt` immediately.

## Wire contract v1

`POST /voice/sessions` JSON:

```json
{"organization":"noizu-labs","project":"noizu-infra","backend":"litellm","engine":"tts","model":"gpt-4.1-mini","tools":[],"mcpTools":[],"systemPrompt":"You are a concise assistant."}
```

Optional `voice` and `ttsModel`. Response: `{sessionId,websocketUrl,expiresAt,realtime?}`; Realtime credential: `{token,url,model,voice,expiresAt}`. `backendUrl` is the component's transport URL and is separate from `backend`.

Connect to `websocketUrl` once. Server emits `{type:'ready',sessionId}`. JSON messages:

| Direction | Type | Payload |
| --- | --- | --- |
| Client → server | `input.text` | `text` |
| Client → server | `input.image`, `input.screenshot` | `dataUrl` (PNG/JPEG/WebP), optional `text` |
| Client → server | `input.audio` | `data` (base64 complete recording), `mimeType` |
| Client → server | `interrupt` | no fields |
| Both | `animation` | canonical `state` |
| Both | `realtime.event` | `event` (provider event envelope) |
| Server → client | `transcript` | `role` user/assistant, `text`, `final`, `turnId` |
| Server → client | `text` | `text`, `delta?`, `final?`, `turnId` |
| Server → client | `audio` | `data` base64 PCM, `mimeType:'audio/pcm'`, `sampleRate:24000`, `turnId` |
| Server → client | `interrupted` | cancelled `turnId` |
| Server → client | `error` | `code`, `message`, optional `turnId` |

Canonical states: `idle`, `listening`, `thinking`, `speaking`, `tool_running`, `error`, `offline`. Final transcript and final text describe the same assistant reply; consumers must merge rather than append duplicates. A new input supersedes the preceding turn. Malformed media is rejected before that replacement. Disconnect cancels work and removes session state. Sessions expire after 30 minutes; payloads are bounded to 8 MiB and history to 40 messages.

Realtime forwarding: browser sends transcription completion and `response.function_call_arguments.done` as `realtime.event`. Backend emits `conversation.item.create` with `function_call_output`, then `response.create`; the browser forwards both to the established data channel. Images use `conversation.item.create` with `input_image` and then `response.create` on that channel, avoiding a second chat conversation.

## Evidence and limits

`npm test` exercises a real WS listener plus actual fetch requests to controlled HTTP provider endpoints: policy escalation, authentication/origin/ticket, transcript/media/state, interruption and stale output, malformed events, chat vision/SSE, MCP inventory/call lifecycle and allowlisting, STT multipart, Realtime mint shape, and PCM chunk alignment. These do not claim live paid-provider or microphone hardware verification. The fixture is never selected by production fallback.

Provider contracts checked against [OpenAI Realtime](https://platform.openai.com/docs/api-reference/realtime), [ElevenLabs streamed speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), and [MCP Streamable HTTP 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). Deployment must permit the selected model and configure real provider credentials; model names are server policy rather than a hardcoded promise of account access.

Live provider smoke on 2026-09-07 also passed using the real `OpenAICompatibleProvider` methods and an existing server-side OpenAI credential: `gpt-4.1-mini` chat completed; OpenAI TTS emitted 57,600 PCM bytes for “OK”; `gpt-realtime-mini` ephemeral session mint succeeded. No credential or transcript content was logged. This verifies provider requests, not a browser microphone/WebRTC exchange. ElevenLabs and LiteLLM live smoke were unavailable because their provider environment variables were absent.
