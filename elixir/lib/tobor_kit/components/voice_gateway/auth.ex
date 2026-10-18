defmodule ToborKit.VoiceGateway.Auth do
  @moduledoc """
  Session-create authentication. `authorize/2` receives the session-create
  request and the raw requested configuration and returns the **authenticated
  caller's** exact permitted scope — the server-owned policy map consumed by
  `ToborKit.VoiceGateway.Config.authorize_config/2` — or a falsy value when
  unauthenticated. Enforce organization/project membership as a pair here.
  """

  @callback authorize(conn :: Plug.Conn.t(), requested :: map()) :: policy :: map() | nil | false
end

defmodule ToborKit.VoiceGateway.Auth.Bearer do
  @moduledoc """
  Default authentication: one static bearer token, mirroring the Node
  gateway's `VOICE_AUTH_TOKEN` mode. Comparison is constant-time.

      config :tobor_kit, ToborKit.VoiceGateway,
        auth: ToborKit.VoiceGateway.Auth.Bearer

      config :tobor_kit, ToborKit.VoiceGateway.Auth.Bearer,
        token: "static-dev-token",      # falls back to $VOICE_AUTH_TOKEN
        policy: %{...server scope...}
  """

  @behaviour ToborKit.VoiceGateway.Auth

  @impl true
  def authorize(conn, _requested) do
    cfg = Application.get_env(:tobor_kit, __MODULE__, [])
    expected = cfg[:token] || System.get_env("VOICE_AUTH_TOKEN")
    policy = cfg[:policy]

    with [token] <- bearer(conn.req_headers),
         true <-
           is_binary(expected) and
             Plug.Crypto.secure_compare("Bearer " <> token, "Bearer " <> expected),
         true <- is_map(policy) do
      policy
    else
      _ -> nil
    end
  end

  defp bearer(headers) do
    Enum.find_value(headers, fn
      {"authorization", "Bearer " <> token} -> [String.trim(token)]
      _ -> nil
    end)
  end
end
