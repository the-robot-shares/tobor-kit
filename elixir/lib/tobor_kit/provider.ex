defmodule ToborKit.Provider do
  @moduledoc """
  The single seam between generation and a language model.

  Ported from the therobotknows `AI.Provider` seam: a behaviour selected by
  `Application.get_env/3`, read per call, so tests swap the implementation
  rather than stub effects:

      config :tobor_kit, ToborKit.Provider, impl: MyApp.Provider.OpenAICompatible

  The library ships `ToborKit.Provider.Fake` as the default. It is the only
  implementation a prompt-focused test needs, and it keeps this repo honest
  about what it does not do: there is no real HTTP provider here yet. A host
  app supplies one speaking the same five callbacks.

  ## Dark launch

  `configured?/0` delegates to the adapter. An adapter without credentials
  reports false and `complete/2` returns `{:error, :provider_not_configured}`
  — the app boots, every other feature works, and turns fail loudly instead
  of inventing prose.
  """

  require Logger

  alias ToborKit.Completion
  alias ToborKit.Prompt

  @type chunk :: %{optional(:text) => String.t(), optional(:raw) => term()}

  @doc "Run one non-streaming completion."
  @callback complete(Prompt.t(), opts :: keyword()) ::
              {:ok, Completion.t()} | {:error, term()}

  @doc """
  Run a completion, invoking `on_chunk` as fragments arrive, and return the
  assembled completion. Adapters without a streaming transport delegate to
  `complete/2` and invoke `on_chunk` once.
  """
  @callback stream(Prompt.t(), opts :: keyword(), on_chunk :: (chunk() -> any())) ::
              {:ok, Completion.t()} | {:error, term()}

  @doc "Context window for `model`, in tokens."
  @callback context_window(model :: String.t() | nil) :: pos_integer()

  @doc "Whether the adapter has what it needs to make a call."
  @callback configured?() :: boolean()

  @default_impl ToborKit.Provider.Fake

  @doc "The configured implementation. Read per call so tests can swap it."
  @spec impl() :: module()
  def impl, do: config()[:impl] || @default_impl

  @doc "Model to generate with: explicit option, then configured default."
  @spec resolve_model(keyword()) :: String.t() | nil
  def resolve_model(opts \\ []) do
    [Keyword.get(opts, :model), Keyword.get(opts, :preferred_model), config()[:model]]
    |> Enum.find(&valid_model?/1)
  end

  @spec configured?() :: boolean()
  def configured?, do: impl().configured?()

  @spec complete(Prompt.t(), keyword()) :: {:ok, Completion.t()} | {:error, term()}
  def complete(%Prompt{} = prompt, opts \\ []) do
    with :ok <- ensure_configured(),
         :ok <- ToborKit.Budget.check_budget(opts[:user_id]),
         {:ok, completion} <- impl().complete(prompt, put_model(prompt, opts)) do
      ToborKit.Budget.record_usage(opts[:user_id], completion)
      {:ok, completion}
    end
  end

  @spec stream(Prompt.t(), keyword(), (chunk() -> any())) ::
          {:ok, Completion.t()} | {:error, term()}
  def stream(%Prompt{} = prompt, opts \\ [], on_chunk) when is_function(on_chunk, 1) do
    with :ok <- ensure_configured(),
         :ok <- ToborKit.Budget.check_budget(opts[:user_id]) do
      prompt
      |> impl().stream(put_model(prompt, opts), on_chunk)
      |> tap(fn
        {:ok, c} -> ToborKit.Budget.record_usage(opts[:user_id], c)
        _ -> :ok
      end)
    end
  end

  @spec context_window(String.t() | nil) :: pos_integer()
  def context_window(model), do: impl().context_window(model || resolve_model())

  @doc "The adapter's timeout, in milliseconds — generation is a long call."
  @spec timeout() :: pos_integer()
  def timeout, do: config()[:timeout] || 120_000

  @spec max_tokens() :: pos_integer()
  def max_tokens, do: config()[:max_tokens] || 4096

  @spec config() :: keyword()
  def config, do: Application.get_env(:tobor_kit, __MODULE__, [])

  defp put_model(%Prompt{} = prompt, opts) do
    Keyword.put_new(opts, :model, prompt.model)
  end

  defp ensure_configured do
    if configured?() do
      :ok
    else
      Logger.info("tobor_kit AI provider is not configured; turns are dark")
      {:error, :provider_not_configured}
    end
  end

  defp valid_model?(model) when is_binary(model), do: String.trim(model) not in ["", "default"]
  defp valid_model?(_), do: false
end
