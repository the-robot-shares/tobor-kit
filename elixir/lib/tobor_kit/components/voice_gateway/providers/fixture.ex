defmodule ToborKit.VoiceGateway.Providers.Fixture do
  @moduledoc """
  Deterministic test provider mirroring `backend/test/fixture.mjs`. Makes no
  model or speech-provider calls. Behaviour (locked by the contract tests):

    * `respond/1` — `"Sandbox voice reply: <last user text>"`, image turns get
      `" [image received]"` appended, `slow` in the text delays 250 ms (for
      interrupt testing), emits a `tool_running` animation first;
    * `transcribe/3` — always `"Recorded sandbox voice"`;
    * `speak/3` — one PCM frame: 480 zero bytes, or 192_000 when the text
      contains `long audio`;
    * `mint_realtime/1` — refuses; the fixture never mints real credentials.

  Never selected by production fallback: the gateway requires an explicit
  `:provider` config.
  """

  @behaviour ToborKit.VoiceGateway.Provider

  @impl true
  def respond(%{messages: messages, emit: emit}) do
    emit.(%{"type" => "animation", "state" => "tool_running"})

    text =
      case List.last(messages) do
        %{"content" => content} when is_list(content) ->
          hd(content)["text"] <> " [image received]"

        %{"content" => content} when is_binary(content) ->
          content

        _ ->
          ""
      end

    if text =~ "slow", do: Process.sleep(250)
    {:ok, "Sandbox voice reply: #{text}"}
  end

  @impl true
  def transcribe(_data, _mime, _ctx), do: {:ok, "Recorded sandbox voice"}

  @impl true
  def speak(text, %{emit: emit}) do
    size = if text =~ "long audio", do: 192_000, else: 480

    emit.(%{
      "type" => "audio",
      "data" => Base.encode64(:binary.copy(<<0>>, size)),
      "mimeType" => "audio/pcm",
      "sampleRate" => 24_000
    })

    :ok
  end

  @impl true
  def mint_realtime(_config),
    do:
      {:error,
       {"fixture_realtime_unavailable", "Fixture does not mint real provider credentials"}}

  @impl true
  def invoke_tool(tool, args, ctx),
    do: ToborKit.VoiceGateway.Provider.invoke_tool(tool, args, ctx)
end
