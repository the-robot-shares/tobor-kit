// Host snippet: serve a page that mounts <tobor-review-panel>.
//
// GET/POST /artifacts/{id}/reviews and POST …/resolve are host-owned.
// Never put a bearer secret on the element. go run embed.go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-review-panel</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/review-panel/review-panel.js"></script>
  </head>
  <body>
    <h1>Reviews</h1>
    <div class="demo-frame">
      <tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>
    </div>
    <script type="module">
      const el = document.querySelector('tobor-review-panel');
      const artifactId = el.artifactId || 'artifact-1';
      async function load() {
        const res = await fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews', {credentials: 'same-origin'});
        if (!res.ok) return;
        el.reviews = (await res.json()).reviews ?? [];
      }
      el.addEventListener('review-submit', (event) => {
        fetch('/artifacts/' + encodeURIComponent(event.detail.artifactId) + '/reviews', {
          method: 'POST', headers: {'content-type': 'application/json'}, credentials: 'same-origin',
          body: JSON.stringify({body: event.detail.body}),
        }).then((res) => { if (res.ok) return load(); });
      });
      el.addEventListener('review-resolve', (event) => {
        fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews/' + encodeURIComponent(event.detail.id) + '/resolve', {
          method: 'POST', credentials: 'same-origin',
        }).then((res) => { if (res.ok) return load(); });
      });
      load();
    </script>
  </body>
</html>`

type review struct {
	ID     string `json:"id"`
	Author string `json:"author"`
	Body   string `json:"body"`
	At     string `json:"at,omitempty"`
	Status string `json:"status,omitempty"`
}

var (
	mu   sync.Mutex
	rows = map[string][]review{
		"artifact-1": {{ID: "r1", Author: "Ada", Body: "Looks good", At: "2026-01-01T00:00:00Z", Status: "open"}},
	}
)

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
	mux.HandleFunc("/artifacts/", artifacts)
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}

func artifacts(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 || parts[2] != "reviews" {
		http.NotFound(w, r)
		return
	}
	id := parts[1]
	w.Header().Set("content-type", "application/json")
	mu.Lock()
	defer mu.Unlock()
	switch {
	case len(parts) == 3 && r.Method == http.MethodGet:
		_ = json.NewEncoder(w).Encode(map[string]any{"reviews": rows[id]})
	case len(parts) == 3 && r.Method == http.MethodPost:
		var in struct{ Body string `json:"body"` }
		_ = json.NewDecoder(r.Body).Decode(&in)
		row := review{ID: fmt.Sprintf("r-%d", time.Now().UnixNano()), Author: "you", Body: in.Body, At: time.Now().UTC().Format(time.RFC3339), Status: "open"}
		rows[id] = append(rows[id], row)
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(row)
	case len(parts) == 5 && parts[4] == "resolve" && r.Method == http.MethodPost:
		for i, row := range rows[id] {
			if row.ID == parts[3] {
				row.Status = "resolved"
				rows[id][i] = row
				_ = json.NewEncoder(w).Encode(map[string]string{"id": row.ID, "status": "resolved"})
				return
			}
		}
		http.NotFound(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
