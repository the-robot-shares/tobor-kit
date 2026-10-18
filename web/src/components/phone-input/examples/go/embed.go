// Host snippet: serve a page that mounts <noizu-phone-input>.
// No phone API. Host-owned: uniqueness / OTP. Never put secrets on the element.
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
    <title>noizu-phone-input</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/phone-input/noizu-phone-input.js"></script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; background: #12131a; color: #e8e9f0; }
    </style>
  </head>
  <body>
    <h1>Phone</h1>
    <noizu-phone-input country="US" name="phone"></noizu-phone-input>
    <pre id="log"></pre>
    <script type="module">
      const el = document.querySelector('noizu-phone-input');
      const log = document.querySelector('#log');
      for (const name of ['country-change', 'phone-change', 'phone-invalid']) {
        el.addEventListener(name, (event) => {
          log.textContent = name + ' ' + JSON.stringify(event.detail);
        });
      }
    </script>
  </body>
</html>`

func PhoneInputPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(page))
}

func main() {
	http.HandleFunc("/", PhoneInputPage)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
