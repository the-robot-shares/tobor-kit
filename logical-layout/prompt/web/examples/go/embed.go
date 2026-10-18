// net/http host: serve prompt tags. Stub GET/PUT/POST /prompts/* echoes the payload.
// Host-owned persistence and session cookies stay off the element.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
)

const page = `<!doctype html>
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
</html>`

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("content-type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, page)
	})
	mux.HandleFunc("/prompts/history", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"entries": []map[string]any{
				{"id": "sys-v1", "title": "System", "at": "2026-01-01T12:00:00Z", "version": 1},
			},
		})
	})
	mux.HandleFunc("/prompts/", func(w http.ResponseWriter, r *http.Request) {
		rest := strings.TrimPrefix(r.URL.Path, "/prompts/")
		w.Header().Set("content-type", "application/json")
		if strings.HasSuffix(rest, "/star") && r.Method == http.MethodPut {
			defer r.Body.Close()
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": body["id"], "starred": body["starred"]})
			return
		}
		if strings.HasSuffix(rest, "/fork") && r.Method == http.MethodPost {
			id := strings.TrimSuffix(rest, "/fork")
			id = strings.TrimSuffix(id, "/")
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id + "-fork", "forkedFrom": id})
			return
		}
		http.NotFound(w, r)
	})
	mux.HandleFunc("/prompts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"prompts": []map[string]any{
				{"id": "sys", "title": "System", "body": "You are a helpful assistant.\nDo not render HTML.", "starred": true},
			},
		})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
