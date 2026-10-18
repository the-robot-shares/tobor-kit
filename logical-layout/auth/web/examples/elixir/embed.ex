defmodule MyApp.Auth.Router do
  @moduledoc """
  Host wiring for `<noizu-auth>`. Mounts `ToborKit.Auth.SocketPlug` and maps
  RPC methods onto the product's existing account APIs. Not an account database.
  Cookie options and salts are host-owned — do not commit production secrets.

  Six-pipe / merge-flow: this example does not implement `merge_required` — see
  docs/backend-requirements.md for the `{merge_required, challenge_id, pipes: [{type, masked}]}`
  contract `MyApp.Accounts.auth_login/2` etc. must add when the identifier already belongs to
  an account under a different pipe, and the corresponding `merge_challenge_id` a confirming
  request will carry.
  """
  use Plug.Router
  import Plug.Conn

  plug Plug.Session, store: :cookie, key: "_host_session", signing_salt: "host-owned-salt"
  plug :fetch_session
  plug :ensure_prelogin_binding
  plug :bind_auth_browser

  plug ToborKit.Auth.SocketPlug,
    handler: MyApp.Auth.ComponentHandler,
    path: "/auth/socket",
    # Server-side enforcement matching the element's invite-token-mode="required"
    # (client-side check is UX only). Options: :optional (default) | :required | :ignore.
    invite_token: :required

  plug :match
  plug :dispatch

  get "/auth/sms-regions" do
    # Host-owned public config, not part of the /auth/socket RPC surface. Not session-scoped —
    # safe to call anonymously, before the socket connects.
    send_resp(
      conn,
      200,
      Jason.encode!(%{
        supported: ["US", "CA", "GB"],
        message: "SMS is not currently available for this region."
      })
    )
  end

  get "/auth/session/finish" do
    # Redeem the one-time code bound to this browser's pre-login nonce, then
    # Set-Cookie on this HTTP response. Never set cookies from the websocket.
    binding = get_session(conn, :auth_browser_binding)
    code = conn.query_params["code"]

    case MyApp.Accounts.redeem_auth_handoff(code, binding) do
      {:ok, user_id} ->
        conn
        |> configure_session(renew: true)
        |> delete_session(:auth_browser_binding)
        |> put_session(:user_id, user_id)
        |> put_resp_header("location", "/app")
        |> send_resp(303, "")

      _ ->
        send_resp(conn, 403, "Authentication could not be completed.")
    end
  end

  get "/" do
    send_resp(conn, 200, """
    <!doctype html><meta charset="utf-8">
    <noizu-auth endpoint="/auth/socket"></noizu-auth>
    <script type="module">
      const release = await fetch("https://cdn.derobot.is/tobor-kit/latest.json", {cache:"no-cache"}).then(r => r.json());
      await import(release.auth);
    </script>
    """)
  end

  match _, do: send_resp(conn, 404, "not found")

  defp ensure_prelogin_binding(conn, _) do
    case get_session(conn, :auth_browser_binding) do
      binding when is_binary(binding) and byte_size(binding) >= 16 -> conn
      _ -> put_session(conn, :auth_browser_binding, :crypto.strong_rand_bytes(32))
    end
  end

  defp bind_auth_browser(conn, _) do
    binding = get_session(conn, :auth_browser_binding)
    put_private(conn, :tobor_auth_context, %{browser_binding: binding})
  end
end

defmodule MyApp.Auth.ComponentHandler do
  @moduledoc "Adapts product account APIs to `handle_auth/3`. Do not return tokens."

  def handle_auth("config", params, context), do: MyApp.Accounts.auth_config(params, context)
  def handle_auth("login", params, context), do: MyApp.Accounts.auth_login(params, context)
  def handle_auth("register", params, context), do: MyApp.Accounts.auth_register(params, context)
  def handle_auth("magic-link", params, context), do: MyApp.Accounts.auth_magic_link(params, context)
  def handle_auth("otp-request", params, context), do: MyApp.Accounts.auth_otp_request(params, context)
  def handle_auth("otp-verify", params, context), do: MyApp.Accounts.auth_otp_verify(params, context)
  def handle_auth(_method, _params, _context), do: {:error, "unsupported", "Unsupported method."}
end

# Expected shapes from those product functions (do not reimplement production here):
# config → {:ok, %{providers: [%{id: "authentik", href: "/auth/authentik/start"}],
#                  domain_policies: %{"noizu.com" => %{providers: ["authentik"]}}, methods: []}}
# login/register/otp-verify → {:ok, %{redirect: "/auth/session/finish?code=" <> handoff}}
# Provider start routes stay HTTP; optional helper: ToborKit.Auth.OIDC.authorization_url/2
#
# SMS-region gating: when a request carries a mobile_phone identifier the host cannot deliver
# SMS to (carrier registration incomplete, e.g. US A2P 10DLC), auth_login/2, auth_register/2, and
# auth_otp_request/2 must return {:error, "sms_region_unsupported", "SMS is not currently
# available for this region."} — this is authoritative regardless of the element's client-side
# `smsRegions` allowlist. Check it before any password/OTP verification work.

# ---------------------------------------------------------------------------
# REST transport option (`transport="rest"`) — the same element, a different wire.
# Most portfolio apps already expose a JSON auth API with Bearer-token sessions instead of
# this WebSocket. Mount the element with transport="rest" api-base="/api/v1" and implement:
#
#   POST {apiBase}/auth/login                  {email, password}
#   POST {apiBase}/auth/register               {user: {email, password, user_name, first_name, last_name, mobile_phone?}, invite_token?}
#   POST {apiBase}/auth/mobile/login           {mobile, password}
#   POST {apiBase}/auth/mobile/register        {mobile, password, code, user_name?}
#   POST {apiBase}/auth/otp/email/start        {email}                      -> 202 {status:'sent'}
#   POST {apiBase}/auth/otp/mobile/start       {mobile}                     -> 202 {status:'sent'}
#   POST {apiBase}/auth/otp/email/verify       {email, code}
#   POST {apiBase}/auth/otp/mobile/verify      {mobile, code}
#   GET  {apiBase}/auth/merge/:challenge_id    -> masked description
#   POST {apiBase}/auth/merge/confirm          {challenge_id, proof:{pipe, identifier, password|code}}
#   GET  {apiBase}/auth/config                 optional; any failure degrades to no providers
#
# Success (200 existing / 201 created):
#   {user, organizations, access_token, refresh_token, expires_in}
# Merge challenge: HTTP 409
#   {status:'merge_required', merge_challenge_id, expires_at,
#    available_pipes:[{pipe:'password_email', identifier:'g******@gmail.com'}]}
#   Backend pipe names (password_email / otp_mobile) map to the element's
#   email_password / mobile_otp. `identifier` MUST already be masked.
# Region not SMS-deliverable: HTTP 422 {"error":"sms_region_unsupported"}
#   (the 422 analogue of this socket's error.code of the same name).
# Other errors: {"error":"<code>"} + status — invalid_credentials, invalid_code,
#   expired_code, too_many_attempts, rate_limited, pipe_not_permitted,
#   merge_not_authorized, not_found, invalid_identifier, invalid_password.
#
# The element sends NO cookies in REST mode (credentials: "omit") unless
# with-credentials is set, and it NEVER stores the returned tokens — they arrive
# on auth-success / noizu-auth-success as event.detail.session and the host decides
# where they live. See docs/backend-requirements.md.
