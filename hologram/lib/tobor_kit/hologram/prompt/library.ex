defmodule ToborKit.Hologram.Prompt.Library do
  @moduledoc """
  Mirror of `<tobor-prompt-library>` (registry: `prompt` family) —
  searchable host-supplied prompt list. Contract class B (query filter +
  selected-id state).

  Lit events:

    * `prompt-select` `{id}` → `:prompt_select` `params: %{id: ...}`
    * `prompt-star` `{id, starred}` → `:prompt_star`
      `params: %{id: ..., starred: ...}` (local star state flips too)

  The island does not fetch or persist; the host owns stars. Body is always
  text (never parsed HTML).

  Client-filter divergence (PORTING.md §6.1 honesty rule): Lit filters
  per-keystroke with `query.trim().toLowerCase()` + `String.includes`. The
  transpiler-verified op set does not include `String.trim/downcase/
  contains?/2`, so the client-side filter is rebuilt from verified leaves
  (`String.graphemes`, `String.split`, `Enum.*`) with **ASCII-only** case
  folding; the initial filter (from the `query` prop) is computed
  server-side in init/3 with full Unicode semantics.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Tools

  prop :prompts, :list, default: []
  prop :query, :string, default: ""
  prop :selected_id, :string, default: ""
  prop :target, :string, default: "parent"

  def template do
    ~HOLO"""
    <div class="tk tk-prompt-library">
      <div class="tk-prompt-library__library" data-cy="prompt.library">
        <div class="tk-prompt-library__search">
          <label for="prompt-search">Search</label>
          <input
            id="prompt-search"
            type="search"
            placeholder="Search prompts"
            aria-label="Search prompts"
            value={@query}
            $change={:set_query}
          />
        </div>
        {%if @visible != []}
          <ul class="tk-prompt-library__list">
            {%for row <- @visible}
              <li>
                <div class="tk-prompt-library__row">
                  <button
                    type="button"
                    class="tk-prompt-library__item"
                    data-cy="prompt.item"
                    data-prompt-id={row.id}
                    aria-current={flag(row.id == @selected_id)}
                    $click={action: :select_item, params: %{id: row.id}}
                  >
                    <span class="tk-prompt-library__title">{row.title}</span>
                    {%if row.body != ""}
                      <pre class="tk-prompt-library__body">{row.body}</pre>
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="tk-prompt-library__star"
                    data-cy="prompt.star"
                    data-prompt-id={row.id}
                    aria-pressed={flag(row.starred)}
                    aria-label={star_label(row)}
                    $click={action: :toggle_star, params: %{id: row.id}}
                  >
                    {%if row.starred}Starred{%else}Star{/if}
                  </button>
                </div>
              </li>
            {/for}
          </ul>
        {%else}
          <p class="empty muted tk-prompt-library__empty">{empty_copy(@prompts)}</p>
        {/if}
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    rows = normalize_prompts(props.prompts)
    query = props.query || ""

    put_state(component,
      target: props.target,
      rows: rows,
      query: query,
      selected_id: props.selected_id,
      visible: filter_prompts(rows, query)
    )
  end

  # -- actions (client; transpiler-verified ops only — PORTING.md §6.1) --

  # Lit filters per keystroke; the client-side filter below is rebuilt from
  # transpiler-verified leaves (ASCII-only case folding — see moduledoc).
  def action(:set_query, params, component) do
    query = params.event.value
    put_state(component, query: query, visible: filter_prompts(component.state.rows, query))
  end

  def action(:select_item, %{id: id}, component) do
    component
    |> put_action(name: :prompt_select, target: component.state.target, params: %{id: id})
    |> put_state(selected_id: id)
  end

  def action(:toggle_star, %{id: id}, component) do
    starred = if starred?(component.state.rows, id), do: false, else: true

    component
    |> put_action(
      name: :prompt_star,
      target: component.state.target,
      params: %{id: id, starred: starred}
    )
    |> put_state(
      rows: set_starred(component.state.rows, id, starred),
      visible: set_starred(component.state.visible, id, starred)
    )
  end

  # -- normalization / filtering (shared server + client-safe impl) --

  @doc "Normalizes the prompt roster (`{id, title, body, starred?}`)."
  @spec normalize_prompts(any) :: [map]
  def normalize_prompts(prompts) when is_list(prompts) do
    for row <- prompts, is_map(row) do
      id = Tools.to_s(Tools.fetch(row, :id))

      if id != "" do
        %{
          id: id,
          title: Tools.to_s(Tools.fetch(row, :title) || ""),
          body: Tools.to_s(Tools.fetch(row, :body) || ""),
          starred: Tools.fetch(row, :starred) == true
        }
      else
        nil
      end
    end
    |> Enum.reject(&is_nil/1)
  end

  def normalize_prompts(_), do: []

  @doc """
  Filters prompts by query (Lit `filterPrompts`): case-insensitive substring
  match over id, title and body. Client-safe ops only; **ASCII-only case
  folding** (see moduledoc).
  """
  @spec filter_prompts([map], String.t()) :: [map]
  def filter_prompts(rows, query) do
    q = normalize_query(query)

    if q == "" do
      rows
    else
      for row <- rows, matches?(row, q), do: row
    end
  end

  @doc "Query prep: ASCII-downcase + space-trim, client-safe ops."
  @spec normalize_query(String.t()) :: String.t()
  def normalize_query(query) do
    query
    |> downcase_ascii()
    |> trim_spaces()
  end

  @doc "Substring test built from transpiler-verified `String.split/2`."
  @spec contains?(String.t(), String.t()) :: boolean
  def contains?(hay, needle) do
    needle == "" or length(String.split(hay, needle)) > 1
  end

  @doc "ASCII case folding via graphemes (client-safe; Unicode folding is init-only)."
  @spec downcase_ascii(String.t()) :: String.t()
  def downcase_ascii(text) do
    text
    |> String.graphemes()
    |> Enum.map(&down_char/1)
    |> Enum.join("")
  end

  @doc "Single-char ASCII lowercase."
  @spec down_char(String.t()) :: String.t()
  def down_char(char) do
    case char do
      "A" -> "a"
      "B" -> "b"
      "C" -> "c"
      "D" -> "d"
      "E" -> "e"
      "F" -> "f"
      "G" -> "g"
      "H" -> "h"
      "I" -> "i"
      "J" -> "j"
      "K" -> "k"
      "L" -> "l"
      "M" -> "m"
      "N" -> "n"
      "O" -> "o"
      "P" -> "p"
      "Q" -> "q"
      "R" -> "r"
      "S" -> "s"
      "T" -> "t"
      "U" -> "u"
      "V" -> "v"
      "W" -> "w"
      "X" -> "x"
      "Y" -> "y"
      "Z" -> "z"
      _ -> char
    end
  end

  @doc "Space-trim via verified graphemes ops (String.trim/1 is unverified client-side)."
  @spec trim_spaces(String.t()) :: String.t()
  def trim_spaces(text) do
    text
    |> String.graphemes()
    |> Enum.drop_while(fn char -> char == " " end)
    |> Enum.reverse()
    |> Enum.drop_while(fn char -> char == " " end)
    |> Enum.reverse()
    |> Enum.join("")
  end

  # -- template helpers (public: client codegen calls publics by name) --

  @doc "Empty-state copy (Lit `emptyCopy`)."
  @spec empty_copy([map]) :: String.t()
  def empty_copy(prompts) do
    if prompts != [], do: "No matching prompts", else: "No prompts."
  end

  @doc "Star button aria-label."
  @spec star_label(map) :: String.t()
  def star_label(row) do
    if row.starred, do: "Unstar " <> row.title, else: "Star " <> row.title
  end

  @doc "Boolean prop to verbatim string attr."
  @spec flag(boolean) :: String.t()
  def flag(true), do: "true"
  def flag(_), do: "false"

  @doc "Starred flag lookup by id (client-safe)."
  @spec starred?([map], String.t()) :: boolean
  def starred?(rows, id) do
    case for r <- rows, r.id == id, do: r.starred do
      [starred | _] -> starred
      [] -> false
    end
  end

  @doc "Star-flag row update (client-safe)."
  @spec set_starred([map], String.t(), boolean) :: [map]
  def set_starred(rows, id, starred) do
    for r <- rows do
      if r.id == id, do: %{r | starred: starred}, else: r
    end
  end

  @doc "Row matches a prepared query (id/title/body substring; client-safe)."
  @spec matches?(map, String.t()) :: boolean
  def matches?(row, q) do
    contains?(row.id, q) or contains?(row.title, q) or contains?(row.body, q)
  end
end
