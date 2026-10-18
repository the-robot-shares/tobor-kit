defmodule ToborKit.Hologram.SubscriptionGateTest do
  use ExUnit.Case, async: false

  alias Hologram.Component.Action
  alias ToborKit.Hologram.SubscriptionGate.Gate
  alias ToborKit.Hologram.Support.Events

  defmodule StubTransport do
    def get(_url, _opts \\ []),
      do: Application.get_env(:tobor_kit_hologram, :stub_transport_response)
  end

  defmodule ApiHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:tobor_kit_api),
      do: %{base_url: "https://api.test", token: "secret-token", transport: StubTransport}

    def resolve(scope), do: raise(ArgumentError, "unmapped scope #{inspect(scope)}")
  end

  @server %Hologram.Server{cid: "gate-1"}

  setup do
    Application.put_env(:tobor_kit_hologram, :host_config_module, ApiHostConfig)

    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :stub_transport_response)
    end)

    :ok
  end

  describe "commands — :check_entitlement" do
    test "200 + entitled:true maps to :entitled_confirmed" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:ok, %{"entitled" => true}})

      server = Gate.command(:check_entitlement, %{url: "/api/entitlements"}, @server)

      assert %Action{name: :entitled_confirmed} = server.next_action
    end

    test "200 + entitled:false maps to :check_unconfirmed (stays blocked)" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:ok, %{"entitled" => false}})

      server = Gate.command(:check_entitlement, %{url: "/api/entitlements"}, @server)

      assert %Action{name: :check_unconfirmed} = server.next_action
    end

    test "non-200 maps to :check_unconfirmed (Lit ignores the status but still blocks)" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{status: 403, body: ""}})

      server = Gate.command(:check_entitlement, %{url: "/api/entitlements"}, @server)

      assert %Action{name: :check_unconfirmed} = server.next_action
    end

    test "transport failure maps to :check_unconfirmed" do
      Application.put_env(:tobor_kit_hologram, :stub_transport_response, {:error, %{reason: "econnrefused"}})

      server = Gate.command(:check_entitlement, %{url: "/api/entitlements"}, @server)

      assert %Action{name: :check_unconfirmed} = server.next_action
    end

    test "reserved secret keys in params are denied at the door" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Gate.command(:check_entitlement, %{url: "/x", token: "spoof"}, @server)
      end
    end
  end

  describe "client actions" do
    defp component do
      Gate.init(%{check_url: "/api/entitlements", target: "page"}, %Hologram.Component{}, nil)
    end

    test "starts blocked with the resolved redirect default" do
      component = component()
      assert component.state.entitled == false
      assert component.state.redirect_to == "/pricing"
    end

    test ":check dispatches the command once and sets checking" do
      component = Gate.action(:check, %{}, component())

      assert component.state.checking == true
      assert component.next_command.name == :check_entitlement
      assert component.next_command.params == %{url: "/api/entitlements"}

      # already checking → no double dispatch
      component = Gate.action(:check, %{}, component)
      assert component.next_command.params == %{url: "/api/entitlements"}
    end

    test ":check is a no-op without a check_url" do
      component = Gate.init(%{}, %Hologram.Component{}, nil)
      assert Gate.action(:check, %{}, component).next_command == nil
    end

    test ":entitled_confirmed unlocks the gate" do
      component =
        Gate.action(:entitled_confirmed, %{}, Hologram.Component.put_state(component(), checking: true))

      assert component.state.entitled == true
      assert component.state.checking == false
    end

    test ":check_unconfirmed forwards gate_blocked with the redirect" do
      component =
        Gate.init(%{check_url: "/x", redirect_to: "/plans", auto_redirect: false, target: "page"}, %Hologram.Component{}, nil)

      component =
        Gate.action(:check_unconfirmed, %{}, Hologram.Component.put_state(component, checking: true))

      assert component.next_action.name == :gate_blocked
      assert component.next_action.params == %{redirect_to: "/plans"}
      assert component.next_action.target == "page"
      assert component.state.checking == false
    end

    test ":check_unconfirmed with auto_redirect still forwards the event (veto not representable)" do
      component =
        Gate.init(%{check_url: "/x", redirect_to: "/plans", auto_redirect: true, target: "page"}, %Hologram.Component{}, nil)

      component = Gate.action(:check_unconfirmed, %{}, component)

      assert component.next_action.name == :gate_blocked
      assert component.next_action.params == %{redirect_to: "/plans"}
    end

    test "unknown actions are no-ops" do
      component = component()
      assert Gate.action(:bogus, %{}, component) == component
    end
  end

  describe "resolved_redirect/1" do
    test "blank falls back to /pricing; values pass through" do
      assert Gate.resolved_redirect("") == "/pricing"
      assert Gate.resolved_redirect("/upgrade") == "/upgrade"
    end
  end

  test "event contract" do
    assert Events.all()["subscription-gate"] == ["gate-blocked"]
  end
end
