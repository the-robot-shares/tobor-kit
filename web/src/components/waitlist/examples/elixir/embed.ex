# Phoenix host: serve <noizu-waitlist> and the ForYou public list/signup routes
# the element calls. Persistence is host-owned (this stub logs and always 202s).
# Honeypot: nonempty company_website is discarded, still 202.
# credentials omit — no session cookies on these routes.

defmodule WaitlistEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", WaitlistEmbedWeb do
    pipe_through :browser
    get "/", PageController, :index
  end

  scope "/api/v1/public", WaitlistEmbedWeb do
    pipe_through :api
    get "/lists/:slug", WaitlistController, :show
    post "/lists/:slug/signups", WaitlistController, :create
    get "/services/:service/lists/:list", WaitlistController, :show_service
    post "/services/:service/lists/:list/signups", WaitlistController, :create_service
  end
end

defmodule WaitlistEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>noizu-waitlist</title>
        <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/waitlist/noizu-waitlist.js"></script>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
          .field-group { display: grid; gap: 0.25rem; margin: 0.5rem 0; }
          .field-input, .field-select, .field-textarea { padding: 0.4rem; }
          .btn { padding: 0.4rem 0.8rem; cursor: pointer; }
          .success { color: #0a0; }
          .danger { color: #c00; }
        </style>
      </head>
      <body>
        <noizu-waitlist slug="my-site" source="landing"></noizu-waitlist>
        <script type="module">
          const el = document.querySelector('noizu-waitlist');
          el.api = location.origin;
          el.addEventListener('waitlist-success', (event) => console.info('waitlist-success', event.detail));
          el.addEventListener('waitlist-error', (event) => console.warn('waitlist-error', event.detail));
        </script>
      </body>
    </html>
    """)
  end
end

defmodule WaitlistEmbedWeb.WaitlistController do
  use Phoenix.Controller, formats: [:json]

  def show(conn, %{"slug" => slug}), do: json(conn, manifest(slug))

  def show_service(conn, %{"service" => service, "list" => list}) do
    json(conn, manifest("#{service}/#{list}"))
  end

  def create(conn, params), do: accept(conn, params["slug"], params)

  def create_service(conn, params) do
    accept(conn, "#{params["service"]}/#{params["list"]}", params)
  end

  defp accept(conn, id, params) do
    hp = params |> Map.get("company_website", "") |> to_string() |> String.trim()

    if hp == "" do
      IO.inspect(%{list: id, values: params["values"], source: params["source"] || "widget"},
        label: "waitlist signup"
      )
    end

    conn |> put_status(202) |> json(%{accepted: true})
  end

  defp manifest(name) do
    %{
      list: %{
        name: name,
        description: "Join the waitlist.",
        opt_in_mode: "single",
        settings: %{success_message: "You're on the list!"},
        attributes: [
          %{slug: "email", name: "Email", type: "email", required: true, is_identity: true, sort_order: 0}
        ]
      }
    }
  end
end
