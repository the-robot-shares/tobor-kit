defmodule ToborKit.Budget do
  @moduledoc """
  Generation budget seam.

  The reference backend in a host app will have a real budget table; the
  library ships only the behaviour and a permissive default. Enforcing hosts
  implement `check_budget/1` and `record_usage/3` (the therobotknows
  `AI.Budget` pattern: monthly per-user cents, checked before the call,
  recorded after). Checked before every provider call by `ToborKit.Provider`.
  """

  @callback check_budget(user_id :: String.t() | nil) :: :ok | {:error, :budget_exceeded}
  @callback record_usage(user_id :: String.t() | nil, completion :: ToborKit.Completion.t()) ::
              :ok

  def impl, do: Application.get_env(:tobor_kit, __MODULE__, [])[:impl] || ToborKit.Budget.Noop

  @doc "Returns :ok, or {:error, :budget_exceeded} — which becomes a 429 turn error."
  def check_budget(user_id), do: impl().check_budget(user_id)

  @doc "Record usage after a successful call. Never raises into the turn."
  def record_usage(user_id, %ToborKit.Completion{} = completion) do
    impl().record_usage(user_id, completion)
  rescue
    _ -> :ok
  end
end

defmodule ToborKit.Budget.Noop do
  @moduledoc "Permissive default: unlimited budget, usage discarded."
  @behaviour ToborKit.Budget

  @impl true
  def check_budget(_user_id), do: :ok

  @impl true
  def record_usage(_user_id, _completion), do: :ok
end
