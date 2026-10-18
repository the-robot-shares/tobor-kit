// Host-owned login-flow page + OIDC callback.
//
// Prefer kit helpers in go/internal/auth (NormalizeIssuer, Discover, StartFlow,
// AuthorizeURL, Exchange). That package is internal/ — drop this file into a
// cmd of github.com/the-robot-lives/tobor-kit/go, or copy the HTTP surface
// into the host and call those helpers from the same module.
//
// Public config only on the page. Never a client secret. Host owns cookies.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	kitauth "github.com/the-robot-lives/tobor-kit/go/internal/auth"
)

const redirectPath = "/auth/oidc/callback"

func main() {
	store := kitauth.NewStateStore()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", servePage)
	mux.HandleFunc("GET /auth/oidc", start(store))
	mux.HandleFunc("GET "+redirectPath, callback(store))
	mux.HandleFunc("POST /auth/session", sessionMint)
	log.Fatal(http.ListenAndServe(":8080", mux))
}

func publicAuth() map[string]any {
	return map[string]any{
		"required":      true,
		"provider":      "authentik",
		"issuer":        os.Getenv("TOBOR_KIT_OIDC_ISSUER"),
		"client_id":     os.Getenv("TOBOR_KIT_OIDC_CLIENT_ID"),
		"scopes":        []string{"openid", "email", "profile"},
		"redirect_path": redirectPath,
	}
}

func servePage(w http.ResponseWriter, _ *http.Request) {
	raw, _ := json.Marshal(publicAuth())
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!doctype html>
<html lang="en"><body>
<tobor-login-flow id="login"></tobor-login-flow>
<script type="module">
  import 'https://cdn.derobot.is/tobor-kit/latest/components/login-flow/login-flow.js';
  const el = document.getElementById('login');
  el.auth = ` + string(raw) + `;
  el.addEventListener('tobor-auth-token', async (e) => {
    await fetch('/auth/session', {
      method: 'POST', credentials: 'same-origin',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({id_token: e.detail.tokens.id_token}),
    });
  });
</script>
</body></html>`))
}

func start(store *kitauth.StateStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ch, err := kitauth.StartFlow()
		if err != nil {
			http.Error(w, "oidc start failed", http.StatusBadGateway)
			return
		}
		store.Put(ch)
		p, err := kitauth.Discover(r.Context(), http.DefaultClient, os.Getenv("TOBOR_KIT_OIDC_ISSUER"))
		if err != nil {
			http.Error(w, "discovery failed", http.StatusBadGateway)
			return
		}
		url := kitauth.AuthorizeURL(p, os.Getenv("TOBOR_KIT_OIDC_CLIENT_ID"), os.Getenv("TOBOR_KIT_OIDC_REDIRECT_URI"),
			[]string{"openid", "email", "profile"}, ch)
		http.Redirect(w, r, url, http.StatusFound)
	}
}

func callback(store *kitauth.StateStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ch, err := store.Compare(r.URL.Query().Get("state"))
		if err != nil {
			http.Redirect(w, r, "/?login=error", http.StatusFound)
			return
		}
		p, err := kitauth.Discover(r.Context(), http.DefaultClient, os.Getenv("TOBOR_KIT_OIDC_ISSUER"))
		if err != nil {
			http.Error(w, "discovery failed", http.StatusBadGateway)
			return
		}
		tokens, err := kitauth.Exchange(r.Context(), http.DefaultClient, p.TokenEndpoint,
			os.Getenv("TOBOR_KIT_OIDC_CLIENT_ID"), os.Getenv("TOBOR_KIT_OIDC_REDIRECT_URI"),
			r.URL.Query().Get("code"), ch)
		if err != nil {
			http.Redirect(w, r, "/?login=error", http.StatusFound)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name: "tobor_session", Value: tokens.IDToken, Path: "/",
			HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
		})
		http.Redirect(w, r, "/", http.StatusFound)
	}
}

func sessionMint(w http.ResponseWriter, r *http.Request) {
	// Host-owned: verify id_token (JWKS) then Set-Cookie. Never a client secret.
	_ = r
	w.WriteHeader(http.StatusNoContent)
}
