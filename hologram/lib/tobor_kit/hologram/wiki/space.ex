defmodule ToborKit.Hologram.Wiki.Space do
  @moduledoc """
  `<tobor-wiki-space>` mirror — list of wiki spaces (contract class C).

  Ported from `web/src/components/wiki/tobor-wiki-space.ts`. The host loads
  `spaces`; selection emits `:wiki_space_select` (Lit
  `wiki-space-select {id}`). This mirror does not fetch.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Space roster: `{id, title, slug?}` maps.
  prop :spaces, :list, default: []

  # Host-controlled highlight (Lit `selected-id` attribute).
  prop :selected_id, :string, default: ""

  # Host-notification target.
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-wiki-space", @class)}>
      <nav class="tk-wiki-space__nav" data-cy="wiki.space" aria-label="Wiki spaces">
        {%if not Enum.empty?(@spaces)}
          <ul class="tk-wiki-space__list">
            {%for space <- @spaces}
              <li>
                <button
                  type="button"
                  class="tk-wiki-space__item"
                  data-cy="wiki.space-item"
                  data-space-id={space_id(space)}
                  aria-current={aria_current(space_selected?(space, @selected_id))}
                  $click={action: :wiki_space_select, params: %{id: space_id(space)}, target: @target}
                >
                  <span>{space_title(space)}</span>
                  {%if space_slug(space) != ""}
                    <span class="muted slug">{space_slug(space)}</span>
                  {/if}
                </button>
              </li>
            {/for}
          </ul>
        {%else}
          <p class="muted">No spaces.</p>
        {/if}
      </nav>
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  def space_id(space), do: get(space, :id) || ""
  def space_title(space), do: get(space, :title) || ""
  def space_slug(space), do: get(space, :slug) || ""

  @doc "Highlight from the host-controlled prop (divergence: no local optimistic set)."
  def space_selected?(space, selected_id) do
    space_id(space) != "" and space_id(space) == selected_id
  end

  @doc "Lit `aria-current=${selected ? 'page' : 'false'}`."
  def aria_current(true), do: "page"
  def aria_current(_), do: "false"

  def get(map, key) when is_map(map) do
    case Map.get(map, key) do
      nil -> Map.get(map, key_to_string(key))
      value -> value
    end
  end

  def get(_map, _key), do: nil

  defp key_to_string(key) when is_atom(key), do: Atom.to_string(key)
  defp key_to_string(key), do: key
end
