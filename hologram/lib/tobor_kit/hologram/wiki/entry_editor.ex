defmodule ToborKit.Hologram.Wiki.EntryEditor do
  @moduledoc """
  `<tobor-wiki-entry-editor>` mirror — title + body editor (contract
  class B).

  Ported from `web/src/components/wiki/tobor-wiki-entry-editor.ts`. Emits
  `:wiki_save` (Lit `wiki-save {id, title, body, spaceId?}`); the host
  persists. Body is source text (xhtml-first / NPL), never parsed as HTML.
  This mirror does not fetch or store.

  Mount-only contract: drafts seed from the `entry` prop once in `init/3`;
  a new entry after mount does not reseed (re-mount with a new `cid`).

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Seed for title/body/`spaceId`: `{id, title, body, spaceId?}`.
  prop :entry, :any, default: nil

  # Host-notification target.
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def init(props, component, _server) do
    entry = props.entry

    put_state(component,
      entry: entry,
      target: props.target || "parent",
      draft_title: get(entry, :title) || "",
      draft_body: get(entry, :body) |> plain_text()
    )
  end

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-wiki-entry-editor", @class)}>
      <article class="tk-wiki-entry-editor__stack" data-cy="wiki.editor">
        <label class="tk-wiki-entry-editor__field">
          <span>Title</span>
          <input
            class="tk-wiki-entry-editor__title"
            name="title"
            type="text"
            autocomplete="off"
            aria-label="Title"
            value={@draft_title}
            $input={:set_title}
          />
        </label>
        <label class="tk-wiki-entry-editor__field">
          <span>Body</span>
          <textarea
            class="tk-wiki-entry-editor__body"
            name="body"
            autocomplete="off"
            spellcheck="false"
            aria-label="Body"
            value={@draft_body}
            $input={:set_body}
          ></textarea>
        </label>
        <button type="button" class="tk-wiki-entry-editor__save" data-cy="wiki.save" $click={:save}>
          Save
        </button>
      </article>
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  @doc "Lit `wikiPlainText` — nil-safe `String(value)`."
  def plain_text(nil), do: ""
  def plain_text(value), do: to_string(value)

  # -- actions (client-side; regex-free) ---------------------------------

  def action(:set_title, params, component) do
    put_state(component, :draft_title, params.event.value)
  end

  def action(:set_body, params, component) do
    put_state(component, :draft_body, params.event.value)
  end

  def action(:save, _params, component) do
    save(component)
  end

  # Host-forwarded actions loop back onto this component when no explicit
  # target resolves — Lit CustomEvents with no listener drop silently.
  def action(_name, _params, component) do
    component
  end

  @doc "Lit `#onSave`: `{id, title, body, spaceId?}`, id empty when unseeded."
  def save(component) do
    state = component.state
    entry = state.entry

    params =
      %{
        id: (entry && get(entry, :id)) || "",
        title: state.draft_title || "",
        body: state.draft_body || ""
      }
      |> maybe_add_space(entry_space(entry))

    put_action(component, name: :wiki_save, target: state.target, params: params)
  end

  defp entry_space(nil), do: nil
  defp entry_space(entry) do
    case get(entry, :spaceId) do
      "" -> nil
      space_id -> space_id
    end
  end

  defp maybe_add_space(params, nil), do: params
  defp maybe_add_space(params, space_id), do: Map.put(params, :space_id, space_id)

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
