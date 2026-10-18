defmodule ToborKit.Hologram.LoginFlowTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.LoginFlow.Flow

  @auth %{
    "provider" => "oidc",
    "issuer" => "https://auth.example.test/",
    "client_id" => "gallery-client",
    "scopes" => ["openid", "email"],
    "redirect_path" => "/auth/oidc/callback"
  }

  defmodule StubHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:auth), do: %{client_secret: "secret-do-not-leak", origin: "https://app.example.test"}
    def resolve(_scope), do: %{}
  end

  setup do
    Application.put_env(:tobor_kit_hologram, :host_config_module, StubHostConfig)

    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :http_module)
    end)

    :ok
  end


  describe "normalize_issuer/1 (Lit normalizeIssuer)" do
    test "strips trailing slashes" do
      assert Flow.normalize_issuer("https://auth.test/") == "https://auth.test"
      assert Flow.normalize_issuer("https://auth.test///") == "https://auth.test"
      assert Flow.normalize_issuer("https://auth.test") == "https://auth.test"
      assert Flow.normalize_issuer(nil) == ""
    end
  end

  describe "parse_callback/1 (Lit parseCallback)" do
    test "extracts code + state" do
      assert Flow.parse_callback("?code=abc&state=xyz") == %{code: "abc", state: "xyz"}
      assert Flow.parse_callback("code=abc&state=xyz") == %{code: "abc", state: "xyz"}
      assert Flow.parse_callback("foo=1&code=abc&state=xyz&bar=2") == %{code: "abc", state: "xyz"}
    end

    test "nil unless BOTH code and state are present" do
      assert Flow.parse_callback("?code=abc") == nil
      assert Flow.parse_callback("?state=xyz") == nil
      assert Flow.parse_callback("") == nil
      assert Flow.parse_callback(nil) == nil
    end
  end

  describe "build_authorize_url/1 (Lit buildAuthorizeUrl)" do
    test "S256 PKCE query, issuer normalized" do
      url =
        Flow.build_authorize_url(%{
          issuer: "https://auth.example.test/",
          client_id: "cid",
          redirect_uri: "https://app.example.test/auth/oidc/callback",
          scopes: ["openid", "email"],
          state: "s3t",
          code_challenge: "challenge"
        })

      assert String.starts_with?(url, "https://auth.example.test/authorize?")
      assert url =~ "response_type=code"
      assert url =~ "client_id=cid"
      assert url =~ "scope=openid+email"
      assert url =~ "state=s3t"
      assert url =~ "code_challenge=challenge"
      assert url =~ "code_challenge_method=S256"
      refute url =~ "client_secret"
    end
  end

  describe "auth_disabled?/1 (Lit render gate)" do
    test "provider none or required false renders nothing" do
      assert Flow.auth_disabled?(%{"provider" => "none"})
      assert Flow.auth_disabled?(%{"required" => false})
      refute Flow.auth_disabled?(@auth)
    end
  end

  describe "redact_tokens/1 (token-handoff contract)" do
    test "drops refresh_token, keeps the access-token half" do
      redacted =
        Flow.redact_tokens(%{
          "access_token" => "at",
          "refresh_token" => "rt",
          "token_type" => "Bearer",
          "expires_in" => 300
        })

      assert redacted["access_token"] == "at"
      assert redacted["token_type"] == "Bearer"
      refute Map.has_key?(redacted, "refresh_token")
    end
  end

  describe "command :begin_login" do
    test "builds the authorize URL, stashes PKCE in the session, returns :auth_redirect" do
      result = Flow.command(:begin_login, %{issuer: "https://auth.test/", client_id: "cid"}, %Hologram.Server{})

      assert %{next_action: %{name: :auth_redirect}} = result
      url = result.next_action.params.url
      assert String.starts_with?(url, "https://auth.test/authorize?")

      assert byte_size(result.session["tobor_kit_pkce_state"]) == 24
      assert byte_size(result.session["tobor_kit_pkce_verifier"]) == 64
    end

    test "unconfigured auth → :exchange_failed, no session writes" do
      result = Flow.command(:begin_login, %{issuer: "", client_id: ""}, %Hologram.Server{})

      assert %{next_action: %{name: :exchange_failed}} = result
      assert result.session == %{}
    end

    test "reserved keys in params raise (HostConfig guard)" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Flow.command(:begin_login, %{token: "spoof"}, %Hologram.Server{})
      end
    end
  end

  describe "command :exchange" do
    test "state mismatch → :exchange_failed" do
      server = %Hologram.Server{
        session: %{"tobor_kit_pkce_state" => "known", "tobor_kit_pkce_verifier" => "v"}
      }

      result =
        Flow.command(:exchange, %{code: "c", state: "other", issuer: "https://auth.test", client_id: "cid"}, server)

      assert %{next_action: %{name: :exchange_failed}} = result
      assert result.next_action.params.error =~ "state mismatch"
    end

    test "missing verifier → :exchange_failed" do
      result =
        Flow.command(:exchange, %{code: "c", state: "s", issuer: "https://auth.test", client_id: "cid"}, %Hologram.Server{})

      assert %{next_action: %{name: :exchange_failed}} = result
      assert result.next_action.params.error =~ "no PKCE verifier"
    end

    test "matching session → 401 exchange surfaces :exchange_failed and consumes the verifier" do
      server = %Hologram.Server{
        session: %{"tobor_kit_pkce_state" => "s", "tobor_kit_pkce_verifier" => "v"}
      }

      Application.put_env(:tobor_kit_hologram, :http_module, ToborKit.Hologram.TestSupport.HttpStub)

      result =
        Flow.command(
          :exchange,
          %{code: "c", state: "s", issuer: "https://stub-401.test", client_id: "cid"},
          server
        )

      assert %{next_action: %{name: :exchange_failed}} = result
      assert result.next_action.params.error =~ "token exchange failed (401)"
      # PKCE material is consumed (one-shot), success or failure.
      assert result.session["tobor_kit_pkce_verifier"] == nil
      refute result.next_action.params.error =~ "secret"
    end
  end

  describe "init/3 callback chaining" do
    test "callback search chains :begin_exchange with the parsed callback" do
      component = Flow.init(%{callback_search: "?code=c1&state=s1", auth: @auth}, %Hologram.Component{}, %Hologram.Server{})

      assert %{next_action: %{name: :begin_exchange}} = component
      assert component.next_action.params == %{code: "c1", state: "s1"}
    end

    test "no callback → no chained action" do
      component = Flow.init(%{auth: @auth}, %Hologram.Component{}, %Hologram.Server{})

      assert component.next_action == nil
    end
  end

  describe "gallery render (conn-based smoke)" do
    test "login-flow renders the light-DOM root with the Lit testid contract" do
      html = render_gallery()

      assert html =~ ~s(class="tk tk-login-flow")
      assert html =~ ~s(data-testid="login-button")
      # provider "none" renders the root but no button
      assert html =~ "Sign in"
    end
  end

  defp render_gallery do
    conn =
      :get
      |> Plug.Test.conn("/gallery")
      |> Map.put(
        :secret_key_base,
        "tk_hologram_test_secret_key_base_padding_padding_padding_at_least_64_bytes_long__"
      )
      |> Plug.Conn.fetch_query_params()
      |> ToborKit.Hologram.TestSupport.Router.call([])

    assert conn.status == 200, "expected 200, got #{conn.status}"
    conn.resp_body
  end
end
