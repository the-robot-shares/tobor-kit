// net/http host: serve <noizu-plan-compare> with sample plans JSON.
// Does not create Stripe sessions. Host-owned: navigate on plan-select.
package main

import (
	"io"
	"log"
	"net/http"
)

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-plan-compare</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/plan-compare/noizu-plan-compare.js"></script>
  </head>
  <body>
    <noizu-plan-compare layout="cards" billing-toggle checkout-url-template="https://example.com/checkout/{planId}">
      <script type="application/json">
        [
          {"id":"starter","name":"Starter","priceMonthly":9,"priceYearly":90,"features":["1 seat","Community support"]},
          {"id":"pro","name":"Pro","priceMonthly":29,"priceYearly":290,"features":["5 seats","Priority support"],"highlighted":true,"ctaLabel":"Go Pro"},
          {"id":"team","name":"Team","priceMonthly":99,"priceYearly":990,"features":["Unlimited seats","SSO"]}
        ]
      </script>
    </noizu-plan-compare>
    <pre id="log"></pre>
    <script type="module">
      document.querySelector('noizu-plan-compare').addEventListener('plan-select', (event) => {
        document.querySelector('#log').textContent = JSON.stringify(event.detail);
        // Host-owned: location.assign(event.detail.checkoutUrl). Do not create Stripe sessions here.
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
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
