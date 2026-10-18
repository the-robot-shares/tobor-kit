defmodule ToborKit.Hologram.LoginFlow.Flow do
  @moduledoc """
  Mirror of `<tobor-login-flow>` (registry: `login-flow` family) — OIDC
  Authorization Code + PKCE sign-in button. Contract class B **plus
  server commands** (PORTING.md §6.7/§9): `action/3` owns client state,
  `command/3` performs the privileged half.

  Lit surface → mirror surface:

    * `auth` JS property (GuideAuth: provider/issuer/client_id/scopes/
      redirect_path/required — all public) → string-keyed `:map` prop,
      copied into state by `init/3`.
    * `callback-search` attr → `:callback_search` prop. When it parses to
      `{code, state}`, `init/3` chains `:begin_exchange` (client-mount
      action — PORTING.md "chaining actions in initialization") which
      dispatches the `:exchange` command.
    * `auto-redirect` attr → `:auto_redirect` prop (default `true`).
    * event `tobor-auth-redirect` `{url}` → action `:tobor_auth_redirect`
      `%{url: url}` forwarded to the host `:target` — see the divergence
      note below.
    * event `tobor-auth-token` `{tokens}` → action `:tobor_auth_token`
      with `access_token` / `token_type` / `expires_in` / `id_token`.
    * event `tobor-auth-error` `{error}` → action `:tobor_auth_error`
      `%{error: message}`.

  ## Security model (the reason this mirror has commands)

  The Lit element ran the whole flow in the browser with a **public**
  PKCE client. The mirror keeps exactly that on the client (issuer,
  client_id, scopes — props/state are client-visible) and moves the
  privileged half server-side:

    * **PKCE verifier/state** are generated in `command/3`
      (`:crypto.strong_rand_bytes`) and stashed in the Hologram **session**
      (`put_session/3`), not `sessionStorage`. Documented divergence: the
      verifier is never client-visible at all, which is strictly stronger
      than the Lit sessionStorage contract.
    * **client_secret** (optional; Authentik deployments frequently require
      one even for public-style clients) resolves from
      `HostConfig.resolve(:auth)` — `%{client_secret: ..., redirect_uri: ...}`
      or `%{origin: ...}` + the projection's `redirect_path`. It never
      crosses the wire.
    * **Token redaction**: the exchange result action carries
      `access_token`, `token_type`, `expires_in`, `id_token` — the host app
      needs the access token to call APIs. `refresh_token` is **dropped**
      (long-lived privileged grant; the host should mint refresh through
      its own backend). Component state keeps only the `:signed_in` flag —
      tokens live in the action params for the handoff instant, never in
      mirror state.
    * The address-bar cleanup Lit performed
      (`history.replaceState`) has no mirror equivalent — the callback
      search string is host-provided, so the host owns URL hygiene.

  ## Divergences

    * **`tobor-auth-redirect` fires only when `auto_redirect` is false.**
      Hologram allows one `next_action` per handler; when the mirror is
      about to navigate away via `Hologram.JS` interop
      (`JS.get(:window, :location)` + `JS.call(loc, :assign, [url])`,
      PORTING.md §6.8) the forward is dropped — the browser is leaving
      anyway. Hosts that want the event pass `auto_redirect={false}` and
      navigate themselves from a rendered `<a href>` fallback
      (`redirect_url` state).
    * Query params are matched verbatim (no percent-decoding) — OIDC
      `code`/`state` values are URL-safe by spec.
  """

  use Hologram.Component
  use Hologram.JS

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  @session_state "tobor_kit_pkce_state"
  @session_verifier "tobor_kit_pkce_verifier"

  prop :auth, :map, default: %{}
  prop :callback_search, :string, default: ""
  prop :auto_redirect, :boolean, default: true
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-login-flow", @class)}>
      {%if auth_disabled?(@auth)}
        {""}
      {%else}
        {%if @status == :error}
          <div class="tk-login-flow__notice tk-login-flow__notice--error" data-testid="login-error">
            {@error}
          </div>
        {%else}
          {%if @status == :signed_in}
            <span class="tk-login-flow__user" data-testid="login-user">Signed in</span>
          {%else}
            <button
              type="button"
              class="tk-login-flow__button"
              data-testid="login-button"
              $click={:login}
            >
              Sign in
            </button>
          {/if}
        {/if}
      {/if}
      {%if @redirect_url != ""}
        <a class="tk-login-flow__fallback" href={@redirect_url}>Continue to sign in</a>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    component =
      put_state(component,
        auth: Map.get(props, :auth) || %{},
        auto_redirect: Map.get(props, :auto_redirect) != false,
        target: Map.get(props, :target) || "parent",
        status: :idle,
        error: "",
        redirect_url: ""
      )

    case parse_callback(Map.get(props, :callback_search) || "") do
      %{code: code, state: state} ->
        put_action(component, name: :begin_exchange, params: %{code: code, state: state})

      nil ->
        component
    end
  end

  # -- client actions --------------------------------------------------------

  # Lit `#login`: the button click. PKCE material is generated server-side;
  # the action only flips to pending and dispatches the command.
  def action(:login, _params, component) do
    component
    |> put_state(status: :pending)
    |> put_command(:begin_login, %{
      issuer: Map.get(component.state.auth, "issuer") || "",
      client_id: Map.get(component.state.auth, "client_id") || "",
      redirect_path: Map.get(component.state.auth, "redirect_path") || "",
      scopes: Map.get(component.state.auth, "scopes") || []
    })
  end

  # Command result: the authorize URL is ready. Redirect (§6.8 JS interop)
  # or hand the URL to the host — one or the other (one-shot next_action).
  def action(:auth_redirect, %{url: url}, component) do
    if component.state.auto_redirect do
      location = JS.get(:window, :location)
      JS.call(location, :assign, [url])

      put_state(component, status: :redirecting, redirect_url: url)
    else
      put_state(component, status: :redirecting, redirect_url: url)
      |> put_action(name: :tobor_auth_redirect, params: %{url: url}, target: component.state.target)
    end
  end

  # Mount-chained (init/3) when a callback query string was provided.
  def action(:begin_exchange, %{code: code, state: state}, component) do
    auth = component.state.auth

    component
    |> put_state(status: :pending)
    |> put_command(:exchange, %{
      code: code,
      state: state,
      issuer: Map.get(auth, "issuer") || "",
      client_id: Map.get(auth, "client_id") || "",
      redirect_path: Map.get(auth, "redirect_path") || ""
    })
  end

  def action(:begin_exchange, _params, component), do: component

  # Command result: tokens. Forward the redacted set to the host; the
  # mirror itself retains only the signed-in flag (never the tokens).
  def action(:exchange_ok, %{tokens: tokens}, component) do
    forwarded = %{
      access_token: Map.get(tokens, "access_token") || Map.get(tokens, :access_token) || "",
      token_type: Map.get(tokens, "token_type") || Map.get(tokens, :token_type) || "",
      expires_in: Map.get(tokens, "expires_in") || Map.get(tokens, :expires_in),
      id_token: Map.get(tokens, "id_token") || Map.get(tokens, :id_token)
    }

    put_state(component, status: :signed_in)
    |> put_action(name: :tobor_auth_token, params: forwarded, target: component.state.target)
  end

  def action(:exchange_ok, _params, component), do: component

  def action(:exchange_failed, %{error: error}, component) do
    put_state(component, status: :error, error: error)
    |> put_action(name: :tobor_auth_error, params: %{error: error}, target: component.state.target)
  end

  def action(:exchange_failed, _params, component), do: component

  # No-op catch-all so a stray event never crashes the page (§6.3).
  def action(_name, _params, component), do: component

  # -- server commands -------------------------------------------------------

  @doc """
  `:begin_login` — generate PKCE material, stash it in the session, and
  return the authorize URL via `:auth_redirect`.
  """
  def command(:begin_login, params, %Hologram.Server{} = server) do
    params = HostConfig.from_params!(params)

    if Map.get(params, :issuer) in [nil, ""] or Map.get(params, :client_id) in [nil, ""] do
      put_action(server, :exchange_failed, %{error: "auth is not configured — missing issuer or client_id"})
    else
      state = random_token(24)
      verifier = random_token(64)
      challenge = code_challenge(verifier)

      server = server |> put_session(@session_state, state) |> put_session(@session_verifier, verifier)

      url =
        build_authorize_url(%{
          issuer: Map.get(params, :issuer),
          client_id: Map.get(params, :client_id),
          redirect_uri: redirect_uri(server, params),
          scopes: Map.get(params, :scopes) || ["openid", "email", "profile"],
          state: state,
          code_challenge: challenge
        })

      put_action(server, :auth_redirect, %{url: url})
    end
  end

  # `:exchange` — verify the callback state against the session, resolve the
  # secret half from `HostConfig.resolve(:auth)`, and POST the token
  # exchange. Returns `:exchange_ok` (redacted tokens) or `:exchange_failed`.
  def command(:exchange, params, %Hologram.Server{} = server) do
    params = HostConfig.from_params!(params)

    stored_state = get_session(server, @session_state)
    verifier = get_session(server, @session_verifier)

    cond do
      stored_state in [nil, ""] ->
        put_action(server, :exchange_failed, %{error: "no PKCE verifier for this callback"})

      stored_state != Map.get(params, :state) ->
        put_action(server, :exchange_failed, %{error: "state mismatch — ignoring callback"})

      true ->
        server = server |> delete_session(@session_state) |> delete_session(@session_verifier)
        exchange_code(server, params, verifier)
    end
  end

  def command(_name, _params, server), do: server

  defp exchange_code(server, params, verifier) do
    config = HostConfig.resolve(:auth)

    form = %{
      grant_type: "authorization_code",
      client_id: Map.get(params, :client_id),
      redirect_uri: redirect_uri(server, params, config),
      code: Map.get(params, :code),
      code_verifier: verifier
    }

    form =
      case Map.get(config, :client_secret) do
        nil -> form
        secret -> Map.put(form, :client_secret, secret)
      end

    url = normalize_issuer(Map.get(params, :issuer)) <> "/token"

    case Http.post_form(url, form) do
      {:ok, body} when is_map(body) ->
        put_action(server, :exchange_ok, %{tokens: body})

      {:ok, _body} ->
        put_action(server, :exchange_failed, %{error: "token exchange failed — malformed response"})

      {:error, %{status: status}} ->
        put_action(server, :exchange_failed, %{error: "token exchange failed (#{status})"})

      {:error, %{reason: reason}} ->
        put_action(server, :exchange_failed, %{error: "token exchange failed — #{reason}"})
    end
  rescue
    e in ArgumentError ->
      put_action(server, :exchange_failed, %{error: Exception.message(e)})
  end

  # -- public helpers --------------------------------------------------------

  @doc "Lit `normalizeIssuer` — strip trailing slashes (regex-free)."
  def normalize_issuer(issuer) when is_binary(issuer), do: String.trim_trailing(issuer, "/")
  def normalize_issuer(nil), do: ""

  @doc """
  Lit `parseCallback` — `{"code" => ..., "state" => ...}` as a map, or
  `nil`. Verbatim matching, no percent-decoding (OIDC values are URL-safe).
  """
  def parse_callback(search) when is_binary(search) do
    pairs =
      search
      |> String.trim_leading("?")
      |> String.split("&", trim: true)

    code = query_param(pairs, "code")
    state = query_param(pairs, "state")

    if code && state, do: %{code: code, state: state}, else: nil
  end

  def parse_callback(nil), do: nil

  @doc """
  Lit `buildAuthorizeUrl` — S256 PKCE authorize URL. Server-side only
  (uses `URI.encode_query/1`).
  """
  def build_authorize_url(options) do
    query =
      URI.encode_query(%{
        "response_type" => "code",
        "client_id" => options.client_id,
        "redirect_uri" => options.redirect_uri,
        "scope" => Enum.join(options.scopes, " "),
        "state" => options.state,
        "code_challenge" => options.code_challenge,
        "code_challenge_method" => "S256"
      })

    normalize_issuer(options.issuer) <> "/authorize?" <> query
  end

  @doc "Lit render gate: `provider == \"none\"` or `required == false` renders nothing."
  def auth_disabled?(auth) do
    Map.get(auth, "provider") == "none" or Map.get(auth, "required") == false
  end

  @doc """
  Lit `redactTokens` decision: the exchange action forwards `access_token`
  (host apps need it), `token_type`, `expires_in`, `id_token`. `refresh_token`
  is dropped — long-lived grant, host backend territory.
  """
  def redact_tokens(tokens) when is_map(tokens) do
    tokens
    |> Map.drop(["refresh_token", :refresh_token])
  end

  # -- server-side private helpers -------------------------------------------

  defp redirect_uri(server, params, config \\ nil)

  defp redirect_uri(_server, params, config) when is_map(config) do
    case Map.get(config, :redirect_uri) do
      nil -> origin_uri(config, params)
      uri -> uri
    end
  end

  defp redirect_uri(server, params, _config) do
    case safe_resolve_auth() do
      nil -> origin_uri(%{}, params)
      config -> redirect_uri(server, params, config)
    end
  end

  defp origin_uri(config, params) do
    path = Map.get(params, :redirect_path)
    path = if path in [nil, ""], do: "/auth/oidc/callback", else: path

    case Map.get(config, :origin) do
      nil -> path
      origin -> String.trim_trailing(origin, "/") <> path
    end
  end

  defp safe_resolve_auth do
    HostConfig.resolve(:auth)
  rescue
    _ -> nil
  end

  defp query_param(pairs, key) do
    Enum.find_value(pairs, fn pair ->
      case String.split(pair, "=", parts: 2) do
        [^key, value] -> value
        [^key] -> ""
        _ -> nil
      end
    end)
  end

  defp random_token(length) do
    length
    |> then(fn len -> :crypto.strong_rand_bytes(div(len * 3, 4) + 1) end)
    |> Base.url_encode64(padding: false)
    |> binary_part(0, length)
  end

  defp code_challenge(verifier) do
    :crypto.hash(:sha256, verifier)
    |> Base.url_encode64(padding: false)
  end
end
