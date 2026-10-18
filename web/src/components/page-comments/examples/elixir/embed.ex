# Phoenix / Plug host for <noizu-page-comments>.
# Serves a page that mounts the island (CDN or npm build). The annotate
# service itself is a separate production tree — see docs/backend-requirements.md.
defmodule Demo.PageCommentsController do
  use Plug.Router

  plug Plug.Logger
  plug :match
  plug Plug.Parsers, parsers: [:json], pass: ["application/json"], json_decoder: Jason
  plug :dispatch

  get "/" do
    html = """
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>page-comments host</title>
        <script type="module">
          import "https://cdn.derobot.is/tobor-kit/latest/components/page-comments/page-comments.js";
        </script>
      </head>
      <body>
        <h1>Annotatable page</h1>
        <p id="intro">Enable comments (launcher or Alt+C), then click to anchor a thread.</p>
        <noizu-page-comments site="my-site"></noizu-page-comments>
      </body>
    </html>
    """
    send_resp(conn, 200, html)
  end

  # Optional: a same-origin dev stub that mirrors the annotate contract so the
  # island can run without the real service. Production traffic goes to
  # annotate-srv.therobotlives.com instead.
  match _ do
    send_resp(conn, 404, "not found")
  end
end
