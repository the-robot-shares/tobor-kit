defmodule ToborKit.Voice do
  @moduledoc """
  Voice credential minting — the server side of the contract's voice block.

  The client never holds a provider API key. `POST /voice/token` dispatches
  on the guide's `voice.adapter`:

    * `realtime` — mints an ephemeral provider client secret (the browser
      WebRTC path modeled on therobotplans' `Assistant.OpenAIRealtime`);
    * `backend`  — returns STT/TTS endpoint URLs;
    * `native`   — **409**: the platform's own speech stack needs no
      server-minted credential;
    * `none`     — voice is disabled: 503.
  """

  @adapters %{
    "realtime" => ToborKit.Voice.Realtime,
    "native" => ToborKit.Voice.Native,
    "backend" => ToborKit.Voice.Backend,
    "none" => ToborKit.Voice.Disabled
  }

  @callback mint(voice_cfg :: map(), opts :: keyword()) ::
              {:ok, map()} | {:error, term()}

  @doc """
  Credential expiry: the provider's epoch-seconds value converted to the
  contract's ISO8601, else a 5-minute credential from now. Minted exact —
  clients treat it as such, so there is no skew padding.
  """
  def expires_at(epoch) when is_integer(epoch) do
    DateTime.from_unix!(epoch) |> DateTime.to_iso8601()
  end

  def expires_at(_) do
    DateTime.utc_now()
    |> DateTime.add(5 * 60, :second)
    |> DateTime.truncate(:second)
    |> DateTime.to_iso8601()
  end

  @doc """
  Mint a credential for `guide`. Returns `{:ok, credential}` (contract
  `VoiceCredential` shape), `{:error, :no_credential_needed}` (→ 409), or
  `{:error, :unavailable | term()}` (→ 503).
  """
  @spec mint(ToborKit.Guide.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def mint(%ToborKit.Guide{} = guide, opts \\ []) do
    voice_cfg = guide.config["voice"] || %{}
    adapter = Map.get(voice_cfg, "adapter") || "none"

    case Map.fetch(@adapters, adapter) do
      {:ok, module} -> module.mint(voice_cfg, opts)
      :error -> {:error, :unavailable}
    end
  end
end

defmodule ToborKit.Voice.Native do
  @moduledoc "The `native` adapter: no server-minted credential exists."
  @behaviour ToborKit.Voice

  @impl true
  def mint(_voice_cfg, _opts), do: {:error, :no_credential_needed}
end

defmodule ToborKit.Voice.Disabled do
  @moduledoc "The `none` adapter: voice is off."
  @behaviour ToborKit.Voice

  @impl true
  def mint(_voice_cfg, _opts), do: {:error, :unavailable}
end

defmodule ToborKit.Voice.Backend do
  @moduledoc "The `backend` adapter: hands out STT/TTS URLs, no secret material."
  @behaviour ToborKit.Voice

  @impl true
  def mint(voice_cfg, opts) do
    stt = Keyword.get(opts, :stt_url) || Map.get(voice_cfg, "stt_url")
    tts = Keyword.get(opts, :tts_url) || Map.get(voice_cfg, "tts_url")

    if stt && tts do
      {:ok,
       %{
         "adapter" => "backend",
         "backend" => %{"stt_url" => stt, "tts_url" => tts},
         "expires_at" => ToborKit.Voice.expires_at(nil)
       }}
    else
      {:error, :unavailable}
    end
  end
end

defmodule ToborKit.Voice.Realtime do
  @moduledoc """
  The `realtime` adapter: mints an ephemeral OpenAI Realtime client secret
  via `POST /v1/realtime/client_secrets` so the client completes the WebRTC
  handshake directly with the provider. The long-lived key never leaves the
  backend; HTTP is injectable (`:tobor_kit, :realtime_http`) for tests.
  """

  @behaviour ToborKit.Voice

  @secrets_url "https://api.openai.com/v1/realtime/client_secrets"
  @allowed_voices ~w(marin cedar alloy ash ballad coral echo sage shimmer verse)

  @impl true
  def mint(voice_cfg, opts) do
    case api_key(opts) do
      nil ->
        {:error, :unavailable}

      key ->
        realtime_cfg = voice_cfg["realtime"] || %{}
        model = normalize_model(Keyword.get(opts, :model) || Map.get(realtime_cfg, "model"))
        voice = normalize_voice(Keyword.get(opts, :voice) || Map.get(realtime_cfg, "voice"))

        session = %{
          "type" => "realtime",
          "model" => model,
          "audio" => %{"output" => %{"voice" => voice}}
        }

        headers = [
          {"authorization", "Bearer " <> key},
          {"content-type", "application/json"}
        ]

        case http().({:post_json, @secrets_url, Jason.encode!(%{"session" => session}), headers}) do
          {:ok, %{status: status, body: raw}} when status in 200..299 ->
            case Jason.decode(raw) do
              {:ok, %{"value" => secret} = data} when is_binary(secret) and secret != "" ->
                # Minted expiry, no skew padding: the provider's expiry when
                # given, else a 5-minute credential.
                {:ok,
                 %{
                   "adapter" => "realtime",
                   "expires_at" => ToborKit.Voice.expires_at(Map.get(data, "expires_at")),
                   "realtime" => %{
                     "token" => secret,
                     "url" => "https://api.openai.com/v1/realtime/calls",
                     "model" => model,
                     "voice" => voice
                   }
                 }}

              _ ->
                {:error, {:unexpected_response, raw}}
            end

          {:ok, %{status: status, body: body}} ->
            {:error, {:provider_error, status, body}}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp api_key(opts) do
    key =
      case Keyword.get(opts, :api_key) do
        nil ->
          Application.get_env(:tobor_kit, __MODULE__, [])[:api_key] ||
            System.get_env("OPENAI_API_KEY")

        k ->
          k
      end

    case key do
      k when is_binary(k) ->
        k = String.trim(k)
        if k == "", do: nil, else: k

      _ ->
        nil
    end
  end

  defp http, do: Application.get_env(:tobor_kit, :realtime_http, &__MODULE__.default_http/1)

  @doc false
  def default_http({:post_json, url, body, headers}) do
    case Req.post(url, headers: headers, body: body, receive_timeout: 30_000) do
      {:ok, %Req.Response{status: status, body: resp}} ->
        {:ok, %{status: status, body: if(is_binary(resp), do: resp, else: Jason.encode!(resp))}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp normalize_model(value) do
    case trim_or_nil(value) do
      nil ->
        "gpt-realtime-2.1-mini"

      model ->
        if String.starts_with?(model, "gpt-realtime"), do: model, else: "gpt-realtime-2.1-mini"
    end
  end

  defp normalize_voice(value) do
    case trim_or_nil(value) do
      nil -> "marin"
      voice -> if voice in @allowed_voices, do: voice, else: "marin"
    end
  end

  defp trim_or_nil(value) when is_binary(value) do
    value = String.trim(value)
    if value == "", do: nil, else: value
  end

  defp trim_or_nil(_), do: nil
end
