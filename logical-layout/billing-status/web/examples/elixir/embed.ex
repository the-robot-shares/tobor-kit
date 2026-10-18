defmodule ExampleWeb.BillingStatusController do
  @moduledoc """
  Phoenix/Plug host snippet: serve a page that mounts `<noizu-billing-status>`.

  Router:
    get "/", BillingStatusController, :index
    post "/billing/portal", BillingStatusController, :portal

  Host supplies the subscription snapshot in page JS. POST /billing/portal is
  host-owned (create a Stripe Billing Portal session server-side). Never put
  `sk_…` on the element. No kit billing API in this repo.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>noizu-billing-status</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/billing-status/noizu-billing-status.js"></script>
    </head>
    <body>
      <h1>Billing</h1>
      <noizu-billing-status></noizu-billing-status>
      <script type="module">
        const el = document.querySelector('noizu-billing-status');
        // Host-owned snapshot. Never a Stripe secret on the element.
        el.subscription = {status: 'active', planName: 'Pro', renewsAt: '2026-10-01'};
        el.addEventListener('portal-open', () => {
          fetch('/billing/portal', {method: 'POST', credentials: 'same-origin'})
            .then((res) => res.json())
            .then((body) => { if (body.url) location.assign(body.url); });
        });
      </script>
    </body>
  </html>
  """

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, @page)
  end

  def portal(conn, _params) do
    # Host-owned: Stripe Billing Portal session. Stub URL only — no secrets here.
    json(conn, %{url: "https://billing.example.test/session"})
  end
end
