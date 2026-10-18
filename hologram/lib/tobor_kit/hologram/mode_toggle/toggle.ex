defmodule ToborKit.Hologram.ModeToggle.Toggle do
  @moduledoc """
  Mirror of `<tobor-mode-toggle>` (contract class B — stateful interactive).

  Voice ⇄ text ⇄ transcript switcher. The mode list comes from the host
  (`modes` prop, display order); the active mode is local state seeded from
  the `mode` prop. Properties down, one action up: selecting a mode updates
  local state and forwards `:tobor_mode_change` (`%{mode, previous}`) to the
  `:target` — the Lit `tobor-mode-change` CustomEvent, name kept verbatim as
  an atom.

  **Host requirement (class B): embed with a `cid` or init/3 never runs.**

  Divergence (documented, PORTING.md §4.3): the Lit `modes` property is a
  JS-only array of `GuideMode` atoms; the mirror takes a list of strings and
  labels known modes via `mode_label/1` (unknown modes render raw, as Lit).

  Backend: None. Host owns the conversation mode.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :modes, :list, default: ["text"]
  prop :mode, :string, default: "text"
  prop :disabled, :boolean, default: false
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-mode-toggle", @class)}>
      {%if @modes != []}
        <div class="tk-mode-toggle__group" role="radiogroup" aria-label="Conversation mode">
          {%for mode <- @modes}
            <button
              type="button"
              class="tk-mode-toggle__mode"
              role="radio"
              data-mode={mode}
              aria-checked={checked?(mode, @mode)}
              disabled={@disabled or mode == @mode}
              $click={action: :select, params: %{mode: mode, previous: @mode}}
            >
              {mode_label(mode)}
            </button>
          {/for}
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component,
      modes: modes_value(props.modes),
      mode: props.mode || "text",
      disabled: props.disabled || false,
      target: props.target || "parent"
    )
  end

  # Selecting the active mode is a no-op (Lit `#select` guard); the template
  # also disables the active button, matching Lit's `?disabled` expression.
  def action(:select, params, component) do
    mode = params.mode
    previous = component.state.mode

    if component.state.disabled or mode == previous do
      component
    else
      component
      |> put_state(mode: mode)
      |> put_action(
        name: :tobor_mode_change,
        params: %{mode: mode, previous: previous},
        target: component.state.target
      )
    end
  end

  def action(_, _params, component), do: component

  # — public: template-called helpers transpile client-side —

  @doc "Modes normalizer — strings pass through, non-string items drop (string keys stay strings)."
  def modes_value(modes) when is_list(modes) do
    Enum.filter(modes, &is_binary/1)
  end

  def modes_value(_), do: []

  @doc "`aria-checked` flag string for a mode button."
  def checked?(mode, current), do: if(mode == current, do: "true", else: "false")

  @doc "Known-mode labels (Lit `MODE_LABELS`); unknown modes render raw."
  def mode_label("voice"), do: "Voice"
  def mode_label("text"), do: "Text"
  def mode_label("transcript"), do: "Transcript"
  def mode_label(mode) when is_binary(mode), do: mode
  def mode_label(_), do: ""
end
