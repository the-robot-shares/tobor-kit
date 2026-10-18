// Echo host for <tobor-mcp-domain>.
// go run embed.go
// Host-owned persistence and session cookies stay off the element.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-mcp-domain</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-domain/tobor-mcp-domain.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-domain></tobor-mcp-domain></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-domain');
      const tools = await fetch('/mcp/domain', {credentials: 'same-origin'}).then((r) => r.json());
      el.tools = tools.tools;
      el.addEventListener('tool-visibility-change', (event) => {
        fetch('/mcp/domain', {
          method: 'PATCH',
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
	mux.HandleFunc("/mcp/domain", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		if r.Method == http.MethodPatch {
			defer r.Body.Close()
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "tool": body})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"tools": []map[string]string{
				{"name": "Github.PullCreate", "visibility": "visible"},
				{"name": "Github.IssueList", "visibility": "discoverable"},
				{"name": "Filesystem.Write", "visibility": "disabled"},
			},
		})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
