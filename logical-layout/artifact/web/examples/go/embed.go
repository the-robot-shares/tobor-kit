// net/http host: serve both artifact tags.
// go run embed.go
// Host-owned persistence. Kit does not PUT. No secrets on the element.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
)

type artifact struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Version int    `json:"version"`
	Body    string `json:"body"`
	Mime    string `json:"mime,omitempty"`
}

var (
	mu  sync.Mutex
	art = artifact{
		ID:      "demo",
		Title:   "Release notes",
		Version: 1,
		Body:    "Ship the island.\nDo not render HTML.",
		Mime:    "text/plain",
	}
)

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>artifact family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-view.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-editor.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <tobor-artifact-view id="view"></tobor-artifact-view>
    <tobor-artifact-editor id="editor"></tobor-artifact-editor>
    <script type="module">
      const view = document.querySelector('#view');
      const editor = document.querySelector('#editor');
      const apply = (artifact) => { view.artifact = artifact; editor.artifact = artifact; };
      fetch('/artifacts/demo', {credentials: 'same-origin'}).then((r) => r.json()).then(apply);
      view.addEventListener('review-start', (event) => {
        fetch('/reviews', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      });
      editor.addEventListener('artifact-save', (event) => {
        const id = event.detail.id || 'demo';
        fetch('/artifacts/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        }).then((r) => r.json()).then(apply);
      });
    </script>
  </body>
</html>`

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, page)
	})
	mux.HandleFunc("GET /artifacts/{id}", getArtifact)
	mux.HandleFunc("PUT /artifacts/{id}", putArtifact)
	mux.HandleFunc("POST /reviews", postReview)
	log.Println("artifact family host http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}

func getArtifact(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	if r.PathValue("id") != art.ID {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	writeJSON(w, art)
}

func putArtifact(w http.ResponseWriter, r *http.Request) {
	var body artifact
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	mu.Lock()
	art.ID = r.PathValue("id")
	if body.Title != "" {
		art.Title = body.Title
	}
	art.Body = body.Body
	if body.Mime != "" {
		art.Mime = body.Mime
	}
	art.Version++
	out := art
	mu.Unlock()
	writeJSON(w, out)
}

func postReview(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "review": body})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
