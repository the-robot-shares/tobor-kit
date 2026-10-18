defmodule ToborKit.Hologram.HostConfigTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.HostConfig

  defmodule Stub do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:tobor_kit_api), do: %{base_url: "https://api.test", token: "secret-token"}
    def resolve(:llm_providers), do: %{openai: %{base_url: "https://oai.test", api_key: "k"}}
    def resolve(scope), do: raise(ArgumentError, "unmapped scope #{inspect(scope)}")
  end

  setup do
    Application.put_env(:tobor_kit_hologram, :host_config_module, Stub)

    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :host_config)
    end)

    :ok
  end

  describe "resolve/1" do
    test "delegates to the configured host config module" do
      assert %{base_url: "https://api.test", token: "secret-token"} =
               HostConfig.resolve(:tobor_kit_api)
    end

    test "resolves per-provider LLM config" do
      assert %{openai: %{base_url: "https://oai.test"}} = HostConfig.resolve(:llm_providers)
    end

    test "documents the recognized scopes" do
      assert HostConfig.scopes() == [:tobor_kit_api, :llm_providers, :waitlist_api, :catalog, :auth]
    end
  end

  describe "Env default implementation" do
    test "reads Application env host_config keyword list" do
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.put_env(:tobor_kit_hologram, :host_config, catalog: %{base_url: "https://cat.test"})

      assert %{base_url: "https://cat.test"} = HostConfig.resolve(:catalog)
    end

    test "raises on unknown scope" do
      Application.delete_env(:tobor_kit_hologram, :host_config_module)

      assert_raise ArgumentError, ~r/no host_config entry for scope :waitlist_api/, fn ->
        HostConfig.resolve(:waitlist_api)
      end
    end

    test "raises when the scope entry is not a map" do
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.put_env(:tobor_kit_hologram, :host_config, catalog: "https://cat.test")

      assert_raise ArgumentError, ~r/must be a map/, fn ->
        HostConfig.resolve(:catalog)
      end
    end
  end

  describe "from_params!/1" do
    test "passes clean params through unchanged" do
      params = %{persona_id: "p1", query: "hello"}
      assert ^params = HostConfig.from_params!(params)
    end

    test "raises when a param key collides with a reserved secret name" do
      for key <- [:base_url, :token, :api_key, :api_key_spec, :authorization] do
        assert_raise ArgumentError, ~r/reserved secret key/, fn ->
          HostConfig.from_params!(%{key => "spoofed"})
        end
      end
    end

    test "raises on string-keyed reserved params (client-serialized shape)" do
      assert_raise ArgumentError, ~r/reserved secret key "base_url"/, fn ->
        HostConfig.from_params!(%{"base_url" => "https://evil.test"})
      end
    end

    test "allows non-reserved keys that merely mention secrets in values" do
      assert %{note: "stored under token"} = HostConfig.from_params!(%{note: "stored under token"})
    end
  end
end
