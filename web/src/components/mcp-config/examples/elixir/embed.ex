# Phoenix host: serve <tobor-mcp-config> and echo GET/PUT /mcp/config.
# Host validates URL/transport. Never store secrets on the element.

defmodule McpConfigEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", McpConfigEmbedWeb do
    pipe_through :browser
    get "/", PageController, :index
  end

  scope "/mcp", McpConfigEmbedWeb do
    pipe_through :api
    get "/config", ConfigController, :show
    put "/config", ConfigController, :update
  end
end

defmodule McpConfigEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>tobor-mcp-config</title>
        <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-config/tobor-mcp-config.js"></script>
      </head>
      <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
        <div class="demo-frame"><tobor-mcp-config></tobor-mcp-config></div>
        <script type="module">
          const el = document.querySelector('tobor-mcp-config');
          const cfg = await fetch('/mcp/config', {credentials: 'same-origin'}).then((r) => r.json());
          el.url = cfg.url || '';
          el.transport = cfg.transport || 'http';
          if (cfg.extras) el.extras = cfg.extras;
          el.addEventListener('config-change', (event) => {
            fetch('/mcp/config', {
              method: 'PUT',
              headers: {'content-type': 'application/json'},
              credentials: 'same-origin',
              body: JSON.stringify(event.detail),
            });
          });
        </script>
      </body>
    </html>
    """)
  end
end

defmodule McpConfigEmbedWeb.ConfigController do
  use Phoenix.Controller, formats: [:json]

  def show(conn, _params) do
    json(conn, %{url: "https://mcp.example.test/mcp", transport: "http"})
  end

  def update(conn, params) do
    json(conn, %{ok: true, config: params})
  end
end
