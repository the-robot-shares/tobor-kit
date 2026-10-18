defmodule ToborKit.Hologram.Telemetry.Toggle do
  @moduledoc """
  Mirror of `<tobor-telemetry-toggle>` (contract class B + commands — PORTING.md §6.7).

  Consent is resolved server-side: the `:load_consent` command GETs
  `/telemetry/consent` through the `:tobor_kit_api` HostConfig scope; the
  `:set_consent` command PUTs the new value. A 403 means the server
  disagreed with the client's belief that the toggle was overridable — the
  mirror reverts to a forced (inert) consent state and re-renders nothing,
  rather than leaving a dead control.

  Render states (Lit parity):

    * consent known and overridable — the checkbox
    * consent known but forced / not overridable — **nothing** (a toggle
      that cannot change anything is a lie in the UI)
    * load error — `.notice--error` with the reason
    * otherwise — nothing (loading, or neither consent nor a fetch)

  Event contract: `tobor-telemetry-change` (verbatim registry name, §2)
  forwards as action `:tobor_telemetry_change` with `%{consent: map}` to
  the `:target`.

  **Host requirement (class B): embed with a `cid`.**

  Deltas (documented): Hologram has no mount-time trigger, so the initial
  GET is not automatic — pass the `consent` prop (host-fetched snapshot)
  or invoke the `:load_consent` command from host-authored trigger content
  targeted at the mirror's cid. See the README.

  Backend: `:tobor_kit_api` HostConfig scope (`%{base_url, token}`); the
  scope map may also carry `transport` (module with `get/2`/`put/3`
  matching `Support.Http`) for test/gallery injection.
  """

  use Hologram.Component

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  prop :consent, :map, default: nil
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-telemetry-toggle", @class)}>
      {%if @consent}
        {%if overridable?(@consent)}
          <label class="tk-telemetry-toggle__label">
            <input
              type="checkbox"
              data-testid="telemetry-toggle"
              checked={@consent.enabled}
              disabled={@saving}
              aria-label="Allow the guide to log conversation content"
              $change={:toggle}
            />
            <span>Log conversation content for debugging</span>
          </label>
        {/if}
      {/if}
      {%if @error != ""}
        <div class="notice notice--error" data-testid="telemetry-error">
          Could not load telemetry consent: {@error}
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component,
      consent: normalize_consent(Map.get(props, :consent)),
      error: "",
      saving: false,
      target: Map.get(props, :target) || "parent"
    )
  end

  # — client actions —

  # Checkbox change: optimistic local echo of the checked flag is NOT kept —
  # the command result (or the 403 revert) is the source of truth, so the
  # checkbox simply goes into `saving` while the round-trip runs.
  def action(:toggle, params, component) do
    if component.state.saving do
      component
    else
      component
      |> put_state(saving: true)
      |> put_command(:set_consent, %{enabled: params.event.value == true})
    end
  end

  # Explicit load trigger (see moduledoc delta): host-authored content or a
  # host page action can dispatch this to fetch consent.
  def action(:load, _params, component) do
    put_command(component, :load_consent, %{})
  end

  def action(:consent_loaded, params, component) do
    put_state(component, consent: params.consent, error: "", saving: false)
  end

  def action(:consent_saved, params, component) do
    component
    |> put_state(consent: params.consent, saving: false)
    |> put_action(
      name: :tobor_telemetry_change,
      params: %{consent: params.consent},
      target: component.state.target
    )
  end

  # 403 — the server says the default is binding. Stop offering the lie.
  def action(:consent_forbidden, params, component) do
    forced =
      forced_consent(component.state.consent, enabled: !params.enabled)

    component
    |> put_state(consent: forced, saving: false)
    |> put_action(
      name: :tobor_telemetry_change,
      params: %{consent: forced},
      target: component.state.target
    )
  end

  def action(:consent_error, params, component) do
    put_state(component, error: params.message, saving: false)
  end

  def action(_, _params, component), do: component

  # — server commands (one request each, §6.9) —

  def command(:load_consent, params, server) do
    _params = HostConfig.from_params!(params)
    config = HostConfig.resolve(:tobor_kit_api)
    http = transport(config)

    case http.get(Map.get(config, :base_url) <> "/telemetry/consent", headers: auth_headers(config)) do
      {:ok, body} ->
        put_action(server, :consent_loaded, %{consent: consent_from_body(body)})

      {:error, err} ->
        put_action(server, :consent_error, %{message: error_message(err)})
    end
  end

  def command(:set_consent, params, server) do
    params = HostConfig.from_params!(params)
    config = HostConfig.resolve(:tobor_kit_api)
    http = transport(config)

    case http.put(Map.get(config, :base_url) <> "/telemetry/consent", %{enabled: params.enabled},
           headers: auth_headers(config)
         ) do
      {:ok, body} ->
        put_action(server, :consent_saved, %{consent: consent_from_body(body)})

      {:error, %{status: 403}} ->
        put_action(server, :consent_forbidden, %{enabled: params.enabled})

      {:error, err} ->
        put_action(server, :consent_error, %{message: error_message(err)})
    end
  end

  # — public: template-called helpers transpile client-side —

  # True when the user may actually change the resolved value (Lit `overridable`).
  # Tolerant of both atom- and string-keyed consent maps: props arrive
  # string-keyed (§6.2), command results are normalized server-side.
  @doc "Consent is overridable when present, not `source: forced`, and `user_overridable` is not false."
  def overridable?(consent) when is_map(consent) do
    source = consent_get(consent, :source)
    overridable_flag = consent_get(consent, :user_overridable)

    source != "forced" and overridable_flag != false
  end

  def overridable?(_), do: false

  @doc "Normalizes a host-provided consent prop (atom- or string-keyed) into the canonical atom-keyed shape; nil/junk passes through as nil."
  def normalize_consent(nil), do: nil

  def normalize_consent(consent) when is_map(consent) do
    %{
      enabled: consent_get(consent, :enabled) == true,
      source: consent_get(consent, :source) || "",
      user_overridable: consent_get(consent, :user_overridable) != false
    }
  end

  def normalize_consent(_), do: nil

  # — internals shared client+server (verified op set only) —

  defp consent_get(consent, key) do
    # Explicit false/"" values must win, so only fall through to the string
    # spelling when the atom key is genuinely absent.
    if Map.has_key?(consent, key) do
      Map.get(consent, key)
    else
      Map.get(consent, Atom.to_string(key))
    end
  end

  # Lit `#toggle` 403 branch: keep the previous consent but mark it binding.
  defp forced_consent(previous, opts) do
    base =
      if is_map(previous) do
        previous
      else
        %{enabled: opts[:enabled], source: "", user_overridable: true}
      end

    base
    |> Map.put(:source, "forced")
    |> Map.put(:user_overridable, false)
  end

  # — server-only internals —

  defp transport(config), do: Map.get(config, :transport, Http)

  defp auth_headers(config) do
    case Map.get(config, :token) do
      nil -> []
      token -> [authorization: "Bearer " <> token]
    end
  end

  # GET/PUT bodies are JSON → string keys; normalize into the canonical
  # atom-keyed consent shape before it rides the wire back to the client.
  defp consent_from_body(body) when is_map(body) do
    %{
      enabled: Map.get(body, "enabled") == true,
      source: Map.get(body, "source") || "",
      user_overridable: Map.get(body, "user_overridable") != false
    }
  end

  defp consent_from_body(_), do: %{enabled: false, source: "", user_overridable: true}

  defp error_message(%{status: status, body: body}) do
    "request failed (#{status})" <> suffix(body)
  end

  defp error_message(%{reason: reason}) when is_binary(reason), do: reason
  defp error_message(_), do: "unknown error"

  defp suffix(body) when is_binary(body) and body != "", do: ": " <> body
  defp suffix(_), do: ""
end
