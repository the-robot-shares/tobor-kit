defmodule ToborKit.Provider.Fake do
  @moduledoc """
  Deterministic test adapter.

  Config (all optional, under `config :tobor_kit, ToborKit.Provider.Fake`):

    * `:text` — the completion body (default: an echo of the last user message).
    * `:chunks` — emit the text as this many equal chunks (default 2).
    * `:tool_calls` — list of `ToborKit.Completion.tool_call()` maps returned
      with the completion, to exercise tool events.
    * `:configured` — false simulates a dark deployment (default true).
    * `:error` — `:raise` (mid-stream failure), or any term returned as
      `{:error, term}` instead of a completion.

  Always `configured?` true unless `:configured` is set false: absence of a
  fake is a test bug, not a dark launch.
  """

  @behaviour ToborKit.Provider

  @impl true
  def configured?, do: config()[:configured] != false

  @impl true
  def context_window(_model), do: 128_000

  @impl true
  def complete(%ToborKit.Prompt{} = prompt, opts) do
    stream(prompt, opts, fn _chunk -> :ok end)
  end

  @impl true
  def stream(%ToborKit.Prompt{} = prompt, _opts, on_chunk) do
    case config()[:error] do
      :raise ->
        on_chunk.(%{text: "Parti"})
        raise "fake provider exploded mid-stream"

      nil ->
        emit(prompt, on_chunk)

      reason ->
        {:error, reason}
    end
  end

  defp emit(%ToborKit.Prompt{} = prompt, on_chunk) do
    text = completion_text(prompt)
    chunks = chunk_text(text, config()[:chunks] || 2)
    Enum.each(chunks, fn chunk -> on_chunk.(%{text: chunk}) end)

    {:ok,
     ToborKit.Completion.new(
       text: text,
       model: "tobor-fake-1",
       provider: "fake",
       prompt_tokens: estimate(prompt),
       completion_tokens: div(String.length(text), 4) + 1,
       finish_reason: :stop,
       tool_calls: config()[:tool_calls] || []
     )}
  end

  defp completion_text(%ToborKit.Prompt{messages: messages}) do
    config()[:text] ||
      case Enum.reverse(messages) do
        [%{content: last} | _] -> "Acknowledged: " <> last
        [] -> "Acknowledged."
      end
  end

  defp chunk_text(text, n) when n <= 1, do: [text]

  defp chunk_text(text, n) do
    len = String.length(text)
    size = max(1, ceil(len / n))

    text
    |> String.graphemes()
    |> Stream.chunk_every(size, size, [])
    |> Enum.map(&Enum.join/1)
  end

  defp estimate(%ToborKit.Prompt{messages: messages}) do
    Enum.sum(Enum.map(messages, &(div(String.length(&1.content), 4) + 1))) + 10
  end

  defp config, do: Application.get_env(:tobor_kit, __MODULE__, [])
end
