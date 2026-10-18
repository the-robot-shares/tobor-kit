defmodule ToborKit.Hologram.Prompt.History do
  @moduledoc """
  Mirror of `<tobor-prompt-history>` (registry: `prompt` family) —
  host-supplied prompt revision list with optional side-by-side diff.
  Contract class B (star state; no other internal toggle state in Lit).

  Lit events:

    * `prompt-fork` `{id}` → `:prompt_fork` `params: %{id: ...}`
    * `prompt-star` `{id, starred}` → `:prompt_star`
      `params: %{id: ..., starred: ...}` (local star state flips too)

  The island does not persist forks or stars — the host does. Never
  `unsafeHTML`: diff/pane bodies render as text.

  Divergence (PORTING.md §4 #3): the Lit named `diff` slot is pending
  Hologram slot-semantics verification, so the mirror accepts only the
  `diff` prop (left/right panes). Stamps are precomputed server-side in
  init/3 (`formatPromptStamp` port) so client re-renders touch only state.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Tools

  prop :entries, :list, default: []
  prop :diff, :map, default: nil
  prop :target, :string, default: "parent"

  def template do
    ~HOLO"""
    <div class="tk tk-prompt-history">
      <div class="tk-prompt-history__history" data-cy="prompt.history">
        {%if @rows != []}
          <ul class="tk-prompt-history__list">
            {%for row <- @rows}
              <li>
                <div class="tk-prompt-history__row" data-prompt-id={row.id}>
                  <div class="tk-prompt-history__meta">
                    <span class="tk-prompt-history__title">{row.title}</span>
                    <span class="tk-prompt-history__stamp muted">{row.stamp}</span>
                  </div>
                  <button
                    type="button"
                    class="tk-prompt-history__fork"
                    data-cy="prompt.fork"
                    data-prompt-id={row.id}
                    aria-label={"Fork " <> row.title}
                    $click={action: :fork, params: %{id: row.id}}
                  >
                    Fork
                  </button>
                  <button
                    type="button"
                    class="tk-prompt-history__star"
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
          <p class="empty muted tk-prompt-history__empty">No history.</p>
        {/if}
        {%if @has_diff}
          <div class="tk-prompt-history__diff">
            {%if @diff_left}
              <div class="tk-prompt-history__pane">
                {%if @diff_left.label != ""}
                  <span class="tk-prompt-history__pane-label muted">{@diff_left.label}</span>
                {/if}
                <pre class="tk-prompt-history__diff-body">{@diff_left.body}</pre>
              </div>
            {/if}
            {%if @diff_right}
              <div class="tk-prompt-history__pane">
                {%if @diff_right.label != ""}
                  <span class="tk-prompt-history__pane-label muted">{@diff_right.label}</span>
                {/if}
                <pre class="tk-prompt-history__diff-body">{@diff_right.body}</pre>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    {left, right} = normalize_diff(props.diff)

    put_state(component,
      target: props.target,
      rows: normalize_entries(props.entries),
      has_diff: left != nil or right != nil,
      diff_left: left,
      diff_right: right
    )
  end

  # -- actions (client; transpiler-verified ops only — PORTING.md §6.1) --

  def action(:fork, %{id: id}, component) do
    put_action(component,
      name: :prompt_fork,
      target: component.state.target,
      params: %{id: id}
    )
  end

  def action(:toggle_star, %{id: id}, component) do
    starred = if starred?(component.state.rows, id), do: false, else: true

    component
    |> put_action(
      name: :prompt_star,
      target: component.state.target,
      params: %{id: id, starred: starred}
    )
    |> put_state(rows: set_starred(component.state.rows, id, starred))
  end

  # -- init-only normalization (server-side) --

  @doc "Normalizes history entries (`{id, title, at, version?, starred?}`), stamp precomputed."
  @spec normalize_entries(any) :: [map]
  def normalize_entries(entries) when is_list(entries) do
    for row <- entries, is_map(row) do
      id = String.trim(Tools.to_s(Tools.fetch(row, :id)))

      if id != "" do
        title = Tools.to_s(Tools.fetch(row, :title) || "")
        version = Tools.fetch(row, :version)
        stamp = join_stamp([version_stamp(version), format_prompt_stamp(Tools.fetch(row, :at))])

        %{
          id: id,
          title: title,
          stamp: stamp,
          starred: Tools.fetch(row, :starred) == true
        }
      else
        nil
      end
    end
    |> Enum.reject(&is_nil/1)
  end

  def normalize_entries(_), do: []

  @doc """
  Stamp text (Lit `formatPromptStamp`): ISO input → `"YYYY-MM-DD HH:MM UTC"`,
  unparseable → verbatim. Server-side only (`Date.parse` replacement).
  """
  @spec format_prompt_stamp(any) :: String.t()
  def format_prompt_stamp(at) when is_binary(at) and at != "" do
    case DateTime.from_iso8601(at) do
      {:ok, dt, _offset} -> Calendar.strftime(dt, "%Y-%m-%d %H:%M") <> " UTC"
      _ -> at
    end
  end

  def format_prompt_stamp(_), do: ""

  @doc "Lit `version == null ? '' : `v${version}`` (string | number)."
  @spec version_stamp(any) :: String.t()
  def version_stamp(nil), do: ""
  def version_stamp(v) when is_binary(v), do: if(v == "", do: "", else: "v" <> v)
  def version_stamp(v) when is_integer(v), do: "v" <> Integer.to_string(v)
  def version_stamp(_), do: ""

  @doc "Lit `[version, stamp].filter(Boolean).join(' · ')`."
  @spec join_stamp([String.t()]) :: String.t()
  def join_stamp(parts) do
    parts
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(" · ")
  end

  @doc "Normalizes the optional diff prop into `{left, right}` pane maps."
  @spec normalize_diff(any) :: {map | nil, map | nil}
  def normalize_diff(diff) when is_map(diff) do
    {normalize_pane(Tools.fetch(diff, :left)), normalize_pane(Tools.fetch(diff, :right))}
  end

  def normalize_diff(_), do: {nil, nil}

  defp normalize_pane(pane) when is_map(pane) do
    body = pane_body(pane)

    if body == "" and pane_label(pane) == "" do
      nil
    else
      %{label: pane_label(pane), body: body}
    end
  end

  defp normalize_pane(_), do: nil

  # Lit `promptPlainText`: bodies are always source text, never parsed HTML.
  defp pane_body(pane) do
    case Tools.fetch(pane, :body) do
      body when is_binary(body) -> body
      body when is_integer(body) -> Integer.to_string(body)
      _ -> ""
    end
  end

  defp pane_label(pane) do
    case Tools.fetch(pane, :label) do
      label when is_binary(label) -> label
      _ -> ""
    end
  end

  # -- template helpers (public: client codegen calls publics by name) --

  @doc "Boolean prop to verbatim string attr."
  @spec flag(boolean) :: String.t()
  def flag(true), do: "true"
  def flag(_), do: "false"

  @doc "Star button aria-label."
  @spec star_label(map) :: String.t()
  def star_label(row) do
    if row.starred, do: "Unstar " <> row.title, else: "Star " <> row.title
  end

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
end
