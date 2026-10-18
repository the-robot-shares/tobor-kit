# Phoenix host: serve /auth/invite-required and a stub POST /api/v1/invites/redeem.
# The real redeem must sit behind the authenticated pipeline, be exempt from the
# invite-gate plug, and be rate-limited. See docs/backend-requirements.md.

defmodule InviteGateEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", InviteGateEmbedWeb do
    pipe_through :browser
    get "/auth/invite-required", PageController, :invite_required
  end

  scope "/api/v1", InviteGateEmbedWeb do
    # Real app: pipe_through [:api, :rate_limited_sensitive, :authenticated]
    pipe_through :api
    post "/invites/redeem", InviteController, :redeem
  end
end

defmodule InviteGateEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def invite_required(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>invite required</title>
        <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/invite-gate/noizu-invite-gate.js"></script>
      </head>
      <body>
        <noizu-invite-gate brand="therobotplans" sign-out-url="/logout"></noizu-invite-gate>
      </body>
    </html>
    """)
  end
end

defmodule InviteGateEmbedWeb.InviteController do
  use Phoenix.Controller, formats: [:json]

  # Stub. Replace with InviteGate.redeem(user, token, conn).
  def redeem(conn, %{"token" => "GOOD-INVITE"}),
    do: json(conn, %{organization_id: "org-1", organization_name: "Demo", role: "member", invite_required: false, organizations: []})

  def redeem(conn, %{"token" => "USED-INVITE"}),
    do: conn |> put_status(409) |> json(%{error: "This invite has already been used"})

  def redeem(conn, _params),
    do: conn |> put_status(404) |> json(%{error: "Invalid or expired invite token"})
end
