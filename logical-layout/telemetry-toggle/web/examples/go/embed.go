package main

import (
	"net/http"
	"os"
)

// Serves the tobor-telemetry-toggle page. GET/PUT /api/tobor-kit/telemetry/consent
// is implemented by github.com/the-robot-lives/tobor-kit/go/internal/server —
// mount that Server alongside this handler. Do not reimplement the resource.
// 403 means the guide default is binding; the element renders nothing.
//
// Host-owned: bearer verification, secrets, persistence.

const page = `<!doctype html>
<meta charset="utf-8">
<title>tobor-telemetry-toggle</title>
<tobor-telemetry-toggle></tobor-telemetry-toggle>
<script type="module">
  import {ToborKitClient} from "https://cdn.derobot.is/tobor-kit/latest/client.js";
  import "https://cdn.derobot.is/tobor-kit/latest/components/telemetry-toggle/telemetry-toggle.js";
  const el = document.querySelector("tobor-telemetry-toggle");
  el.client = new ToborKitClient({
    baseUrl: "/api/tobor-kit",
    token: () => sessionStorage.getItem("tobor-access-token")
  });
  el.addEventListener("tobor-telemetry-change", (e) => {
    console.log("tobor-telemetry-change", e.detail.consent);
  });
</script>`

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /telemetry-toggle", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	// mux.Handle("/", server.New(cfg)) // real Guide API, including /telemetry/consent
	addr := ":8090"
	if v := os.Getenv("LISTEN"); v != "" {
		addr = v
	}
	_ = http.ListenAndServe(addr, mux)
}
