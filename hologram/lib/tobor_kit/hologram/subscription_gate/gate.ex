defmodule ToborKit.Hologram.SubscriptionGate.Gate do
  @moduledoc """
  Mirror of `<noizu-subscription-gate>` (contract class B + commands —
  PORTING.md §6.7). Shadow-DOM entitled gate: renders the default slot when
  entitled, otherwise a blocked panel with an upgrade link.

  Host owns entitlement truth (Lit parity): pass the `entitled` prop and no
  network runs. The optional `check_url` entitlement probe runs as the
  `:check_entitlement` command instead of a client `fetch` — see the
  README for the cookie-session delta that implies.

  `gate-blocked` (cancelable CustomEvent in Lit) forwards as the
  `:gate_blocked` action `%{redirect_to}` to the `:target`. **Cancelable
  veto is not representable** — an action dispatch cannot be declined — so
  `auto_redirect` performs its §6.8 JS-interop navigation after forwarding,
  unconditionally. Hosts that need a veto keep `auto_redirect` false and
  navigate in their own `:gate_blocked` handler.

  **Host requirement (class B): embed with a `cid`.**

  Backend: `:tobor_kit_api` HostConfig scope (`%{base_url, token}`,
  optional `transport`) when `check_url` is a relative path; absolute
  `check_url`s pass through. Resolved in `command/3` only.
  """

  use Hologram.Component
  use Hologram.JS

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  prop :entitled, :boolean, default: false
  prop :check_url, :string, default: ""
  prop :redirect_to, :string, default: "/pricing"
  prop :auto_redirect, :boolean, default: false
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-subscription-gate", @class)} data-cy="gate.root">
      {%if @entitled}
        <slot />
      {/if}
      {%if not @entitled}
        <div class="tk-subscription-gate__blocked" data-cy="gate.blocked" role="status">
          <p>This content requires a subscription.</p>
          <a class="tk-subscription-gate__link" data-cy="gate.link" href={resolved_redirect(@redirect_to)}>Upgrade</a>
          {%if @check_url != "" and not @checking}
            <button type="button" class="tk-subscription-gate__check" $click={:check}>
              Check entitlement
            </button>
          {/if}
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component,
      entitled: Map.get(props, :entitled) == true,
      check_url: Map.get(props, :check_url) || "",
      redirect_to: resolved_redirect(Map.get(props, :redirect_to) || ""),
      auto_redirect: Map.get(props, :auto_redirect) == true,
      checking: false,
      target: Map.get(props, :target) || "parent"
    )
  end

  # — client actions —

  def action(:check, _params, component) do
    if component.state.entitled or component.state.checking or component.state.check_url == "" do
      component
    else
      component
      |> put_state(checking: true)
      |> put_command(:check_entitlement, %{url: component.state.check_url})
    end
  end

  def action(:entitled_confirmed, _params, component) do
    put_state(component, entitled: true, checking: false)
  end

  # Lit `announceBlocked` + conditional auto-redirect. The cancelable veto
  # is not representable (§README): the forward is unconditional, and
  # auto_redirect navigates via §6.8 JS interop right after.
  def action(:check_unconfirmed, _params, component) do
    component = put_state(component, checking: false)
    announce_blocked(component)
  end

  def action(_, _params, component), do: component

  defp announce_blocked(component) do
    redirect_to = component.state.redirect_to

    component =
      put_action(
        component,
        name: :gate_blocked,
        params: %{redirect_to: redirect_to},
        target: component.state.target
      )

    if component.state.auto_redirect do
      location = JS.get(:window, :location)
      JS.call(location, :assign, [redirect_to])
      component
    else
      component
    end
  end

  # — server command (one request, §6.9) —

  def command(:check_entitlement, params, server) do
    params = HostConfig.from_params!(params)
    config = HostConfig.resolve(:tobor_kit_api)
    http = Map.get(config, :transport, Http)

    url =
      if String.starts_with?(Map.get(params, :url) || "", "https://") do
        Map.get(params, :url)
      else
        Map.get(config, :base_url) <> (Map.get(params, :url) || "")
      end

    headers =
      case Map.get(config, :token) do
        nil -> []
        token -> [authorization: "Bearer " <> token]
      end

    case http.get(url, headers: headers) do
      {:ok, %{} = body} ->
        if Map.get(body, "entitled") == true do
          put_action(server, :entitled_confirmed, %{})
        else
          put_action(server, :check_unconfirmed, %{})
        end

      _other ->
        # Lit ignores non-200 silently but still announces the block.
        put_action(server, :check_unconfirmed, %{})
    end
  end

  # — public: template-called helpers —

  @doc "Non-empty redirect target or the Lit default (`/pricing`)."
  def resolved_redirect(value) do
    if value == "", do: "/pricing", else: value
  end
end
