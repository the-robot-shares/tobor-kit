defmodule ToborKit.Auth.OIDC do
  @moduledoc """
  Generic OIDC authorization-code flow with PKCE.

  Correctness details ported from NoizuPromptLingua's SSO controller and
  runtime config:

    * `state` and `nonce` live in the session and `state` is cleared
      **before** the token exchange, so a replayed callback cannot reuse a
      state value that already succeeded;
    * state comparison uses `Plug.Crypto.secure_compare/2`; a provider that
      omits the nonce it was given is tolerated, one that returns a
      **different** nonce is not;
    * the configured issuer is trimmed of a trailing slash before discovery —
      Authentik's per-provider issuers (`.../application/o/<slug>/`) 404 the
      well-known URL otherwise.

  The session is an explicit map passed in and out (`%{binary => term}`) so
  the module is framework-neutral: the host's Plug session, an ETS store, or
  JWT claims all work as the backing store. HTTP is injectable
  (`:tobor_kit, ToborKit.Auth.OIDC, http:`) for tests.
  """

  @scopes ~w(openid email profile)

  # ── flow ──────────────────────────────────────────────────────────────────

  @doc """
  Build the authorization redirect. Returns `{:ok, url, session'}` — `session'`
  carries `state`, `nonce`, and the PKCE verifier the callback will need.
  """
  @spec authorization_url(map(), keyword()) :: {:ok, String.t(), map()} | {:error, term()}
  def authorization_url(session, opts \\ []) do
    with {:ok, config} <- config(opts),
         {:ok, discovery} <- discovery(config, http(opts)) do
      state = random_token()
      nonce = random_token()
      verifier = random_token()

      challenge =
        :sha256
        |> :crypto.hash(verifier)
        |> Base.url_encode64(padding: false)

      params =
        URI.encode_query(%{
          "response_type" => "code",
          "client_id" => config.client_id,
          "redirect_uri" => config.redirect_uri,
          "scope" => Enum.join(scopes(opts), " "),
          "state" => state,
          "nonce" => nonce,
          "code_challenge" => challenge,
          "code_challenge_method" => "S256"
        })

      url = discovery["authorization_endpoint"] <> "?" <> params

      {:ok, url,
       session
       |> Map.put("oidc_state", state)
       |> Map.put("oidc_nonce", nonce)
       |> Map.put("oidc_verifier", verifier)}
    end
  end

  @doc """
  Handle the callback. Verifies state (cleared first — one-time use), then
  exchanges the code with the PKCE verifier, verifies the id token
  (signature, iss, aud, exp) and the nonce.

  Returns `{:ok, claims, session'}` — `session'` has all flow values removed,
  whether or not the exchange succeeded.
  """
  @spec callback(map(), map(), keyword()) ::
          {:ok, map(), map()} | {:error, term(), map()}
  def callback(params, session, opts \\ []) do
    expected_state = session["oidc_state"]
    expected_nonce = session["oidc_nonce"]
    verifier = session["oidc_verifier"]

    # One-time use: cleared before the exchange.
    session = Map.drop(session, ["oidc_state", "oidc_nonce", "oidc_verifier"])

    http_fn = http(opts)

    with :ok <- verify_state(expected_state, params["state"]),
         {:ok, config} <- config(opts),
         {:ok, discovery} <- discovery(config, http_fn),
         {:ok, tokens} <- fetch_tokens(config, discovery, params["code"], verifier, http_fn),
         {:ok, claims} <-
           verify_id_token(config, discovery, tokens["id_token"], expected_nonce, http_fn) do
      {:ok, claims, session}
    else
      {:error, reason} -> {:error, reason, session}
      {:error, reason, _} -> {:error, reason, session}
    end
  end

  # ── pieces (exposed for tests) ────────────────────────────────────────────

  @doc "Issuer with trailing slash stripped — Authentik per-provider issuers 404 discovery otherwise."
  def normalize_issuer(issuer) when is_binary(issuer),
    do: issuer |> String.trim() |> String.trim_trailing("/")

  def normalize_issuer(_), do: nil

  def discovery_document_uri(issuer),
    do: normalize_issuer(issuer) <> "/.well-known/openid-configuration"

  @doc "secure_compare state check; both sides must be present."
  def verify_state(expected, received) when is_binary(expected) and is_binary(received) do
    if Plug.Crypto.secure_compare(expected, received), do: :ok, else: {:error, :state_mismatch}
  end

  def verify_state(_, _), do: {:error, :state_mismatch}

  def verify_nonce(_expected, nil), do: :ok
  def verify_nonce(nil, _received), do: :ok

  def verify_nonce(expected, received) do
    if Plug.Crypto.secure_compare(expected, received), do: :ok, else: {:error, :nonce_mismatch}
  end

  @doc """
  Verify an id token: JWKS signature, `iss` against the *normalized* issuer,
  `aud` against the client id, `exp` in the future, then `nonce`.
  """
  def verify_id_token(config, discovery, id_token, expected_nonce, http_fn) do
    with {:ok, %{"kid" => kid, "alg" => alg} = _header} when is_binary(kid) <-
           peek_header(id_token),
         {:ok, jwks} <- http_fn.({:get, discovery["jwks_uri"]}),
         {:ok, jwk} <- find_jwk(jwks, kid),
         {:ok, claims} <- verify_signature(id_token, alg, jwk) do
      cond do
        claims["iss"] != normalize_issuer(discovery["issuer"]) ->
          {:error, :issuer_mismatch}

        not aud_contains?(claims["aud"], config.client_id) ->
          {:error, :aud_mismatch}

        not unexpired?(claims["exp"]) ->
          {:error, :token_expired}

        true ->
          case verify_nonce(expected_nonce, claims["nonce"]) do
            :ok -> {:ok, claims}
            error -> error
          end
      end
    end
  end

  # ── internals ─────────────────────────────────────────────────────────────

  defp config(opts) do
    cfg = Application.get_env(:tobor_kit, __MODULE__, [])

    issuer = Keyword.get(opts, :issuer) || cfg[:issuer]
    client_id = Keyword.get(opts, :client_id) || cfg[:client_id]
    redirect_uri = Keyword.get(opts, :redirect_uri) || cfg[:redirect_uri]

    if issuer && client_id && redirect_uri do
      {:ok, %{issuer: issuer, client_id: client_id, redirect_uri: redirect_uri}}
    else
      {:error, :oidc_not_configured}
    end
  end

  defp scopes(opts) do
    case Keyword.get(opts, :scopes) do
      s when is_list(s) and s != [] -> s
      _ -> Application.get_env(:tobor_kit, __MODULE__, [])[:scopes] || @scopes
    end
  end

  defp discovery(config, http_fn) do
    with {:ok, body} <- http_fn.({:get, discovery_document_uri(config.issuer)}),
         {:ok, doc} <- Jason.decode(body),
         true <- is_binary(doc["authorization_endpoint"]) and is_binary(doc["token_endpoint"]) do
      {:ok, doc}
    else
      _ -> {:error, :discovery_failed}
    end
  end

  defp fetch_tokens(config, discovery, code, verifier, http_fn) do
    form = [
      {"grant_type", "authorization_code"},
      {"code", code},
      {"redirect_uri", config.redirect_uri},
      {"client_id", config.client_id},
      {"code_verifier", verifier}
    ]

    case http_fn.({:post_form, discovery["token_endpoint"], form}) do
      {:ok, body} ->
        body = if is_map(body), do: Map.get(body, :body) || Map.get(body, "body"), else: body

        case Jason.decode(body) do
          {:ok, %{"id_token" => _} = tokens} -> {:ok, tokens}
          _ -> {:error, :token_exchange_failed}
        end

      _ ->
        {:error, :token_exchange_failed}
    end
  end

  defp peek_header(id_token) when is_binary(id_token) do
    case String.split(id_token, ".") do
      [header, _payload, _sig] ->
        case Base.url_decode64(header, padding: false) do
          {:ok, json} -> Jason.decode(json)
          _ -> {:error, :malformed_id_token}
        end

      _ ->
        {:error, :malformed_id_token}
    end
  end

  defp peek_header(_), do: {:error, :malformed_id_token}

  defp find_jwk(jwks, kid) when is_binary(jwks) do
    case Jason.decode(jwks) do
      {:ok, doc} -> find_jwk(doc, kid)
      _ -> {:error, :unknown_signing_key}
    end
  end

  defp find_jwk(jwks, kid) do
    case Enum.find(jwks["keys"] || [], &(&1["kid"] == kid)) do
      nil -> {:error, :unknown_signing_key}
      jwk -> {:ok, jwk}
    end
  end

  defp verify_signature(id_token, alg, jwk) do
    # verify_strict dispatches on its first argument: a plain map would be
    # treated as a signed payload, so materialize a real JWK struct.
    jwk = jose_jwk(jwk)

    try do
      case JOSE.JWT.verify_strict(jwk, [alg], id_token) do
        {true, %JOSE.JWT{fields: claims}, _} -> {:ok, claims}
        _ -> {:error, :signature_invalid}
      end
    rescue
      _ -> {:error, :signature_invalid}
    end
  end

  # JOSE switches between struct and {modules, struct} return shapes
  # depending on app config; apply/3 keeps the compiler's type inference
  # (which only sees one shape) from flagging the tuple clause as dead.
  defp jose_jwk(map) do
    case apply(JOSE.JWK, :from_map, [map]) do
      {_, jwk} -> jwk
      jwk -> jwk
    end
  end

  defp aud_contains?(aud, client_id) when is_list(aud), do: client_id in aud
  defp aud_contains?(aud, client_id) when is_binary(aud), do: aud == client_id
  defp aud_contains?(_, _), do: false

  defp unexpired?(exp) when is_integer(exp), do: exp > System.system_time(:second)
  defp unexpired?(_), do: false

  defp random_token, do: :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)

  defp http(opts) do
    Keyword.get(opts, :http) || Application.get_env(:tobor_kit, __MODULE__, [])[:http] ||
      (&__MODULE__.default_http/1)
  end

  @doc false
  def default_http({:get, url}) do
    case Req.get(url, receive_timeout: 10_000) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        {:ok, if(is_binary(body), do: body, else: Jason.encode!(body))}

      _ ->
        {:error, :http_error}
    end
  end

  def default_http({:post_form, url, form}) do
    case Req.post(url, form: form, receive_timeout: 10_000) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        {:ok, if(is_binary(body), do: body, else: Jason.encode!(body))}

      _ ->
        {:error, :http_error}
    end
  end
end
