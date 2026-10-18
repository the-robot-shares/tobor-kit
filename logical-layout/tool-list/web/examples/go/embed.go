// Throwaway net/http stub of GET /api/tobor-kit/mcp/tools.
// Production inventory dressing lives in go/internal/mcp — do not reimplement it here.
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

// Host-owned: TLS, bearer check when guide.auth.required. Never embed secrets.

var inventory = map[string]any{
	"groups": []map[string]string{
		{"id": "Github", "label": "Github"},
		{"id": "Tickets", "label": "Tickets"},
	},
	"tools": []map[string]any{
		{"name": "Github.BranchCreate", "label": "New branch", "group": "Github", "read_only": true},
		{"name": "Github.PullCreate", "label": "Open a PR", "group": "Github", "confirm": true},
		{"name": "Ticket.Create", "label": "File a ticket", "group": "Tickets"},
	},
	"degraded": []map[string]string{
		{"server": "seo", "label": "SEO", "error": "connection refused"},
	},
}

const page = `<!doctype html>
<meta charset="utf-8">
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/tool-list/tool-list.js"></script>
<div class="demo-frame"><tobor-tool-list></tobor-tool-list></div>
<script type="module">
  const el = document.querySelector('tobor-tool-list');
  const res = await fetch('/api/tobor-kit/mcp/tools');
  el.inventory = await res.json();
  el.addEventListener('tobor-tool-select', (e) => {
    console.info('tobor-tool-select', e.detail.tool);
  });
</script>`

func handleMCPTools(w http.ResponseWriter, r *http.Request) {
	// r.URL.Query().Get("refresh") is ignored here; production bypasses the cache.
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(inventory)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/tobor-kit/mcp/tools", handleMCPTools)
	mux.HandleFunc("GET /", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	log.Fatal(http.ListenAndServe(":8090", mux))
}
