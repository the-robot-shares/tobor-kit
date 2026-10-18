defmodule ToborKit.FooterBrandEmbed do
  @moduledoc """
  Serves a page that mounts `<noizu-footer-brand>` in a site footer.

  No backend is required — the island is presentational. Host-owned: the
  link destination and any analytics around it. Never put secrets on this
  island.

      Plug.Cowboy.http(ToborKit.FooterBrandEmbed, [], port: 4000)
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
        <title>noizu-footer-brand</title>
        <script type="importmap">
          {
            "imports": {
              "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
              "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
            }
          }
        </script>
        <style>
          body { font-family: system-ui, sans-serif; margin: 2rem; background: #12131a; color: #e8e9f0; }
          footer { margin-top: 3rem; display: grid; gap: 1rem; }
        </style>
      </head>
      <body>
        <footer>
          <noizu-footer-brand></noizu-footer-brand>
          <noizu-footer-brand
            prefix="Built by"
            suffix=""
            brand="Noizu Labs"
            href="https://noizu.com"
            target="_blank"
            palette="accent"
            align="end"
          ></noizu-footer-brand>
        </footer>
        <script type="module">
          import 'https://cdn.derobot.is/tobor-kit/latest/components/footer-brand/noizu-footer-brand.js';
        </script>
      </body>
    </html>
    """
  end
end
