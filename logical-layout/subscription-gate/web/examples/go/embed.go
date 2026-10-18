// Host snippet: serve <noizu-subscription-gate> and optional GET /entitlement.
// go run embed.go
// Replace the stub with a session/billing lookup. Host owns entitlement truth.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", servePage)
	mux.HandleFunc("GET /entitlement", entitlement)
	log.Println("noizu-subscription-gate host http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}

func entitlement(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"entitled": true})
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
    <title>noizu-subscription-gate</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/subscription-gate/noizu-subscription-gate.js"></script>
  </head>
  <body>
    <h1>Subscription gate</h1>
    <noizu-subscription-gate check-url="/entitlement" redirect-to="/pricing">
      <p>Subscriber content (check-url)</p>
    </noizu-subscription-gate>
    <noizu-subscription-gate redirect-to="/pricing">
      <p>Blocked unless the host sets entitled</p>
    </noizu-subscription-gate>
    <script type="module">
      document.querySelectorAll('noizu-subscription-gate').forEach((el) => {
        el.addEventListener('gate-blocked', (event) => {
          console.info('gate-blocked', event.detail.redirectTo);
        });
      });
    </script>
  </body>
</html>`)
}
