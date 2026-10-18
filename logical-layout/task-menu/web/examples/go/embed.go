package main

import (
	"encoding/json"
	"net/http"
	"os"
)

// Serves the tobor-task-menu page and a canned GET /api/tobor-kit/mcp/tools
// body. Production dressing lives in go/internal/mcp — mount
// go/internal/server instead of this stub when you have a guide.
//
// Host-owned: bearer verification, secrets, persistence.

var inventory = map[string]any{
	"groups": []map[string]string{
		{"id": "Github", "label": "Github"},
	},
	"tools": []map[string]any{
		{"name": "Github.BranchCreate", "label": "New branch", "group": "Github"},
		{"name": "Github.PullCreate", "label": "Open a PR", "group": "Github", "confirm": true},
	},
	"degraded": []map[string]string{
		{"server": "tickets", "label": "Tickets", "error": "timeout"},
	},
}

const page = `<!doctype html>
<meta charset="utf-8">
<title>tobor-task-menu</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/task-menu/task-menu.js"></script>
<div class="demo-frame"><tobor-task-menu></tobor-task-menu></div>
<script type="module">
  const el = document.querySelector('tobor-task-menu');
  const token = sessionStorage.getItem('tobor-access-token');
  const headers = token ? {Authorization: 'Bearer ' + token} : {};
  const res = await fetch('/api/tobor-kit/mcp/tools', {headers});
  if (res.ok) el.inventory = await res.json();
  el.addEventListener('tobor-task-select', (e) => {
    console.log('tobor-task-select', e.detail.tool);
  });
</script>`

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /task-menu", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	mux.HandleFunc("GET /api/tobor-kit/mcp/tools", func(w http.ResponseWriter, r *http.Request) {
		// r.URL.Query().Get("refresh") is ignored here; production bypasses the cache.
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(inventory)
	})
	// mux.Handle("/", server.New(cfg)) // real Guide API, including GET /mcp/tools
	addr := ":8090"
	if v := os.Getenv("LISTEN"); v != "" {
		addr = v
	}
	_ = http.ListenAndServe(addr, mux)
}
