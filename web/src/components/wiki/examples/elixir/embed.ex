defmodule ExampleWeb.WikiController do
  @moduledoc """
  Phoenix host snippet: serve the wiki tags.

  Router:
    get "/", WikiController, :index
    get "/wiki/spaces", WikiController, :spaces
    get "/wiki/entries/:id", WikiController, :show
    put "/wiki/entries/:id", WikiController, :update

  Host-owned persistence, CSRF, and session cookies stay off the element.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>wiki family</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-space.js"></script>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry.js"></script>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry-editor.js"></script>
    </head>
    <body>
      <div class="demo-frame">
        <tobor-wiki-space></tobor-wiki-space>
        <tobor-wiki-entry></tobor-wiki-entry>
        <tobor-wiki-entry-editor></tobor-wiki-entry-editor>
      </div>
      <script type="module">
        const spacesEl = document.querySelector('tobor-wiki-space');
        const entryEl = document.querySelector('tobor-wiki-entry');
        const editorEl = document.querySelector('tobor-wiki-entry-editor');
        const spaces = await fetch('/wiki/spaces', {credentials: 'same-origin'}).then((r) => r.json());
        spacesEl.spaces = spaces.spaces;
        spacesEl.addEventListener('wiki-space-select', async (event) => {
          const id = event.detail.id === 'eng' ? 'eng-readme' : event.detail.id;
          entryEl.entry = await fetch('/wiki/entries/' + encodeURIComponent(id), {credentials: 'same-origin'}).then((r) => r.json());
        });
        entryEl.addEventListener('wiki-edit', () => { editorEl.entry = entryEl.entry; });
        editorEl.addEventListener('wiki-save', async (event) => {
          const saved = event.detail;
          const res = await fetch('/wiki/entries/' + encodeURIComponent(saved.id || 'new'), {
            method: 'PUT',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(saved),
          });
          entryEl.entry = await res.json().then((body) => body.entry);
          editorEl.entry = entryEl.entry;
        });
      </script>
    </body>
  </html>
  """

  @spaces [%{id: "eng", title: "Engineering", slug: "eng"}]
  @entry %{
    id: "eng-readme",
    title: "README",
    body: "Ship the island.\nDo not render HTML.",
    spaceId: "eng"
  }

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, @page)
  end

  def spaces(conn, _params) do
    json(conn, %{spaces: @spaces})
  end

  def show(conn, %{"id" => id}) do
    json(conn, Map.put(@entry, :id, id))
  end

  def update(conn, params) do
    json(conn, %{ok: true, entry: params})
  end
end
