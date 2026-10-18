// Echo host for <noizu-model-config>.
// go run embed.go
// Empty api_key on PATCH keeps the stored key. Never log keys.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
)

type custom struct {
	BaseURL string `json:"base_url"`
	Model   string `json:"model"`
	APIKey  string `json:"api_key,omitempty"`
}

type ai struct {
	Model               string  `json:"model"`
	MonthlyBudgetCents  int     `json:"monthly_budget_cents"`
	UsedCents           int     `json:"used_cents"`
	CustomEndpoint      *custom `json:"custom_endpoint,omitempty"`
}

var mu sync.Mutex
var model = "openai:gpt-4o"
var budget = 1000
var customEP *custom
var storedKey string

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", servePage)
	mux.HandleFunc("GET /api/v1/ai/models", getModels)
	mux.HandleFunc("GET /api/v1/ai/settings", getSettings)
	mux.HandleFunc("PATCH /api/v1/ai/settings", patchSettings)
	log.Println("noizu-model-config host http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", mux))
}

func getModels(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"models": []map[string]string{
		{"provider": "openai", "model": "gpt-4o", "label": "GPT-4o", "spec": "openai:gpt-4o"},
		{"provider": "anthropic", "model": "claude-3-5", "label": "Claude 3.5", "spec": "anthropic:claude-3-5"},
	}})
}

func patchSettings(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body)
	aiBody, _ := body["ai"].(map[string]any)
	if aiBody == nil {
		aiBody = map[string]any{}
	}
	mu.Lock()
	if v, ok := aiBody["model"].(string); ok {
		model = v
	}
	switch v := aiBody["monthly_budget_cents"].(type) {
	case float64:
		budget = int(v)
	case int:
		budget = v
	}
	if raw, ok := aiBody["custom_endpoint"].(map[string]any); ok {
		if k, ok := raw["api_key"].(string); ok && strings.TrimSpace(k) != "" {
			storedKey = k
		}
		base, _ := raw["base_url"].(string)
		mod, _ := raw["model"].(string)
		customEP = &custom{BaseURL: base, Model: mod}
	}
	out := snapshotLocked()
	mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ai": out})
}

func getSettings(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	out := snapshotLocked()
	mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ai": out})
}

func snapshotLocked() ai {
	out := ai{Model: model, MonthlyBudgetCents: budget, UsedCents: 0}
	if customEP != nil {
		c := *customEP
		c.APIKey = mask(storedKey)
		out.CustomEndpoint = &c
	}
	return out
}

func mask(key string) string {
	if key == "" {
		return ""
	}
	tail := key
	if len(key) > 4 {
		tail = key[len(key)-4:]
	}
	return "••••" + tail
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func servePage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(page))
}

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-model-config</title>
    <script type="importmap">
      {"imports":{"lit":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js","lit/decorators.js":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"}}
    </script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <noizu-model-config id="model" catalog-url="/api/v1/ai/models" inherit allow-custom allow-budget></noizu-model-config>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/model-config/noizu-model-config.js';
      const el = document.querySelector('#model');
      const patch = (ai) => fetch('/api/v1/ai/settings', {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        credentials: 'same-origin', body: JSON.stringify({ai})
      });
      fetch('/api/v1/ai/settings', {credentials:'same-origin'}).then(r => r.json()).then(({ai}) => {
        el.value = ai.model || '';
        el.budget = ai.monthly_budget_cents;
        if (ai.custom_endpoint) el.customEndpoint = {
          baseUrl: ai.custom_endpoint.base_url, model: ai.custom_endpoint.model, apiKey: ai.custom_endpoint.api_key
        };
      });
      el.addEventListener('model-change', e => patch({model: e.detail.value}));
      el.addEventListener('budget-change', e => patch({monthly_budget_cents: e.detail.amount}));
      el.addEventListener('custom-endpoint-save', e => {
        const {baseUrl, model, apiKey} = e.detail;
        patch({custom_endpoint: {base_url: baseUrl, model, api_key: apiKey}});
      });
    </script>
  </body>
</html>
`
