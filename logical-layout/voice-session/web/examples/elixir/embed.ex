# Host page + Guide API passthrough for <tobor-voice-session>.
#
# Production minting: elixir/ (ToborKit.Voice + Endpoint) and go/ (port).
# This snippet serves the mount page and lets the existing Endpoint answer
# POST /voice/token. Do not reimplement minting. Never put OPENAI_API_KEY
# on the element.

defmodule HostApp.VoiceSessionRouter do
  use Plug.Router

  plug Plug.Logger
  plug :match
  plug :dispatch

  @cdn_client "https://cdn.derobot.is/tobor-kit/latest/client.js"
  @cdn_el "https://cdn.derobot.is/tobor-kit/latest/components/voice-session/voice-session.js"

  get "/" do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, """
    <!doctype html>
    <meta charset="utf-8"/>
    <title>tobor-voice-session</title>
    <div class="demo-frame">
      <tobor-voice-session id="voice"></tobor-voice-session>
    </div>
    <script type="module">
      import {ToborKitClient} from "#{@cdn_client}";
      import "#{@cdn_el}";
      const el = document.getElementById("voice");
      // Host-owned session token — never a provider key, never an attribute.
      el.client = new ToborKitClient({
        baseUrl: "/api/tobor-kit",
        token: () => window.__TOBOR_ACCESS_TOKEN,
      });
      el.voice = {adapter: "native", locale: "en-US"};
      el.addEventListener("tobor-voice-state", (e) => console.info(e.detail));
      el.addEventListener("tobor-voice-transcript", (e) => console.info(e.detail));
      el.addEventListener("tobor-voice-error", (e) => console.warn(e.detail));
    </script>
    """)
  end

  # Endpoint matches the full /api/tobor-kit/... path (see elixir/test).
  # Plug.forward would strip the prefix — pass the conn through instead.
  match _ do
    ToborKit.Endpoint.call(conn, [])
  end
end

# Boot the reference server instead of embedding a second implementation:
#
#   config :tobor_kit, ToborKit.HTTP, enabled: true, port: 8080
#
# native → 409 no_credential_needed
# none   → 503 voice_unavailable
# realtime → 201 ephemeral credential (OPENAI_API_KEY stays on the server)
