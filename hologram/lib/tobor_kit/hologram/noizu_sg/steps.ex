defmodule ToborKit.Hologram.Sg.Steps do
  @moduledoc """
  Mirror of `<noizu-sg-steps>` (contract class A — stateless render-only).

  `steps` is a list of labels; `current` is the 0-based index of the current
  step (clamped to an integer; the Lit version does not clamp range — an
  out-of-range index simply marks nothing current/done, and so does the
  mirror).

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :steps, :list, default: []
  prop :current, :integer, default: 0
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-steps", @class)}>
      <ol
        class="tk-sg-steps__list"
        data-cy="sg.steps"
        data-current={Integer.to_string(resolved_current(@current))}
        aria-label="Progress"
      >
        {%for step <- steps_view(@steps, @current)}
          <li
            class="tk-sg-steps__step"
            data-state={Map.get(step, :state)}
            aria-current={Map.get(step, :aria_current)}
          >
            <span class="tk-sg-steps__bar" aria-hidden="true"></span>
            <span class="tk-sg-steps__index">{Map.get(step, :number)}</span>
            <span class="tk-sg-steps__label">{Map.get(step, :label)}</span>
          </li>
        {/for}
      </ol>
    </div>
    """
  end

  @doc "Current clamp — non-integer falls back to 0 (Lit `resolvedCurrent`)."
  def resolved_current(current) when is_integer(current), do: current
  def resolved_current(_), do: 0

  @doc "Per-step view models: `%{number, label, state, aria_current}` (port of Lit `stepState`)."
  def steps_view(steps, current) when is_list(steps) do
    current = resolved_current(current)

    Enum.with_index(steps, fn label, index ->
      state = step_state(index, current)

      %{
        number: Integer.to_string(index + 1),
        label: step_label(label),
        state: state,
        aria_current: if(state == "current", do: "step", else: "false")
      }
    end)
  end

  def steps_view(_, _), do: []

  @doc "Labels coerce to strings; `nil` renders empty (Lit `asSteps`)."
  def step_label(nil), do: ""
  def step_label(label) when is_binary(label), do: label
  def step_label(label), do: to_string(label)

  def step_state(index, current) when index < current, do: "done"
  def step_state(index, index), do: "current"
  def step_state(_, _), do: "todo"
end
