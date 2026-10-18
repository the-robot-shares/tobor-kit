# Phoenix host: serve <noizu-subscription-gate> and optional GET /entitlement.
# Replace the stub with a session/billing lookup. Host owns entitlement truth.
# credentials same-origin — no Authorization header, no secrets on the element.

defmodule SubscriptionGateEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", SubscriptionGateEmbedWeb do
    pipe_through :browser
    get "/", PageController, :index
  end

  scope "/", SubscriptionGateEmbedWeb do
    pipe_through :api
    get "/entitlement", EntitlementController, :show
  end
end

defmodule SubscriptionGateEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>noizu-subscription-gate</title>
        <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/subscription-gate/noizu-subscription-gate.js"></script>
      </head>
      <body>
        <h1>Subscription gate</h1>
        <noizu-subscription-gate check-url="/entitlement" redirect-to="/pricing">
          <p>Subscriber content (check-url)</p>
        </noizu-subscription-gate>
        <noizu-subscription-gate redirect-to="/pricing">
          <p>Blocked unless the host sets entitled</p>
        </noizu-subscription-gate>
        <script type="module">
          document.querySelectorAll('noizu-subscription-gate').forEach((el) => {
            el.addEventListener('gate-blocked', (event) => {
              // Host-owned navigation. auto-redirect defaults to false.
              console.info('gate-blocked', event.detail.redirectTo);
            });
          });
        </script>
      </body>
    </html>
    """)
  end
end

defmodule SubscriptionGateEmbedWeb.EntitlementController do
  use Phoenix.Controller, formats: [:json]

  def show(conn, _params) do
    # Host-owned: look up the session / billing record. This stub always entitles.
    json(conn, %{entitled: true})
  end
end
