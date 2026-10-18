defmodule ToborKit.VoiceGateway.Brain do
  @moduledoc """
  The host-supplied text engine for the `tts` (push-to-talk) engine: one
  recorded audio clip in, one reply text out, with the gateway streaming the
  reply back through speech synthesis.

  `respond/1` receives the turn context:

    * `"text"` — transcribed user text (or `nil` for image-only turns)
    * `"image"` — data URL when the turn carries an image/screenshot
    * `"history"` — prior wire-shaped `%{"role" =>, "content" =>}` messages
    * `"config"` — the authorized session config (organization, project, …)

  Bridge any LLM/genai stack here. Return `{:ok, reply_text}` or
  `{:error, term}`.
  """

  @callback respond(ctx :: map()) :: {:ok, reply :: String.t()} | {:error, term()}
end
