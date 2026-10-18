defmodule ToborKit.ModeToggleEmbed do
  @moduledoc """
  Serves a page that mounts `<tobor-mode-toggle>` and logs `tobor-mode-change`.

  No backend is required. Host-owned: persist `{mode, previous}` if you want.
  Never put secrets on this island.

      Plug.Cowboy.http(ToborKit.ModeToggleEmbed, [], port: 4000)
  """

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html())
  end

  defp html do
    """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>tobor-mode-toggle</title>
        <script type="importmap">
          {
            "imports": {
              "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
              "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
            }
          }
        </script>
      </head>
      <body>
        <tobor-mode-toggle id="toggle" mode="text"></tobor-mode-toggle>
        <pre id="log"></pre>
        <script type="module">
          import 'https://cdn.derobot.is/tobor-kit/latest/components/mode-toggle/mode-toggle.js';
          const el = document.querySelector('#toggle');
          el.modes = ['text', 'voice', 'transcript'];
          el.addEventListener('tobor-mode-change', (event) => {
            document.querySelector('#log').textContent = JSON.stringify(event.detail);
          });
        </script>
      </body>
    </html>
    """
  end
end
