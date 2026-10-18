defmodule ToborKit.Hologram.ModelConfigTest do
  use ExUnit.Case, async: false

  alias Hologram.Component.Action
  alias ToborKit.Hologram.ModelConfig.Config
  alias ToborKit.Hologram.Support.Events

  defmodule StubTransport do
    def get(_url, _opts \\ []),
      do: Application.get_env(:tobor_kit_hologram, :stub_transport_response)
  end

  defmodule CatalogHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:catalog), do: %{base_url: "https://cat.test/catalog.json", transport: StubTransport}

    def resolve(scope), do: raise(ArgumentError, "unmapped scope #{inspect(scope)}")
  end

  @server %Hologram.Server{cid: "model-1"}

  setup do
    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :stub_transport_response)
    end)

    :ok
  end

  describe "commands — :load_catalog" do
    test "uses the param URL when given (public catalog-url attr data) and normalizes entries" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)

      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:ok, %{
        "models" => [
          %{"provider" => "openai", "model" => "gpt-5", "label" => " GPT-5 "},
          %{"provider" => "noizu", "model" => "fable", "spec" => "noizu:fable"}
        ],
        "custom" => %{"baseUrl" => "https://oai.test/v1", "model" => "gpt-5"}
      }})

      server = Config.command(:load_catalog, %{url: "https://pub.test/catalog.json"}, @server)

      assert %Action{name: :catalog_loaded, params: %{entries: entries, custom: custom}} =
               server.next_action

      assert entries == [
               %{provider: "openai", model: "gpt-5", label: "GPT-5", spec: ""},
               %{provider: "noizu", model: "fable", label: "", spec: "noizu:fable"}
             ]

      assert custom == %{base_url: "https://oai.test/v1", model: "gpt-5", api_key: ""}
    end

    test "without a param URL the :catalog HostConfig scope supplies the base URL" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:ok, []})

      server = Config.command(:load_catalog, %{}, @server)

      assert %Action{name: :catalog_loaded, params: %{entries: []}} = server.next_action
    end

    test "missing :catalog scope raises inside the command (host wiring bug)" do
      assert_raise ArgumentError, ~r/no host_config entry for scope :catalog/, fn ->
        Config.command(:load_catalog, %{}, @server)
      end
    end

    test "HTTP errors map to :catalog_error" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{status: 404, body: ""}})

      server = Config.command(:load_catalog, %{url: "https://pub.test/404"}, @server)

      assert %Action{name: :catalog_error, params: %{message: "Could not load the model catalog."}} =
               server.next_action
    end

    test "reserved secret keys in params are denied at the door" do
      assert_raise ArgumentError, ~r/reserved secret key "base_url"/, fn ->
        Config.command(:load_catalog, %{"base_url" => "https://evil.test"}, @server)
      end
    end
  end

  describe "client actions" do
    defp component do
      Config.init(
        %{value: "openai:gpt-5", allow_custom: true, allow_budget: true, target: "page"},
        %Hologram.Component{},
        nil
      )
    end

    test ":pick inherit clears the value and forwards model_change" do
      component = Config.action(:pick, %{event: %{value: "__inherit__"}}, component())

      assert component.state.value == ""
      assert component.next_action.name == :model_change
      assert component.next_action.params == %{value: ""}
      assert component.next_action.target == "page"
    end

    test ":pick custom re-derives the spec from the draft model" do
      component = component() |> Hologram.Component.put_state(draft_model: "llama 4")
      component = Config.action(:pick, %{event: %{value: "__custom__"}}, component)

      assert component.state.value == "custom:llama4"
      assert component.next_action.params == %{value: "custom:llama4"}
    end

    test ":pick passes the picked spec through" do
      component = Config.action(:pick, %{event: %{value: "openai:gpt-5"}}, component())
      assert component.state.value == "openai:gpt-5"
    end

    test ":save_endpoint forwards custom_endpoint_save (value folded in), masks mean keep" do
      component =
        component()
        |> Hologram.Component.put_state(
          draft_base_url: "https://oai.test/v1",
          draft_model: "gpt-5",
          draft_api_key: "••••1234"
        )

      component = Config.action(:save_endpoint, %{}, component)

      assert component.state.value == "custom:gpt-5"
      assert component.next_action.name == :custom_endpoint_save
      assert component.next_action.params == %{
               base_url: "https://oai.test/v1",
               model: "gpt-5",
               api_key: "",
               value: "custom:gpt-5"
             }

      # api_key stayed "" → the draft is not cleared (host echo remains visible)
      assert component.state.draft_api_key != ""
    end

    test ":save_endpoint clears the draft key when a real secret was saved" do
      component =
        component()
        |> Hologram.Component.put_state(draft_model: "m", draft_api_key: "sk-live-123")

      component = Config.action(:save_endpoint, %{}, component)
      assert component.state.draft_api_key == ""
    end

    test ":budget_changed forwards the raw amount (empty string maps to 0)" do
      component = Config.action(:budget_changed, %{event: %{value: ""}}, component())
      assert component.next_action.name == :budget_change
      assert component.next_action.params == %{amount: 0}

      component = Config.action(:budget_changed, %{event: %{value: "25"}}, component())
      assert component.next_action.params == %{amount: "25"}
    end

    test ":catalog_loaded seeds endpoint drafts from the custom echo" do
      component =
        Config.action(:catalog_loaded, %{
          entries: [],
          custom: %{base_url: "https://oai.test/v1", model: "gpt-5", api_key: ""}
        }, component())

      assert component.state.draft_base_url == "https://oai.test/v1"
      assert component.state.draft_model == "gpt-5"
      assert component.state.catalog_error == ""
    end

    test "unknown actions are no-ops" do
      component = component()
      assert Config.action(:bogus, %{}, component) == component
    end
  end

  describe "helpers (Lit catalog.ts parity)" do
    test "spec_of falls back to provider:model, tolerates string keys" do
      assert Config.spec_of(%{provider: "openai", model: "gpt-5"}) == "openai:gpt-5"
      assert Config.spec_of(%{"provider" => "o", "model" => "m", "spec" => "s"}) == "s"
    end

    test "entry_label prefers the label" do
      assert Config.entry_label(%{provider: "o", model: "m", label: "L"}) == "L"
      assert Config.entry_label(%{provider: "o", model: "m"}) == "o:m"
    end

    test "custom_spec / custom_value? / inherit_value?" do
      assert Config.custom_spec("") == "custom"
      assert Config.custom_spec("llama 4") == "custom:llama4"
      assert Config.custom_value?("custom:llama")
      assert Config.custom_value?("custom")
      refute Config.custom_value?("openai:gpt-5")
      assert Config.inherit_value?("")
      assert Config.inherit_value?("inherit")
    end

    test "masked_key? / api_key_for_save (regex-free isMaskedSecret)" do
      assert Config.masked_key?("••••1234")
      assert Config.masked_key?("******")
      assert Config.masked_key?("xxxxxxxx")
      assert Config.masked_key?("XXXX1234")
      refute Config.masked_key?("sk-live-1")

      assert Config.api_key_for_save("") == ""
      assert Config.api_key_for_save("••••1234") == ""
      assert Config.api_key_for_save("sk-new") == "sk-new"
    end

    test "select_value / orphan_option? / show_custom?" do
      entries = [%{provider: "openai", model: "gpt-5"}]

      assert Config.select_value("", true, false, entries) == "__inherit__"
      assert Config.select_value("inherit", true, false, entries) == "__inherit__"
      assert Config.select_value("custom:x", false, true, entries) == "__custom__"
      assert Config.select_value("unknown-model", false, true, entries) == "__custom__"
      assert Config.select_value("openai:gpt-5", false, true, entries) == "openai:gpt-5"
      assert Config.select_value("openai:gpt-5", false, false, entries) == "openai:gpt-5"

      assert Config.orphan_option?("ghost", false, entries)
      refute Config.orphan_option?("openai:gpt-5", false, entries)
      refute Config.orphan_option?("", false, entries)
      refute Config.orphan_option?("inherit", true, entries)

      assert Config.show_custom?("custom:x", false, true, entries)
      refute Config.show_custom?("openai:gpt-5", false, true, entries)
      refute Config.show_custom?("openai:gpt-5", false, false, entries)
    end

    test "normalize_catalog_payload accepts array, {catalog}, {models}, {entries}" do
      assert %{entries: [%{provider: "a"}], custom: nil} =
               Config.normalize_catalog_payload([%{"provider" => "a", "model" => "b"}])

      assert %{entries: [_]} = Config.normalize_catalog_payload(%{"catalog" => [%{"provider" => "a", "model" => "b"}]})
      assert %{entries: []} = Config.normalize_catalog_payload(%{"nope" => 1})
      assert %{entries: [], custom: nil} = Config.normalize_catalog_payload("junk")
    end

    test "normalize_custom ignores empty endpoint maps" do
      assert Config.normalize_custom(%{"custom" => %{"model" => ""}}) == nil
      assert Config.normalize_custom(%{"custom_endpoint" => %{"base_url" => "https://x.test"}}) !=
               nil
    end
  end

  test "event contract: registry events already carried" do
    assert Events.all()["model-config"] == ["model-change", "custom-endpoint-save", "budget-change"]
  end
end
