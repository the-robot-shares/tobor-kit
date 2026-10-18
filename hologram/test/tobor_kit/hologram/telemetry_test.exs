defmodule ToborKit.Hologram.TelemetryTest do
  use ExUnit.Case, async: false

  # Application-env host-config + transport injection (async: false).
  alias Hologram.Component.Action
  alias ToborKit.Hologram.Support.Events
  alias ToborKit.Hologram.Telemetry.Toggle

  defmodule StubTransport do
    # Behaviour canned per test via :tobor_kit_hologram :stub_transport_response.
    def get(_url, _opts), do: canned()
    def put(_url, _payload, _opts), do: canned()

    defp canned, do: Application.get_env(:tobor_kit_hologram, :stub_transport_response)
  end

  defmodule StubHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:tobor_kit_api),
      do: %{base_url: "https://api.test", token: "secret-token", transport: StubTransport}

    def resolve(scope), do: raise(ArgumentError, "unmapped scope #{inspect(scope)}")
  end

  @server %Hologram.Server{cid: "telemetry-1"}

  setup do
    Application.put_env(:tobor_kit_hologram, :host_config_module, StubHostConfig)

    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :stub_transport_response)
    end)

    :ok
  end

  defp next_action(server), do: server.next_action

  describe "commands — :load_consent" do
    test "GET resolves through HostConfig and returns the normalized consent" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response,
        {:ok, %{"enabled" => true, "source" => "user", "user_overridable" => true}}
      )

      server = Toggle.command(:load_consent, %{}, @server)

      assert %Action{name: :consent_loaded, params: %{consent: consent}} = next_action(server)
      assert consent == %{enabled: true, source: "user", user_overridable: true}
    end

    test "transport failure maps to :consent_error" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{reason: "econnrefused"}})

      server = Toggle.command(:load_consent, %{}, @server)

      assert %Action{name: :consent_error, params: %{message: "econnrefused"}} = next_action(server)
    end

    test "HTTP error status maps to :consent_error with the status" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{status: 500, body: "boom"}})

      server = Toggle.command(:load_consent, %{}, @server)

      assert %Action{name: :consent_error, params: %{message: "request failed (500): boom"}} =
               next_action(server)
    end

    test "reserved secret keys in params are denied at the door" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Toggle.command(:load_consent, %{token: "spoofed"}, @server)
      end
    end
  end

  describe "commands — :set_consent" do
    test "2xx returns :consent_saved with the server's consent body" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response,
        {:ok, %{"enabled" => false, "source" => "user", "user_overridable" => true}}
      )

      server = Toggle.command(:set_consent, %{enabled: false}, @server)

      assert %Action{name: :consent_saved, params: %{consent: %{enabled: false}}} =
               next_action(server)
    end

    test "403 maps to :consent_forbidden (server says the default is binding)" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{status: 403, body: ""}})

      server = Toggle.command(:set_consent, %{enabled: true}, @server)

      assert %Action{name: :consent_forbidden, params: %{enabled: true}} = next_action(server)
    end

    test "5xx maps to :consent_error" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{status: 500, body: ""}})

      server = Toggle.command(:set_consent, %{enabled: true}, @server)

      assert %Action{name: :consent_error} = next_action(server)
    end
  end

  describe "client actions" do
    test ":toggle goes into saving and dispatches the set_consent command" do
      component =
        Toggle.init(%{consent: %{enabled: true, source: "user", user_overridable: true}}, %Hologram.Component{}, nil)

      component = Toggle.action(:toggle, %{event: %{value: false}}, component)

      assert component.state.saving == true
      assert component.next_command.name == :set_consent
      assert component.next_command.params == %{enabled: false}
    end

    test ":consent_saved updates state and forwards tobor_telemetry_change to the target" do
      component = Toggle.init(%{target: "page"}, %Hologram.Component{}, nil)
      consent = %{enabled: true, source: "user", user_overridable: true}

      component =
        Toggle.action(:consent_saved, %{consent: consent}, Hologram.Component.put_state(component, saving: true))

      assert component.state.consent == consent
      assert component.state.saving == false
      assert component.next_action.name == :tobor_telemetry_change
      assert component.next_action.params == %{consent: consent}
      assert component.next_action.target == "page"
    end

    test ":consent_forbidden reverts to a forced consent and forwards the change" do
      previous = %{enabled: true, source: "user", user_overridable: true}
      component = Toggle.init(%{}, %Hologram.Component{}, nil)
      component = Hologram.Component.put_state(component, consent: previous)

      component = Toggle.action(:consent_forbidden, %{enabled: true}, component)

      assert component.state.consent.source == "forced"
      assert component.state.consent.user_overridable == false
      assert component.state.consent.enabled == true
      assert component.next_action.name == :tobor_telemetry_change
    end

    test "unknown actions are no-ops (host-forwarding catch-all)" do
      component = Toggle.init(%{}, %Hologram.Component{}, nil)
      assert Toggle.action(:bogus, %{}, component) == component
    end
  end

  describe "overridable?/1" do
    test "atom-keyed (command-normalized) consent" do
      assert Toggle.overridable?(%{enabled: true, source: "user", user_overridable: true})
      refute Toggle.overridable?(%{enabled: true, source: "forced", user_overridable: true})
      refute Toggle.overridable?(%{enabled: true, source: "user", user_overridable: false})
    end

    test "string-keyed (prop) consent" do
      assert Toggle.overridable?(%{"enabled" => true, "source" => "default", "user_overridable" => true})
      refute Toggle.overridable?(%{"enabled" => true, "source" => "forced"})
    end

    test "nil/junk is not overridable" do
      refute Toggle.overridable?(nil)
      refute Toggle.overridable?("junk")
    end
  end

  describe "normalize_consent/1" do
    test "fills defaults for missing keys" do
      assert Toggle.normalize_consent(%{}) == %{enabled: false, source: "", user_overridable: true}
      assert Toggle.normalize_consent(nil) == nil
    end
  end

  test "event contract: tobor-telemetry-change is the registry name" do
    assert Events.all()["telemetry-toggle"] == ["tobor-telemetry-change"]
  end
end
