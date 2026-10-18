defmodule ToborKit.Telemetry.Consent do
  @moduledoc """
  Telemetry consent resolution.

  Contract model:

    * consent is an **explicit user record** when one exists (`source: "user"`);
    * otherwise the guide's `telemetry.default` applies (`source: "default"`);
    * when `telemetry.user_overridable` is false the default is binding and
      the source reports `"forced"` — `PUT /telemetry/consent` answers 403;
    * a guide-level `telemetry.enabled: false` is a hard master switch
      (`source: "forced"`, always off).

  The resolved value governs content capture. Content attributes
  (prompt/response/tool_args/tool_results, per `telemetry.capture`) are added
  to spans **only** when consent resolves on, and `telemetry.redact[]`
  regexes are applied on top even then.
  """

  @enforce_keys [:enabled, :source, :user_overridable]
  defstruct [:enabled, :source, :user_overridable, capture: %{}, redact: []]

  @type t :: %__MODULE__{
          enabled: boolean(),
          source: String.t(),
          user_overridable: boolean(),
          capture: map(),
          redact: [Regex.t() | String.t()]
        }

  @callback get(user_id :: String.t()) :: boolean() | :not_recorded
  @callback put(user_id :: String.t(), enabled :: boolean()) :: :ok

  @doc "The default (never-expressed) consent value for the guide."
  def default_enabled?(telemetry_cfg) do
    cfg = mapify(telemetry_cfg)

    if Map.get(cfg, "enabled") == false do
      false
    else
      Map.get(cfg, "default") == "on"
    end
  end

  @doc "Resolve consent for `user_id` against the guide's telemetry config."
  @spec resolve(String.t() | nil, map()) :: t()
  def resolve(user_id, telemetry_cfg) do
    cfg = mapify(telemetry_cfg)
    master_on? = Map.get(cfg, "enabled") != false
    overridable? = Map.get(cfg, "user_overridable") != false

    {enabled, source, effective_overridable?} =
      if not master_on? do
        {false, "forced", false}
      else
        case store().get(user_id) do
          recorded when is_boolean(recorded) and overridable? ->
            {recorded, "user", true}

          _ ->
            {Map.get(cfg, "default") == "on", if(overridable?, do: "default", else: "forced"), overridable?}
        end
      end

    capture =
      case Map.get(cfg, "capture") do
        m when is_map(m) -> m
        _ -> %{}
      end

    %__MODULE__{
      enabled: enabled,
      source: source,
      # Consistency rule the clients rely on: forced ⇒ no user choice, ever.
      user_overridable: effective_overridable?,
      capture: capture,
      redact: Map.get(cfg, "redact") || []
    }
  end

  @doc "Record an explicit preference. `{:error, :not_overridable}` when the default is binding."
  @spec put(String.t() | nil, boolean(), map()) :: :ok | {:error, :not_overridable}
  def put(user_id, enabled, telemetry_cfg) do
    cfg = mapify(telemetry_cfg)

    if Map.get(cfg, "user_overridable") == false or Map.get(cfg, "enabled") == false do
      {:error, :not_overridable}
    else
      store().put(user_id, enabled)
      :ok
    end
  end

  defp store, do: ToborKit.Telemetry.Consent.Store

  defp mapify(cfg) when is_map(cfg), do: cfg
  defp mapify(_), do: %{}
end

defmodule ToborKit.Telemetry.Consent.Store do
  @moduledoc "ETS-backed consent records — the library default consent store."

  use GenServer
  @behaviour ToborKit.Telemetry.Consent

  @name __MODULE__
  @table :tobor_kit_consent

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: @name)

  @impl true
  def get(user_id) do
    case :ets.lookup(@table, user_id) do
      [{^user_id, enabled}] -> enabled
      [] -> :not_recorded
    end
  end

  @impl true
  def put(user_id, enabled) do
    :ets.insert(@table, {user_id, enabled})
    :ok
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public])
    {:ok, %{}}
  end
end
