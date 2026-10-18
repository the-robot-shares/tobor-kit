// net/http host: serve wiki tags. Stub GET/PUT /wiki/* echoes the payload.
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
        entryEl.entry = (await res.json()).entry;
        editorEl.entry = entryEl.entry;
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
	mux.HandleFunc("/wiki/spaces", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"spaces": []map[string]string{{"id": "eng", "title": "Engineering", "slug": "eng"}},
		})
	})
	mux.HandleFunc("/wiki/entries/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/wiki/entries/")
		w.Header().Set("content-type", "application/json")
		if r.Method == http.MethodPut {
			defer r.Body.Close()
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "entry": body})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id": id, "title": "README", "body": "Ship the island.\nDo not render HTML.", "spaceId": "eng",
		})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
