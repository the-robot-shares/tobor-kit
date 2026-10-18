defmodule ToborKit.Hologram.Faq.Faq do
  @moduledoc """
  Mirror of `<noizu-faq>` (contract class B — stateful interactive).

  **Documented divergence (PORTING.md §4.1):** the Lit element decorates
  host-slotted `<details>/<summary>` elements; slots could not express the
  interactive contract, so the mirror takes an `items` prop
  (`%{question, answer}` maps, string- or atom-keyed) and renders native
  `<details>/<summary>` itself. With an empty `items` list it falls back to
  a plain `<slot />` (display-only — no accordion, no `faq-toggle` events;
  hosts needing the slotted Lit behavior keep using the Lit element).

  `mode="one"` is the accordion: opening an item closes the others. Every
  toggle forwards `:faq_toggle` (`%{open, index}`) to the `:target` — the
  Lit `faq-toggle` CustomEvent, name kept verbatim as an atom.

  **Host requirement (class B): embed with a `cid` or init/3 never runs.**

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :items, :list, default: []
  prop :mode, :string, default: "many"
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-faq", @class)}>
      {%if @items_view != []}
        <div class="hui tk-faq__list" data-cy="faq.list">
          {%for item <- @items_view}
            <details
              class="hui disclosure disclosure-panel tk-faq__item"
              data-cy="faq.item"
              open={item_open?(@open, Map.get(item, :index))}
            >
              <summary
                class="hui disclosure-button tk-faq__trigger"
                data-cy="faq.trigger"
                $click={action: :toggle, params: %{index: Map.get(item, :index)}}
              >
                {Map.get(item, :question)}
              </summary>
              <div class="tk-faq__answer">{Map.get(item, :answer)}</div>
            </details>
          {/for}
        </div>
      {%else}
        <div class="hui tk-faq__list" data-cy="faq.list">
          <slot />
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component,
      items_view: items_view(props.items),
      mode: clamp_mode(props.mode),
      open: [],
      target: props.target || "parent"
    )
  end

  # Accordion (`mode: "one"`): opening an item closes the others. The
  # browser toggles the native `open` attribute itself; the mirror keeps
  # state in sync and forwards the event.
  def action(:toggle, params, component) do
    index = params.index
    was_open? = item_open?(component.state.open, index)

    open =
      if was_open? do
        Enum.reject(component.state.open, &(&1 == index))
      else
        if component.state.mode == "one" do
          [index]
        else
          [index | component.state.open]
        end
      end

    component
    |> put_state(open: open)
    |> put_action(
      name: :faq_toggle,
      params: %{open: not was_open?, index: index},
      target: component.state.target
    )
  end

  def action(_, _params, component), do: component

  # — public: template-called helpers transpile client-side —

  @doc "Mode clamp — invalid input falls back to `many` (Lit default)."
  def clamp_mode("one"), do: "one"
  def clamp_mode(_), do: "many"

  @doc """
  Item normalizer (string- or atom-keyed maps; `nil`/non-map items render
  empty) with positional `index` for the toggle contract.
  """
  def items_view(items) when is_list(items) do
    items
    |> Enum.with_index()
    |> Enum.map(fn {item, index} ->
      %{
        index: index,
        question: text(fetch(item, "question", :question)),
        answer: text(fetch(item, "answer", :answer))
      }
    end)
  end

  def items_view(_), do: []

  @doc "Open-state membership check (drives the native `open` attribute)."
  def item_open?(open, index), do: Enum.member?(open, index)

  @doc false
  def fetch(item, string_key, atom_key) when is_map(item) do
    case Map.get(item, string_key) do
      nil -> Map.get(item, atom_key)
      value -> value
    end
  end

  def fetch(_, _, _), do: nil

  @doc false
  def text(nil), do: ""
  def text(value) when is_binary(value), do: value
  def text(value), do: to_string(value)
end
