defmodule Example.ToolListStub do
  @moduledoc """
  Throwaway Plug that stubs `GET /api/tobor-kit/mcp/tools` with canned JSON.

  Production dressing (discover → allow/deny → mcp.menu, including degraded[])
  lives in `elixir/lib/tobor_kit/components/mcp/` — do not reimplement it here.

  Phoenix host: `forward "/api/tobor-kit", to: Example.ToolListStub`
  (or mount the real `ToborKit.Endpoint` instead).
  """

  use Plug.Router

  plug :match
  plug :dispatch

  # Host-owned: bearer check when guide.auth.required. Never embed secrets.

  @inventory %{
    "groups" => [
      %{"id" => "Github", "label" => "Github"},
      %{"id" => "Tickets", "label" => "Tickets"}
    ],
    "tools" => [
      %{
        "name" => "Github.BranchCreate",
        "label" => "New branch",
        "group" => "Github",
        "read_only" => true
      },
      %{
        "name" => "Github.PullCreate",
        "label" => "Open a PR",
        "group" => "Github",
        "confirm" => true
      },
      %{"name" => "Ticket.Create", "label" => "File a ticket", "group" => "Tickets"}
    ],
    "degraded" => [
      %{"server" => "seo", "label" => "SEO", "error" => "connection refused"}
    ]
  }

  get "/mcp/tools" do
    inventory(conn)
  end

  get "/api/tobor-kit/mcp/tools" do
    inventory(conn)
  end

  get "/" do
    send_resp(conn, 200, html())
  end

  match _ do
    send_resp(conn, 404, ~s({"code":"not_found","message":"not found"}))
  end

  defp inventory(conn) do
    conn = fetch_query_params(conn)
    # `refresh` is ignored in this stub; production bypasses the MCP cache.
    _refresh = conn.query_params["refresh"]

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(@inventory))
  end

  defp html do
    """
    <!doctype html>
    <meta charset="utf-8">
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/tool-list/tool-list.js"></script>
    <div class="demo-frame"><tobor-tool-list></tobor-tool-list></div>
    <script type="module">
      const el = document.querySelector('tobor-tool-list');
      const res = await fetch('/api/tobor-kit/mcp/tools');
      el.inventory = await res.json();
      el.addEventListener('tobor-tool-select', (e) => {
        console.info('tobor-tool-select', e.detail.tool);
      });
    </script>
    """
  end
end
