defmodule ToborKit.VoiceGateway.Plug do
  @moduledoc """
  The voice gateway as a mountable Plug router — mirrors the Node gateway's
  HTTP surface exactly:

      forward "/api/voice", to: ToborKit.VoiceGateway.Plug

    * `POST /voice/sessions` — authorize, mint, return
      `{sessionId, websocketUrl, expiresAt}` (+ `realtime` credentials for
      the `openai-realtime` engine);
    * `GET /voice/sessions/:id/socket?ticket=…` — single-use WebSocket
      upgrade;
    * `GET /health` — ops probe, not called by the element;
    * CORS for credentialed cross-origin browsers, `OPTIONS` preflight → 204.

  Origin rules match the Node gateway exactly: requests without an `Origin`
  header pass (curl, same-origin GET), anything else must be an exact
  `:allowed_origins` entry or it is denied `403 {"code":"origin_denied"}`.
  """

  use Plug.Router
  import Plug.Conn

  alias ToborKit.VoiceGateway
  alias ToborKit.VoiceGateway.{Config, Socket, Store}

  @body_limit 65_536

  plug :voice_cors
  plug :match
  plug :dispatch

  get "/health" do
    send_json(conn, 200, %{"ok" => true})
  end

  post "/voice/sessions" do
    case read_body(conn, length: @body_limit + 1, read_length: @body_limit) do
      {:ok, body, conn} ->
        create_session(conn, body)

      {:more, _, _conn} ->
        send_json(conn, 400, error("invalid_config", "Configuration is too large"))

      {:error, _reason} ->
        send_json(conn, 400, error("invalid_request", "Invalid session request"))
    end
  end

  get "/voice/sessions/:id/socket" do
    cfg = VoiceGateway.config()
    session = Store.get_session(id)
    ticket = fetch_query_params(conn).query_params["ticket"]

    cond do
      is_nil(session) ->
        forbidden(conn)

      session.expires_at <= now_ms() ->
        Store.delete_session(id)
        forbidden(conn)

      is_pid(session.pid) ->
        # Single live websocket per session: reconnect always means a new session.
        forbidden(conn)

      not Store.consume_ticket(ticket, id) ->
        forbidden(conn)

      true ->
        remaining = max(session.expires_at - now_ms(), 0)

        conn
        |> upgrade_adapter(
          :websocket,
          {Socket, %{session_id: id, max_payload: cfg.max_payload}, timeout: remaining + 60_000}
        )
        |> halt()
    end
  end

  match _ do
    send_json(conn, 404, error("not_found", "Not found"))
  end

  # ── session create ────────────────────────────────────────────────────────

  defp create_session(conn, body) do
    cfg = VoiceGateway.config()

    with {:ok, requested} <- decode(body),
         policy when is_map(policy) <- authorize(conn, requested, cfg.auth),
         {:ok, config} <- Config.authorize_config(requested, policy),
         :ok <- capacity(cfg),
         {:ok, realtime} <- maybe_mint_realtime(cfg.provider, config) do
      session_id = ToborKit.UUID.generate()
      ticket = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
      expires_at = now_ms() + cfg.session_ttl_ms

      Store.put_session(%{
        session_id: session_id,
        config: config,
        ticket: ticket,
        expires_at: expires_at,
        pid: nil
      })

      Store.put_ticket(ticket, session_id, expires_at)

      reply = %{
        "sessionId" => session_id,
        "websocketUrl" => websocket_url(conn, cfg.public_url, session_id, ticket),
        "expiresAt" => iso8601(expires_at)
      }

      reply = if realtime, do: Map.put(reply, "realtime", realtime), else: reply
      send_json(conn, 201, reply)
    else
      nil -> send_json(conn, 401, error("unauthorized", "Authentication required"))
      {:error, status, code, message} -> send_json(conn, status, error(code, message))
    end
  end

  defp decode(body) do
    case Jason.decode(body) do
      {:ok, requested} when is_map(requested) -> {:ok, requested}
      _ -> {:error, 400, "invalid_request", "Invalid session request"}
    end
  end

  # Authentication precedes policy validation: no policy → 401, never a 403
  # that leaks which scopes the caller was denied.
  defp authorize(conn, requested, auth) do
    case auth.authorize(conn, requested) do
      policy when is_map(policy) -> policy
      _ -> nil
    end
  end

  defp capacity(cfg) do
    if Store.count() >= cfg.max_sessions,
      do: {:error, 429, "capacity", "Too many voice sessions"},
      else: :ok
  end

  defp maybe_mint_realtime(nil, _config),
    do: {:error, 400, "invalid_request", "Voice gateway is not configured"}

  defp maybe_mint_realtime(_provider, %{"engine" => "openai-realtime"} = config) do
    case provider().mint_realtime(config) do
      {:ok, credential} ->
        {:ok, credential}

      {:error, {code, message}} when is_binary(code) and is_binary(message) ->
        {:error, 400, code, message}

      {:error, _} ->
        {:error, 400, "invalid_request", "Invalid session request"}
    end
  end

  defp maybe_mint_realtime(_, _), do: {:ok, nil}

  defp provider, do: VoiceGateway.config().provider

  defp websocket_url(conn, public_url, session_id, ticket) do
    path = "/voice/sessions/#{session_id}/socket"
    query = "ticket=" <> ticket

    uri =
      case parse_origin(public_url) do
        %URI{host: host} = uri when is_binary(host) and host != "" ->
          scheme = if uri.scheme == "https", do: "wss", else: "ws"
          %URI{uri | scheme: scheme, path: path, query: query}

        _ ->
          scheme = if conn.scheme == :https, do: "wss", else: "ws"
          host = if is_binary(conn.host) and conn.host != "", do: conn.host, else: "127.0.0.1"

          %URI{scheme: scheme, host: host, port: conn.port, path: path, query: query}
      end

    URI.to_string(uri)
  end

  defp parse_origin(url) when is_binary(url), do: URI.parse(url)
  defp parse_origin(_), do: nil

  defp iso8601(ms) do
    ms
    |> DateTime.from_unix!(:millisecond)
    |> DateTime.truncate(:millisecond)
    |> DateTime.to_iso8601()
  end

  defp now_ms, do: System.system_time(:millisecond)

  # ── CORS / origin policy (Node-parity) ────────────────────────────────────

  defp voice_cors(conn, _opts) do
    case get_req_header(conn, "origin") do
      [origin | _] ->
        if origin in VoiceGateway.config().allowed_origins do
          conn
          |> put_resp_header("access-control-allow-origin", origin)
          |> put_resp_header("vary", "Origin")
          |> put_resp_header("access-control-allow-credentials", "true")
          |> preflight()
        else
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(403, Jason.encode!(error("origin_denied", "Origin denied")))
          |> halt()
        end

      [] ->
        conn
    end
  end

  defp preflight(%{method: "OPTIONS"} = conn) do
    conn
    |> put_resp_header("access-control-allow-methods", "POST, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "Content-Type, Authorization")
    |> send_resp(204, "")
    |> halt()
  end

  defp preflight(conn), do: conn

  # ── helpers ───────────────────────────────────────────────────────────────

  defp forbidden(conn) do
    conn |> send_resp(403, "Forbidden") |> halt()
  end

  defp send_json(conn, status, body) do
    conn
    |> put_resp_content_type("application/json")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(status, Jason.encode!(body))
  end

  defp error(code, message), do: %{"code" => code, "message" => message}
end
