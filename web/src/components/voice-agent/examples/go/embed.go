// Host page + reverse-proxy /voice/ to the Node gateway (backend/).
// Production voice is that gateway, not the Guide API in go/.
// go run ./embed.go  — set VOICE_GATEWAY_URL (default http://127.0.0.1:8081).
package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

const page = `<!doctype html><meta charset="utf-8"><title>tobor-voice-agent</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/voice-agent/voice-agent.js"></script>
<tobor-voice-agent organization="acme" project="app" backend="litellm" engine="tts" model="gpt-4o-mini" label="Voice agent"></tobor-voice-agent>
<script type="module">
  const agent = document.querySelector('tobor-voice-agent');
  agent.backendUrl = location.origin; // same-origin POST /voice/sessions + WS
  agent.tools = []; agent.mcpTools = [];
</script>`

func main() {
	gateway := os.Getenv("VOICE_GATEWAY_URL")
	if gateway == "" {
		gateway = "http://127.0.0.1:8081"
	}
	target, err := url.Parse(gateway)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	// Host-owned: wrap proxy.Director to attach session/OIDC auth. Never copy provider keys to the browser.
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	mux.Handle("/voice/", proxy)
	log.Fatal(http.ListenAndServe(":8091", mux))
}

// Stub alternative (tests only): POST /voice/sessions → 201 {sessionId, websocketUrl}.
// Real turns still need backend/ or a WS that emits ready / transcript / audio / animation.
