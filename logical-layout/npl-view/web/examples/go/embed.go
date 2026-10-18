// net/http host: serve <tobor-npl-view>.
// go run embed.go
// No kit API. Host-owned: set source. Never put secrets on the element.
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
    <title>tobor-npl-view</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/npl-view/npl-view.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <h1>NPL view</h1>
    <div class="demo-frame">
      <tobor-npl-view id="npl"></tobor-npl-view>
    </div>
    <pre id="log"></pre>
    <script type="module">
      const el = document.querySelector('#npl');
      const log = document.querySelector('#log');
      el.source = [
        '⌜NPL@1.0⌝',
        '',
        '# Syntax',
        'Greet {user.name} with [...:1sentence| warm].',
        'Use 🎯 care.',
        '',
        '# Agent',
        '⌜guide|agent|NPL@1.0⌝',
        'You are a helpful guide.',
        '⌞guide⌟',
        '',
      ].join('\n');
      el.addEventListener('npl-copy', (event) => {
        log.textContent = JSON.stringify({copy: event.detail});
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
	log.Println("npl-view host http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}
