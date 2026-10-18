defmodule ToborKit.Endpoint.AuthPlug do
  @moduledoc """
  Bearer-token gate.

  When the guide's `auth.required` is true, everything but `GET /guide`
  requires a bearer token; `/guide` stays open either way (the projection
  carries no secrets). Token *verification* belongs to the host — set a
  loader (`config :tobor_kit, ToborKit.Endpoint, current_user: {Mod, fun, args}`)
  and this plug exposes `conn.private[:tobor_user]` / `[:tobor_user_id]`.
  """

  @behaviour Plug

  import Plug.Conn

  @impl true
  def init(opts), do: opts

  @impl true
  def call(conn, _opts) do
    conn = put_private(conn)
    auth_cfg = current_auth_config()

    required? = Map.get(auth_cfg, "required") == true
    public? = conn.path_info in [~w(api tobor-kit guide), ~w(api tobor-kit healthz)]
    bearer? = match?([_token], bearer_value(get_req_header(conn, "authorization")))

    cond do
      public? or not required? or bearer? ->
        conn

      true ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(
          401,
          Jason.encode!(%{
            "code" => "unauthorized",
            "message" => "Missing or invalid credentials."
          })
        )
        |> halt()
    end
  end

  defp put_private(conn) do
    case Application.get_env(:tobor_kit, ToborKit.Endpoint, [])[:current_user] do
      {mod, fun, args} ->
        case apply(mod, fun, [conn | args]) do
          %{id: id} = user -> conn |> put_private_user(user, id)
          %{"id" => id} = user -> conn |> put_private_user(user, id)
          id when is_binary(id) -> Plug.Conn.put_private(conn, :tobor_user_id, id)
          _ -> conn
        end

      _ ->
        conn
    end
  end

  defp put_private_user(conn, user, id) do
    conn
    |> Plug.Conn.put_private(:tobor_user, user)
    |> Plug.Conn.put_private(:tobor_user_id, id)
  end

  defp bearer_value(headers) do
    Enum.find_value(headers, fn
      "Bearer " <> token -> [String.trim(token)]
      "bearer " <> token -> [String.trim(token)]
      _ -> nil
    end)
  end

  defp current_auth_config do
    case ToborKit.Guide.Store.guide() do
      {:ok, guide} -> Map.get(guide.config, "auth") || %{}
      _ -> %{}
    end
  end
end

defmodule ToborKit.HTTP do
  @moduledoc """
  Bandit server wrapper. Off by default — hosts either start it
  (`config :tobor_kit, ToborKit.HTTP, enabled: true, port: 8080`) or forward
  to `ToborKit.Endpoint` from their own plug pipeline.
  """

  use Supervisor

  def start_link(opts) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    cfg = Application.get_env(:tobor_kit, __MODULE__, [])
    port = cfg[:port] || 8080

    children = [
      {Bandit, plug: ToborKit.Endpoint, scheme: :http, port: port}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
