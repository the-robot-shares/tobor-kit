defmodule ToborKit do
  @moduledoc """
  Reference backend for tobor-kit: serves frozen NPL guide bundles over the
  tobor-kit Guide API (`openapi/tobor-kit.openapi.yaml`).

  Entry points:

    * `ToborKit.Guide` — load + hash-verify a compiled bundle, project it for clients
    * `ToborKit.Endpoint` — the HTTP surface (Plug; `ToborKit.HTTP` runs Bandit)
    * `ToborKit.TurnRunner` — one assistant turn as contract SSE events
    * `ToborKit.Provider` — the generation seam (dark-launch aware)
    * `ToborKit.Voice` / `ToborKit.MCP` / `ToborKit.Telemetry` / `ToborKit.Auth.OIDC` /
      `ToborKit.Transcript` — the supporting seams
  """
end
