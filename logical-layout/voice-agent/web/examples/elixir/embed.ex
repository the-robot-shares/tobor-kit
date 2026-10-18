# Phoenix/Plug host for <tobor-voice-agent>.
# Production voice is backend/ (Node). Guide API elixir/ is a different contract.
# mix deps: {:plug, ...}, {:plug_cowboy, ...}, {:jason, ...}, {:req, ...}

defmodule VoiceAgentEmbed.Router do
  @moduledoc false
  use Plug.Router

  plug(:match)
  plug(Plug.Parsers, parsers: [:json], json_decoder: Jason)
  plug(:dispatch)

  get "/" do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html())
  end

  # Host-owned auth belongs here (cookie / bearer). Never mint provider keys for the browser.
  post "/voice/sessions" do
    case Req.post(gateway() <> "/voice/sessions", json: conn.body_params, receive_timeout: 15_000) do
      {:ok, %{status: status, body: body}} ->
        json = if is_binary(body), do: body, else: Jason.encode!(body)

        conn
        |> put_resp_content_type("application/json")
        |> send_resp(status, json)

      {:error, _} ->
        # Stub when the Node gateway is down. Browser still needs a real WS for turns.
        session_id = Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)

        conn
        |> put_resp_content_type("application/json")
        |> send_resp(
          201,
          Jason.encode!(%{
            sessionId: session_id,
            websocketUrl: "ws://127.0.0.1:8081/voice/sessions/#{session_id}/socket"
          })
        )
    end
  end

  match _ do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(404, ~s({"code":"not_found","message":"Not found"}))
  end

  defp gateway, do: System.get_env("VOICE_GATEWAY_URL") || "http://127.0.0.1:8081"

  defp html do
    """
    <!doctype html><meta charset="utf-8"><title>tobor-voice-agent</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/voice-agent/voice-agent.js"></script>
    <tobor-voice-agent organization="acme" project="app" backend-url="" backend="litellm" engine="tts" model="gpt-4o-mini" label="Voice agent"></tobor-voice-agent>
    <script type="module">
      const agent = document.querySelector('tobor-voice-agent');
      agent.backendUrl = location.origin;
      agent.tools = []; agent.mcpTools = [];
    </script>
    """
  end
end

# Alternative HEEx (LiveView / Hologram): keep arrays as JS properties.
# <tobor-voice-agent
#   organization={@org} project={@project} backend-url={@backend_url}
#   backend="litellm" engine="tts" model="gpt-4o-mini" label="Voice agent">
# </tobor-voice-agent>
