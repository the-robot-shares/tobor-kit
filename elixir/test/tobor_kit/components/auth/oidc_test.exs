defmodule ToborKit.Auth.OIDCTest do
  use ExUnit.Case, async: false

  alias ToborKit.Auth.OIDC

  @issuer "https://auth.derobot.is/application/o/tobor-kit/"
  @client_id "tobor-kit"
  @redirect_uri "https://tobor.example.com/auth/oidc/callback"

  describe "issuer normalization" do
    test "strips the trailing slash that 404s Authentik discovery" do
      assert OIDC.normalize_issuer("https://auth.example.com/application/o/tobor-kit/") ==
               "https://auth.example.com/application/o/tobor-kit"

      assert OIDC.normalize_issuer("https://auth.example.com") == "https://auth.example.com"

      assert OIDC.discovery_document_uri(@issuer) ==
               "https://auth.derobot.is/application/o/tobor-kit/.well-known/openid-configuration"
    end
  end

  test "authorization_url puts state, nonce, and PKCE verifier in the session; challenge is S256" do
    {http, recorder} = ToborKit.TestSupport.OIDCRecorder.start()

    {:ok, url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    params = URI.decode_query(URI.parse(url).query)

    assert params["client_id"] == @client_id
    assert params["redirect_uri"] == @redirect_uri
    assert params["response_type"] == "code"
    assert params["code_challenge_method"] == "S256"
    assert String.length(params["code_challenge"]) == 43
    assert session["oidc_state"] == params["state"]
    assert session["oidc_nonce"] == params["nonce"]
    assert is_binary(session["oidc_verifier"])

    # The PKCE challenge really is S256(verifier).
    expected =
      :sha256 |> :crypto.hash(session["oidc_verifier"]) |> Base.url_encode64(padding: false)

    assert params["code_challenge"] == expected

    # Discovery was fetched from the slash-stripped issuer.
    assert [{:get, discovery_url}] = ToborKit.TestSupport.OIDCRecorder.calls(recorder)

    assert discovery_url ==
             "https://auth.derobot.is/application/o/tobor-kit/.well-known/openid-configuration"
  end

  test "state is verified and cleared before the exchange" do
    {http, _recorder} = ToborKit.TestSupport.OIDCRecorder.start()

    {:ok, _url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    assert {:error, :state_mismatch, cleared} =
             OIDC.callback(%{"code" => "c", "state" => "forged"}, session, oidc_opts(http))

    refute Map.has_key?(cleared, "oidc_state")
    refute Map.has_key?(cleared, "oidc_nonce")
    refute Map.has_key?(cleared, "oidc_verifier")

    assert {:error, :state_mismatch, _} =
             OIDC.callback(%{"code" => "c"}, session, oidc_opts(http))
  end

  test "full callback: exchange carries the code and PKCE verifier; claims verified" do
    {http, holder} = ToborKit.TestSupport.OIDCRecorder.start()

    {:ok, _url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    # The fake IdP mints the token for THIS session's nonce.
    ToborKit.TestSupport.OIDCRecorder.set(holder, nonce: session["oidc_nonce"])

    assert {:ok, claims, cleared} =
             OIDC.callback(
               %{"code" => "authcode", "state" => session["oidc_state"]},
               session,
               oidc_opts(http)
             )

    assert claims["sub"] == "user-123"
    assert claims["email"] == "testing@therobotlives.com"
    refute Map.has_key?(cleared, "oidc_state")

    calls = ToborKit.TestSupport.OIDCRecorder.calls(self())
    {:post_form, token_url, form} = Enum.find(calls, &match?({:post_form, _, _}, &1))
    assert token_url == "https://auth.derobot.is/application/o/tobor-kit/token"
    assert {"code", "authcode"} in form
    assert {"code_verifier", session["oidc_verifier"]} in form
    assert {"grant_type", "authorization_code"} in form
    assert {"client_id", @client_id} in form
  end

  test "callback with a different nonce is rejected even when the signature is valid" do
    {http, _} = ToborKit.TestSupport.OIDCRecorder.start(nonce: "other-nonce")

    {:ok, _url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    assert {:error, :nonce_mismatch, _} =
             OIDC.callback(
               %{"code" => "authcode", "state" => session["oidc_state"]},
               session,
               oidc_opts(http)
             )
  end

  test "a token signed by an unknown key fails strict verification" do
    {http, _} = ToborKit.TestSupport.OIDCRecorder.start(sign_with: :rogue)

    {:ok, _url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    assert {:error, :signature_invalid, _} =
             OIDC.callback(
               %{"code" => "authcode", "state" => session["oidc_state"]},
               session,
               oidc_opts(http)
             )
  end

  test "id token whose iss does not match is rejected" do
    {http, _} =
      ToborKit.TestSupport.OIDCRecorder.start(
        issuer: "https://evil.example.com/application/o/tobor-kit"
      )

    {:ok, _url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    assert {:error, :issuer_mismatch, _} =
             OIDC.callback(
               %{"code" => "authcode", "state" => session["oidc_state"]},
               session,
               oidc_opts(http)
             )
  end

  test "expired id token is rejected" do
    {http, _} = ToborKit.TestSupport.OIDCRecorder.start(exp_offset: -300)

    {:ok, _url, session} =
      OIDC.authorization_url(%{},
        issuer: @issuer,
        client_id: @client_id,
        redirect_uri: @redirect_uri,
        http: http
      )

    assert {:error, :token_expired, _} =
             OIDC.callback(
               %{"code" => "authcode", "state" => session["oidc_state"]},
               session,
               oidc_opts(http)
             )
  end

  # ── helpers ───────────────────────────────────────────────────────────────

  defp oidc_opts(http),
    do: [issuer: @issuer, client_id: @client_id, redirect_uri: @redirect_uri, http: http]
end
