defmodule ToborKit.Hologram.Wiki.Entry do
  @moduledoc """
  `<tobor-wiki-entry>` mirror — read view for one wiki page (contract
  class A).

  Ported from `web/src/components/wiki/tobor-wiki-entry.ts`. Body is
  xhtml-first / NPL source rendered as escaped text in `<pre>` — never raw
  HTML. The host owns load; the mirror emits `:wiki_edit` (Lit
  `wiki-edit {id}`).

  Class A: the edit button relies on the render-tree default target
  (nearest stateful component) — no explicit target binding.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Current page: `{id, title, body, spaceId?}`.
  prop :entry, :any, default: nil

  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-wiki-entry", @class)}>
      {%if @entry}
        <article class="tk-wiki-entry__stack" data-cy="wiki.entry">
          <header class="tk-wiki-entry__header">
            <h2 class="tk-wiki-entry__title">{entry_title(@entry)}</h2>
            {%if entry_space(@entry) != ""}
              <p class="muted">{entry_space(@entry)}</p>
            {/if}
          </header>
          <pre class="tk-wiki-entry__body">{entry_body(@entry)}</pre>
          <button
            type="button"
            class="tk-wiki-entry__edit"
            disabled={no_id?(@entry)}
            $click={action: :wiki_edit, params: %{id: entry_id(@entry)}}
          >
            Edit
          </button>
        </article>
      {%else}
        <article class="tk-wiki-entry__stack" data-cy="wiki.entry">
          <p class="muted">No entry.</p>
        </article>
      {/if}
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  def entry_id(entry), do: get(entry, :id)
  def entry_title(entry), do: get(entry, :title) || ""

  @doc "Lit `wikiPlainText`: body is always characters, never parsed HTML."
  def entry_body(entry), do: plain_text(get(entry, :body))

  def entry_space(entry), do: get(entry, :spaceId) || ""

  @doc "Lit `wikiPlainText` — nil-safe `String(value)`."
  def plain_text(nil), do: ""
  def plain_text(value), do: to_string(value)

  @doc "Lit `?disabled=${!page.id}`."
  def no_id?(entry), do: is_nil(get(entry, :id))

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
