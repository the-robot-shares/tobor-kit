defmodule ToborKit.Hologram.Artifact.Editor do
  @moduledoc """
  `<tobor-artifact-editor>` mirror — title + body editor (contract class B).

  Ported from `web/src/components/artifact/tobor-artifact-editor.ts`. Emits
  `:artifact_save` (Lit `artifact-save {id, title, body, version?}`); the
  host persists. This mirror does not fetch, store, or bump versions.

  Mount-only contract: drafts seed from the `artifact` prop once in
  `init/3`; a new artifact after mount does not reseed (re-mount with a new
  `cid`).

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Seed for title/body: `{id, title, version, body, mime?}`.
  prop :artifact, :any, default: nil

  # Host-notification target.
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def init(props, component, _server) do
    artifact = props.artifact

    put_state(component,
      artifact: artifact,
      target: props.target || "parent",
      draft_title: get(artifact, :title) || "",
      draft_body: get(artifact, :body) || ""
    )
  end

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-artifact-editor", @class)}>
      <article class="tk-artifact-editor__stack" data-cy="artifact.editor">
        <label class="tk-artifact-editor__field">
          <span>Title</span>
          <input
            class="tk-artifact-editor__title"
            name="title"
            type="text"
            autocomplete="off"
            aria-label="Title"
            value={@draft_title}
            $input={:set_title}
          />
        </label>
        <label class="tk-artifact-editor__field">
          <span>Body</span>
          <textarea
            class="tk-artifact-editor__body"
            name="body"
            autocomplete="off"
            spellcheck="false"
            aria-label="Body"
            value={@draft_body}
            $input={:set_body}
          ></textarea>
        </label>
        <button type="button" class="tk-artifact-editor__save" data-cy="artifact.save" $click={:save}>
          Save
        </button>
      </article>
    </div>
    """
  end

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

  @doc "Lit `#onSave`: `{id, title, body, version?}`, id empty when unseeded."
  def save(component) do
    state = component.state
    artifact = state.artifact

    params =
      %{
        id: (artifact && get(artifact, :id)) || "",
        title: state.draft_title || "",
        body: state.draft_body || ""
      }
      |> maybe_add_version(artifact_version(artifact))

    put_action(component, name: :artifact_save, target: state.target, params: params)
  end

  defp artifact_version(nil), do: nil
  defp artifact_version(artifact), do: get(artifact, :version)

  defp maybe_add_version(params, nil), do: params
  defp maybe_add_version(params, version), do: Map.put(params, :version, version)

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
