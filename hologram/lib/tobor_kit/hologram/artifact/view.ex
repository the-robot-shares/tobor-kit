defmodule ToborKit.Hologram.Artifact.View do
  @moduledoc """
  `<tobor-artifact-view>` mirror — version-aware artifact reader (contract
  class A).

  Ported from `web/src/components/artifact/tobor-artifact-view.ts`. Body is
  always text in `<pre>` (escaped interpolation). Never raw HTML. The host
  owns persistence and the review flow; the mirror emits `:review_start`
  (Lit `review-start {artifactId, version}`).

  Class A: the review button relies on the render-tree default target
  (nearest stateful component) — no explicit target binding.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Current artifact: `{id, title, version, body, mime?}`.
  prop :artifact, :any, default: nil

  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-artifact-view", @class)}>
      {%if @artifact}
        <article class="tk-artifact-view__stack" data-cy="artifact.view">
          <header class="tk-artifact-view__header">
            <h2 class="tk-artifact-view__title">{artifact_title(@artifact)}</h2>
            <p class="meta muted tk-artifact-view__meta">
              <span>v{version_label(artifact_version(@artifact))}</span>
              {%if artifact_mime(@artifact) != ""}
                <span>{artifact_mime(@artifact)}</span>
              {/if}
            </p>
          </header>
          <pre class="tk-artifact-view__body">{artifact_body(@artifact)}</pre>
          <button
            type="button"
            class="tk-artifact-view__review"
            data-cy="artifact.review"
            disabled={no_id?(@artifact)}
            $click={action: :review_start, params: %{artifact_id: artifact_id(@artifact), version: artifact_version(@artifact)}}
          >
            Start review
          </button>
        </article>
      {%else}
        <article class="tk-artifact-view__stack" data-cy="artifact.view">
          <p class="muted">No artifact.</p>
        </article>
      {/if}
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  def artifact_id(artifact), do: get(artifact, :id)
  def artifact_title(artifact), do: get(artifact, :title) || ""
  def artifact_version(artifact), do: get(artifact, :version)
  def artifact_body(artifact), do: get(artifact, :body) || ""
  def artifact_mime(artifact), do: get(artifact, :mime) || ""

  @doc "Lit `?disabled=${!art.id}`."
  def no_id?(artifact), do: is_nil(get(artifact, :id))

  @doc "Lit `v${art.version}` label."
  def version_label(nil), do: ""
  def version_label(version), do: to_string(version)

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
