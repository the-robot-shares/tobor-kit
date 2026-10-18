defmodule ToborKit.VoiceGateway.Providers.OpenAIRealtime do
  @moduledoc """
  The `openai-realtime` engine (default): mints the ephemeral WebRTC
  credential the browser exchanges directly with the provider, mirroring the
  Node gateway's `mintRealtime`. The long-lived key never leaves the server;
  HTTP is injectable (`:http` seam) so tests never touch the network.

  Config under `:tobor_kit, __MODULE__`:

    * `:api_key` — server credential (falls back to `$OPENAI_API_KEY`)
    * `:base_url` — OpenAI-compatible root incl. `/v1`
      (falls back to `$OPENAI_BASE_URL`, else `https://api.openai.com/v1`)
    * `:http` — `({:post_json, url, body, headers} -> {:ok, %{status:, body:}} | {:error, term})`
      seam for tests

  Speech and transcription happen on the provider's WebRTC channel, so
  `transcribe/3` and `speak/3` fail closed. Function calls arrive over the
  relay and execute against the session allowlist through the shared
  `invoke_tool` default (server-side `invoke` callbacks).
  """

  @behaviour ToborKit.VoiceGateway.Provider

  @stt_model "gpt-4o-mini-transcribe"
  @default_voice "marin"

  alias ToborKit.VoiceGateway.Config

  @impl true
  def mint_realtime(config) do
    case api_key() do
      nil ->
        {:error, {"provider_unconfigured", "Realtime credentials are not configured"}}

      key ->
        base_url = base_url()
        voice = config["voice"] || @default_voice
        session = realtime_session(config, voice)
        headers = [{"authorization", "Bearer " <> key}, {"content-type", "application/json"}]

        case http().(
               {:post_json, base_url <> "/realtime/client_secrets",
                Jason.encode!(%{"session" => session}), headers}
             ) do
          {:ok, %{status: status, body: raw}} when status in 200..299 ->
            case Jason.decode(raw) do
              {:ok, %{"value" => secret} = data} when is_binary(secret) and secret != "" ->
                {:ok,
                 %{
                   "token" => secret,
                   "url" => base_url <> "/realtime/calls",
                   "model" => config["model"],
                   "voice" => voice,
                   "expiresAt" => Map.get(data, "expires_at")
                 }}

              _ ->
                {:error, {"provider_error", "Realtime credential missing"}}
            end

          {:ok, %{status: status}} ->
            {:error, {"provider_error", "Realtime credential request failed (#{status})"}}

          {:error, reason} ->
            {:error, {"provider_error", "Realtime credential request failed: #{inspect(reason)}"}}
        end
    end
  end

  @impl true
  def respond(_ctx),
    do:
      {:error, {"invalid_message", "The openai-realtime engine answers on the provider channel"}}

  @impl true
  def transcribe(_data, _mime, _ctx),
    do:
      {:error,
       {"invalid_message", "The openai-realtime engine transcribes on the provider channel"}}

  @impl true
  def speak(_text, _ctx),
    do: {:error, {"invalid_message", "The openai-realtime engine speaks on the provider channel"}}

  @impl true
  def invoke_tool(tool, args, ctx),
    do: ToborKit.VoiceGateway.Provider.invoke_tool(tool, args, ctx)

  @impl true
  def resolve_tool(tools, name), do: ToborKit.VoiceGateway.Provider.resolve_tool(tools, name)

  defp realtime_session(config, voice) do
    tools =
      Enum.map(config["tools"] || [], fn tool ->
        %{
          "type" => "function",
          "name" => Config.function_name(tool["name"]),
          "description" => tool["description"] || "",
          "parameters" => tool["inputSchema"] || %{"type" => "object", "properties" => %{}}
        }
      end)

    %{
      "type" => "realtime",
      "model" => config["model"],
      "instructions" => config["systemPrompt"],
      "tools" => tools,
      "audio" => %{
        "input" => %{
          "transcription" => %{"model" => @stt_model},
          "turn_detection" => %{
            "type" => "server_vad",
            "interrupt_response" => true,
            "create_response" => true
          }
        },
        "output" => %{"voice" => voice}
      }
    }
  end

  defp api_key do
    case Application.get_env(:tobor_kit, __MODULE__, [])[:api_key] ||
           System.get_env("OPENAI_API_KEY") do
      key when is_binary(key) ->
        key = String.trim(key)
        if key == "", do: nil, else: key

      _ ->
        nil
    end
  end

  defp base_url do
    Application.get_env(:tobor_kit, __MODULE__, [])[:base_url] ||
      System.get_env("OPENAI_BASE_URL") ||
      "https://api.openai.com/v1"
      |> String.trim_trailing("/")
  end

  defp http,
    do: Application.get_env(:tobor_kit, __MODULE__, [])[:http] || (&__MODULE__.default_http/1)

  @doc false
  def default_http({:post_json, url, body, headers}) do
    case Req.post(url, headers: headers, body: body, receive_timeout: 30_000) do
      {:ok, %Req.Response{status: status, body: resp}} ->
        {:ok, %{status: status, body: if(is_binary(resp), do: resp, else: Jason.encode!(resp))}}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
