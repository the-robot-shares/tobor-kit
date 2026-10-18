defmodule ToborKit.Hologram.Review.Panel do
  @moduledoc """
  `<tobor-review-panel>` mirror — artifact review thread: list + optional
  composer (contract class B: snapshot list, local draft state).

  Ported from `web/src/components/review-panel/review-panel.ts`. The host
  loads and persists reviews; the mirror emits `:review_submit` /
  `:review_resolve` (Lit `review-submit {artifactId, body}` / `review-resolve
  {id}`). Entry from the artifact view is `:review_start`; this tag is the
  list/thread view.

  Rows are read straight from the `reviews` prop on every render (the Lit
  `normalizeReviews` never-crash guarantee, applied per render), so host
  snapshot updates flow without a re-mount.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Host-owned review rows: `{id, author, body, at?, status?}` maps.
  prop :reviews, :list, default: []

  # Lit `artifact-id` attribute — carried on `:review_submit` params.
  prop :artifact_id, :string, default: ""

  # When true (default), the composer renders and can emit `:review_submit`.
  prop :show_composer, :boolean, default: true

  # Host-notification target.
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def init(props, component, _server) do
    put_state(component,
      draft: "",
      target: props.target || "parent",
      artifact_id: props.artifact_id || ""
    )
  end

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-review-panel", @class)}>
      <div class="tk-review-panel__panel" data-cy="review.panel">
        {%if not Enum.empty?(normalize(@reviews))}
          <ul class="tk-review-panel__list" aria-label="Reviews">
            {%for row <- normalize(@reviews)}
              <li class="tk-review-panel__item" data-cy="review.item" data-id={row_id(row)} data-status={row_status(row)}>
                <div class="tk-review-panel__meta">
                  <span class="tk-review-panel__author">{row_author(row)}</span>
                  {%if row_stamp(row) != ""}
                    <time datetime={row_at(row)}>{row_stamp(row)}</time>
                  {/if}
                  <span class="tk-review-panel__status">{row_status(row)}</span>
                </div>
                <p class="tk-review-panel__body">{row_body(row)}</p>
                {%if row_status(row) == "open"}
                  <button
                    type="button"
                    class="tk-review-panel__resolve"
                    $click={action: :review_resolve, params: %{id: row_id(row)}, target: @target}
                  >
                    Resolve
                  </button>
                {/if}
              </li>
            {/for}
          </ul>
        {%else}
          <p class="muted">No reviews yet</p>
        {/if}
        {%if @show_composer}
          <form class="tk-review-panel__composer-form" $submit={:submit}>
            <textarea
              class="tk-review-panel__composer"
              data-cy="review.composer"
              rows="3"
              aria-label="Review"
              value={@draft}
              $input={:set_draft}
            ></textarea>
            <button class="tk-review-panel__submit" data-cy="review.submit" type="submit">Submit</button>
          </form>
        {/if}
      </div>
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  @doc "Lit `normalizeReviews`: non-map rows drop, never crash the render."
  def normalize(reviews) when is_list(reviews) do
    Enum.filter(reviews, &is_map/1)
  end

  def normalize(_reviews), do: []

  @doc "Lit `reviewStatus`: anything but `resolved` is `open`."
  def review_status(status) do
    if status == "resolved" or status == :resolved do
      "resolved"
    else
      "open"
    end
  end

  @doc """
  Lit `formatReviewStamp`, regex-free port: ISO-8601 prefixes render as
  `"YYYY-MM-DD HH:MM UTC"`; anything else passes through unchanged.
  """
  def format_stamp(at) do
    if iso_prefix?(at) do
      stamped = at |> String.slice(0, 16) |> String.replace("T", " ")
      stamped <> " UTC"
    else
      at || ""
    end
  end

  @doc "Shape test for the ISO-8601 display prefix."
  def iso_prefix?(at) when is_binary(at) do
    String.length(at) >= 16 and String.at(at, 4) == "-" and
      String.at(at, 7) == "-" and String.at(at, 10) == "T" and String.at(at, 13) == ":"
  end

  def iso_prefix?(_at), do: false

  def row_id(row), do: get(row, :id) || ""
  def row_author(row), do: get(row, :author) || ""
  def row_body(row), do: get(row, :body) || ""
  def row_at(row), do: get(row, :at) || ""
  def row_stamp(row), do: format_stamp(get(row, :at))
  def row_status(row), do: review_status(get(row, :status))

  def get(map, key) when is_map(map) do
    case Map.get(map, key) do
      nil -> Map.get(map, key_to_string(key))
      value -> value
    end
  end

  def get(_map, _key), do: nil

  defp key_to_string(key) when is_atom(key), do: Atom.to_string(key)
  defp key_to_string(key), do: key

  # -- actions (client-side; regex-free) ---------------------------------

  def action(:set_draft, params, component) do
    put_state(component, :draft, params.event.value)
  end

  def action(:submit, _params, component) do
    submit(component)
  end

  # Host-forwarded actions loop back onto this component when no explicit
  # target resolves — Lit CustomEvents with no listener drop silently.
  def action(_name, _params, component) do
    component
  end

  @doc "Lit `#submitFrom`: trim, refuse empty, emit `:review_submit`, clear draft."
  def submit(component) do
    body = String.trim(component.state.draft || "")

    if body == "" do
      component
    else
      component
      |> put_state(:draft, "")
      |> put_action(
        name: :review_submit,
        target: component.state.target,
        params: %{artifact_id: component.state.artifact_id, body: body}
      )
    end
  end
end
