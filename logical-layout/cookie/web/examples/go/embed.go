// net/http host: serve both cookie tags. Optional POST /consent echoes the payload.
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
    <title>cookie family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-consent.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-settings.js"></script>
  </head>
  <body>
    <noizu-cookie-settings>Cookie Settings</noizu-cookie-settings>
    <noizu-cookie-consent storage-key="start-app.cookie-consent.v1" mode="categories"></noizu-cookie-consent>
    <script type="module">
      window.addEventListener('start-app:cookie-consent-change', (event) => {
        if (!event.detail) return;
        fetch('/consent', {
          method: 'POST',
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
	mux.HandleFunc("/consent", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		defer r.Body.Close()
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "consent": body})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
