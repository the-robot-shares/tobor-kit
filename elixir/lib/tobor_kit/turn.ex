defmodule ToborKit.Turn do
  @moduledoc "One turn record, per the contract `Turn` schema."

  @enforce_keys [:id, :role, :content, :created_at]
  defstruct [:id, :role, :content, :created_at, tool_calls: [], usage: nil]

  @type t :: %__MODULE__{
          id: String.t(),
          role: String.t(),
          content: String.t(),
          created_at: DateTime.t(),
          tool_calls: [
            %{id: String.t(), name: String.t(), ok: boolean(), summary: String.t() | nil}
          ],
          usage: %{input_tokens: non_neg_integer(), output_tokens: non_neg_integer()} | nil
        }

  def serialize(%__MODULE__{} = turn) do
    %{
      "id" => turn.id,
      "role" => turn.role,
      "content" => turn.content,
      "created_at" => DateTime.to_iso8601(turn.created_at),
      "tool_calls" =>
        Enum.map(turn.tool_calls, fn tc ->
          %{"id" => tc.id, "name" => tc.name, "ok" => Map.get(tc, :ok, true)}
          |> then(&if Map.get(tc, :summary), do: Map.put(&1, "summary", tc.summary), else: &1)
        end),
      "usage" => turn.usage
    }
  end

  @doc "Build an assistant turn from a completion."
  def from_completion(%ToborKit.Completion{} = completion) do
    %__MODULE__{
      id: ToborKit.UUID.generate(),
      role: "assistant",
      content: completion.text,
      created_at: DateTime.utc_now() |> DateTime.truncate(:millisecond),
      tool_calls:
        Enum.map(completion.tool_calls, fn tc ->
          %{
            id: tc.id,
            name: tc.name,
            ok: Map.get(tc, :ok, true),
            summary: Map.get(tc, :summary)
          }
        end),
      usage: usage(completion)
    }
  end

  defp usage(%ToborKit.Completion{prompt_tokens: nil, completion_tokens: nil}), do: nil

  defp usage(%ToborKit.Completion{} = c) do
    %{
      input_tokens: c.prompt_tokens || 0,
      output_tokens: c.completion_tokens || 0
    }
  end
end
