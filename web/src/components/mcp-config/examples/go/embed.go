// Echo host for <tobor-mcp-config>.
// go run embed.go
// Host validates. Never put secrets on the element.
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
    <title>tobor-mcp-config</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-config/tobor-mcp-config.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-config></tobor-mcp-config></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-config');
      const cfg = await fetch('/mcp/config', {credentials: 'same-origin'}).then((r) => r.json());
      el.url = cfg.url || '';
      el.transport = cfg.transport || 'http';
      if (cfg.extras) el.extras = cfg.extras;
      el.addEventListener('config-change', (event) => {
        fetch('/mcp/config', {
          method: 'PUT',
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
	mux.HandleFunc("/mcp/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		if r.Method == http.MethodPut {
			defer r.Body.Close()
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "config": body})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"url": "https://mcp.example.test/mcp", "transport": "http",
		})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
