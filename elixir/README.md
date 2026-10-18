# tobor_kit (Elixir reference backend)

The reference implementation of the tobor-kit Guide API
(`../openapi/tobor-kit.openapi.yaml`). It serves **frozen NPL bundles**
produced by `../compiler/` and owns everything the client must never see or
drift on: the compiled prompt, provider calls, MCP menu dressing, voice
credential minting, telemetry consent, and OIDC.

Plain Plug + Bandit — no Phoenix.

## Modules

| Module | Role |
|---|---|
| `ToborKit.Guide` | Load + `bundle_hash`-verify a compiled bundle; project it for clients |
| `ToborKit.Guide.Store` | The one verified guide this backend serves |
| `ToborKit.Endpoint` / `ToborKit.HTTP` | The HTTP surface (Plug router; optional Bandit runner) |
| `ToborKit.TurnRunner` | One assistant turn as contract SSE events (`state`, `delta`, `tool_call`, `tool_result`, terminal `message`/`error`) |
| `ToborKit.Provider` | Generation seam (behaviour, dark-launch via `configured?/0`); ships `Provider.Fake` |
| `ToborKit.Budget` | Budget seam (behaviour + permissive default) |
| `ToborKit.MCP` | Live tool inventory: discover → allow/deny globs → `mcp.menu` overlay; `degraded[]` / 502 for required servers |
| `ToborKit.Voice` | Credential minting per adapter; `native` → 409, disabled/unconfigured → 503 |
| `ToborKit.VoiceGateway` | Embeddable talking-agent backend (wire contract v1) for `<tobor-voice-agent>` — see below |
| `ToborKit.Telemetry` | OTel span per exchange; content attributes **only** with consent, redacted even then |
| `ToborKit.Auth.OIDC` | Generic authorization-code + PKCE flow (framework-neutral session map, injectable HTTP) |
| `ToborKit.Transcript` | Store seam; `Memory` impl is not server-backed, so transcript endpoints 501 |

## VoiceGateway — talking-agent backend in one block

`ToborKit.VoiceGateway` is the embeddable Elixir twin of the Node gateway in
`../backend/` — same wire contract v1 (`POST /voice/sessions`, single-use
WS ticket, `input.*` / `transcript` / `text` / `audio` / `interrupted` /
`realtime.event` frames, 8 MiB / 40-message / 30-minute limits). The Node
gateway remains the reference implementation; this is the drop-in equivalent
for Phoenix/Plug hosts. Three lines:

```elixir
# 1. endpoint/router
forward "/api/voice", to: ToborKit.VoiceGateway.Plug

# 2. application supervision tree
{ToborKit.VoiceGateway, []}

# 3. config — provider keys never leave the server
config :tobor_kit, ToborKit.VoiceGateway,
  provider: ToborKit.VoiceGateway.Providers.OpenAIRealtime,  # or Providers.Tts / your own
  brain: MyApp.AssistantBrain,                               # text turns for the tts engine
  allowed_origins: ["https://app.example.com"],
  public_url: "https://app.example.com"
```

Engine matrix: `openai-realtime` (ephemeral WebRTC credential minting + event
relay, done), `tts` (push-to-talk via the host `Brain`, STT/TTS seams — done),
`elevenlabs` — behaviour hooks only, not ported (implement
`ToborKit.VoiceGateway.Provider.speak/3` against the ElevenLabs stream API).
Tool execution is server-side `invoke` callbacks from the policy catalog
(`ToborKit.VoiceGateway.Provider.invoke_tool/3`); remote-MCP endpoint tools
are bridged through `invoke` rather than a built-in MCP client.

Dark by default: with no `:provider` configured, session creation fails
closed — nothing falls back to a fixture in production.

## Bundle hash

`Guide.verify/1` re-derives `bundle_hash` exactly as the compiler does:
sha256 hex with a `sha256:` prefix over **compact JSON with lexicographically
sorted keys** of the bundle minus the `bundle_hash` member
(`ToborKit.Json.compact/1`). Tampered bundles never reach the prompt.

## Configuration

```elixir
config :tobor_kit, ToborKit.Guide.Store,
  path: "priv/deploy-guide.bundle.json",   # compiled bundle (required)
  config: %{                                # runtime sections of the guide definition
    "ui" => %{}, "auth" => %{}, "telemetry" => %{},
    "voice" => %{}, "transcript" => %{}, "mcp" => %{}
  }

config :tobor_kit, ToborKit.Provider, impl: MyApp.Provider.OpenAICompatible
config :tobor_kit, ToborKit.HTTP, enabled: true, port: 8080

config :opentelemetry,
  resource: %{"service.name" => "tobor-kit-deploy-guide"}   # a real identity
```

Missing provider credentials are the dark-launch switch: the app boots, and
turns fail loudly with a terminal `error` event instead of inventing prose.

## Development

```sh
mix test          # no network access required
```
