// Host page + reverse-proxy for <tobor-guide-panel>.
//
// GET /api/tobor-kit/guide (config projection, no NPL preamble) and the rest
// of the Guide API live in github.com/the-robot-lives/tobor-kit/go/internal/server
// — or the Elixir reference. Do not reimplement them here.
package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

const page = `<!doctype html>
<html lang="en">
  <body>
    <div class="demo-frame">
      <tobor-guide-panel id="guide" base-url="/api/tobor-kit" placement="floating"></tobor-guide-panel>
    </div>
    <script type="module">
      import "/assets/tobor-kit/guide-panel.js";
      const el = document.getElementById("guide");
      el.token = window.__TOBOR_ACCESS_TOKEN;
      el.addEventListener("tobor-turn-submitted", (event) => {
        console.debug("turn", event.detail);
      });
    </script>
  </body>
</html>`

func main() {
	upstreamRaw := getenv("TOBOR_KIT_UPSTREAM", "http://127.0.0.1:8080")
	upstream, err := url.Parse(upstreamRaw)
	if err != nil {
		log.Fatal(err)
	}
	// Streams SSE (POST /sessions/{id}/turn) without buffering.
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
	mux.Handle("/api/tobor-kit/", proxy)
	// Or mount the in-repo server instead of proxying:
	// mux.Handle("/api/tobor-kit/", server.New(cfg))

	log.Fatal(http.ListenAndServe(getenv("LISTEN", "127.0.0.1:8090"), mux))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
