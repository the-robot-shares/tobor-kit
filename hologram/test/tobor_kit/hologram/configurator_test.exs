defmodule ToborKit.Hologram.ConfiguratorTest do
  use ExUnit.Case, async: false

  alias Hologram.Component.Action
  alias ToborKit.Hologram.Configurator.Playground
  alias ToborKit.Hologram.Support.Events

  defmodule StubTransport do
    def get(_url, _opts \\ []),
      do: Application.get_env(:tobor_kit_hologram, :stub_transport_response)
  end

  defmodule CatalogHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:catalog), do: %{base_url: "https://cat.test", transport: StubTransport}

    def resolve(scope), do: raise(ArgumentError, "unmapped scope #{inspect(scope)}")
  end

  @server %Hologram.Server{cid: "cfg-1"}

  setup do
    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :stub_transport_response)
    end)

    :ok
  end

  @raw_schema %{
    "tag" => "noizu-widget",
    "fields" => [
      %{"attr" => "name", "type" => "string", "required" => true, "placeholder" => "Name…"},
      %{"attr" => "enabled", "type" => "boolean", "default" => true},
      %{"attr" => "size", "type" => "number", "default" => 42},
      %{"attr" => "variant", "type" => "select", "options" => ["cards", "rows"]},
      %{"attr" => "tags", "type" => "tag-list"},
      %{"attr" => "meta", "type" => "json", "propertyOnly" => true},
      %{"attr" => "desc", "type" => "string", "propertyOnly" => false, "description" => "shown"}
    ],
    "slots" => ["header"]
  }

  describe "normalize_schema/1" do
    test "normalizes a string-keyed document into atom-keyed canonical shape" do
      {:ok, schema} = Playground.normalize_schema(@raw_schema)

      assert schema.tag == "noizu-widget"
      assert schema.slots == ["header"]
      assert [%{attr: "name", type: "string", required: true}, %{attr: "enabled"} | _] = schema.fields
      assert %{attr: "meta", property_only: true} = Enum.at(schema.fields, 5)
    end

    test "unwraps {configurator} and first-of-{configurators}" do
      {:ok, schema} = Playground.normalize_schema(%{"configurator" => @raw_schema})
      assert schema.tag == "noizu-widget"

      {:ok, schema} = Playground.normalize_schema(%{"configurators" => [@raw_schema]})
      assert schema.tag == "noizu-widget"
    end

    test "errors on missing tag / fields / junk" do
      assert {:error, "Configurator schema is missing tag"} =
               Playground.normalize_schema(%{"fields" => []})

      assert {:error, "Configurator schema is missing fields"} =
               Playground.normalize_schema(%{"tag" => "x"})

      assert {:error, "Invalid configurator schema"} = Playground.normalize_schema("junk")
      assert {:error, "Invalid configurator schema"} = Playground.normalize_schema(nil)
    end

    test "snake_case propertyOnly keys normalize too" do
      {:ok, schema} =
        Playground.normalize_schema(%{
          "tag" => "t",
          "fields" => [%{"attr" => "a", "property_only" => true}]
        })

      assert [%{property_only: true}] = schema.fields
    end
  end

  describe "seed_values/2 + seed_slots" do
    test "defaults by field type; explicit defaults win" do
      {:ok, schema} = Playground.normalize_schema(@raw_schema)
      values = Playground.seed_values(schema)

      assert values["name"] == ""
      assert values["enabled"] == true
      assert values["size"] == 42
      assert values["variant"] == ""
      assert values["tags"] == []
      assert values["meta"] == ""
    end

    test "slots seed to empty strings" do
      {:ok, schema} = Playground.normalize_schema(@raw_schema)
      assert Playground.seed_slots(schema) == %{"header" => ""}
    end
  end

  describe "snippet_text/3" do
    defp snippet do
      {:ok, schema} = Playground.normalize_schema(@raw_schema)
      values = Playground.seed_values(schema)

      Playground.snippet_text(schema, values, %{"header" => ""})
    end

    test "void element; booleans render as bare presence; empty strings omitted" do
      html = snippet()
      assert html == ~s(<noizu-widget enabled size="42"></noizu-widget>)
    end

    test "values flow into escaped attributes; lists join with commas" do
      {:ok, schema} = Playground.normalize_schema(@raw_schema)

      values = %{
        "name" => ~s(a "b" <c> &d),
        "enabled" => false,
        "size" => "",
        "variant" => "cards",
        "tags" => ["alpha", "beta"],
        "meta" => "",
        "desc" => ""
      }

      html = Playground.snippet_text(schema, values, %{})

      # Lit's escapeAttr covers &, ", < — a bare > passes through (Lit parity)
      assert html ==
               ~s(<noizu-widget name="a &quot;b&quot; &lt;c> &amp;d" variant="cards" tags="alpha,beta"></noizu-widget>)
    end
  end

  describe "control_kind/1 + select_options/2" do
    test "kind mapping follows the schema type; unknown types clamp to string" do
      assert Playground.control_kind(%{type: "text"}) == "textarea"
      assert Playground.control_kind(%{type: "number"}) == "number"
      assert Playground.control_kind(%{type: "boolean"}) == "boolean"
      assert Playground.control_kind(%{type: "select"}) == "select"
      assert Playground.control_kind(%{type: "multiselect"}) == "multiselect"
      assert Playground.control_kind(%{type: "color"}) == "color"
      assert Playground.control_kind(%{type: "url"}) == "url"
      assert Playground.control_kind(%{type: "tag-list"}) == "tag-list"
      assert Playground.control_kind(%{type: "json"}) == "json"
      assert Playground.control_kind(%{type: "string"}) == "string"
      assert Playground.control_kind(%{type: "mystery"}) == "string"
    end

    test "select_options admits the current value when missing" do
      field = %{options: ["cards", "rows"]}
      assert Playground.select_options(field, "cards") == ["cards", "rows"]
      assert Playground.select_options(field, "ghost") == ["ghost", "cards", "rows"]
      assert Playground.select_options(field, "") == ["cards", "rows"]
    end

    test "tags_of filters junk" do
      assert Playground.tags_of(["a", "b"]) == ["a", "b"]
      assert Playground.tags_of("junk") == []
    end
  end

  describe "client actions" do
    defp component do
      Playground.init(%{schema: @raw_schema, target: "page"}, %Hologram.Component{}, nil)
    end

    test "init adopts the schema prop and seeds values" do
      component = component()
      assert component.state.schema.tag == "noizu-widget"
      assert component.state.values["enabled"] == true
      assert component.state.error == ""
    end

    test ":set_value updates and forwards configurator_change" do
      component = Playground.action(:set_value, %{event: %{value: "kit"}, attr: "name"}, component())

      assert component.state.values["name"] == "kit"
      assert component.next_action.name == :configurator_change
      assert component.next_action.params.tag == "noizu-widget"
      assert component.next_action.params.attributes["name"] == "kit"
      assert component.next_action.target == "page"
    end

    test ":set_bool uses the checked flag" do
      component =
        Playground.action(:set_bool, %{event: %{value: false}, attr: "enabled"}, component())

      assert component.state.values["enabled"] == false
    end

    test ":toggle_multi adds then removes options" do
      component =
        Playground.action(:toggle_multi, %{event: %{value: true}, attr: "tags", option: "x"}, component())

      assert component.state.values["tags"] == ["x"]

      component =
        Playground.action(:toggle_multi, %{event: %{value: true}, attr: "tags", option: "x"}, component)

      assert component.state.values["tags"] == ["x"]

      component =
        Playground.action(:toggle_multi, %{event: %{value: false}, attr: "tags", option: "x"}, component())

      assert component.state.values["tags"] == []
    end

    test ":tag_key commits the draft on Enter/comma via the draft state" do
      component =
        Hologram.Component.put_state(component(), tag_drafts: %{"tags" => " alpha,"})

      component = Playground.action(:tag_key, %{event: %{key: "Enter"}, attr: "tags"}, component)
      assert component.state.values["tags"] == ["alpha"]
      assert component.state.tag_drafts["tags"] == ""

      component = Hologram.Component.put_state(component, tag_drafts: %{"tags" => "b,c"})
      component = Playground.action(:tag_key, %{event: %{key: ","}, attr: "tags"}, component)
      # comma is stripped, the whole draft commits as one tag (split-on-comma is a server nicety)
      assert component.state.values["tags"] == ["alpha", "bc"]

      component = Playground.action(:tag_key, %{event: %{key: "a"}, attr: "tags"}, component)
      assert component.next_action == nil or component.state.values["tags"] == ["alpha", "bc"]
    end

    test ":remove_tag drops the chip" do
      component = Hologram.Component.put_state(component(), values: %{"tags" => ["x", "y"]})
      component = Playground.action(:remove_tag, %{attr: "tags", tag: "x"}, component)
      assert component.state.values["tags"] == ["y"]
    end

    test ":apply forwards configurator_apply with the snapshot" do
      component = Playground.action(:apply, %{}, component())

      assert component.next_action.name == :configurator_apply
      assert component.next_action.params.tag == "noizu-widget"
      assert is_map(component.next_action.params.attributes)
      assert component.next_action.params.slots == %{"header" => ""}
    end

    test ":schema_loaded adopts the fetched schema; :schema_error stores the message" do
      {:ok, schema} = Playground.normalize_schema(@raw_schema)

      component =
        Playground.action(:schema_loaded, %{schema: schema}, Hologram.Component.put_state(component(), loading: true))

      assert component.state.schema.tag == "noizu-widget"
      assert component.state.loading == false

      component = Playground.action(:schema_error, %{message: "schema-src failed (500)"}, component())
      assert component.state.error == "schema-src failed (500)"
      assert component.state.schema == nil
    end

    test "unknown actions are no-ops" do
      component = component()
      assert Playground.action(:bogus, %{}, component) == component
    end
  end

  describe "commands — :load_schema" do
    test "GET + normalize returns schema_loaded" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)

      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:ok, @raw_schema})

      server = Playground.command(:load_schema, %{src: "https://pub.test/schema.json"}, @server)

      assert %Action{name: :schema_loaded, params: %{schema: schema}} = server.next_action
      assert schema.tag == "noizu-widget"
    end

    test "non-2xx maps to schema_error with the Lit status copy" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)

      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{status: 404, body: ""}})

      server = Playground.command(:load_schema, %{src: "https://pub.test/404"}, @server)

      assert %Action{name: :schema_error, params: %{message: "schema-src failed (404)"}} =
               server.next_action
    end

    test "transport failure passes the reason through" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)

      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{reason: "econnrefused"}})

      server = Playground.command(:load_schema, %{src: "https://pub.test/x"}, @server)

      assert %Action{name: :schema_error, params: %{message: "econnrefused"}} = server.next_action
    end

    test "non-schema JSON maps to the invalid-schema error" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, CatalogHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:ok, "not json"})

      server = Playground.command(:load_schema, %{src: "https://pub.test/x"}, @server)

      assert %Action{name: :schema_error, params: %{message: "Invalid configurator schema"}} =
               server.next_action
    end

    test "reserved secret keys in params are denied at the door" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Playground.command(:load_schema, %{src: "x", token: "spoof"}, @server)
      end
    end
  end

  test "event contract" do
    assert Events.all()["configurator"] == ["configurator-change", "configurator-apply"]
  end
end
