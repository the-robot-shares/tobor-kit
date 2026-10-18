// Host snippet: serve a page that mounts <noizu-faq> with slotted details.
// No FAQ API. Host-owned: persist faq-toggle in page JS if you want analytics.
package main

import (
	"log"
	"net/http"
)

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-faq</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/faq/noizu-faq.js"></script>
  </head>
  <body>
    <h1>FAQ</h1>
    <noizu-faq mode="many">
      <details>
        <summary>What is this?</summary>
        <p>A Light DOM island that decorates slotted native details/summary.</p>
      </details>
      <details>
        <summary>Does the host need a backend?</summary>
        <p>No. The island is host-only markup.</p>
      </details>
      <details>
        <summary>Can only one item stay open?</summary>
        <p>Set <code>mode="one"</code> for accordion behavior.</p>
      </details>
    </noizu-faq>
  </body>
</html>`

func FaqPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(page))
}

func main() {
	http.HandleFunc("/", FaqPage)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
