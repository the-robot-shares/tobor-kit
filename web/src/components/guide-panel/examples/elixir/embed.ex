# Host Plug: serve the island and pass the real Guide API through.
# GET /api/tobor-kit/guide is the config projection on ToborKit.Endpoint —
# no NPL preamble. Do not reimplement the service here.

defmodule HostApp.GuidePanelRouter do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/" do
    conn
    |> put_resp_content_type("text/html; charset=utf-8")
    |> send_resp(200, embed_html())
  end

  # Endpoint matches the full /api/tobor-kit/... path (see elixir/test).
  # Plug.forward would strip the prefix — pass the conn through instead.
  match _ do
    ToborKit.Endpoint.call(conn, [])
  end

  defp embed_html do
    """
    <!doctype html>
    <html lang="en">
      <body>
        <div class="demo-frame">
          <tobor-guide-panel id="guide" base-url="/api/tobor-kit" placement="floating"></tobor-guide-panel>
        </div>
        <script type="module">
          import "/assets/tobor-kit/guide-panel.js";
          const el = document.getElementById("guide");
          el.token = window.__TOBOR_ACCESS_TOKEN;
          el.addEventListener("tobor-turn-submitted", (event) => {
            console.debug("turn", event.detail);
          });
        </script>
      </body>
    </html>
    """
  end
end

# Phoenix HEEx equivalent (token from the session, never a compiled secret):
#
#   def guide_panel(assigns) do
#     ~H"""
#     <div class="demo-frame">
#       <tobor-guide-panel id="guide" base-url="/api/tobor-kit" placement="floating"></tobor-guide-panel>
#     </div>
#     """
#   end
#
# Or boot the reference Bandit listener and point base-url at it:
#   config :tobor_kit, ToborKit.HTTP, enabled: true, port: 8080
