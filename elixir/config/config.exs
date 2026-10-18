import Config

config :logger, level: :info

# The bundle to serve. Hosts MUST set `path` (a compiled `*.bundle.json`) and
# SHOULD set `config` with the guide's runtime sections (ui/auth/telemetry/
# voice/transcript/mcp) as a decoded map. Sections left out get safe defaults.
config :tobor_kit, ToborKit.Guide.Store,
  path: nil,
  config: %{}

# Provider seam. The library ships only the Fake; host apps set a real impl.
# Absence of credentials is the dark-launch switch (`configured?/0`).
config :tobor_kit, ToborKit.Provider, impl: ToborKit.Provider.Fake

config :tobor_kit, ToborKit.MCP,
  cache_ttl_ms: 30_000,
  request_timeout: 5_000

config :tobor_kit, ToborKit.Auth.OIDC,
  issuer: nil,
  client_id: nil,
  redirect_uri: nil,
  scopes: ~w(openid email profile)

config :tobor_kit, ToborKit.Voice.Realtime,
  model: "gpt-realtime-2.1-mini",
  voice: "marin"

# Voice gateway (embeddable talking-agent backend, wire contract v1). Dark by
# default: no provider, no auth token, no origins — session creation fails
# closed until a host configures them. See ToborKit.VoiceGateway moduledoc.
config :tobor_kit, ToborKit.VoiceGateway,
  provider: nil,
  brain: nil,
  auth: ToborKit.VoiceGateway.Auth.Bearer,
  allowed_origins: [],
  public_url: nil,
  session_ttl_ms: 30 * 60_000,
  max_sessions: 100,
  max_payload: 8 * 1024 * 1024

config :tobor_kit, ToborKit.VoiceGateway.Auth.Bearer,
  token: nil,
  policy: nil

# Telemetry defaults. `service_name` must be a real identity for this
# deployment (the guide's `telemetry.service_name` when present, else the
# bundle slug) — never a generic placeholder.
config :tobor_kit, ToborKit.Telemetry,
  service_name: "tobor-kit",
  otlp_endpoint: ~c"http://otel-collector.observability-ns.svc.cluster.local:4317"

config :opentelemetry,
  resource: %{"service.name" => System.get_env("TOBOR_KIT_SERVICE_NAME", "tobor-kit")},
  processors: [
    {:otel_batch_processor,
     %{
       exporter:
         {:otel_exporter_otlp,
          %{
            otlp_protocol: :grpc,
            endpoints: [~c"http://otel-collector.observability-ns.svc.cluster.local:4317"]
          }}
     }}
  ]

config :tobor_kit, ToborKit.HTTP,
  enabled: false,
  port: 8080

import_config "#{config_env()}.exs"
