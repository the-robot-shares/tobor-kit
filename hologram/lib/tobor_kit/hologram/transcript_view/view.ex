defmodule ToborKit.Hologram.TranscriptView.View do
  @moduledoc """
  `<tobor-transcript-view>` mirror — the conversation log (contract class C).

  Ported from `web/src/components/transcript-view/transcript-view.ts`. Three
  visually distinct render states are preserved, because collapsing them
  hides real information:

    * turns present → the log
    * empty turns   → "nothing said yet"
    * `not_server_backed` load → the server keeps no copy (GET /transcript
      answered 501). NOT an error, NOT an empty transcript.

  Props are snapshots — the host owns the data flow. Streaming is
  host-driven: the host pushes new `pending` text as props; the mirror holds
  no connection and runs no commands.

  The component is stateless: the clear button relies on the render-tree
  default target (the nearest stateful component — the containing host, or
  the wrapping `ToborKit.Hologram.ChatThread.Thread` when composed), so
  `tobor-transcript-clear` maps to the `:tobor_transcript_clear` action on
  whichever stateful component contains it. Pass `target` to force an
  explicit `"page"` / `"layout"` / cid target instead.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  # Turns to render. Ignored while `load` says otherwise.
  prop :turns, :list, default: []

  # Outcome of a backend store load — carries the 501 distinction.
  prop :load, :any, default: nil

  # Streaming text not yet finalized into a turn.
  prop :pending, :string, default: ""

  # Present/true → a clear affordance renders (Lit `store` prop).
  prop :clearable, :boolean, default: false

  # Empty → render-tree default target; else "page" | "layout" | cid.
  prop :target, :string, default: ""

  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-transcript-view", @class)}>
      {%if not_server_backed?(@load)}
        <div class="tk-transcript-view__not-backed" data-testid="not-server-backed">
          This guide keeps its transcript on this device — the server stores no copy.
        </div>
      {%else}
        {%if transcript_empty?(@turns, @pending)}
          <div class="tk-transcript-view__empty" data-testid="transcript-empty">Nothing said yet.</div>
        {%else}
        <div class="tk-transcript-view__log" role="log" aria-label="Conversation transcript">
          {%for turn <- @turns}
            <div class="tk-transcript-view__turn" data-role={turn_role(turn)} data-turn-id={turn_id(turn)}>
              {turn_content(turn)}
              {%if turn_has_tools?(turn)}
                <div class="tk-transcript-view__tools" data-testid="turn-tools">
                  {%for call <- turn_tools(turn)}
                    <div>{tool_mark(call)} {tool_label(call)}</div>
                  {/for}
                </div>
              {/if}
            </div>
          {/for}
          {%if @pending != ""}
            <div class="tk-transcript-view__turn" data-role="assistant" data-testid="pending-turn">{@pending}</div>
          {/if}
        </div>
        {%if @clearable}
            <footer class="tk-transcript-view__footer">
              {%if @target == ""}
                <button type="button" data-testid="transcript-clear" $click={action: :tobor_transcript_clear}>Clear transcript</button>
              {%else}
                <button type="button" data-testid="transcript-clear" $click={action: :tobor_transcript_clear, target: @target}>Clear transcript</button>
              {/if}
            </footer>
          {/if}
        {/if}
      {/if}
    </div>
    """
  end

  # -- public template helpers (dual-key tolerant: template-passed maps may
  #    arrive string-keyed) --------------------------------------------

  @doc "Lit `load.status === \"not_server_backed\"`."
  def not_server_backed?(load) do
    is_map(load) and (Map.get(load, :status) == "not_server_backed" or Map.get(load, "status") == "not_server_backed")
  end

  @doc "Lit `!turns.length && !pending`."
  def transcript_empty?(turns, pending) do
    Enum.empty?(turns) and pending == ""
  end

  @doc "Lit `turn.tool_calls?.length`."
  def turn_has_tools?(turn) do
    not Enum.empty?(turn_tools(turn))
  end

  def turn_id(turn), do: get(turn, :id)
  def turn_role(turn), do: get(turn, :role)
  def turn_content(turn), do: get(turn, :content)

  def turn_tools(turn) do
    case get(turn, :tool_calls) do
      tools when is_list(tools) -> tools
      _ -> []
    end
  end

  @doc "Lit `c.ok === false ? \"✗\" : \"✓\"`."
  def tool_mark(call) do
    if get(call, :ok) == false do
      "✗"
    else
      "✓"
    end
  end

  @doc "Lit `c.name ?? \"tool\"` plus the ` — summary` suffix."
  def tool_label(call) do
    name = get(call, :name) || "tool"

    case get(call, :summary) do
      nil -> name
      "" -> name
      summary -> name <> " — " <> summary
    end
  end

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
