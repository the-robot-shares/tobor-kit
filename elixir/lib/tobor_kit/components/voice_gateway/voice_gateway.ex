defmodule ToborKit.VoiceGateway do
  @moduledoc """
  Embeddable talking-agent backend for `<tobor-voice-agent>` — the Elixir
  twin of the Node reference gateway in `backend/`. Same wire contract v1:
  `POST /voice/sessions` mints a session and a single-use WebSocket ticket;
  the socket speaks the `input.*` / `transcript` / `text` / `audio` /
  `animation` / `interrupted` / `realtime.event` frames documented in
  `web/src/components/voice-agent/docs/backend-requirements.md`.

  Hosts mount the plug and start one supervisor; sessions, tickets and turn
  tasks are ETS/BEAM state — no external store. Provider credentials never
  reach the browser.

      # endpoint.ex
      forward "/api/voice", to: ToborKit.VoiceGateway.Plug

      # application.ex
      {ToborKit.VoiceGateway, []}

      # config.exs
      config :tobor_kit, ToborKit.VoiceGateway,
        provider: MyApp.VoiceProvider,
        brain: MyApp.AssistantBrain,
        auth: ToborKit.VoiceGateway.Auth.Bearer,
        allowed_origins: ["https://app.example.com"],
        public_url: "https://app.example.com"

  Configuration (all under `:tobor_kit, ToborKit.VoiceGateway`):

  | Key | Default | Meaning |
  | --- | --- | --- |
  | `:provider` | `nil` | `ToborKit.VoiceGateway.Provider` implementation (required) |
  | `:brain` | `nil` | `ToborKit.VoiceGateway.Brain` for the `tts` engine |
  | `:auth` | `ToborKit.VoiceGateway.Auth.Bearer` | `authorize/2` callback module |
  | `:allowed_origins` | `[]` | Exact browser origins; absent `Origin` is allowed |
  | `:public_url` | host-derived | Origin used for absolute `wss://` URLs behind proxies |
  | `:session_ttl_ms` | `1_800_000` | 30-minute session TTL |
  | `:max_sessions` | `100` | Capacity ceiling (429 beyond) |
  | `:max_payload` | `8_388_608` | 8 MiB frame/media cap |
  """

  use Supervisor

  @doc "Starts the session/ticket store and the turn-task supervisor."
  def start_link(opts) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      ToborKit.VoiceGateway.Store,
      {Task.Supervisor, name: ToborKit.VoiceGateway.TaskSup}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  @doc """
  Runtime settings resolved from `:tobor_kit, ToborKit.VoiceGateway` app env.
  """
  def config do
    cfg = Application.get_env(:tobor_kit, __MODULE__, [])

    %{
      provider: cfg[:provider],
      brain: cfg[:brain],
      auth: cfg[:auth] || ToborKit.VoiceGateway.Auth.Bearer,
      allowed_origins: cfg[:allowed_origins] || [],
      public_url: cfg[:public_url],
      session_ttl_ms: cfg[:session_ttl_ms] || 30 * 60_000,
      max_sessions: cfg[:max_sessions] || 100,
      max_payload: cfg[:max_payload] || 8 * 1024 * 1024
    }
  end
end
