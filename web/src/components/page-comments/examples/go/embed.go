// Go host: serves the annotatable page; mirrors the read side of the annotate
// contract for local development only. Production runs annotate-srv
// (docs/backend-requirements.md).
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

type anchor struct {
	CSS         string `json:"css"`
	XPath       string `json:"xpath"`
	TextQuote   struct {
		Prefix string `json:"prefix"`
		Exact  string `json:"exact"`
		Suffix string `json:"suffix"`
	} `json:"textQuote"`
	Fingerprint struct {
		Tag      string `json:"tag"`
		TextHash string `json:"textHash"`
		RelPos   int    `json:"relPos"`
	} `json:"fingerprint"`
}

type comment struct {
	ID     string `json:"id"`
	BodyMD string `json:"body_md"`
}

type thread struct {
	ID       string    `json:"id"`
	PageKey  string    `json:"page_key"`
	URL      string    `json:"url"`
	BodyMD   string    `json:"body_md"`
	Resolved bool      `json:"resolved"`
	Comments []comment `json:"comments"`
	Anchor   anchor    `json:"anchor"`
}

func threads(w http.ResponseWriter, r *http.Request) {
	// Dev stub: one empty list per page_key. Real per-site storage lives in
	// the annotate service.
	key := r.URL.Query().Get("page_key")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"threads": []thread{{
		ID: "demo-1", PageKey: key, URL: "http://localhost:8080/", BodyMD: "Seeded **dev** thread.",
		Comments: []comment{}, Anchor: anchor{},
	}}})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/sites/demo-site/threads", threads)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!doctype html>
<html><head><meta charset="utf-8"><title>page-comments host</title>
<script type="module">
import "https://cdn.derobot.is/tobor-kit/latest/components/page-comments/page-comments.js";
</script></head>
<body>
<h1>Annotatable page</h1>
<p id="intro">Enable comments (launcher or Alt+C), then click to anchor.</p>
<noizu-page-comments site="demo-site" api-base="http://localhost:8080"></noizu-page-comments>
</body></html>`))
	})
	log.Println("listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
