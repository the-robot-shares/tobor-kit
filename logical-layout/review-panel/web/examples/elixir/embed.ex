defmodule ExampleWeb.ReviewPanelController do
  @moduledoc """
  Phoenix/Plug host snippet: serve a page that mounts `<tobor-review-panel>`.

  Router:
    get "/", ReviewPanelController, :index
    get "/artifacts/:artifact_id/reviews", ReviewPanelController, :list
    post "/artifacts/:artifact_id/reviews", ReviewPanelController, :create
    post "/artifacts/:artifact_id/reviews/:id/resolve", ReviewPanelController, :resolve

  Host persists reviews. Never put a bearer secret on the element.
  No kit review API in this repo.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>tobor-review-panel</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/review-panel/review-panel.js"></script>
    </head>
    <body>
      <h1>Reviews</h1>
      <div class="demo-frame">
        <tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>
      </div>
      <script type="module">
        const el = document.querySelector('tobor-review-panel');
        const artifactId = el.artifactId || 'artifact-1';
        async function load() {
          const res = await fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews', {credentials: 'same-origin'});
          if (!res.ok) return;
          el.reviews = (await res.json()).reviews ?? [];
        }
        el.addEventListener('review-submit', (event) => {
          fetch('/artifacts/' + encodeURIComponent(event.detail.artifactId) + '/reviews', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify({body: event.detail.body}),
          }).then((res) => { if (res.ok) return load(); });
        });
        el.addEventListener('review-resolve', (event) => {
          fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews/' + encodeURIComponent(event.detail.id) + '/resolve', {
            method: 'POST', credentials: 'same-origin',
          }).then((res) => { if (res.ok) return load(); });
        });
        load();
      </script>
    </body>
  </html>
  """

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, @page)
  end

  def list(conn, %{"artifact_id" => id}) do
    json(conn, %{reviews: reviews_for(id)})
  end

  def create(conn, %{"artifact_id" => id} = params) do
    body = params["body"] || (conn.body_params["body"] || "")
    row = %{id: "r-#{System.unique_integer([:positive])}", author: "you", body: body, at: DateTime.utc_now() |> DateTime.to_iso8601(), status: "open"}
    put_review(id, row)
    conn |> put_status(201) |> json(row)
  end

  def resolve(conn, %{"artifact_id" => artifact_id, "id" => id}) do
    json(conn, %{id: id, status: "resolved", artifact_id: artifact_id})
  end

  # Host-owned in-memory stub. Production persists. No secrets here.
  defp reviews_for(_id), do: [%{id: "r1", author: "Ada", body: "Looks good", at: "2026-01-01T00:00:00Z", status: "open"}]
  defp put_review(_id, _row), do: :ok
end
