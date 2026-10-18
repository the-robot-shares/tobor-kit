defmodule ExampleWeb.AssetController do
  @moduledoc """
  Phoenix/Plug host snippet: serve `<tobor-asset-view>` and `<tobor-asset-editor>`.

  Router:
    get "/", AssetController, :index
    get "/assets/:id", AssetController, :show
    put "/assets/:id", AssetController, :update

  Host loads the snapshot (GET) and persists `asset-save` (PUT). Kit does not
  persist. Never put secrets on the element. No kit asset API in this repo.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>asset family</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-view.js"></script>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-editor.js"></script>
    </head>
    <body>
      <h1>Asset</h1>
      <tobor-asset-view></tobor-asset-view>
      <tobor-asset-editor></tobor-asset-editor>
      <script type="module">
        const view = document.querySelector('tobor-asset-view');
        const editor = document.querySelector('tobor-asset-editor');
        fetch('/assets/note-1')
          .then((res) => res.json())
          .then((asset) => {
            view.asset = asset;
            editor.asset = asset;
          });
        editor.addEventListener('asset-save', (event) => {
          fetch('/assets/' + event.detail.id, {
            method: 'PUT',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(event.detail),
          });
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
    json(conn, %{id: id, name: "readme.txt", mime: "text/plain", body: "Hello from the host."})
  end

  def update(conn, params) do
    # Host-owned persist. Stub echo only — no secrets here.
    json(conn, %{ok: true, asset: params})
  end
end
