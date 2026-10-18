# Host Plug: serve the island and forward the real Guide API.
# Transcript is GET/DELETE /api/tobor-kit/sessions/:id/transcript on
# ToborKit.Endpoint — do not reimplement it here.
# 501 = client store (memory/local), not empty.
# Phoenix/Hologram hosts can emit the same tag.

defmodule HostApp.ChatThreadRouter do
  use Plug.Router

  plug :match
  plug :dispatch

  forward "/api/tobor-kit", to: ToborKit.Endpoint

  get "/" do
    conn
    |> put_resp_content_type("text/html; charset=utf-8")
    |> send_resp(200, embed_html())
  end

  match _ do
    send_resp(conn, 404, "not found")
  end

  defp embed_html do
    """
    <!doctype html>
    <html lang="en">
      <body>
        <div class="demo-frame">
          <tobor-chat-thread show-composer></tobor-chat-thread>
        </div>
        <script type="module">
          import {ToborKitClient} from "/assets/tobor-kit/client.js";
          import {createBackendStore, createMemoryStore} from "/assets/tobor-kit/transcript-store.js";
          import "/assets/tobor-kit/chat-thread.js";
          const el = document.querySelector("tobor-chat-thread");
          const sessionId = new URLSearchParams(location.search).get("session");
          el.addEventListener("tobor-transcript-clear", () => {
            el.turns = [];
            el.messages = [];
            el.load = null;
          });
          el.addEventListener("thread-send", (event) => {
            // Host-owned: POST /api/tobor-kit/sessions/{id}/turn if you persist.
            console.info("thread-send", event.detail.text);
          });
          if (sessionId) {
            const store = createBackendStore(new ToborKitClient({
              baseUrl: "/api/tobor-kit",
              token: () => window.__TOBOR_ACCESS_TOKEN
            }), sessionId);
            const load = await store.load();
            el.store = store;
            el.load = load;
            if (load.status === "ok") el.turns = load.turns;
          } else {
            const store = createMemoryStore();
            el.store = store;
            el.turns = (await store.load()).turns;
          }
        </script>
      </body>
    </html>
    """
  end
end

# Phoenix HEEx equivalent (token from the session, never a compiled secret):
#
#   def chat_thread(assigns) do
#     ~H"""
#     <div class="demo-frame">
#       <tobor-chat-thread id="thread" show-composer></tobor-chat-thread>
#     </div>
#     """
#   end
