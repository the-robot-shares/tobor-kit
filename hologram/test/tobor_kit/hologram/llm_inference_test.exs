defmodule ToborKit.Hologram.LlmInferenceTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.LlmInference.Catalog
  alias ToborKit.Hologram.LlmInference.Settings

  @transport "Elixir.ToborKit.Hologram.TestSupport.LlmTransportStub"

  defmodule StubHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:llm_providers) do
      %{
        zai: %{api_key: "literal-stub-key"},
        anthropic: %{api_key: %{env: "STUB_LLM_KEY"}}
      }
    end

    def resolve(_scope), do: %{}
  end

  setup do
    Application.put_env(:tobor_kit_hologram, :host_config_module, StubHostConfig)

    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
    end)

    :ok
  end


  describe "catalog integrity (1:1 with web/src/components/llm-inference/catalog.ts)" do
    test "provider ids and order match the Lit catalog" do
      assert Enum.map(Catalog.providers(), & &1.id) == [
               "anthropic",
               "openai",
               "deepseek",
               "groq",
               "cerebras",
               "zai",
               "litellm",
               "ollama",
               "custom"
             ]
    end

    test "groups partition the catalog" do
      assert length(Catalog.providers_by_group("cloud")) == 6
      assert length(Catalog.providers_by_group("proxyLocal")) == 2
      assert length(Catalog.providers_by_group("advanced")) == 1
    end

    test "wire shapes pin except custom" do
      assert Catalog.provider_by_id("anthropic").api_shape == "anthropic"
      assert Catalog.provider_by_id("openai").api_shape == "openai"
      assert Catalog.provider_by_id("custom").api_shape == nil
      assert Catalog.provider_by_id("ollama").requires_key == false
    end

    test "effective shape: pinned wins, config pick applies to custom only" do
      assert Catalog.effective_api_shape(%{"providerID" => "anthropic", "apiShape" => "openai"}) == "anthropic"
      assert Catalog.effective_api_shape(%{"providerID" => "custom", "apiShape" => "anthropic"}) == "anthropic"
      assert Catalog.effective_api_shape(%{"providerID" => "custom"}) == "openai"
      assert Catalog.effective_api_shape(%{}) == "openai"
    end

    test "effective base URL: config override wins over catalog default" do
      assert Catalog.effective_base_url(%{"providerID" => "openai"}) == "https://api.openai.com/v1"

      assert Catalog.effective_base_url(%{"providerID" => "openai", "baseURL" => "https://proxy.test/v1"}) ==
               "https://proxy.test/v1"

      assert Catalog.effective_base_url(%{"providerID" => "custom"}) == nil
    end

    test "zai preset carries the coding-plan values" do
      assert Catalog.zai_preset()["model"] == "glm-5.3-flash"
      assert Catalog.zai_preset()["baseURL"] == "https://api.z.ai/api/coding/paas/v4"
    end

    test "response parsers" do
      assert Catalog.parse_openai_content(%{"choices" => [%{"message" => %{"content" => "hi"}}]}) == "hi"
      assert Catalog.parse_openai_content(%{}) == ""

      assert Catalog.parse_anthropic_content(%{"content" => [%{"text" => "a"}, %{"text" => "b"}]}) == "ab"
      assert Catalog.parse_anthropic_content(%{}) == ""
    end
  end

  describe "provider-switch state machine (Lit onProviderChange)" do
    def init_with(config) do
      Settings.init(%{config: config}, %Hologram.Component{}, %Hologram.Server{})
    end

    test "None clears the config" do
      component = init_with(%{"providerID" => "openai"})
      component = Settings.action(:provider_change, %{event: %{value: ""}}, component)

      assert component.state.config["providerID"] == ""
      # config-change forwarded to the host
      assert %{name: :config_change} = component.next_action
      assert component.next_action.params.config == component.state.config
    end

    test "zai preset pins model + base URL" do
      component = init_with(%{})
      component = Settings.action(:provider_change, %{event: %{value: "zai"}}, component)

      assert component.state.config["providerID"] == "zai"
      assert component.state.config["model"] == "glm-5.3-flash"
      assert component.state.config["baseURL"] == "https://api.z.ai/api/coding/paas/v4"
    end

    test "switching clears the model list + error" do
      component = init_with(%{"providerID" => "openai"})

      component =
        Hologram.Component.put_state(component, available_models: ["m1"], models_error: "stale")

      component = Settings.action(:provider_change, %{event: %{value: "anthropic"}}, component)

      assert component.state.available_models == []
      assert component.state.models_error == ""
    end
  end

  describe "commands (stub transport seam)" do
    test ":test_connection happy path (openai shape, literal key from HostConfig)" do
      config = %{"providerID" => "zai", "model" => "glm-5.3-flash"}

      server =
        Settings.command(:test_connection, %{config: config, prompt: "hi", transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :test_ok}} = server
      assert server.next_action.params.content == "stub hello"
      assert server.next_action.params.model =~ "glm-5.3-flash"
      # keys never ride the response
      refute server.next_action.params |> inspect() |> String.contains?("literal-stub-key")
    end

    test ":test_connection 401 → :test_failed with the status message" do
      config = %{"providerID" => "zai", "model" => "m", "baseURL" => "https://stub-401.test/v1"}

      server =
        Settings.command(:test_connection, %{config: config, prompt: "hi", transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :test_failed}} = server
      assert server.next_action.params.error =~ "401"
    end

    test ":test_connection anthropic shape parses content blocks (env key resolved)" do
      System.put_env("STUB_LLM_KEY", "env-stub-key")
      config = %{"providerID" => "anthropic", "model" => "m", "baseURL" => "https://stub-anthropic.test/v1"}

      server =
        Settings.command(:test_connection, %{config: config, prompt: "", transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :test_ok}} = server
      assert server.next_action.params.content == "anthropic stub reply"
    end

    test ":test_connection missing key names the env var, never a value" do
      config = %{"providerID" => "deepseek", "model" => "m"}

      server =
        Settings.command(:test_connection, %{config: config, prompt: "hi", transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :test_failed}} = server
      assert server.next_action.params.error =~ "DEEPSEEK_API_KEY"
    end

    test ":test_connection without model → the Lit copy" do
      config = %{"providerID" => "zai", "model" => ""}

      server =
        Settings.command(:test_connection, %{config: config, prompt: "hi", transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :test_failed}} = server
      assert server.next_action.params.error =~ "No model"
    end

    test ":fetch_models extracts ids in endpoint order" do
      config = %{"providerID" => "zai"}

      server = Settings.command(:fetch_models, %{config: config, transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :models_loaded}} = server
      assert server.next_action.params.models == ["stub-mini", "stub-large"]
    end

    test ":fetch_models transport failure → :models_failed" do
      config = %{"providerID" => "zai", "baseURL" => "https://stub-down.test/v1"}

      server = Settings.command(:fetch_models, %{config: config, transport: @transport}, %Hologram.Server{})

      assert %{next_action: %{name: :models_failed}} = server
      assert server.next_action.params.error =~ "econnrefused"
    end

    test "reserved keys in command params raise through the HostConfig guard" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Settings.command(:test_connection, %{config: %{}, api_key: "spoof"}, %Hologram.Server{})
      end
    end
  end

  describe "modality axis (mirror of Lit LLMModality / Swift LLMModality)" do
    @media_catalog [
      %{
        id: "openai",
        label: "OpenAI",
        group: "cloud",
        api_shape: "openai",
        default_base_url: "https://api.openai.com/v1",
        base_url_placeholder: nil,
        env_var_name: "OPENAI_API_KEY",
        requires_key: true,
        default_model: "gpt-4o",
        modalities: ["text", "image"]
      },
      %{
        id: "suno",
        label: "Suno",
        group: "cloud",
        api_shape: "openai",
        default_base_url: "https://api.suno.ai/v1",
        base_url_placeholder: nil,
        env_var_name: "SUNO_API_KEY",
        requires_key: true,
        default_model: "v6",
        modalities: ["audio"]
      },
      %{
        id: "runway",
        label: "Runway",
        group: "advanced",
        api_shape: "openai",
        default_base_url: nil,
        base_url_placeholder: "https://api.runwayml.com/v1",
        env_var_name: nil,
        requires_key: true,
        default_model: "gen-4",
        modalities: ["video"]
      }
    ]

    test "the built-in catalog declares nothing and therefore reads as text" do
      refute Catalog.catalog_declares_modalities?(Catalog.providers())
      assert Catalog.catalog_modalities(Catalog.providers()) == ["text"]

      for provider <- Catalog.providers() do
        assert Catalog.provider_modalities(provider) == ["text"]
        assert Catalog.provider_supports?(provider, "text")
        refute Catalog.provider_supports?(provider, "image")
      end

      assert length(Catalog.providers_by_modality("text")) == length(Catalog.providers())
      assert Catalog.providers_by_modality("video") == []
    end

    test "nil / empty / absent all mean text" do
      base = Catalog.provider_by_id("openai")
      assert Catalog.provider_modalities(Map.delete(base, :modalities)) == ["text"]
      assert Catalog.provider_modalities(Map.put(base, :modalities, nil)) == ["text"]
      assert Catalog.provider_modalities(Map.put(base, :modalities, [])) == ["text"]
      assert Catalog.provider_modalities(nil) == ["text"]
    end

    test "a media catalog sections in canonical modality order" do
      assert Catalog.catalog_declares_modalities?(@media_catalog)
      assert Catalog.catalog_modalities(@media_catalog) == ["text", "image", "audio", "video"]

      assert Enum.map(Catalog.providers_by_modality("image", @media_catalog), & &1.id) == ["openai"]
      assert Enum.map(Catalog.providers_by_modality("audio", @media_catalog), & &1.id) == ["suno"]
      assert Enum.map(Catalog.providers_by_modality("video", @media_catalog), & &1.id) == ["runway"]
      assert Catalog.modality_section_title("image") == "── Image ──"
      assert Catalog.modality_label("speech") == "Speech"
    end

    test "visible_catalog: no filter is the identity, a filter narrows the picker" do
      assert Settings.visible_catalog([], "") == Catalog.providers()
      assert Enum.map(Settings.visible_catalog(@media_catalog, ""), & &1.id) == ["openai", "suno", "runway"]
      assert Enum.map(Settings.visible_catalog(@media_catalog, "audio"), & &1.id) == ["suno"]
      assert Settings.visible_catalog(@media_catalog, "speech") == []
    end

    test "current_provider resolves against the host catalog" do
      config = %{"providerID" => "runway"}
      assert Settings.current_provider(config) == nil
      assert Settings.current_provider(config, @media_catalog).label == "Runway"
      assert Settings.current_provider(%{"providerID" => "zai"}, []).id == "zai"
    end

    test "a config map without modalities round-trips through JSON unchanged" do
      config = %{"providerID" => "zai", "model" => "glm-5.3-flash", "baseURL" => nil, "apiShape" => nil}
      restored = config |> Jason.encode!() |> Jason.decode!()

      assert restored == config
      assert Catalog.effective_api_shape(restored) == "openai"
      assert Catalog.effective_base_url(restored) == "https://api.z.ai/api/coding/paas/v4"

      legacy_provider =
        Catalog.provider_by_id("zai")
        |> Map.new(fn {k, v} -> {Atom.to_string(k), v} end)
        |> Jason.encode!()
        |> Jason.decode!()

      refute Map.has_key?(legacy_provider, "modalities")
      assert Catalog.provider_modalities(legacy_provider) == ["text"]
    end
  end

  describe "init/3" do
    test "seeds the form state" do
      component = Settings.init(%{config: %{"providerID" => "openai"}}, %Hologram.Component{}, %Hologram.Server{})

      assert component.state.config["providerID"] == "openai"
      assert component.state.available_models == []
      assert component.state.testing == false
    end
  end

  describe "gallery render (conn-based smoke)" do
    test "llm inference renders the header, badge, provider picker, and test box" do
      html = render_gallery()

      assert html =~ ~s(class="tk tk-llm-inference")
      assert html =~ "LLM Inference"
      assert html =~ ~s(data-testid="status-badge")
      assert html =~ "zai connected"
      assert html =~ ~s(data-testid="provider")
      assert html =~ ~s(data-testid="test-connection")
      assert html =~ ~s(data-testid="test-button")
      # "Not configured" badge for the empty config instance
      assert html =~ "Not configured"
      # Default instances keep the historic deployment-group sections.
      assert html =~ "── Cloud Providers ──"
      assert html =~ "── Proxies &amp; Local ──" or html =~ "── Proxies & Local ──"
      assert html =~ "── Advanced ──"
    end

    test "a media catalog instance sections the picker by modality" do
      html = render_gallery()

      assert html =~ "── Text ──"
      assert html =~ "── Image ──"
      assert html =~ "── Audio ──"
      assert html =~ "── Video ──"
      refute html =~ "── Speech ──"
      assert html =~ "Suno"
      assert html =~ "Runway"
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
