defmodule ToborKit.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    ToborKit.Telemetry.setup()

    children = [
      ToborKit.Guide.Store,
      ToborKit.Session.Store,
      ToborKit.Telemetry.Consent.Store,
      ToborKit.Transcript.Memory,
      ToborKit.MCP.Cache,
      ToborKit.VoiceGateway
      | http_children()
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: ToborKit.Supervisor)
  end

  defp http_children do
    if Application.get_env(:tobor_kit, ToborKit.HTTP, [])[:enabled] do
      [ToborKit.HTTP]
    else
      []
    end
  end
end
