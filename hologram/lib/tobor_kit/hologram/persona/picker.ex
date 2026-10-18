defmodule ToborKit.Hologram.Persona.Picker do
  @moduledoc """
  Mirror of `<tobor-persona-picker>` (registry: `persona` family) — searchable
  grid of host-supplied personas. Contract class B (stateful interactive;
  PORTING.md §1): owns the `:query` search state; embeds require a host `cid`
  (hard renderer requirement — without it `init/3` never runs).

  Lit surface → mirror surface:

    * `personas` JS property → `:list` prop of string-keyed maps
      `%{"id" => ..., "name" => ..., "handle" => ...}` (template-passed map
      literals arrive string-keyed — PORTING.md §6.2). Never fetched; the
      host supplies the roster.
    * `query` attr → `:query` prop, seeded into state by `init/3`; the search
      input's `$change` (native `input` event for text inputs — every
      keystroke, like the Lit `@input`) drives the `:set_query` action.
    * event `persona-select` `{personaId}` → item binding
      `$click={action: :persona_select, params: %{persona_id: ...}, target: @target}`
      (PORTING.md §2). `:target` defaults to `"parent"`. The island does not
      fetch or navigate.

  Filtering (`filter_personas/2`) runs in template-called public functions
  using only client-verified string ops (`String.trim/1`, `String.downcase/1`,
  `String.contains?/2` — PORTING.md §6.1 verified list).
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :personas, :list, default: []
  prop :query, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-persona-picker", @class)}>
      <div class="tk-persona-picker__picker" data-cy="persona.picker">
        <div class="tk-persona-picker__search">
          <label class="tk-persona-picker__label">
            Search
            <input
              type="search"
              class="tk-persona-picker__input"
              data-cy="persona.search"
              placeholder="Search personas"
              value={@query}
              $change={:set_query}
            />
          </label>
        </div>
        {%if visible_personas(@personas, @query) == []}
          <p class="tk-persona-picker__empty">{empty_copy(@personas)}</p>
        {%else}
          <ul class="tk-persona-picker__grid">
            {%for row <- visible_personas(@personas, @query)}
              <li>
                <button
                  type="button"
                  class="tk-persona-picker__item"
                  data-cy="persona.item"
                  data-persona-id={persona_id(row)}
                  $click={action: :persona_select, params: %{persona_id: persona_id(row)}, target: @target}
                >
                  <span class="tk-persona-picker__name">{persona_name(row)}</span>
                  {%if handle_text(row) != ""}
                    <span class="tk-persona-picker__handle">{handle_text(row)}</span>
                  {/if}
                </button>
              </li>
            {/for}
          </ul>
        {/if}
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component, query: props.query || "")
  end

  # Lit `onQueryInput`: `params.event.value` replaces `event.detail.value`
  # (PORTING.md §2 rule 3).
  def action(:set_query, params, component) do
    put_state(component, :query, params.event.value)
  end

  # -- public helpers (templates call public fns only) ----------------------

  @doc """
  Lit `filterPersonas`: drop rows without `id`+`name`, then — when the
  trimmed/lowercased query is non-empty — keep rows whose id, name, or
  handle contains it.
  """
  def filter_personas(personas, query) do
    q = String.trim(query) |> String.downcase()
    rows = Enum.filter(personas, &valid_row?/1)

    if q == "" do
      rows
    else
      Enum.filter(rows, fn row -> matches?(row, q) end)
    end
  end

  @doc "Filtered rows for the current query (template-facing alias)."
  def visible_personas(personas, query) do
    filter_personas(personas, query)
  end

  @doc "Lit empty copy: `'No matching personas'` vs `'No personas'`."
  def empty_copy(personas) do
    if personas == [] do
      "No personas"
    else
      "No matching personas"
    end
  end

  @doc "Row id (string-keyed map access — PORTING.md §6.2)."
  def persona_id(row) do
    Map.get(row, "id") || ""
  end

  @doc "Row name (string-keyed map access)."
  def persona_name(row) do
    Map.get(row, "name") || ""
  end

  @doc "Trimmed row handle, `\"\"` when absent (string-keyed map access)."
  def handle_text(row) do
    case Map.get(row, "handle") do
      nil -> ""
      handle -> String.trim(handle)
    end
  end

  def valid_row?(row) do
    persona_id(row) != "" and persona_name(row) != ""
  end

  def matches?(row, q) do
    String.contains?(String.downcase(persona_id(row)), q) or
      String.contains?(String.downcase(persona_name(row)), q) or
      String.contains?(String.downcase(handle_text(row)), q)
  end
end
