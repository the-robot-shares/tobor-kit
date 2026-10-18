defmodule HostApp.TelemetryTogglePage do
  @moduledoc """
  Serves the tobor-telemetry-toggle mount page.

  Consent is GET/PUT /api/tobor-kit/telemetry/consent on ToborKit.Endpoint
  (ToborKit.Telemetry.Consent). Do not reimplement it here. 403 means the
  guide default is binding — the element renders nothing.

  Host-owned: bearer verification, secrets, persistence.
  """

  import Plug.Conn

  @cdn "https://cdn.derobot.is/tobor-kit/latest"

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html())
  end

  def html do
    """
    <!doctype html>
    <meta charset="utf-8">
    <title>tobor-telemetry-toggle</title>
    <tobor-telemetry-toggle></tobor-telemetry-toggle>
    <script type="module">
      import {ToborKitClient} from "#{@cdn}/client.js";
      import "#{@cdn}/components/telemetry-toggle/telemetry-toggle.js";
      const el = document.querySelector("tobor-telemetry-toggle");
      el.client = new ToborKitClient({
        baseUrl: "/api/tobor-kit",
        token: () => sessionStorage.getItem("tobor-access-token")
      });
      el.addEventListener("tobor-telemetry-change", (e) => {
        console.log("tobor-telemetry-change", e.detail.consent);
      });
    </script>
    """
  end
end

defmodule HostApp.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/telemetry-toggle", do: HostApp.TelemetryTogglePage.call(conn, [])

  # Endpoint matches /api/tobor-kit/* itself (including GET/PUT /telemetry/consent).
  match _ do
    ToborKit.Endpoint.call(conn, [])
  end
end
