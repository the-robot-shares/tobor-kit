defmodule HostApp.TaskMenuPage do
  @moduledoc """
  Serves the tobor-task-menu mount page.

  This file also stubs `GET /api/tobor-kit/mcp/tools` with canned JSON so a
  host can stand up without a guide bundle. Production dressing lives in
  `ToborKit.MCP.inventory/2` — prefer `forward` to `ToborKit.Endpoint`.
  Host-owned: bearer verification, secrets, persistence.
  """

  import Plug.Conn

  @cdn "https://cdn.derobot.is/tobor-kit/latest/components/task-menu/task-menu.js"

  @inventory %{
    "groups" => [%{"id" => "Github", "label" => "Github"}],
    "tools" => [
      %{"name" => "Github.BranchCreate", "label" => "New branch", "group" => "Github"},
      %{
        "name" => "Github.PullCreate",
        "label" => "Open a PR",
        "group" => "Github",
        "confirm" => true
      }
    ],
    "degraded" => [
      %{"server" => "tickets", "label" => "Tickets", "error" => "timeout"}
    ]
  }

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html())
  end

  def tools(conn, _opts) do
    conn = fetch_query_params(conn)
    # `refresh` is ignored in this stub; production bypasses the MCP cache.
    _refresh = conn.query_params["refresh"]

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(@inventory))
  end

  def html do
    """
    <!doctype html>
    <meta charset="utf-8">
    <title>tobor-task-menu</title>
    <script type="module" src="#{@cdn}"></script>
    <div class="demo-frame"><tobor-task-menu></tobor-task-menu></div>
    <script type="module">
      const el = document.querySelector('tobor-task-menu');
      const token = sessionStorage.getItem('tobor-access-token');
      const headers = token ? {Authorization: 'Bearer ' + token} : {};
      const res = await fetch('/api/tobor-kit/mcp/tools', {headers});
      if (res.ok) el.inventory = await res.json();
      el.addEventListener('tobor-task-select', (e) => {
        console.log('tobor-task-select', e.detail.tool);
      });
    </script>
    """
  end
end

defmodule HostApp.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/task-menu", do: HostApp.TaskMenuPage.call(conn, [])

  # Stub. Production: `match _, do: ToborKit.Endpoint.call(conn, [])`
  get "/mcp/tools", do: HostApp.TaskMenuPage.tools(conn, [])
  get "/api/tobor-kit/mcp/tools", do: HostApp.TaskMenuPage.tools(conn, [])

  match _ do
    send_resp(conn, 404, ~s({"code":"not_found","message":"not found"}))
  end
end
