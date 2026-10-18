defmodule ExampleWeb.CookieController do
  @moduledoc """
  Phoenix host snippet: serve both cookie tags.

  Router:
    get "/", CookieController, :index
    post "/consent", CookieController, :create

  Optional POST /consent echoes `cookie-consent-change` / `start-app:cookie-consent-change`.
  Host-owned persistence, CSRF, and session cookies stay off the element.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>cookie family</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-consent.js"></script>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-settings.js"></script>
    </head>
    <body>
      <noizu-cookie-settings>Cookie Settings</noizu-cookie-settings>
      <noizu-cookie-consent storage-key="start-app.cookie-consent.v1" mode="categories"></noizu-cookie-consent>
      <script type="module">
        window.addEventListener('start-app:cookie-consent-change', (event) => {
          if (!event.detail) return;
          fetch('/consent', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(event.detail),
          });
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

  def create(conn, params) do
    json(conn, %{ok: true, consent: params})
  end
end
