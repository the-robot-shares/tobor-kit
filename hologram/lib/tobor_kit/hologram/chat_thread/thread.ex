defmodule ToborKit.Hologram.ChatThread.Thread do
  @moduledoc """
  `<tobor-chat-thread>` mirror — a conversation thread that generalizes
  `ToborKit.Hologram.TranscriptView.View` instead of forking a second log
  (contract class B).

  Ported from `web/src/components/chat-thread/chat-thread.ts`. The inner
  view owns empty / not-server-backed / pending / clear; this mirror adds a
  participant roster, an optional composer (`:thread_send`), and a
  `messages` alias that maps onto turns with timestamps and participant
  names baked into plain text (escaped interpolation, pre-wrapped; no raw
  HTML anywhere).

  `messages` wins over `turns` when nonempty (Lit `#viewTurns`).

  The transcript-clear relay is render-tree wiring: the stateless inner
  view's clear button defaults to the nearest stateful component — this
  thread — whose `action/3` clears the locally derived turns. With an
  explicit `target` ("page" / "layout" / cid) the inner view forwards
  straight to the host instead.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.TranscriptView.View

  # Turns forwarded to the inner view. Ignored when `messages` is nonempty.
  prop :turns, :list, default: []

  # Alias for `turns`: `{id?, role, text, at?, participant?}` maps.
  prop :messages, :list, default: []

  # `{id, name}` roster used to resolve `message.participant`.
  prop :participants, :list, default: []

  # Outcome of a backend store load — forwarded to the inner view.
  prop :load, :any, default: nil

  # Streaming assistant chunk not yet a turn.
  prop :pending, :string, default: ""

  # When true, the composer renders and can emit `:thread_send`.
  prop :show_composer, :boolean, default: false

  # When true the inner view renders its clear affordance (Lit `store`).
  prop :clearable, :boolean, default: false

  # Host-notification target for the inner clear relay.
  prop :target, :string, default: ""

  prop :class, :string, default: ""

  def init(props, component, _server) do
    put_state(component,
      draft: "",
      target: props.target || ""
    )
  end

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-chat-thread", @class)} data-cy="thread.root">
      {%if not Enum.empty?(@participants)}
        <ul class="tk-chat-thread__participants">
          {%for row <- @participants}
            <li class="tk-chat-thread__participant">{participant_name(row)}</li>
          {/for}
        </ul>
      {/if}
      <View
        turns={view_turns(@messages, @participants, @turns)}
        load={@load}
        pending={@pending}
        clearable={@clearable}
        target={@target}
      />
      {%if @show_composer}
        <form class="tk-chat-thread__composer-form" $submit={:send}>
          <textarea
            class="tk-chat-thread__composer"
            data-cy="thread.composer"
            rows="2"
            aria-label="Message"
            value={@draft}
            $input={:set_draft}
            $key_down.enter.prevent_default={:composer_key}
          ></textarea>
          <button class="tk-chat-thread__send" data-cy="thread.send" type="submit">Send</button>
        </form>
      {/if}
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  @doc "Lit `#viewTurns`: `messages` (mapped) wins over `turns` when nonempty."
  def view_turns(messages, participants, turns) do
    if Enum.empty?(messages) do
      turns
    else
      messages_to_turns(messages, participants)
    end
  end

  @doc """
  Lit `messagesToTurns` — maps `{id?, role, text, at?, participant?}` onto
  turn shapes with timestamp + participant name prefixed as plain text.
  """
  def messages_to_turns(messages, participants) do
    messages
    |> Enum.with_index()
    |> Enum.map(fn {message, index} ->
      meta =
        [stamp(message_at(message)), participant_ref(message_participant(message), participants)]
        |> Enum.reject(&(&1 == ""))
        |> Enum.join(" · ")

      body = message_text(message)

      content =
        if meta == "" do
          body
        else
          meta <> "\n" <> body
        end

      %{
        id: message_id(message, index),
        role: coerce_role(message_role(message)),
        content: content,
        created_at: message_at(message) || ""
      }
    end)
  end

  @doc "Lit `coerceRole`: unknown roles fall back to `user`."
  def coerce_role(role) do
    if role in ["user", "assistant", "system"] do
      role
    else
      "user"
    end
  end

  @doc """
  Lit `formatStamp`, regex-free port: ISO-8601 prefixes render as
  `"YYYY-MM-DD HH:MM UTC"` (the Lit `Date.parse` display path); anything
  else passes through unchanged.
  """
  def stamp(at) do
    if iso_prefix?(at) do
      stamped = at |> String.slice(0, 16) |> String.replace("T", " ")
      stamped <> " UTC"
    else
      at || ""
    end
  end

  @doc "Shape test for the ISO-8601 display prefix (`2026-…T…:`)."
  def iso_prefix?(at) when is_binary(at) do
    String.length(at) >= 16 and String.at(at, 4) == "-" and
      String.at(at, 7) == "-" and String.at(at, 10) == "T" and String.at(at, 13) == ":"
  end

  def iso_prefix?(_at), do: false

  def participant_name(row), do: get(row, :name) || ""

  # -- actions (client-side; regex-free) ---------------------------------

  def action(:set_draft, params, component) do
    put_state(component, :draft, params.event.value)
  end

  # Lit `#onComposerKey`: Enter sends, Shift+Enter keeps the newline. The
  # `.enter.prevent_default` filter already swallowed the keystroke's
  # default, so a Shift+Enter press cannot reinsert it (documented
  # divergence).
  def action(:composer_key, params, component) do
    if params.event.shift_key do
      component
    else
      send_draft(component)
    end
  end

  def action(:send, _params, component) do
    send_draft(component)
  end

  # Lit `#onClear`: clear the locally derived view; the host owns the
  # durable transcript and learns about the clear through its own binding
  # (explicit `target`) or by observing the cleared snapshots.
  def action(:tobor_transcript_clear, _params, component) do
    component
  end

  # Host-forwarded actions loop back onto this component when no explicit
  # target resolves (`:target == ""` / "parent" — see README divergence 2).
  # Lit CustomEvents with no listener are simply dropped; mirror the same
  # no-op instead of crashing on an unknown action.
  def action(_name, _params, component) do
    component
  end

  @doc "Lit `#sendFrom`: trim, refuse empty, emit, clear the draft."
  def send_draft(component) do
    text = String.trim(component.state.draft || "")

    if text == "" do
      component
    else
      component
      |> put_state(:draft, "")
      |> put_action(name: :thread_send, target: component.state.target, params: %{text: text})
    end
  end

  # -- internals (also used by templates via the helpers above) ----------

  defp message_id(message, index) do
    case get(message, :id) do
      nil -> "thread-#{index}"
      "" -> "thread-#{index}"
      id -> id
    end
  end

  defp message_role(message), do: get(message, :role)
  defp message_text(message), do: get(message, :text) || ""
  defp message_at(message), do: get(message, :at)
  defp message_participant(message), do: get(message, :participant)

  defp participant_ref(nil, _participants), do: ""
  defp participant_ref("", _participants), do: ""

  defp participant_ref(id, participants) do
    case Enum.find(participants, fn row -> get(row, :id) == id end) do
      nil -> id
      row -> resolve_participant_name(row, id)
    end
  end

  defp resolve_participant_name(row, fallback_id) do
    case participant_name(row) do
      "" -> fallback_id
      name -> name
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
