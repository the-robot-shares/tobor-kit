defmodule ToborKit.Compiler.Error do
  @moduledoc """
  A compilation failure carrying actionable, key-path-scoped issues.

  Never raised across the public API — `ToborKit.Compiler.compile/2` returns
  `{:error, %Error{}}` so a caller can render every offending key path at once
  instead of chasing one exception at a time.
  """

  defstruct kind: :validation, message: "", issues: []

  @type issue :: %{path: String.t(), message: String.t()}
  @type t :: %__MODULE__{kind: atom(), message: String.t(), issues: [issue()]}

  @spec new(atom(), String.t(), [issue()]) :: t()
  def new(kind, message, issues \\ []) do
    %__MODULE__{kind: kind, message: message, issues: issues}
  end

  @doc "Human-readable multi-line rendering, one line per offending key path."
  @spec format(t()) :: String.t()
  def format(%__MODULE__{issues: []} = err), do: err.message

  def format(%__MODULE__{} = err) do
    lines = Enum.map(err.issues, fn %{path: path, message: message} -> "  #{path}: #{message}" end)
    Enum.join([err.message | lines], "\n")
  end
end
