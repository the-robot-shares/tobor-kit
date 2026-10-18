defmodule ToborKit.Hologram.TestSupport.Spike do
  @moduledoc """
  Transpiler spike (PORTING.md §6) — a contract-class-B stateful component
  whose `action/3` performs the string operations the phone-input family
  needs client-side:

    * `String.starts_with?/2`
    * `String.replace/3`
    * digit filtering via graphemes (regex-free E.164 pre-clean)
    * `String.split/2` + `Enum.join/2`

  Compile-level evidence: `mix compile --force` clean means the template
  compiler + call graph accepted this code. The generated client JS is
  inspected for the transpiled action bodies (see docs/PORTING.md §6 for
  the recorded verdicts). Runtime (browser) verification is deferred to
  the first integration wave.
  """

  use Hologram.Component

  prop :target, :string, default: "page"
  prop :value, :string, default: ""

  def template do
    ~HOLO"""
    <div class="tk tk-spike">
      <input
        class="tk-spike__input"
        data-cy="spike.input"
        name="value"
        type="tel"
        value={@value}
        $change={:set_value}
      />
      <button
        type="button"
        class="tk-spike__clean"
        data-cy="spike.clean"
        $click={action: :clean, target: @target}
      >
        Clean
      </button>
      <span class="tk-spike__out" data-cy="spike.output">{@cleaned}</span>
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component, value: props.value || "", cleaned: "")
  end

  def action(:set_value, params, component) do
    put_state(component, :value, params.event.value)
  end

  # Regex-free digit filter + E.164-ish leading-`+` handling: the exact
  # operation set the phone-input family needs client-side.
  def action(:clean, _params, component) do
    raw = component.state.value

    cleaned =
      if String.starts_with?(raw, "+") do
        "+" <> digits_only(raw)
      else
        digits_only(raw)
      end

    put_state(component, :cleaned, cleaned)
  end

  def digits_only(raw) do
    raw
    |> String.replace(" ", "")
    |> String.graphemes()
    |> Enum.filter(&digit?/1)
    |> Enum.join("")
  end

  def digit?(char) do
    char in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
  end
end
