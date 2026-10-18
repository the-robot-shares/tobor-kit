// Host snippet: serve <tobor-asset-view> and <tobor-asset-editor>.
//
// GET /assets/:id stubs a snapshot. PUT /assets/:id echoes asset-save.
// Production hosts own blob storage. Never put secrets on the element.
// go run embed.go
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
	mux.HandleFunc("/assets/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/assets/")
		if id == "" || strings.Contains(id, "/") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("content-type", "application/json")
		switch r.Method {
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(map[string]string{
				"id": id, "name": "readme.txt", "mime": "text/plain", "body": "Hello from the host.",
			})
		case http.MethodPut:
			defer r.Body.Close()
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "asset": body})
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
