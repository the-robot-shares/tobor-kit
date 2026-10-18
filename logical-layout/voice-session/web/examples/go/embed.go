// Host page + reverse-proxy for <tobor-voice-session>.
//
// Production Guide API: elixir/ (reference) and go/ (this repo's port).
// This file serves the mount page and proxies /api/tobor-kit so
// POST /voice/token hits the real mint. It does not mint credentials.
//
//	go run ./cmd/tobor-kit-go \
//	  -guide ../schema/examples/deploy-guide.guide.yaml \
//	  -bundle ../compiler/test/tobor_kit/golden/deploy-guide.bundle.json
package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

const page = `<!doctype html>
<meta charset="utf-8"/>
<title>tobor-voice-session</title>
<tobor-voice-session id="voice"></tobor-voice-session>
<script type="module">
  import {ToborKitClient} from "https://cdn.derobot.is/tobor-kit/latest/client.js";
  import "https://cdn.derobot.is/tobor-kit/latest/components/voice-session/voice-session.js";
  const el = document.getElementById("voice");
  el.client = new ToborKitClient({
    baseUrl: "/api/tobor-kit",
    token: () => sessionStorage.getItem("tobor-access-token"),
  });
  el.voice = {adapter: "native", locale: "en-US"};
</script>
`

func main() {
	upstreamRaw := getenv("TOBOR_KIT_UPSTREAM", "http://127.0.0.1:8080")
	upstream, err := url.Parse(upstreamRaw)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(upstream)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	// Contract prefix — POST /voice/token (409 native, 503 disabled).
	mux.Handle("/api/tobor-kit/", proxy)

	addr := getenv("TOBOR_KIT_HOST_ADDR", ":8090")
	log.Printf("host page %s  proxy /api/tobor-kit -> %s", addr, upstreamRaw)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
