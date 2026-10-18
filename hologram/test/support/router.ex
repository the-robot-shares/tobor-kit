defmodule ToborKit.Hologram.TestSupport.Router do
  @moduledoc """
  Test-only plug pipeline: cookie-session config + `fetch_session`, then the
  Hologram router. `Hologram.Controller.handle_initial_page_request/2` calls
  `fetch_session`, which raises without a configured session store — hosts
  normally provide this via their Phoenix endpoint; the test harness does it
  here.
  """

  use Plug.Router

  plug Plug.Session,
    store: :cookie,
    key: "_tk_hologram_test",
    signing_salt: "tk_hologram_test_salt"

  plug :fetch_session
  plug Hologram.Router

  plug :match
  plug :dispatch

  match _ do
    conn
  end
end
