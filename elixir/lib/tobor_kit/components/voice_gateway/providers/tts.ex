defmodule ToborKit.VoiceGateway.Providers.Tts do
  @moduledoc """
  The `tts` (push-to-talk) engine: a complete recorded clip is transcribed,
  the text turn is answered by the host's `ToborKit.VoiceGateway.Brain`, and
  the reply is synthesized to PCM frames.

  Optional speech seams (config under `:tobor_kit, __MODULE__`):

    * `:stt` — `(data, mime) -> {:ok, text}` | fn/2, `{mod, fun, args}`
    * `:tts` — `(text) -> {:ok, pcm :: binary}` — emitted as one
      `audio/pcm` frame at 24 kHz

  When a seam is absent the corresponding callback fails closed with
  `provider_unconfigured` — no production fallback to any hosted provider.
  """

  @behaviour ToborKit.VoiceGateway.Provider

  @impl true
  def respond(%{brain: nil}), do: {:error, {"provider_unconfigured", "No brain is configured"}}

  def respond(%{brain: brain} = ctx) do
    case brain.respond(%{
           "text" => ctx[:text],
           "image" => ctx[:image],
           "history" => ctx.messages,
           "config" => ctx.config
         }) do
      {:ok, reply} when is_binary(reply) ->
        {:ok, reply}

      {:error, {:code, _} = coded} ->
        {:error, coded}

      {:error, reason} ->
        {:error, {"provider_error", "Voice provider failed: #{inspect(reason)}"}}

      other ->
        {:error, {"provider_error", "Brain returned an invalid reply: #{inspect(other)}"}}
    end
  end

  @impl true
  def transcribe(data, mime, _ctx) do
    case seam(:stt, [data, mime]) do
      {:ok, text} when is_binary(text) -> {:ok, text}
      {:error, {:code, _} = coded} -> {:error, coded}
      :seam_missing -> {:error, {"provider_unconfigured", "STT is not configured"}}
      {:error, reason} -> {:error, {"provider_error", "Transcription failed: #{inspect(reason)}"}}
      _ -> {:error, {"provider_error", "Transcription failed"}}
    end
  end

  @impl true
  def speak(text, %{emit: emit}) do
    case seam(:tts, [text]) do
      {:ok, pcm} when is_binary(pcm) ->
        if rem(byte_size(pcm), 2) == 0 do
          emit.(%{
            "type" => "audio",
            "data" => Base.encode64(pcm),
            "mimeType" => "audio/pcm",
            "sampleRate" => 24_000
          })

          :ok
        else
          {:error, {"provider_error", "Speech synthesis returned an odd-length PCM buffer"}}
        end

      {:error, {:code, _} = coded} ->
        {:error, coded}

      :seam_missing ->
        {:error, {"provider_unconfigured", "TTS is not configured"}}

      {:error, reason} ->
        {:error, {"provider_error", "Speech synthesis failed: #{inspect(reason)}"}}

      _ ->
        {:error, {"provider_error", "Speech synthesis failed"}}
    end
  end

  @impl true
  def mint_realtime(_config),
    do: {:error, {"invalid_message", "The tts engine does not mint realtime credentials"}}

  @impl true
  def invoke_tool(tool, args, ctx),
    do: ToborKit.VoiceGateway.Provider.invoke_tool(tool, args, ctx)

  defp seam(key, args) do
    case Application.get_env(:tobor_kit, __MODULE__, [])[key] do
      fun when is_function(fun, length(args)) ->
        apply(fun, args)

      {mod, fun, extra} when is_atom(mod) and is_atom(fun) and is_list(extra) ->
        apply(mod, fun, args ++ extra)

      nil ->
        :seam_missing

      _ ->
        {:error, :invalid_seam}
    end
  end
end
