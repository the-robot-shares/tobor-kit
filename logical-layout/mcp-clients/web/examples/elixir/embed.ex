# Phoenix host: serve <tobor-mcp-clients> and echo GET/POST /mcp/clients….
# Production authorize for oauth returns {redirect} — the HOST follows it.
# This stub does not redirect and never returns secrets.

defmodule McpClientsEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", McpClientsEmbedWeb do
    pipe_through :browser
    get "/", PageController, :index
  end

  scope "/mcp/clients", McpClientsEmbedWeb do
    pipe_through :api
    get "/", ClientsController, :index
    post "/:id/authorize", ClientsController, :authorize
    post "/:id/revoke", ClientsController, :revoke
  end
end

defmodule McpClientsEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>tobor-mcp-clients</title>
        <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-clients/tobor-mcp-clients.js"></script>
      </head>
      <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
        <div class="demo-frame"><tobor-mcp-clients></tobor-mcp-clients></div>
        <script type="module">
          const el = document.querySelector('tobor-mcp-clients');
          const load = () => fetch('/mcp/clients', {credentials: 'same-origin'}).then((r) => r.json()).then((body) => { el.clients = body.clients; });
          await load();
          el.addEventListener('client-authorize', async (event) => {
            const body = await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/authorize', {
              method: 'POST', credentials: 'same-origin',
            }).then((r) => r.json());
            // Host-owned: if (body.redirect) location.assign(body.redirect);
            await load();
          });
          el.addEventListener('client-revoke', async (event) => {
            await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/revoke', {
              method: 'POST', credentials: 'same-origin',
            });
            await load();
          });
        </script>
      </body>
    </html>
    """)
  end
end

defmodule McpClientsEmbedWeb.ClientsController do
  use Phoenix.Controller, formats: [:json]

  @clients [
    %{id: "github", name: "GitHub", status: "disconnected", auth: "oauth"},
    %{id: "search", name: "Search", status: "connected", auth: "api-key"}
  ]

  def index(conn, _params) do
    json(conn, %{clients: @clients})
  end

  def authorize(conn, %{"id" => id}) do
    # Production oauth: json(conn, %{ok: true, redirect: authorize_url}) — HOST navigates.
    json(conn, %{ok: true, id: id, status: "connected"})
  end

  def revoke(conn, %{"id" => id}) do
    json(conn, %{ok: true, id: id, status: "disconnected"})
  end
end
