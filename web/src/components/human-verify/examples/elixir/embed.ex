# Phoenix host: serve <noizu-human-verify> and POST /verify → provider siteverify.
# Secrets stay in env (TURNSTILE_SECRET, RECAPTCHA_SECRET). Never on the element.
# provider=none skips siteverify (host opted out).
#
# Router:
#   get "/", HumanVerifyController, :index
#   post "/verify", HumanVerifyController, :create

defmodule HumanVerifyEmbedWeb.HumanVerifyController do
  use Phoenix.Controller, formats: [:html, :json]

  @turnstile "https://challenges.cloudflare.com/turnstile/v0/siteverify"
  @recaptcha "https://www.google.com/recaptcha/api/siteverify"

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>noizu-human-verify</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/human-verify/noizu-human-verify.js"></script>
    </head>
    <body>
      <noizu-human-verify provider="none" action="signup"></noizu-human-verify>
      <script type="module">
        const el = document.querySelector('noizu-human-verify');
        el.addEventListener('verified', (event) => {
          fetch('/verify', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(event.detail),
          }).then((r) => r.json()).then((b) => console.info('verify', b));
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

  def create(conn, %{"provider" => "none"}) do
    json(conn, %{ok: true, skipped: true})
  end

  def create(conn, %{"provider" => "turnstile", "token" => token}) do
    siteverify(conn, @turnstile, System.get_env("TURNSTILE_SECRET"), token, "set TURNSTILE_SECRET")
  end

  def create(conn, %{"provider" => "recaptcha-v3", "token" => token}) do
    siteverify(conn, @recaptcha, System.get_env("RECAPTCHA_SECRET"), token, "set RECAPTCHA_SECRET")
  end

  def create(conn, _params) do
    conn |> put_status(400) |> json(%{ok: false, error: "token required"})
  end

  defp siteverify(conn, _url, secret, token, hint)
       when secret in [nil, ""] or token in [nil, ""] do
    if secret in [nil, ""] do
      conn |> put_status(501) |> json(%{ok: false, error: hint})
    else
      conn |> put_status(400) |> json(%{ok: false, error: "token required"})
    end
  end

  defp siteverify(conn, url, secret, token, _hint) do
    :inets.start()
    :ssl.start()
    body = URI.encode_query(%{"secret" => secret, "response" => token})
    request = {String.to_charlist(url), [], ~c"application/x-www-form-urlencoded", String.to_charlist(body)}

    case :httpc.request(:post, request, [], []) do
      {:ok, {{_, 200, _}, _, resp}} ->
        payload = Jason.decode!(List.to_string(resp))

        if payload["success"] == true do
          json(conn, %{ok: true})
        else
          conn
          |> put_status(403)
          |> json(%{ok: false, error: "verification failed", "error-codes": payload["error-codes"] || []})
        end

      _ ->
        conn |> put_status(502) |> json(%{ok: false, error: "siteverify unreachable"})
    end
  end
end
