defmodule ToborKit.Prompt do
  @moduledoc "One generation request: system prompt, message history, model hint."

  defstruct system: "",
            messages: [],
            model: nil,
            metadata: %{}

  @type message :: %{role: :user | :assistant | :system, content: String.t()}
  @type t :: %__MODULE__{
          system: String.t(),
          messages: [message()],
          model: String.t() | nil,
          metadata: map()
        }
end
