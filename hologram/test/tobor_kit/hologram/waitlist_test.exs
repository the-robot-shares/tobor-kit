defmodule ToborKit.Hologram.WaitlistTest do
  use ExUnit.Case, async: false

  alias Hologram.Component.Action
  alias ToborKit.Hologram.Support.Events
  alias ToborKit.Hologram.Waitlist.Form

  defmodule StubTransport do
    def get(_url, _opts \\ []),
      do: Application.get_env(:tobor_kit_hologram, :stub_transport_get)

    def post(_url, _payload, _opts \\ []),
      do: Application.get_env(:tobor_kit_hologram, :stub_transport_post)
  end

  defmodule WaitlistHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:waitlist_api),
      do: %{base_url: "https://foryou.test", transport: StubTransport}

    def resolve(scope), do: raise(ArgumentError, "unmapped scope #{inspect(scope)}")
  end

  @server %Hologram.Server{cid: "wl-1"}

  @manifest %{
    "list" => %{
      "name" => " Launch List ",
      "description" => "Early access",
      "opt_in_mode" => "double",
      "settings" => %{"success_message" => "See you soon"},
      "attributes" => [
        %{"slug" => "email", "name" => "Email", "type" => "email", "required" => true,
         "sort_order" => 0},
        %{"slug" => "team", "name" => "Team size", "type" => "select", "required" => true,
         "options" => [%{"value" => "1", "label" => "Just me"}, "2-10"], "sort_order" => 1},
        %{"slug" => "notes", "name" => "Notes", "type" => "text",
         "validation" => %{"length" => 40}, "sort_order" => 2}
      ]
    }
  }

  setup do
    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :stub_transport_get)
      Application.delete_env(:tobor_kit_hologram, :stub_transport_post)
    end)

    :ok
  end

  describe "commands — :load_manifest" do
    test "GET via :waitlist_api scope returns the normalized list model" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_get, {:ok, @manifest})

      server = Form.command(:load_manifest, %{slug: "launch"}, @server)

      assert %Action{name: :manifest_loaded, params: params} = server.next_action
      assert params.list_name == " Launch List "
      assert params.opt_in_mode == "double"
      assert params.success_message == "See you soon"

      assert [%{slug: "email", type: "email"}, %{slug: "team", type: "select"}, %{slug: "notes"}] =
               params.attributes

      assert [%{label: "Just me", value: "1"}, %{label: "2-10", value: "2-10"}] =
               Enum.at(params.attributes, 1).options
    end

    test "404 maps to the not-found copy" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_get, {:error, %{status: 404, body: ""}})

      server = Form.command(:load_manifest, %{slug: "ghost"}, @server)

      assert %Action{name: :manifest_error, params: %{message: message, status: 404}} =
               server.next_action

      assert message == Form.copy(:not_found)
    end

    test "other non-2xx maps to the unavailable copy" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_get, {:error, %{status: 500, body: ""}})

      server = Form.command(:load_manifest, %{slug: "x"}, @server)
      assert %Action{name: :manifest_error, params: %{status: 500}} = server.next_action
    end

    test "no slug and no service+list pair yields an error without a fetch" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)

      server = Form.command(:load_manifest, %{}, @server)
      assert %Action{name: :manifest_error} = server.next_action
    end

    test "reserved secret keys in params are denied at the door" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Form.command(:signup, %{api_key: "spoof"}, @server)
      end
    end
  end

  describe "commands — :signup" do
    test "2xx posts values+source+honeypot and returns signup_success" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_post, {:ok, %{"id" => 1}})

      params = %{
        slug: "launch",
        source: "widget",
        values: %{"email" => "a@b.co"},
        company_website: ""
      }

      server = Form.command(:signup, params, @server)

      assert %Action{name: :signup_success, params: %{values: %{"email" => "a@b.co"}, source: "widget"}} =
               server.next_action
    end

    test "429 maps to the rate-limit copy" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_post, {:error, %{status: 429, body: ""}})

      server = Form.command(:signup, %{slug: "x"}, @server)

      assert %Action{name: :signup_error, params: %{message: message, status: 429}} =
               server.next_action

      assert message == Form.copy(:rate_limit)
    end

    test "4xx maps to the generic copy" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_post, {:error, %{status: 422, body: ""}})

      server = Form.command(:signup, %{slug: "x"}, @server)
      assert %Action{name: :signup_error, params: %{message: message}} = server.next_action
      assert message == Form.copy(:generic)
    end

    test "transport failure maps to the generic copy" do
      Application.put_env(:tobor_kit_hologram, :host_config_module, WaitlistHostConfig)
      Application.put_env(:tobor_kit_hologram, :stub_transport_post, {:error, %{reason: "econnrefused"}})

      server = Form.command(:signup, %{slug: "x"}, @server)
      assert %Action{name: :signup_error} = server.next_action
    end
  end

  describe "client actions" do
    defp component do
      Form.init(%{slug: "launch", target: "page"}, %Hologram.Component{}, nil)
    end

    test "starts on the fallback email form" do
      component = component()
      assert component.state.ui == "form"
      assert component.state.list_attrs == [Form.fallback_email()]
    end

    test ":field_set updates the value and clears errors after submit" do
      component =
        component()
        |> Hologram.Component.put_state(submitted: true, field_errors: %{"email" => "bad"})

      component = Form.action(:field_set, %{slug: "email", event: %{value: "a@b.co"}}, component)

      assert component.state.values["email"] == "a@b.co"
      assert component.state.field_errors == %{}
    end

    test ":field_toggle adds and removes options" do
      component = Form.action(:field_toggle, %{slug: "t", option: "a", event: %{value: true}}, component())
      assert component.state.values["t"] == ["a"]

      component = Form.action(:field_toggle, %{slug: "t", option: "a", event: %{value: true}}, component)
      assert component.state.values["t"] == ["a"]

      component = Form.action(:field_toggle, %{slug: "t", option: "a", event: %{value: false}}, component)
      assert component.state.values["t"] == []
    end

    test ":submit with validation errors does not dispatch the command" do
      component = Form.action(:submit, %{}, component())

      assert component.state.field_errors == %{"email" => Form.copy(:required)}
      assert component.next_command == nil
    end

    test ":submit with a valid fallback form dispatches :signup and sets busy" do
      component =
        Form.action(:field_set, %{slug: "email", event: %{value: "a@b.co"}}, component())
        |> then(&Form.action(:submit, %{}, &1))

      assert component.state.busy == true
      assert component.next_command.name == :signup
      assert component.next_command.params.values == %{"email" => "a@b.co"}
      assert component.next_command.params.source == "widget"
      assert component.next_command.params.company_website == ""
    end

    test ":signup_success switches to the success state and forwards waitlist_success" do
      component =
        Hologram.Component.put_state(component(),
          success_message: "See you soon",
          busy: true
        )

      component = Form.action(:signup_success, %{values: %{"email" => "a@b.co"}, source: "widget"}, component)

      assert component.state.ui == "success"
      assert component.state.status_text == "See you soon"
      assert component.next_action.name == :waitlist_success
      assert component.next_action.params.values == %{"email" => "a@b.co"}
      assert component.next_action.target == "page"
    end

    test "success copy falls back by opt-in mode" do
      component = Hologram.Component.put_state(component(), opt_in_mode: "double")
      component = Form.action(:signup_success, %{values: %{}}, component)
      assert component.state.status_text == Form.copy(:success_double)
    end

    test ":manifest_error forwards waitlist_error with the status" do
      component = Form.action(:manifest_error, %{message: "nope", status: 404}, component())

      assert component.state.ui == "unavailable"
      assert component.next_action.name == :waitlist_error
      assert component.next_action.params == %{error: "nope", status: 404}
    end

    test "unknown actions are no-ops" do
      component = component()
      assert Form.action(:bogus, %{}, component) == component
    end
  end

  describe "validation + field model (Lit model.ts parity)" do
    test "validate_all: required, email shape, select membership" do
      attrs = [Form.fallback_email()]

      assert Form.validate_all(attrs, %{}) == %{"email" => Form.copy(:required)}
      assert Form.validate_all(attrs, %{"email" => "nope"}) == %{"email" => Form.copy(:email)}

      assert Form.validate_all(attrs, %{"email" => "a@b.co"}) == %{}

      select_attr = %{
        slug: "team", name: "Team", type: "select", required: true,
        options: [%{label: "One", value: "1"}], validation: %{}, sort_order: 0
      }

      assert Form.error_for(select_attr, %{"team" => ""}) == Form.copy(:required)
      assert Form.error_for(select_attr, %{"team" => "9"}) == Form.copy(:select)
      assert Form.error_for(select_attr, %{"team" => "1"}) == nil
    end

    test "email_valid? is the regex-free shape check" do
      assert Form.email_valid?("a@b.co")
      refute Form.email_valid?("a@b")
      refute Form.email_valid?("a@b@")
      refute Form.email_valid?("@b.co")
      refute Form.email_valid?("ab.co")
    end

    test "field labels carry the required star" do
      assert Form.field_label(%{name: "Email", required: true}) == "Email *"
      assert Form.field_label(%{name: "Notes", required: false}) == "Notes"
    end

    test "input helpers map the attribute types" do
      assert Form.input_type(%{type: "int"}) == "number"
      assert Form.step(%{type: "int"}) == "1"
      assert Form.step(%{type: "float"}) == "any"
      assert Form.inputmode(%{type: "float"}) == "decimal"
      assert Form.autocomplete(%{type: "email"}) == "email"
      assert Form.guid?(%{type: "guid"}) == "false"
      assert Form.maxlength(%{validation: %{length: 40}}) == 40
    end

    test "fields/1 falls back to the email field" do
      assert Form.fields([]) == [Form.fallback_email()]
      assert Form.fields([%{slug: "x"}]) == [%{slug: "x"}]
    end
  end

  describe "manifest normalization" do
    test "normalize_list handles junk bodies" do
      empty = Form.normalize_list(%{})
      assert empty.attributes == []
      assert empty.opt_in_mode == "single"

      assert Form.normalize_list("junk").attributes == []
    end

    test "unknown attribute types clamp to string; options coerce scalars" do
      attr = Form.normalize_attr(%{"slug" => "s", "type" => "mystery", "options" => ["a", %{"label" => "B"}]})
      assert attr.type == "string"
      assert attr.options == [%{label: "a", value: "a"}, %{label: "B", value: "B"}]
    end
  end

  test "event contract" do
    assert Events.all()["waitlist"] == ["waitlist-success", "waitlist-error"]
  end
end
