// Minimal JSON-RPC v1 /auth/socket stub for <noizu-auth>. Not production auth.
// go get github.com/gorilla/websocket
//
// Six-pipe / merge-flow: this stub does not implement merge_required — see
// docs/backend-requirements.md for the {merge_required, challenge_id, pipes:[{type,masked}]}
// contract a real host must add to login/register/otp-verify when the identifier already
// belongs to an account under a different pipe.
package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
	return r.Header.Get("Origin") == "http://"+r.Host || r.Header.Get("Origin") == "https://"+r.Host
}}

type frame struct {
	Version int            `json:"version"`
	ID      string         `json:"id"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params"`
}

func domainOf(v any) string {
	email, _ := v.(string)
	parts := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return ""
	}
	return parts[1]
}

// Toy region check for the demo — real hosts key this off carrier registration status, not a
// dial-code prefix. Kept in sync with the /auth/sms-regions handler below.
var smsSupportedDialPrefixes = []string{"+1", "+44"}

func smsRegionSupported(mobilePhone any) bool {
	value, _ := mobilePhone.(string)
	if value == "" {
		return true
	}
	for _, prefix := range smsSupportedDialPrefixes {
		if strings.HasPrefix(value, prefix) {
			return true
		}
	}
	return false
}

func mobilePhoneOf(params map[string]any) any {
	if user, ok := params["user"].(map[string]any); ok {
		if v, ok := user["mobile_phone"]; ok {
			return v
		}
	}
	return params["mobile_phone"]
}

func handleAuthRPC(f frame) map[string]any {
	// Server-side gate — authoritative regardless of the element's client-side `smsRegions`
	// allowlist. See docs/backend-requirements.md's `sms_region_unsupported` contract.
	if f.Method == "login" || f.Method == "register" || f.Method == "otp-request" {
		if mobile := mobilePhoneOf(f.Params); mobile != nil && !smsRegionSupported(mobile) {
			return map[string]any{"id": f.ID, "error": map[string]string{"code": "sms_region_unsupported", "message": "SMS is not currently available for this region."}}
		}
	}
	switch f.Method {
	case "config":
		if domainOf(f.Params["email"]) == "noizu.com" {
			return map[string]any{"id": f.ID, "result": map[string]any{
				"providers":       []map[string]string{{"id": "authentik", "label": "Continue with Authentik", "href": "/auth/authentik/start"}},
				"domain_policies": map[string]any{"noizu.com": map[string]any{"providers": []string{"authentik"}}},
				"methods":         []string{},
			}}
		}
		methods := []string{}
		if domainOf(f.Params["email"]) != "" {
			methods = []string{"password"}
		}
		return map[string]any{"id": f.ID, "result": map[string]any{"providers": []any{}, "domain_policies": map[string]any{}, "methods": methods}}
	case "magic-link":
		return map[string]any{"id": f.ID, "result": map[string]any{"status": "pending"}}
	case "otp-request":
		return map[string]any{"id": f.ID, "result": map[string]any{}}
	case "login", "register", "otp-verify":
		return map[string]any{"id": f.ID, "result": map[string]any{"redirect": "/auth/session/finish?code=one-time-host-code"}}
	default:
		return map[string]any{"id": f.ID, "error": map[string]string{"code": "invalid_request", "message": "Invalid authentication request."}}
	}
}

func main() {
	http.HandleFunc("/auth/sms-regions", func(w http.ResponseWriter, r *http.Request) {
		// Host-owned public config, not part of the /auth/socket RPC surface.
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"supported": []string{"US", "CA", "GB"}, "message": "SMS is not currently available for this region."})
	})
	http.HandleFunc("/auth/session/finish", func(w http.ResponseWriter, r *http.Request) {
		// HTTP handoff — the only place a session cookie is set. Never on the websocket.
		http.SetCookie(w, &http.Cookie{Name: "host_session", Value: "stub", HttpOnly: true, Path: "/", SameSite: http.SameSiteLaxMode})
		http.Redirect(w, r, "/app", http.StatusSeeOther)
	})
	http.HandleFunc("/auth/socket", func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()
		for {
			_, data, err := c.ReadMessage()
			if err != nil {
				return
			}
			var f frame
			if json.Unmarshal(data, &f) != nil || f.Version != 1 || f.ID == "" {
				_ = c.WriteJSON(map[string]any{"id": f.ID, "error": map[string]string{"code": "invalid_request", "message": "Invalid authentication request."}})
				continue
			}
			_ = c.WriteJSON(handleAuthRPC(f))
		}
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<!doctype html><meta charset="utf-8"><noizu-auth endpoint="/auth/socket"></noizu-auth>`))
	})
	_ = http.ListenAndServe(":8080", nil)
}

// ---------------------------------------------------------------------------
// REST transport option (`transport="rest"`) — the same element, a different wire.
// Most portfolio apps already expose a JSON auth API with Bearer-token sessions instead of
// this WebSocket. Mount the element with transport="rest" api-base="/api/v1" and implement:
//
//   POST {apiBase}/auth/login                  {email, password}
//   POST {apiBase}/auth/register               {user: {email, password, user_name, first_name, last_name, mobile_phone?}, invite_token?}
//   (Element invite-token-mode="required" is UX only — reject token-less register server-side.)
//   POST {apiBase}/auth/mobile/login           {mobile, password}
//   POST {apiBase}/auth/mobile/register        {mobile, password, code, user_name?}
//   POST {apiBase}/auth/otp/email/start        {email}                      -> 202 {status:'sent'}
//   POST {apiBase}/auth/otp/mobile/start       {mobile}                     -> 202 {status:'sent'}
//   POST {apiBase}/auth/otp/email/verify       {email, code}
//   POST {apiBase}/auth/otp/mobile/verify      {mobile, code}
//   GET  {apiBase}/auth/merge/:challenge_id    -> masked description
//   POST {apiBase}/auth/merge/confirm          {challenge_id, proof:{pipe, identifier, password|code}}
//   GET  {apiBase}/auth/config                 optional; any failure degrades to no providers
//
// Success (200 existing / 201 created):
//   {user, organizations, access_token, refresh_token, expires_in}
// Merge challenge: HTTP 409
//   {status:'merge_required', merge_challenge_id, expires_at,
//    available_pipes:[{pipe:'password_email', identifier:'g******@gmail.com'}]}
//   Backend pipe names (password_email / otp_mobile) map to the element's
//   email_password / mobile_otp. `identifier` MUST already be masked.
// Region not SMS-deliverable: HTTP 422 {"error":"sms_region_unsupported"}
//   (the 422 analogue of this socket's error.code of the same name).
// Other errors: {"error":"<code>"} + status — invalid_credentials, invalid_code,
//   expired_code, too_many_attempts, rate_limited, pipe_not_permitted,
//   merge_not_authorized, not_found, invalid_identifier, invalid_password.
//
// The element sends NO cookies in REST mode (credentials: "omit") unless
// with-credentials is set, and it NEVER stores the returned tokens — they arrive
// on auth-success / noizu-auth-success as event.detail.session and the host decides
// where they live. See docs/backend-requirements.md.
