defmodule MyApp.LoginFlowEmbed do
  @moduledoc """
  Host Plug: serve `<tobor-login-flow>` and own OIDC start/callback + cookies.

  Calls `ToborKit.Auth.OIDC` — does not reimplement PKCE. Public config only
  on the page (`issuer`, `client_id`, `scopes`, `redirect_path`). Never a
  client secret. Cookie signing keys and the real IdP stay in host config.
  """

  use Plug.Router

  plug Plug.Logger
  plug :match
  plug :dispatch

  @redirect_path "/auth/oidc/callback"

  get "/" do
    # Public values — same keys as GET /api/tobor-kit/guide → auth.
    auth = %{
      "required" => true,
      "provider" => "authentik",
      "issuer" => System.get_env("TOBOR_KIT_OIDC_ISSUER"),
      "client_id" => System.get_env("TOBOR_KIT_OIDC_CLIENT_ID"),
      "scopes" => ["openid", "email", "profile"],
      "redirect_path" => @redirect_path
    }

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, page(auth))
  end

  # Optional host-owned start (server holds PKCE verifier). Do not mix with
  # the element's sessionStorage verifier.
  get "/auth/oidc" do
    session = Map.get(conn.private, :oidc_session, %{})

    case ToborKit.Auth.OIDC.authorization_url(session) do
      {:ok, url, session} ->
        conn
        |> Plug.Conn.put_private(:oidc_session, session)
        |> Plug.Conn.put_resp_header("location", url)
        |> send_resp(302, "")

      {:error, :oidc_not_configured} ->
        send_resp(conn, 503, "oidc not configured")

      {:error, _} ->
        send_resp(conn, 502, "oidc start failed")
    end
  end

  # Host owns token exchange + cookies. 302 off this path before rendering
  # the island with ?code= still in the URL.
  get @redirect_path do
    params = conn.query_params
    session = Map.get(conn.private, :oidc_session, %{})

    case ToborKit.Auth.OIDC.callback(params, session) do
      {:ok, claims, session} ->
        conn
        |> Plug.Conn.put_private(:oidc_session, session)
        |> Plug.Conn.put_resp_cookie("tobor_session", claims["sub"],
          http_only: true,
          secure: true,
          same_site: "Lax",
          path: "/"
        )
        |> Plug.Conn.put_resp_header("location", "/")
        |> send_resp(302, "")

      {:error, _reason, session} ->
        conn
        |> Plug.Conn.put_private(:oidc_session, session)
        |> Plug.Conn.put_resp_header("location", "/?login=error")
        |> send_resp(302, "")
    end
  end

  # Public-PKCE path: element emitted tobor-auth-token. Host verifies JWKS
  # (not shown) and Set-Cookie. Never accept a client secret from the browser.
  post "/auth/session" do
    send_resp(conn, 204, "")
  end

  match _ do
    send_resp(conn, 404, "not found")
  end

  defp page(auth) do
    """
    <!doctype html>
    <html lang="en">
      <body>
        <tobor-login-flow id="login"></tobor-login-flow>
        <script type="module">
          import 'https://cdn.derobot.is/tobor-kit/latest/components/login-flow/login-flow.js';
          const el = document.getElementById('login');
          el.auth = #{Jason.encode!(auth)};
          el.addEventListener('tobor-auth-token', async (e) => {
            await fetch('/auth/session', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {'content-type': 'application/json'},
              body: JSON.stringify({id_token: e.detail.tokens.id_token}),
            });
          });
        </script>
      </body>
    </html>
    """
  end
end
