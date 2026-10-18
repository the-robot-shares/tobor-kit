// Echo host for <tobor-mcp-clients>.
// go run embed.go
// OAuth redirect is host-owned. This stub does not redirect and never returns secrets.
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
    <title>tobor-mcp-clients</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-clients/tobor-mcp-clients.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-clients></tobor-mcp-clients></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-clients');
      const load = () => fetch('/mcp/clients', {credentials: 'same-origin'}).then((r) => r.json()).then((body) => { el.clients = body.clients; });
      await load();
      el.addEventListener('client-authorize', async (event) => {
        const body = await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/authorize', {
          method: 'POST', credentials: 'same-origin',
        }).then((r) => r.json());
        // Host-owned: if (body.redirect) location.assign(body.redirect);
        await load();
      });
      el.addEventListener('client-revoke', async (event) => {
        await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/revoke', {
          method: 'POST', credentials: 'same-origin',
        });
        await load();
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
	mux.HandleFunc("/mcp/clients", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"clients": []map[string]string{
				{"id": "github", "name": "GitHub", "status": "disconnected", "auth": "oauth"},
				{"id": "search", "name": "Search", "status": "connected", "auth": "api-key"},
			},
		})
	})
	mux.HandleFunc("/mcp/clients/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		rest := strings.TrimPrefix(r.URL.Path, "/mcp/clients/")
		id, action, _ := strings.Cut(rest, "/")
		if r.Method != http.MethodPost || id == "" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		status := "connected"
		if action == "revoke" {
			status = "disconnected"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id, "status": status})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
