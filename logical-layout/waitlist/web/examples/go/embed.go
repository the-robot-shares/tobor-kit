// ForYou-compatible host for <noizu-waitlist>.
// go run embed.go
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", servePage)
	mux.HandleFunc("GET /api/v1/public/lists/{slug}", getList)
	mux.HandleFunc("POST /api/v1/public/lists/{slug}/signups", postSignup)
	mux.HandleFunc("GET /api/v1/public/services/{service}/lists/{list}", getServiceList)
	mux.HandleFunc("POST /api/v1/public/services/{service}/lists/{list}/signups", postServiceSignup)
	log.Println("noizu-waitlist host http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", withCORS(mux)))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "content-type, accept")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, manifest(r.PathValue("slug")))
}

func getServiceList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, manifest(r.PathValue("service")+"/"+r.PathValue("list")))
}

func postSignup(w http.ResponseWriter, r *http.Request) {
	acceptSignup(w, r, r.PathValue("slug"))
}

func postServiceSignup(w http.ResponseWriter, r *http.Request) {
	acceptSignup(w, r, r.PathValue("service")+"/"+r.PathValue("list"))
}

func acceptSignup(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Values         map[string]any `json:"values"`
		Source         string         `json:"source"`
		CompanyWebsite string         `json:"company_website"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body)
	if strings.TrimSpace(body.CompanyWebsite) == "" {
		log.Printf("waitlist signup list=%s source=%s values=%v", id, body.Source, body.Values)
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"accepted": true})
}

func manifest(name string) map[string]any {
	return map[string]any{"list": map[string]any{
		"name": name, "description": "Join the waitlist.", "opt_in_mode": "single",
		"settings": map[string]any{"success_message": "You're on the list!"},
		"attributes": []any{map[string]any{
			"slug": "email", "name": "Email", "type": "email",
			"required": true, "is_identity": true, "sort_order": 0,
		}},
	}}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func servePage(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-waitlist</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/waitlist/noizu-waitlist.js"></script>
    <style>
      body{font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem}
      .field-group{display:grid;gap:.25rem;margin:.5rem 0}
      .field-input,.field-select,.field-textarea{padding:.4rem}
      .btn{padding:.4rem .8rem;cursor:pointer}
      .success{color:#0a0}.danger{color:#c00}
    </style>
  </head>
  <body>
    <noizu-waitlist slug="my-site" source="landing"></noizu-waitlist>
    <script type="module">
      const el = document.querySelector('noizu-waitlist');
      el.api = location.origin;
      el.addEventListener('waitlist-success', ev => console.info('waitlist-success', ev.detail));
      el.addEventListener('waitlist-error', ev => console.warn('waitlist-error', ev.detail));
    </script>
  </body>
</html>`)
}
