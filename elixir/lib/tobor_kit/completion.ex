defmodule ToborKit.Completion do
  @moduledoc """
  One provider response, carrying **real** usage.

  `prompt_tokens`/`completion_tokens` are nil when the provider did not
  report them; a nil propagates as nil rather than as a zero that reads like
  a free call. `tool_calls` carries any tools the model invoked during the
  turn; the turn runner turns those into `tool_call`/`tool_result` events.
  """

  defstruct text: "",
            model: nil,
            provider: nil,
            prompt_tokens: nil,
            completion_tokens: nil,
            total_tokens: nil,
            finish_reason: nil,
            tool_calls: [],
            raw: nil

  @type tool_call :: %{
          required(:id) => String.t(),
          required(:name) => String.t(),
          optional(:args) => map() | nil,
          optional(:ok) => boolean(),
          optional(:summary) => String.t() | nil
        }

  @type t :: %__MODULE__{
          text: String.t(),
          model: String.t() | nil,
          provider: String.t() | nil,
          prompt_tokens: non_neg_integer() | nil,
          completion_tokens: non_neg_integer() | nil,
          total_tokens: non_neg_integer() | nil,
          finish_reason: atom() | String.t() | nil,
          tool_calls: [tool_call()],
          raw: term()
        }

  @doc "Build a completion, filling `total_tokens` when both halves were reported."
  @spec new(keyword() | map()) :: t()
  def new(fields) do
    %__MODULE__{} = completion = struct(__MODULE__, Map.new(fields))
    %{completion | total_tokens: total(completion)}
  end

  defp total(%__MODULE__{total_tokens: total}) when is_integer(total), do: total

  defp total(%__MODULE__{prompt_tokens: p, completion_tokens: c})
       when is_integer(p) and is_integer(c),
       do: p + c

  defp total(_), do: nil
end
