defmodule ToborKit.Hologram.Sg.Input do
  @moduledoc """
  Mirror of `<noizu-sg-input>` (contract class A — stateless render-only).

  `type=textarea` renders a textarea; other types clamp to the Lit input
  type set (invalid → `text`). The `sg-input` CustomEvent becomes a
  `:sg_input` action dispatched to the `:target`; the host reads the new
  value from `params.event.value` (PORTING.md §2 rule 3).

  The mirror is value-prop driven: the host owns the value state and
  re-renders with the updated prop.

  Backend: None. Host owns the value.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :name, :string, default: ""
  prop :type, :string, default: "text"
  prop :disabled, :boolean, default: false
  prop :error, :boolean, default: false
  prop :value, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-input", @class)}>
      {%if resolved_type(@type) == "textarea"}
        <textarea
          class="tk-sg-input__field"
          data-cy="sg.input"
          data-error={error_flag(@error)}
          name={maybe_name(@name)}
          aria-invalid={error_flag(@error)}
          value={@value}
          disabled={@disabled}
          $change={action: :sg_input, target: @target}
        ></textarea>
      {%else}
        <input
          class="tk-sg-input__field"
          data-cy="sg.input"
          data-error={error_flag(@error)}
          type={resolved_type(@type)}
          name={maybe_name(@name)}
          aria-invalid={error_flag(@error)}
          value={@value}
          disabled={@disabled}
          $change={action: :sg_input, target: @target}
        />
      {/if}
    </div>
    """
  end

  @doc "Type clamp — `textarea` passes through, invalid types fall back to `text`."
  def resolved_type("textarea"), do: "textarea"

  def resolved_type(type) when type in ["text", "password", "email", "number", "url", "tel", "search"],
    do: type

  def resolved_type(_), do: "text"

  @doc "`data-error` / `aria-invalid` flag — Lit renders the strings `true`/`false`."
  def error_flag(true), do: "true"
  def error_flag(_), do: "false"

  @doc "Empty name drops the attribute (Lit `this.name || nothing`)."
  def maybe_name(""), do: nil
  def maybe_name(name), do: name
end
