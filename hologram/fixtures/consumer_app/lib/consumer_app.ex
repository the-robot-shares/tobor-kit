defmodule ConsumerApp.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    Supervisor.start_link([], strategy: :one_for_one, name: ConsumerApp.Supervisor)
  end
end

defmodule ConsumerApp.Router do
  @moduledoc "Session + Hologram router, as a Phoenix endpoint would provide."
  use Plug.Builder

  plug :put_secret_key_base
  plug Plug.Session, store: :cookie, key: "_consumer_app", signing_salt: "consumer_app_salt"
  plug :fetch_session
  plug Hologram.Router

  def put_secret_key_base(conn, _opts),
    do: %{conn | secret_key_base: System.fetch_env!("SECRET_KEY_BASE")}
end

defmodule ConsumerApp.Layout do
  @moduledoc false
  use Hologram.Component

  def template do
    ~HOLO"""
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>consumer app</title>
        <Hologram.UI.Runtime />
      </head>
      <body>
        <slot />
      </body>
    </html>
    """
  end
end

defmodule ConsumerApp.HomePage do
  @moduledoc "A host page rendering a library component."
  use Hologram.Page

  route("/")
  layout(ConsumerApp.Layout)

  def template do
    ~HOLO"""
    <main>
      <ToborKit.Hologram.Sg.Btn variant="primary">consumer-app-ok</ToborKit.Hologram.Sg.Btn>
    </main>
    """
  end
end

defmodule ConsumerApp.Probe do
  @moduledoc """
  Run inside the booted release (`bin/consumer_app eval`): every app in the
  boot script is started, then the checks that broke therobot.institute run.
  Prints one `PROBE ` line of Elixir terms and halts non-zero on failure.
  """

  # `bin/… eval` starts a bare VM; Hologram.env/0 turns HOLOGRAM_ENV into an
  # EXISTING atom, so the probe module (loaded first) must carry it.
  @hologram_envs [:prod, :dev, :test]

  def run do
    true = Enum.member?(@hologram_envs, Hologram.env())
    {:ok, _} = Application.ensure_all_started(:consumer_app)

    hologram_apps =
      for {app, _, _} <- Application.loaded_applications(),
          :hologram in (Application.spec(app, :applications) || []),
          do: app

    otp_app = Hologram.Reflection.otp_app()

    conn =
      Plug.Test.conn(:get, "/")
      |> Plug.Conn.put_req_header("accept", "text/html")
      |> ConsumerApp.Router.call(ConsumerApp.Router.init([]))

    result = %{
      otp_app: otp_app,
      hologram_apps: hologram_apps,
      status: conn.status,
      rendered_kit_component: String.contains?(conn.resp_body || "", "consumer-app-ok")
    }

    IO.puts("PROBE " <> inspect(result))
    ok? = otp_app == :consumer_app and conn.status == 200 and result.rendered_kit_component
    System.halt(if ok?, do: 0, else: 1)
  end
end
