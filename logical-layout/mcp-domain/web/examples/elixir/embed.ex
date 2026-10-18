# Phoenix host: serve <tobor-mcp-domain> and echo GET/PATCH /mcp/domain.
# Persistence is in-process — replace with the host store.
# Host-owned: session cookies stay off the element.

defmodule McpDomainEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", McpDomainEmbedWeb do
    pipe_through :browser
    get "/", PageController, :index
  end

  scope "/mcp", McpDomainEmbedWeb do
    pipe_through :api
    get "/domain", DomainController, :show
    patch "/domain", DomainController, :update
  end
end

defmodule McpDomainEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>tobor-mcp-domain</title>
        <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-domain/tobor-mcp-domain.js"></script>
      </head>
      <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
        <div class="demo-frame"><tobor-mcp-domain></tobor-mcp-domain></div>
        <script type="module">
          const el = document.querySelector('tobor-mcp-domain');
          const tools = await fetch('/mcp/domain', {credentials: 'same-origin'}).then((r) => r.json());
          el.tools = tools.tools;
          el.addEventListener('tool-visibility-change', (event) => {
            fetch('/mcp/domain', {
              method: 'PATCH',
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

defmodule McpDomainEmbedWeb.DomainController do
  use Phoenix.Controller, formats: [:json]

  @tools [
    %{name: "Github.PullCreate", visibility: "visible"},
    %{name: "Github.IssueList", visibility: "discoverable"},
    %{name: "Filesystem.Write", visibility: "disabled"}
  ]

  def show(conn, _params) do
    json(conn, %{tools: @tools})
  end

  def update(conn, %{"name" => name, "visibility" => visibility}) do
    json(conn, %{ok: true, tool: %{name: name, visibility: visibility}})
  end

  def update(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "name and visibility required"})
  end
end
