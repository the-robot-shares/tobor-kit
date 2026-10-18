// Host snippet: serve a page that mounts <noizu-billing-status>.
//
// Host-owned snapshot in page JS. POST /billing/portal stubs a portal URL.
// Production hosts create a Stripe Billing Portal session server-side.
// Never put sk_… on the element. go run embed.go
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
    <title>noizu-billing-status</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/billing-status/noizu-billing-status.js"></script>
  </head>
  <body>
    <h1>Billing</h1>
    <noizu-billing-status></noizu-billing-status>
    <script type="module">
      const el = document.querySelector('noizu-billing-status');
      // Host-owned snapshot. Never a Stripe secret on the element.
      el.subscription = {status: 'active', planName: 'Pro', renewsAt: '2026-10-01'};
      el.addEventListener('portal-open', () => {
        fetch('/billing/portal', {method: 'POST', credentials: 'same-origin'})
          .then((res) => res.json())
          .then((body) => { if (body.url) location.assign(body.url); });
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
	mux.HandleFunc("/billing/portal", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"url": "https://billing.example.test/session"})
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
