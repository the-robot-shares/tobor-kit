defmodule ToborKit.Auth.SocketPlug do
  @moduledoc """
  Mountable pre-login websocket for the standard auth component. Install before
  the host's authentication gate. The product callback owns account validation,
  rate limits, and a one-time HTTP session handoff; see `docs/auth-socket.md`.
  """
  @behaviour Plug
  import Plug.Conn

  @invite_token_modes [:optional, :required, :ignore]

  @impl true
  def init(opts) do
    Keyword.fetch!(opts, :handler)

    mode = Keyword.get(opts, :invite_token, :optional)
    mode = if mode in @invite_token_modes, do: mode, else: :optional

    opts
    |> Keyword.put_new(:path, "/auth/socket")
    |> Keyword.put(:invite_token, mode)
  end

  @impl true
  def call(conn, opts) do
    if conn.request_path == opts[:path] do
      cond do
        conn.method != "GET" ->
          reject(conn, 405)

        not allowed_origin?(conn, opts) ->
          reject(conn, 403)

        not valid_context?(conn.private[:tobor_auth_context]) ->
          reject(conn, 403)

        true ->
          state = %{
            handler: opts[:handler],
            invite_token: opts[:invite_token],
            context: %{
              origin: hd(get_req_header(conn, "origin")),
              remote_ip: conn.remote_ip,
              browser_binding: conn.private[:tobor_auth_context].browser_binding
            },
            count: 0
          }

          conn
          |> upgrade_adapter(:websocket, {ToborKit.Auth.Socket, state, [timeout: 60_000]})
          |> halt()
      end
    else
      conn
    end
  end

  defp valid_context?(%{browser_binding: binding} = context)
       when map_size(context) == 1 and is_binary(binding) and byte_size(binding) in 16..256,
       do: true

  defp valid_context?(_), do: false

  @doc false
  def allowed_origin?(conn, opts) do
    case get_req_header(conn, "origin") do
      [origin] ->
        uri = URI.parse(origin)

        valid =
          uri.scheme in ["http", "https"] and is_binary(uri.host) and
            is_nil(uri.userinfo) and uri.path in [nil, ""] and is_nil(uri.query) and
            is_nil(uri.fragment)

        same =
          uri.scheme == Atom.to_string(conn.scheme) and uri.host == conn.host and
            uri.port == conn.port

        dev =
          Keyword.get(opts, :development, false) and
            uri.scheme == Atom.to_string(conn.scheme) and uri.host == conn.host and
            origin in Keyword.get(opts, :allowed_origins, [])

        valid and (same or dev)

      _ ->
        false
    end
  end

  defp reject(conn, status), do: conn |> send_resp(status, "Auth websocket unavailable") |> halt()
end

defmodule ToborKit.Auth.Socket do
  @moduledoc """
  Version 1 auth RPC. Handler implements `handle_auth(method, params, context)`
  and returns `{:ok, map}` or `{:error, code, public_message}`. No credentials
  are retained in socket state. Never return bearer tokens: complete session
  establishment through a one-time same-origin HTTP handoff redirect.
  """
  @behaviour WebSock
  @methods ~w(config login register magic-link otp-request otp-verify sso)
  @sensitive ~w(password access_token refresh_token client_secret dev_code dev_link browser_binding)

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_in({data, [opcode: :text]}, state) when byte_size(data) <= 16_384 do
    state = %{state | count: state.count + 1}

    if state.count > 60 do
      {:stop, :normal, 1008, state}
    else
      reply =
        case Jason.decode(data) do
          {:ok, %{"version" => 1, "id" => id, "method" => method, "params" => params}}
          when is_binary(id) and byte_size(id) in 1..128 and is_map(params) and method in @methods ->
            dispatch(id, method, params, state)

          _ ->
            error(nil, "invalid_request", "Invalid authentication request.")
        end

      {:push, {:text, Jason.encode!(reply)}, state}
    end
  end

  def handle_in(_, state), do: {:stop, :normal, 1009, state}

  @impl true
  def handle_info(_, state), do: {:ok, state}

  defp dispatch(id, method, params, state) do
    with {:ok, params} <- enforce_invite_token(method, params, Map.get(state, :invite_token, :optional)),
         {:ok, result} when is_map(result) <- state.handler.handle_auth(method, params, state.context) do
      if safe_result?(result),
        do: %{"id" => id, "result" => result},
        else: error(id, "invalid_response", "Authentication could not be completed.")
    else
      {:error, code, message} when is_binary(code) and is_binary(message) ->
        error(id, code, message)

      _ ->
        error(id, "invalid_response", "Authentication could not be completed.")
    end
  rescue
    _ -> error(id, "unavailable", "Authentication is temporarily unavailable.")
  catch
    _, _ -> error(id, "unavailable", "Authentication is temporarily unavailable.")
  end

  # Invite-token policy (SocketPlug `invite_token:` option, default `:optional` = today's
  # passthrough). `:required` gates only the missing case here — the host handler stays
  # authoritative for token validity. `:ignore` strips the param so it never reaches the host.
  defp enforce_invite_token("register", params, :required) do
    case params["invite_token"] do
      token when is_binary(token) ->
        if String.trim(token) != "",
          do: {:ok, params},
          else: {:error, "invalid_invite_token", "An invite token is required."}

      _ ->
        {:error, "invalid_invite_token", "An invite token is required."}
    end
  end

  defp enforce_invite_token("register", params, :ignore), do: {:ok, strip_invite_token(params)}
  defp enforce_invite_token(_method, params, _mode), do: {:ok, params}

  defp strip_invite_token(params) do
    params = Map.delete(params, "invite_token")

    case params do
      %{"user" => user} when is_map(user) -> Map.put(params, "user", Map.delete(user, "invite_token"))
      _ -> params
    end
  end

  defp safe_result?(value) when is_map(value) do
    Enum.all?(value, fn {key, item} ->
      to_string(key) not in @sensitive and safe_result?(item) and
        (to_string(key) not in ["redirect", "href"] or safe_path?(item))
    end)
  end

  defp safe_result?(value) when is_list(value), do: Enum.all?(value, &safe_result?/1)

  defp safe_result?(value),
    do: is_nil(value) or is_binary(value) or is_boolean(value) or is_number(value)

  defp safe_path?(path) when is_binary(path) do
    String.starts_with?(path, "/") and not String.starts_with?(path, "//") and
      not String.contains?(path, "\\") and not Regex.match?(~r/[\x00-\x20\x7f]/, path)
  end

  defp safe_path?(_), do: false

  defp error(id, code, message),
    do: %{"id" => id, "error" => %{"code" => code, "message" => message}}
end
