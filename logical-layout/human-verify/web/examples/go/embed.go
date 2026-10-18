// Host for <noizu-human-verify>. go run embed.go
// POST /verify → Cloudflare / Google siteverify. Secrets from env only.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-human-verify</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/human-verify/noizu-human-verify.js"></script>
  </head>
  <body>
    <noizu-human-verify provider="none" action="signup"></noizu-human-verify>
    <script type="module">
      const el = document.querySelector('noizu-human-verify');
      el.addEventListener('verified', (event) => {
        fetch('/verify', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(event.detail),
        }).then((r) => r.json()).then((b) => console.info('verify', b));
      });
    </script>
  </body>
</html>`

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", servePage)
	mux.HandleFunc("POST /verify", verify)
	log.Println("noizu-human-verify host http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}

func servePage(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, page)
}

func verify(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Provider string `json:"provider"`
		Token    string `json:"token"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body)
	switch body.Provider {
	case "none":
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "skipped": true})
	case "turnstile":
		siteverify(w, "https://challenges.cloudflare.com/turnstile/v0/siteverify", os.Getenv("TURNSTILE_SECRET"), body.Token, "set TURNSTILE_SECRET")
	case "recaptcha-v3":
		siteverify(w, "https://www.google.com/recaptcha/api/siteverify", os.Getenv("RECAPTCHA_SECRET"), body.Token, "set RECAPTCHA_SECRET")
	default:
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "token required"})
	}
}

func siteverify(w http.ResponseWriter, endpoint, secret, token, hint string) {
	if strings.TrimSpace(secret) == "" {
		writeJSON(w, http.StatusNotImplemented, map[string]any{"ok": false, "error": hint})
		return
	}
	if strings.TrimSpace(token) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "token required"})
		return
	}
	resp, err := http.PostForm(endpoint, url.Values{"secret": {secret}, "response": {token}})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": "siteverify unreachable"})
		return
	}
	defer resp.Body.Close()
	var out struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || !out.Success {
		writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "verification failed", "error-codes": out.ErrorCodes})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
