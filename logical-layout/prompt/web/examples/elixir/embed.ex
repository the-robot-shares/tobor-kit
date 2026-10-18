defmodule ExampleWeb.PromptController do
  @moduledoc """
  Phoenix host snippet: serve the prompt tags.

  Router:
    get "/", PromptController, :index
    get "/prompts", PromptController, :index_prompts
    put "/prompts/:id/star", PromptController, :star
    get "/prompts/history", PromptController, :history
    post "/prompts/:id/fork", PromptController, :fork

  Host-owned persistence, CSRF, and session cookies stay off the element.
  """
  use ExampleWeb, :controller

  @page """
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>prompt family</title>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-library.js"></script>
      <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-history.js"></script>
    </head>
    <body>
      <div class="demo-frame">
        <tobor-prompt-library></tobor-prompt-library>
        <tobor-prompt-history></tobor-prompt-history>
      </div>
      <script type="module">
        const libraryEl = document.querySelector('tobor-prompt-library');
        const historyEl = document.querySelector('tobor-prompt-history');
        const prompts = await fetch('/prompts', {credentials: 'same-origin'}).then((r) => r.json());
        libraryEl.prompts = prompts.prompts;
        const history = await fetch('/prompts/history', {credentials: 'same-origin'}).then((r) => r.json());
        historyEl.entries = history.entries;
        historyEl.diff = {
          left: {label: 'v1', body: 'You are a helpful assistant.'},
          right: {label: 'v2', body: 'You are a concise assistant.\\nNo HTML.'},
        };
        libraryEl.addEventListener('prompt-select', (event) => { libraryEl.selectedId = event.detail.id; });
        const persistStar = async (event) => {
          await fetch('/prompts/' + encodeURIComponent(event.detail.id) + '/star', {
            method: 'PUT',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(event.detail),
          });
        };
        libraryEl.addEventListener('prompt-star', persistStar);
        historyEl.addEventListener('prompt-star', persistStar);
        historyEl.addEventListener('prompt-fork', async (event) => {
          await fetch('/prompts/' + encodeURIComponent(event.detail.id) + '/fork', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(event.detail),
          });
        });
      </script>
    </body>
  </html>
  """

  @prompts [
    %{
      id: "sys",
      title: "System",
      body: "You are a helpful assistant.\nDo not render HTML.",
      starred: true
    }
  ]
  @entries [
    %{id: "sys-v1", title: "System", at: "2026-01-01T12:00:00Z", version: 1}
  ]

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, @page)
  end

  def index_prompts(conn, _params) do
    json(conn, %{prompts: @prompts})
  end

  def history(conn, _params) do
    json(conn, %{entries: @entries})
  end

  def star(conn, params) do
    json(conn, %{ok: true, id: params["id"], starred: params["starred"]})
  end

  def fork(conn, %{"id" => id}) do
    json(conn, %{ok: true, id: id <> "-fork", forkedFrom: id})
  end
end
