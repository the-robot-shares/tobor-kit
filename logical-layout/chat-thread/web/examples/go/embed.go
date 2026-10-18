// Host page for <tobor-chat-thread>.
//
// Transcript is GET/DELETE /api/tobor-kit/sessions/{sessionId}/transcript on
// github.com/the-robot-lives/tobor-kit/go/internal/server — mount that mux
// (server.New). Do not reimplement the resource here.
// 501 = client store (memory/local), not an empty transcript.
package main

import (
	"log"
	"net/http"
)

const page = `<!doctype html>
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
</html>`

func main() {
	mux := http.NewServeMux()
	// mux.Handle("/api/tobor-kit/", server.New(cfg)) // production Guide API
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8090", mux))
}
