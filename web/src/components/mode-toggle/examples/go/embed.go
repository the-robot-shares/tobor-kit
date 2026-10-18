package main

import (
	"log"
	"net/http"
)

// ModeToggleHandler serves a page that mounts <tobor-mode-toggle>
// and listens for tobor-mode-change {mode, previous}.
//
// No backend is required. Host-owned: persist the last mode if you want.
// Never put secrets on this island.
func ModeToggleHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(modeTogglePage))
}

const modeTogglePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tobor-mode-toggle</title>
    <script type="importmap">
      {
        "imports": {
          "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
          "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
        }
      }
    </script>
  </head>
  <body>
    <tobor-mode-toggle id="toggle" mode="text"></tobor-mode-toggle>
    <pre id="log"></pre>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/mode-toggle/mode-toggle.js';
      const el = document.querySelector('#toggle');
      el.modes = ['text', 'voice', 'transcript'];
      el.addEventListener('tobor-mode-change', (event) => {
        document.querySelector('#log').textContent = JSON.stringify(event.detail);
      });
    </script>
  </body>
</html>
`

func main() {
	http.HandleFunc("/", ModeToggleHandler)
	log.Fatal(http.ListenAndServe(":8090", nil))
}
