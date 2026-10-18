defmodule ToborKit.Hologram.GuidePanel.Panel do
  @moduledoc """
  Mirror of `<tobor-guide-panel>` (registry: `guide-panel` family) — the
  orchestrator surface: header (avatar, name, title, task menu, tools
  toggle) · body (text composer | transcript | voice placeholder) · mode
  toggle · footer (expand/collapse). Contract class B **plus server
  commands** (PORTING.md §6.7/§9).

  Lit surface → mirror surface:

    * `guide` JS property (config projection) → string-keyed `:map` prop.
      **Prop wins**; when absent and `auto_fetch` is true, `init/3` chains
      a mount action that dispatches the `:fetch_guide` command
      (`HostConfig.resolve(:tobor_kit_api)` → `GET {base_url}/guide`).
      Lit-parity `base_url`/`token` attrs are also accepted; when set they
      route the fetch through the `:fetch_guide_remote` command — see the
      security note below. HostConfig is the secret-safe path.
    * `placement` attr → clamped in `init/3` to `floating|docked|inline`
      (CSS variant class; no fixed-positioning logic — the host page owns
      layout).
    * `start-expanded` attr → `:start_expanded` prop.
    * `client`/`baseUrl`/`token` JS properties → commands + HostConfig;
      the mirror has no client object.

  Composition: the panel embeds the phase-1 mirrors
  (`RobotAvatar.Avatar`, `TaskMenu.Menu`, `ToolList.List`,
  `ModeToggle.Toggle`, `TranscriptView.View`) with derived child cids
  (`{@cid}-avatar`, …) targeting the panel's own cid, so their forwarded
  actions land on the panel's `action/3`. **Divergence:** `voice-session`
  and `telemetry-toggle` have no mirrors — voice mode renders a
  placeholder (`data-testid="voice-unavailable"`), and the footer carries
  only expand/collapse.

  ## Turn flow — v1 one-shot degradation (PORTING.md §6.9)

  The Lit panel streams SSE deltas. Hologram commands are one-shot
  request/response, so v1 renders **final turns only**: submit →
  `:submit_turn` command (ensure session → `POST /sessions` →
  `POST /sessions/{id}/turn`) → single `:turn_completed` / `:turn_error`
  action. The server-side command accepts BOTH a plain JSON turn (when the
  backend speaks non-streaming JSON) and an SSE body (it extracts the
  guaranteed terminal `message` frame; a stream that closes without one
  surfaces `stream_incomplete`, mirroring `client.ts`). No pending-bubble
  UI, no intermediate `tobor-state-change` emissions — hosts get
  `tobor-turn-submitted` at submit and `tobor-turn-message` /
  `tobor-turn-error` at completion. The `tobor-state-change` event is NOT
  emitted in v1 (no intermediate server states exist to report).

  ## Events (registry-verbatim → action atoms)

    * `tobor-task-invoked` `{task_id}` → `:tobor_task_invoked` (task-menu
      pick; also arms the composer placeholder)
    * `tobor-turn-submitted` `{input, task_id}` → `:tobor_turn_submitted`
    * `tobor-turn-error` `{error: {code, message}}` → `:tobor_turn_error`
    * `tobor-turn-message` `{turn}` → `:tobor_turn_message`
    * `tobor-state-change` — see degradation note above.

  ## State machine

  The avatar state clamps to the canonical 7 GuideState values
  (`clamp_state/1`): `idle | listening | thinking | speaking |
  tool_running | error | offline`. v1 transitions: `idle → thinking`
  (submit, client-side) `→ idle` (completed) `| error` (failed).

  ## Security notes

    * `:fetch_guide` / `:submit_turn` / `:fetch_inventory` resolve
      `HostConfig.from_params!/1` and the `:tobor_kit_api` scope
      server-side; no token ever rides a param.
    * The Lit-parity `:fetch_guide_remote` / remote inventory branch is
      the ONE documented `from_params!/1` exception: `base_url`/`token`
      are the Lit-documented public attrs (client-visible by design, same
      exposure as the Lit element). Do not extend this exception.
  """

  use Hologram.Component

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.ModeToggle.Toggle
  alias ToborKit.Hologram.RobotAvatar.Avatar
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http
  alias ToborKit.Hologram.TaskMenu.Menu
  alias ToborKit.Hologram.ToolList.List
  alias ToborKit.Hologram.TranscriptView.View

  @guide_states ["idle", "listening", "thinking", "speaking", "tool_running", "error", "offline"]

  prop :guide, :map, default: %{}
  prop :auto_fetch, :boolean, default: false
  prop :base_url, :string, default: ""
  prop :token, :string, default: ""
  prop :placement, :string, default: "floating"
  prop :start_expanded, :boolean, default: false
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-guide-panel tk-guide-panel--" <> placement_class(@placement), @class)}>
      {%if guide_loaded?(@guide)}
        <div class="tk-guide-panel__panel">
          <header class="tk-guide-panel__header">
            <Avatar
              cid={"#{@cid}-avatar"}
              state={@state}
              renderer={avatar_renderer(@guide)}
              avatar={avatar_asset(@guide)}
              states={avatar_states(@guide)}
              reduced_motion={avatar_reduced_motion(@guide)}
              label={guide_name(@guide)}
            />
            <div class="tk-guide-panel__id">
              <h1 class="tk-guide-panel__name">{guide_name(@guide)}</h1>
              {%if guide_title(@guide) != ""}
                <div class="tk-guide-panel__title">{guide_title(@guide)}</div>
              {/if}
            </div>
            <div class="tk-guide-panel__header-actions">
              {%if show_task_menu?(@guide)}
                <Menu cid={"#{@cid}-tasks"} inventory={@inventory} target={@cid} />
              {/if}
              {%if show_tool_list?(@guide)}
                <button
                  type="button"
                  class="tk-guide-panel__tools-toggle"
                  data-testid="tools-toggle"
                  aria-expanded={bool_attr(@show_tools)}
                  $click={:toggle_tools}
                >
                  Tools
                </button>
              {/if}
            </div>
          </header>

          {%if @expanded}
            {%if guide_greeting(@guide) != ""}
              <p class="tk-guide-panel__greeting" data-testid="greeting">{guide_greeting(@guide)}</p>
            {/if}
            {%if @error != nil}
              <p class="tk-guide-panel__error" data-testid="turn-error">{error_message(@error)}</p>
            {/if}
            {%if @show_tools}
              <List cid={"#{@cid}-tools"} inventory={@inventory} target={@cid} />
            {/if}
            {%if @mode == "transcript"}
              <View turns={@turns} pending="" clearable={true} target={@cid} />
            {%else}
              {%if @mode == "voice"}
                <p class="tk-guide-panel__voice-unavailable" data-testid="voice-unavailable">
                  Voice mode requires the Lit kit — not available in this mirror yet.
                </p>
              {%else}
                <div class="tk-guide-panel__composer">
                <input
                  type="text"
                  class="tk-guide-panel__input"
                  data-testid="text-input"
                  placeholder={composer_placeholder(@pending_task_label)}
                  value={@input}
                  disabled={@busy}
                  $change={:set_input}
                />
                <button
                  type="button"
                  class="tk-guide-panel__send"
                  data-testid="send"
                  disabled={@busy}
                  $click={:submit}
                >
                  Send
                </button>
                </div>
              {/if}
            {/if}
            <Toggle cid={"#{@cid}-mode"} modes={@modes} mode={@mode} disabled={@busy} target={@cid} />
          {/if}

          <footer class="tk-guide-panel__footer">
            <span class="tk-guide-panel__spacer"></span>
            {%if @expanded}
              <button type="button" class="tk-guide-panel__chrome" data-testid="collapse" $click={:collapse}>
                Collapse
              </button>
            {%else}
              <button type="button" class="tk-guide-panel__chrome" data-testid="expand" $click={:expand}>
                Open
              </button>
            {/if}
          </footer>
        </div>
      {%else}
        <div class="tk-guide-panel__panel">
          {%if @error != nil}
            <p class="tk-guide-panel__error" data-testid="panel-error">{error_message(@error)}</p>
          {%else}
            <p class="tk-guide-panel__loading" data-testid="panel-loading">Loading guide…</p>
          {/if}
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    guide = Map.get(props, :guide) || %{}

    component =
      put_state(component,
        guide: guide,
        auto_fetch: Map.get(props, :auto_fetch) == true,
        base_url: Map.get(props, :base_url) || "",
        token: Map.get(props, :token) || "",
        placement: clamp_placement(Map.get(props, :placement) || "floating"),
        target: Map.get(props, :target) || "parent",
        expanded: panel_start_expanded(guide, Map.get(props, :start_expanded) == true),
        mode: default_mode(guide),
        modes: guide_modes(guide),
        state: "idle",
        turns: [],
        session_id: nil,
        busy: false,
        error: nil,
        input: "",
        pending_task_id: nil,
        pending_task_label: nil,
        show_tools: false,
        inventory: empty_inventory()
      )

    if guide_loaded?(guide) or !component.state.auto_fetch do
      component
    else
      put_action(component, :bootstrap)
    end
  end

  # -- client actions --------------------------------------------------------

  # Mount-chained when no guide prop was supplied and auto_fetch is on.
  def action(:bootstrap, _params, component) do
    if component.state.base_url != "" do
      put_command(component, :fetch_guide_remote, %{base_url: component.state.base_url, token: component.state.token})
    else
      put_command(component, :fetch_guide, %{})
    end
  end

  def action(:guide_loaded, %{guide: guide}, component) do
    put_state(component,
      guide: guide,
      modes: guide_modes(guide),
      mode: default_mode(guide),
      expanded: panel_start_expanded(guide, component.state.expanded)
    )
    |> maybe_fetch_inventory()
  end

  def action(:guide_error, %{error: error}, component) do
    put_state(component, error: normalize_error(error, "guide_unavailable"))
  end

  def action(:inventory_loaded, %{inventory: inventory}, component) do
    put_state(component, inventory: normalize_inventory(inventory))
  end

  # Lit #loadInventory catch: a degraded inventory, not a crash.
  def action(:inventory_error, _params, component) do
    put_state(component, inventory: empty_inventory())
  end

  # Embedded ModeToggle forwards here (`%{mode, previous}`).
  def action(:tobor_mode_change, %{mode: mode}, component) do
    put_state(component, mode: mode)
  end

  # Embedded TaskMenu forwards here (`%{tool: <map>}`).
  def action(:tobor_task_select, %{tool: tool}, component) do
    task_id = Map.get(tool, "name") || Map.get(tool, :name) || ""

    put_state(
      component,
      pending_task_id: task_id,
      pending_task_label: Map.get(tool, "label") || Map.get(tool, :label) || "",
      expanded: true
    )
    |> put_action(
      name: :tobor_task_invoked,
      params: %{task_id: task_id},
      target: component.state.target
    )
  end

  # Embedded ToolList forwards here; the Lit panel does not subscribe.
  def action(:tobor_tool_select, _params, component), do: component

  # Embedded TranscriptView clear.
  def action(:tobor_transcript_clear, _params, component) do
    put_state(component, turns: [])
  end

  def action(:set_input, params, component) do
    put_state(component, input: params.event.value)
  end

  def action(:toggle_tools, _params, component) do
    put_state(component, show_tools: !component.state.show_tools)
  end

  def action(:expand, _params, component), do: put_state(component, expanded: true)
  def action(:collapse, _params, component), do: put_state(component, expanded: false)

  # Lit #submit: trim, guard, mark pending, forward submitted, dispatch the
  # one-shot turn command. next_action (host forward) and next_command
  # (server turn) are independent fields — both fire.
  def action(:submit, _params, component) do
    text = String.trim(component.state.input)

    if text == "" or component.state.busy or not guide_loaded?(component.state.guide) do
      component
    else
      put_state(component, busy: true, state: "thinking", error: nil, input: "")
      |> put_action(
        name: :tobor_turn_submitted,
        params: %{input: text, task_id: component.state.pending_task_id},
        target: component.state.target
      )
      |> put_command(:submit_turn, %{
        input: text,
        task_id: component.state.pending_task_id,
        session_id: component.state.session_id
      })
    end
  end

  # Command result: the completed turn. Append, settle the state machine,
  # remember the session, forward to the host.
  def action(:turn_completed, %{turn: turn, session_id: session_id}, component) do
    put_state(component,
      turns: component.state.turns ++ [normalize_turn(turn)],
      state: "idle",
      busy: false,
      session_id: session_id,
      pending_task_id: nil,
      pending_task_label: nil,
      input: ""
    )
    |> put_action(
      name: :tobor_turn_message,
      params: %{turn: normalize_turn(turn)},
      target: component.state.target
    )
  end

  def action(:turn_completed, _params, component), do: component

  def action(:turn_error, %{error: error}, component) do
    put_state(component,
      busy: false,
      state: "error",
      error: normalize_error(error, "turn_failed"),
      pending_task_id: nil,
      pending_task_label: nil
    )
    |> put_action(
      name: :tobor_turn_error,
      params: %{error: normalize_error(error, "turn_failed")},
      target: component.state.target
    )
  end

  def action(:turn_error, _params, component), do: component

  # No-op catch-all (§6.3).
  def action(_name, _params, component), do: component

  # -- server commands -------------------------------------------------------

  @doc "`:fetch_guide` — HostConfig-resolved `GET /guide` (secret-safe path)."
  def command(:fetch_guide, params, %Hologram.Server{} = server) do
    _params = HostConfig.from_params!(params)

    with_config(server, :guide_error, fn config ->
      Http.get(join_url(Map.get(config, :base_url), "/guide"),
        headers: auth_headers(Map.get(config, :token))
      )
      |> guide_result(server)
    end)
  end

  # `:fetch_guide_remote` — Lit-parity attrs path. Documented
  # `from_params!/1` exception: `base_url`/`token` ARE the request config
  # (Lit exposes them publicly; parity, not leakage).
  def command(:fetch_guide_remote, params, %Hologram.Server{} = server) do
    Http.get(join_url(fetched_base_url(params), "/guide"),
      headers: auth_headers(Map.get(params, :token))
    )
    |> guide_result(server)
  end

  # `:fetch_inventory` — `GET /mcp/tools`, HostConfig or remote-attrs branch.
  def command(:fetch_inventory, params, %Hologram.Server{} = server) do
    if Map.get(params, :base_url) in [nil, ""] do
      _params = HostConfig.from_params!(params)

      with_config(server, :inventory_error, fn config ->
        Http.get(join_url(Map.get(config, :base_url), "/mcp/tools"),
          headers: auth_headers(Map.get(config, :token))
        )
        |> inventory_result(server)
      end)
    else
      Http.get(join_url(fetched_base_url(params), "/mcp/tools"),
        headers: auth_headers(Map.get(params, :token))
      )
      |> inventory_result(server)
    end
  end

  # `:submit_turn` — ensure a session, POST the turn, deliver the completed
  # turn. Accepts a JSON turn body or an SSE stream (terminal `message`
  # frame extracted server-side; `stream_incomplete` when missing).
  def command(:submit_turn, params, %Hologram.Server{} = server) do
    params = HostConfig.from_params!(params)

    with_config(server, :turn_error, fn config ->
      headers = auth_headers(Map.get(config, :token))
      base_url = Map.get(config, :base_url)

      with {:ok, session_id} <- ensure_session(base_url, headers, Map.get(params, :session_id)),
           {:ok, body} <-
             post_turn(base_url, headers, session_id, Map.get(params, :input), Map.get(params, :task_id)) do
        case consume_turn_response(body) do
          {:ok, turn} -> put_action(server, :turn_completed, %{turn: turn, session_id: session_id})
          {:error, error} -> put_action(server, :turn_error, %{error: error})
        end
      else
        {:error, %{status: status}} ->
          put_action(server, :turn_error, %{
            error: %{code: "http_#{status}", message: "request failed with status #{status}"}
          })

        {:error, other} ->
          put_action(server, :turn_error, %{error: normalize_error(other, "turn_failed")})
      end
    end)
  end

  def command(_name, _params, server), do: server

  defp with_config(server, error_action, fun) do
    fun.(HostConfig.resolve(:tobor_kit_api))
  rescue
    e in ArgumentError ->
      put_action(server, error_action, %{error: %{code: "config", message: Exception.message(e)}})
  end

  defp ensure_session(_base_url, _headers, session_id) when is_binary(session_id) and session_id != "",
    do: {:ok, session_id}

  defp ensure_session(base_url, headers, _nil) do
    case Http.post(join_url(base_url, "/sessions"), %{client: "hologram"}, headers: headers) do
      {:ok, body} when is_map(body) -> {:ok, Map.get(body, "id")}
      {:ok, _} -> {:error, %{code: "malformed_response", message: "session response was not a JSON object"}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp post_turn(base_url, headers, session_id, input, task_id) do
    body = %{input: input, idempotency_key: idempotency_key()}
    body = if task_id in [nil, ""], do: body, else: Map.put(body, :task_id, task_id)

    Http.post(join_url(base_url, "/sessions/" <> session_id <> "/turn"), body,
      headers: [{"accept", "text/event-stream"}] ++ headers
    )
  end

  defp idempotency_key do
    "tk-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
  end

  defp guide_result(result, server) do
    case result do
      {:ok, guide} when is_map(guide) -> put_action(server, :guide_loaded, %{guide: guide})
      {:ok, _} -> put_action(server, :guide_error, %{error: %{code: "malformed_response", message: "guide response was not a JSON object"}})
      {:error, %{status: status}} -> put_action(server, :guide_error, %{error: %{code: "http_#{status}", message: "request failed with status #{status}"}})
      {:error, %{reason: reason}} -> put_action(server, :guide_error, %{error: %{code: "transport", message: reason}})
      {:error, other} -> put_action(server, :guide_error, %{error: normalize_error(other, "guide_unavailable")})
    end
  end

  defp inventory_result(result, server) do
    case result do
      {:ok, inventory} when is_map(inventory) -> put_action(server, :inventory_loaded, %{inventory: inventory})
      _ -> put_action(server, :inventory_error, %{})
    end
  end

  # -- turn response consumption (server-side pure helpers) ------------------

  @doc """
  Lit `client.ts` parity for the one-shot command: a plain JSON turn map
  passes through; an SSE binary is scanned for the guaranteed terminal
  `message` frame (falling back to the `error` frame; neither →
  `stream_incomplete`).
  """
  def consume_turn_response(%{"id" => _} = turn) when is_map(turn), do: {:ok, normalize_turn(turn)}
  def consume_turn_response(%{"role" => _, "content" => _} = turn), do: {:ok, normalize_turn(turn)}
  def consume_turn_response(body) when is_binary(body), do: turn_from_sse(body)
  def consume_turn_response(_), do: {:error, %{code: "malformed_response", message: "turn response was not a turn or an SSE stream"}}

  @doc "Extract the terminal turn from an SSE body (`message` frame wins, then `error`)."
  def turn_from_sse(body) do
    body
    |> String.split("\n\n", trim: true)
    |> Enum.reverse()
    |> scan_frames(nil, nil)
    |> case do
      {:ok, turn} -> {:ok, normalize_turn(turn)}
      {:error, error} -> {:error, error}
    end
  end

  defp scan_frames([], nil, nil),
    do: {:error, %{code: "stream_incomplete", message: "stream closed before a terminal message or error"}}

  defp scan_frames([], {:ok, turn}, _), do: {:ok, turn}
  defp scan_frames([], nil, error), do: {:error, error}

  defp scan_frames([frame | rest], message, error) do
    case frame_data(frame) do
      {"message", data} -> scan_frames(rest, decode_frame(data), error)
      {"error", data} -> scan_frames(rest, message, decode_error_frame(data))
      _ -> scan_frames(rest, message, error)
    end
  end

  defp frame_data(frame) do
    lines = String.split(frame, "\n")
    event = frame_field(lines, "event:")
    data = frame_field(lines, "data:")
    if event && data, do: {event, data}, else: nil
  end

  defp frame_field(lines, prefix) do
    Enum.find_value(lines, fn line ->
      trimmed = String.trim_leading(line, " ")

      case String.trim_leading(trimmed, prefix) do
        ^trimmed -> nil
        value -> String.trim_leading(value, " ")
      end
    end)
  end

  defp decode_frame(data) do
    case Jason.decode(data) do
      {:ok, map} -> {:ok, map}
      _ -> nil
    end
  end

  defp decode_error_frame(data) do
    case Jason.decode(data) do
      {:ok, %{"code" => code, "message" => message}} -> %{code: code, message: message}
      {:ok, %{"message" => message}} -> %{code: "unknown", message: message}
      _ -> %{code: "unknown", message: "stream reported an error"}
    end
  end

  @doc "Turn map normalization: id/role/content/created_at/tool_calls defaults."
  def normalize_turn(turn) when is_map(turn) do
    %{
      id: Map.get(turn, "id") || Map.get(turn, :id) || "",
      role: Map.get(turn, "role") || Map.get(turn, :role) || "assistant",
      content: Map.get(turn, "content") || Map.get(turn, :content) || "",
      created_at: Map.get(turn, "created_at") || Map.get(turn, :created_at) || "",
      tool_calls: Map.get(turn, "tool_calls") || Map.get(turn, :tool_calls) || []
    }
  end

  def normalize_turn(_), do: %{id: "", role: "assistant", content: "", created_at: "", tool_calls: []}

  # -- public template helpers (string-keyed projection access) --------------

  @doc "Canonical GuideState clamp — invalid values fall back to `idle`."
  def clamp_state(state) when state in @guide_states, do: state
  def clamp_state(_), do: "idle"

  @doc "Placement clamp: `floating | docked | inline`."
  def clamp_placement(p) when p in ["floating", "docked", "inline"], do: p
  def clamp_placement(_), do: "floating"

  def placement_class(p), do: clamp_placement(p)

  @doc "Projection loaded? (non-empty map with a name)."
  def guide_loaded?(guide), do: is_map(guide) and guide != %{} and guide_name(guide) != ""

  def guide_name(guide), do: Map.get(guide, "name") || ""
  def guide_title(guide), do: Map.get(guide, "title") || ""
  def guide_greeting(guide), do: Map.get(guide, "greeting") || ""

  @doc "Lit #init mode pick: `default_mode`, else the first offered mode, else `text`."
  def default_mode(guide) do
    modes = guide_modes(guide)
    default = Map.get(guide, "default_mode")
    if default && Enum.member?(modes, default), do: default, else: Enum.at(modes, 0) || "text"
  end

  @doc "Offered modes, clamped to voice/text/transcript spellings."
  def guide_modes(guide) do
    guide
    |> Map.get("modes")
    |> case do
      modes when is_list(modes) -> Enum.filter(modes, &(&1 in ["voice", "text", "transcript"]))
      _ -> []
    end
  end

  @doc "Panel flags from the projection (`ui.panel`), defaults mirroring Lit (show)."
  def show_task_menu?(guide), do: panel_flag(guide, "show_task_menu")
  def show_tool_list?(guide), do: panel_flag(guide, "show_tool_list")

  defp panel_flag(guide, key) do
    panel = Map.get(guide, "ui") || %{}
    panel = Map.get(panel, "panel") || %{}
    Map.get(panel, key) != false
  end

  @doc "Lit #init: projection `ui.panel.start_expanded` wins over the prop."
  def panel_start_expanded(guide, prop_value) do
    panel = Map.get(guide, "ui") || %{}
    panel = Map.get(panel, "panel") || %{}

    case Map.get(panel, "start_expanded") do
      nil -> prop_value
      value -> value == true
    end
  end

  def avatar_renderer(guide), do: robot(guide, "renderer") || "glyph"
  def avatar_asset(guide), do: robot(guide, "asset") || %{}
  def avatar_states(guide), do: robot(guide, "states") || %{}

  def avatar_reduced_motion(guide), do: robot(guide, "reduced_motion") || "respect"

  defp robot(guide, key) do
    ui = Map.get(guide, "ui") || %{}
    robo = Map.get(ui, "robot") || %{}
    Map.get(robo, key)
  end

  @doc "Composer placeholder mirrors Lit: armed task or the default ask."
  def composer_placeholder(nil), do: "Ask the guide…"
  def composer_placeholder(""), do: "Ask the guide…"
  def composer_placeholder(label), do: "Ask about: " <> label

  @doc "Empty tool inventory (Lit degraded shape)."
  def empty_inventory, do: %{"groups" => [], "tools" => [], "degraded" => []}

  @doc "Inventory normalization to groups/tools/degraded (list defaults)."
  def normalize_inventory(inventory) when is_map(inventory) do
    %{
      "groups" => Map.get(inventory, "groups") || [],
      "tools" => Map.get(inventory, "tools") || [],
      "degraded" => Map.get(inventory, "degraded") || []
    }
  end

  def normalize_inventory(_), do: empty_inventory()

  @doc "Boolean prop to verbatim string attr."
  def bool_attr(true), do: "true"
  def bool_attr(_), do: "false"

  def normalize_error(%{code: _c, message: _m} = error, _fallback), do: error
  def normalize_error(%{"code" => c, "message" => m}, _fallback), do: %{code: c, message: m}
  def normalize_error(%{"message" => m}, fallback), do: %{code: fallback, message: m}
  def normalize_error(%{message: m}, fallback), do: %{code: fallback, message: m}
  def normalize_error(error, fallback) when is_binary(error), do: %{code: fallback, message: error}
  def normalize_error(_, fallback), do: %{code: fallback, message: "request failed"}

  @doc "Error map to display message (template-facing)."
  def error_message(nil), do: ""

  def error_message(error) do
    case normalize_error(error, "error") do
      %{message: message} -> message
    end
  end

  # -- command-path private helpers ------------------------------------------

  defp maybe_fetch_inventory(component) do
    if show_task_menu?(component.state.guide) or show_tool_list?(component.state.guide) do
      if component.state.base_url != "" do
        put_command(component, :fetch_inventory, %{base_url: component.state.base_url, token: component.state.token})
      else
        put_command(component, :fetch_inventory, %{})
      end
    else
      component
    end
  end

  defp fetched_base_url(params), do: Map.get(params, :base_url) || ""

  defp join_url("", _path), do: ""
  defp join_url(base, path), do: String.trim_trailing(base, "/") <> path

  defp auth_headers(nil), do: []
  defp auth_headers(""), do: []
  defp auth_headers(token), do: [{"authorization", "Bearer " <> token}]
end
