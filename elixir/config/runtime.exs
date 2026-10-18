# Runtime configuration — evaluated at boot for releases (and by Mix for all
# envs). Only overrides what `config/config.exs` already defines; every value
# is env-driven with prod-safe defaults. Nothing here introduces new secrets —
# the platform injects them via k8s Secrets (see helm/).
import Config

# Telemetry identity. Must be a real deployment identity, never a generic
# placeholder — defaults to the app slug, override per deployment.
service_name = System.get_env("TOBOR_KIT_SERVICE_NAME", "tobor-kit")

config :tobor_kit, ToborKit.Telemetry,
  service_name: service_name

config :opentelemetry,
  resource: %{"service.name" => service_name}

if config_env() == :prod do
  # Standalone Bandit listener. Defaults ON for the release so the service
  # container serves out of the box; hosts that forward to ToborKit.Endpoint
  # from their own pipeline set TOBOR_KIT_HTTP_ENABLED=false.
  enabled = System.get_env("TOBOR_KIT_HTTP_ENABLED", "true") == "true"

  port =
    case Integer.parse(System.get_env("TOBOR_KIT_HTTP_PORT", "8080")) do
      {n, ""} -> n
      _ -> 8080
    end

  config :tobor_kit, ToborKit.HTTP,
    enabled: enabled,
    port: port

  # The frozen guide bundle to serve. Required for a real deployment.
  if path = System.get_env("TOBOR_KIT_GUIDE_PATH") do
    config :tobor_kit, ToborKit.Guide.Store, path: path
  end

  # Voice token mint. `ToborKit.Voice.Realtime` also falls back to
  # System.get_env("OPENAI_API_KEY") itself; this makes the value visible
  # through Application env for hosts that introspect config.
  if api_key = System.get_env("OPENAI_API_KEY") do
    config :tobor_kit, ToborKit.Voice.Realtime, api_key: api_key
  end

  # Public-PKCE OIDC (Authentik). Keys absent from the environment stay nil —
  # the same safe default `config.exs` ships.
  config :tobor_kit, ToborKit.Auth.OIDC,
    issuer: System.get_env("TOBOR_KIT_OIDC_ISSUER"),
    client_id: System.get_env("TOBOR_KIT_OIDC_CLIENT_ID"),
    redirect_uri: System.get_env("TOBOR_KIT_OIDC_REDIRECT_URI")
end
