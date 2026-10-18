defmodule ExampleWeb.PhoneInputController do
  @moduledoc """
  Phoenix/Plug host snippet: serve a page that mounts `<noizu-phone-input>`.

  No phone API. Router: `get "/phone", PhoneInputController, :index`.
  Host-owned: uniqueness / OTP. Never put secrets on the element.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>noizu-phone-input</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/phone-input/noizu-phone-input.js"></script>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; background: #12131a; color: #e8e9f0; }
      </style>
    </head>
    <body>
      <h1>Phone</h1>
      <noizu-phone-input country="US" name="phone"></noizu-phone-input>
      <pre id="log"></pre>
      <script type="module">
        const el = document.querySelector('noizu-phone-input');
        const log = document.querySelector('#log');
        for (const name of ['country-change', 'phone-change', 'phone-invalid']) {
          el.addEventListener(name, (event) => {
            log.textContent = name + ' ' + JSON.stringify(event.detail);
          });
        }
      </script>
    </body>
  </html>
  """

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, @page)
  end
end
