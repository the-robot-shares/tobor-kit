defmodule ExampleWeb.ArtifactController do
  @moduledoc """
  Phoenix host snippet: serve both artifact tags.

  Router:
    get "/", ArtifactController, :index
    get "/artifacts/:id", ArtifactController, :show
    put "/artifacts/:id", ArtifactController, :update
    post "/reviews", ArtifactController, :review

  Echo store is in-process. Host-owned persistence, CSRF, and auth stay off
  the element. Kit does not PUT.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>artifact family</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-view.js"></script>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-editor.js"></script>
    </head>
    <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
      <tobor-artifact-view id="view"></tobor-artifact-view>
      <tobor-artifact-editor id="editor"></tobor-artifact-editor>
      <script type="module">
        const view = document.querySelector('#view');
        const editor = document.querySelector('#editor');
        const apply = (artifact) => { view.artifact = artifact; editor.artifact = artifact; };
        fetch('/artifacts/demo', {credentials: 'same-origin'})
          .then((r) => r.json())
          .then(apply);
        view.addEventListener('review-start', (event) => {
          fetch('/reviews', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(event.detail),
          });
        });
        editor.addEventListener('artifact-save', (event) => {
          const id = event.detail.id || 'demo';
          fetch('/artifacts/' + encodeURIComponent(id), {
            method: 'PUT',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(event.detail),
          }).then((r) => r.json()).then(apply);
        });
      </script>
    </body>
  </html>
  """

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, @page)
  end

  def show(conn, %{"id" => id}) do
    case ExampleWeb.ArtifactStore.get(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not found"})
      art -> json(conn, art)
    end
  end

  def update(conn, %{"id" => id} = params) do
    json(conn, ExampleWeb.ArtifactStore.put(id, params))
  end

  def review(conn, params) do
    json(conn, %{ok: true, review: params})
  end
end

defmodule ExampleWeb.ArtifactStore do
  use Agent

  @seed %{
    "id" => "demo",
    "title" => "Release notes",
    "version" => 1,
    "body" => "Ship the island.\nDo not render HTML.",
    "mime" => "text/plain"
  }

  def start_link(_opts), do: Agent.start_link(fn -> @seed end, name: __MODULE__)

  def get(id), do: Agent.get(__MODULE__, fn art -> if art["id"] == id, do: art end)

  def put(id, attrs) do
    Agent.get_and_update(__MODULE__, fn art ->
      next = %{
        "id" => id,
        "title" => attrs["title"] || art["title"],
        "body" => attrs["body"] || art["body"],
        "mime" => attrs["mime"] || art["mime"],
        "version" => (art["version"] || 0) + 1
      }

      {next, next}
    end)
  end
end
