defmodule ToborKit.Hologram.RobotAvatar.Avatar do
  @moduledoc """
  Mirror of `<tobor-robot-avatar>` (contract class B — stateful, no host
  actions). A pure state machine over the seven canonical guide states; it
  renders exactly what it is told. The resolved state, motion policy and
  sanitized sprite source are computed **server-side in init/3** (state
  clamp + asset.src sanitization regex live there, per the spike contract).

  Renderers: `glyph` (inline SVG) is the default and fully implemented.
  `sprite`/`lottie` share the state interface but need art; without a
  sanitized sprite source they fall back to the glyph and say so via
  `data-renderer-fallback="glyph"`.

  Animations are CSS-only: they run when the root carries
  `data-motion="animated"`, and the stylesheet additionally honors the user's
  `prefers-reduced-motion` setting for the `respect` policy (the server
  cannot query media — divergence, documented in the family README).

  **Host requirement (class B): embed with a `cid` or init/3 never runs.**

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  @guide_states ["idle", "listening", "thinking", "speaking", "tool_running", "error", "offline"]

  prop :state, :string, default: "idle"
  prop :renderer, :string, default: "glyph"
  prop :avatar, :map, default: %{}
  prop :states, :map, default: %{}
  prop :reduced_motion, :string, default: "respect"
  prop :label, :string, default: "Guide"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div
      class={Classes.classes("tk tk-robot-avatar", @class)}
      data-state={@resolved_state}
      data-motion={@motion}
      data-renderer={@renderer}
      data-unknown-state={@unknown_state}
      data-renderer-fallback={@renderer_fallback}
      role="img"
      aria-label={@aria_label}
    >
      {%if @source != nil}
        <div class="tk-robot-avatar__asset asset" style={@sprite_style}></div>
      {%else}
        <svg class="tk-robot-avatar__svg" viewBox="0 0 100 100" style={"--_tk-speed: #{@speed}"}>
          <line x1="50" y1="20" x2="50" y2="9" class="shell" />
          <circle cx="50" cy="7" r="4.5" class={antenna_class(@resolved_state)} />
          <rect x="17" y="20" width="66" height="53" rx="17" class="shell" />
          <rect x="25" y="29" width="50" height="27" rx="11" class="visor" />
          <rect x="33" y="78" width="34" height="10" rx="5" class="shell" />
          {%if @resolved_state == "listening" and @motion == "animated"}
            <circle class="ring" cx="50" cy="46" r="42" fill="none" stroke="var(--tobor-kit-robot-accent, var(--tk-accent))" stroke-width="2" />
            <circle class="ring" cx="50" cy="46" r="42" fill="none" stroke="var(--tobor-kit-robot-accent, var(--tk-accent))" stroke-width="2" />
          {/if}
          {%if @resolved_state == "error"}
            <g class="stroke-lit" data-eyes="error">
              <line x1="35" y1="38" x2="44" y2="47" />
              <line x1="44" y1="38" x2="35" y2="47" />
              <line x1="56" y1="38" x2="65" y2="47" />
              <line x1="65" y1="38" x2="56" y2="47" />
            </g>
          {/if}
          {%if @resolved_state == "offline"}
            <g class="stroke-lit" data-eyes="offline">
              <line x1="34" y1="43" x2="45" y2="43" />
              <line x1="55" y1="43" x2="66" y2="43" />
            </g>
          {/if}
          {%if @resolved_state == "listening"}
            <g data-eyes="wide">
              <circle class="lit" cx="39.5" cy="42.5" r="6.5" />
              <circle class="lit" cx="60.5" cy="42.5" r="6.5" />
            </g>
          {/if}
          {%if @resolved_state == "thinking"}
            <g data-eyes="up">
              <circle class="lit" cx="39.5" cy="40" r="4.5" />
              <circle class="lit" cx="60.5" cy="40" r="4.5" />
            </g>
            <g data-mouth="thinking-dots">
              <circle class="lit think-dot" cx="41" cy="14" r="3" />
              <circle class="lit think-dot" cx="50" cy="12" r="3" />
              <circle class="lit think-dot" cx="59" cy="14" r="3" />
            </g>
          {/if}
          {%if @resolved_state == "idle" or @resolved_state == "speaking" or @resolved_state == "tool_running"}
            <g class="blink" data-eyes="normal">
              <circle class="lit" cx="39.5" cy="42.5" r="5.5" />
              <circle class="lit" cx="60.5" cy="42.5" r="5.5" />
            </g>
          {/if}
          {%if @resolved_state == "speaking"}
            <g data-mouth="bars">
              <rect class="lit bar" x="40" y="59" width="4" height="9" rx="2" />
              <rect class="lit bar" x="48" y="57" width="4" height="13" rx="2" />
              <rect class="lit bar" x="56" y="59" width="4" height="9" rx="2" />
            </g>
          {/if}
          {%if @resolved_state == "tool_running"}
            <g class="gear" data-mouth="gear">
              <circle class="stroke-lit" cx="50" cy="63" r="6" />
              <line class="stroke-lit" x1="50" y1="53.5" x2="50" y2="57" />
              <line class="stroke-lit" x1="50" y1="69" x2="50" y2="72.5" />
              <line class="stroke-lit" x1="40.5" y1="63" x2="44" y2="63" />
              <line class="stroke-lit" x1="56" y1="63" x2="59.5" y2="63" />
            </g>
            <circle class="lit pulse" data-mouth="badge" cx="80" cy="24" r="5" />
          {/if}
          {%if @resolved_state == "error"}
            <path class="stroke-lit" data-mouth="frown" d="M41 68 Q50 60 59 68" />
          {/if}
          {%if @resolved_state == "offline"}
            <line class="stroke-lit" data-mouth="flat" x1="41" y1="65" x2="59" y2="65" />
          {/if}
          {%if @resolved_state == "listening"}
            <circle class="lit pulse" data-mouth="listening" cx="50" cy="64" r="4" />
          {/if}
          {%if @resolved_state == "idle"}
            <path class="stroke-lit" data-mouth="smile" d="M42 62 Q50 69 58 62" />
          {/if}
        </svg>
      {/if}
      <span class="tk-robot-avatar__sr-only sr-only">{@resolved_state}</span>
    </div>
    """
  end

  def init(props, component, _server) do
    current = resolved_state(props.state)
    motion = motion_policy(props.reduced_motion)
    asset = sprite_for(props.avatar, current)
    source = sanitized_source(asset)

    put_state(component,
      resolved_state: current,
      motion: motion,
      renderer: props.renderer || "glyph",
      unknown_state: unknown_state(props.state),
      renderer_fallback: fallback(props.renderer, source),
      source: source,
      sprite_style: sprite_style(asset, source),
      speed: speed_for(props.states, current),
      aria_label: "#{props.label || "Guide"}: #{current}"
    )
  end

  # — public: helpers transpile client-side alongside the template —

  @doc "Every state this mirror understands, in contract order (Lit `GUIDE_STATES`)."
  def guide_states, do: @guide_states

  @doc "The state actually rendered — unknown input is clamped to `idle`."
  def resolved_state(state) when state in @guide_states, do: state
  def resolved_state(_), do: "idle"

  @doc """
  `animated` or `static`, after the reduced-motion policy is applied.
  `respect` resolves to `animated` here; the stylesheet's
  `prefers-reduced-motion` media query downgrades it at display time.
  """
  def motion_policy("force_static"), do: "static"
  def motion_policy("ignore"), do: "animated"
  def motion_policy(_), do: "animated"

  @doc "Antenna lights up for listening/thinking/tool_running (Lit `antennaLit`)."
  def antenna_class(current)
      when current == "listening" or current == "thinking" or current == "tool_running",
      do: "lit"

  def antenna_class(_), do: "shell"

  @doc "`data-unknown-state` value — the raw input when it was not a guide state, else `nil` (attr dropped)."
  def unknown_state(state) when state in @guide_states, do: nil
  def unknown_state(state) when is_binary(state), do: state
  def unknown_state(state), do: to_string(state)

  @doc "`data-renderer-fallback`: `glyph` when a non-glyph renderer has no sanitized source."
  def fallback(renderer, source)
      when is_binary(renderer) and renderer != "glyph" and source == nil,
      do: "glyph"

  def fallback(_, _), do: nil

  @doc "Sprite descriptor for the current state: `avatar.states[<state>]` or `avatar.default`."
  def sprite_for(avatar, current) when is_map(avatar) and avatar != %{} do
    states = fetch_map(avatar, "states", :states)

    case fetch_map(states, current, current) do
      %{} = asset when asset != %{} -> asset
      _ -> fetch_map(avatar, "default", :default)
    end
  end

  def sprite_for(_, _), do: nil

  @doc """
  Asset.src sanitization (port of the Lit
  `/^(?:javascript|vbscript|data:(?!image\/))/i` guard): javascript:,
  vbscript: and non-image data: URLs are dropped. Additionally rejects
  sources containing quotes/parens/whitespace — they cannot be carried
  safely in a style attribute.
  """
  def sanitized_source(nil), do: nil

  def sanitized_source(asset) when is_map(asset) do
    case fetch(asset, "src", :src) do
      src when is_binary(src) -> if safe_src?(src), do: src, else: nil
      _ -> nil
    end
  end

  def sanitized_source(_), do: nil

  def safe_src?(src) do
    lower = String.downcase(src)

    blocked? =
      String.starts_with?(lower, "javascript:") or
        String.starts_with?(lower, "vbscript:") or
        (String.starts_with?(lower, "data:") and not String.starts_with?(lower, "data:image/"))

    not blocked? and not unsafe_chars?(src)
  end

  def unsafe_chars?(src) do
    src
    |> String.graphemes()
    |> Enum.any?(&(&1 in ["\"", "'", "(", ")", " ", "\n", "\t"]))
  end

  @doc "Animation speed multiplier from `states[<state>].speed` (port of the Lit `1/speed` hint)."
  def speed_for(states, current) when is_map(states) and states != %{} do
    config = fetch_map(states, current, current)

    speed =
      case config do
        %{} = c when c != %{} -> fetch(c, "speed", :speed)
        _ -> nil
      end

    case speed do
      value when is_number(value) and value > 0 -> format_speed(1 / value)
      _ -> "1"
    end
  end

  def speed_for(_, _), do: "1"

  @doc "Sprite `background-*` style string, port of the Lit inline style."
  def sprite_style(_asset, nil), do: ""

  def sprite_style(asset, source) when is_map(asset) do
    columns = positive_int(fetch(asset, "columns", :columns), 1)
    rows = positive_int(fetch(asset, "rows", :rows), 1)
    column = non_negative_int(fetch(asset, "column", :column), 0)
    row = non_negative_int(fetch(asset, "row", :row), 0)

    pos_x = if columns > 1, do: column * 100 / (columns - 1), else: 50.0
    pos_y = if rows > 1, do: row * 100 / (rows - 1), else: 50.0

    "width:100%;height:100%;background-image:url(\"" <>
      source <>
      "\");background-repeat:no-repeat;background-size:" <>
      number_string(columns * 100) <>
      "% " <>
      number_string(rows * 100) <>
      "%;background-position:" <>
      number_string(pos_x) <> "% " <> number_string(pos_y) <> "%;"
  end

  def sprite_style(_, _), do: ""

  # — internals (public for client codegen) —

  @doc false
  def fetch(map, string_key, atom_key) when is_map(map) do
    case Map.get(map, string_key) do
      nil -> Map.get(map, atom_key)
      value -> value
    end
  end

  def fetch(_, _, _), do: nil

  @doc false
  def fetch_map(map, string_key, atom_key) when is_map(map) do
    case fetch(map, string_key, atom_key) do
      value when is_map(value) -> value
      _ -> %{}
    end
  end

  def fetch_map(_, _, _), do: %{}

  @doc false
  def positive_int(value, _default) when is_integer(value) and value > 0, do: value
  def positive_int(_, default), do: default

  @doc false
  def non_negative_int(value, _default) when is_integer(value) and value >= 0, do: value
  def non_negative_int(_, default), do: default

  @doc false
  def number_string(value) when is_integer(value), do: Integer.to_string(value)
  def number_string(value) when is_float(value), do: Float.to_string(value)
  def number_string(value), do: to_string(value)

  @doc false
  def format_speed(value) when is_float(value), do: Float.to_string(value)
  def format_speed(value) when is_integer(value), do: Integer.to_string(value)
  def format_speed(_), do: "1"
end
