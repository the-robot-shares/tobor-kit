// Go host: serve /auth/invite-required and a stub POST /api/v1/invites/redeem.
// go run embed.go → http://localhost:8080/auth/invite-required
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>invite required</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/invite-gate/noizu-invite-gate.js"></script>
</head><body><noizu-invite-gate brand="therobotplans" sign-out-url="/logout"></noizu-invite-gate></body></html>`

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func main() {
	http.HandleFunc("/auth/invite-required", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	// Stub. The real handler authenticates the session, is exempt from the invite
	// gate, is rate-limited, and redeems in one transaction.
	http.HandleFunc("/api/v1/invites/redeem", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Token string `json:"token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		switch req.Token {
		case "GOOD-INVITE":
			writeJSON(w, 200, map[string]any{"organization_id": "org-1", "role": "member", "invite_required": false})
		case "USED-INVITE":
			writeJSON(w, 409, map[string]string{"error": "This invite has already been used"})
		default:
			writeJSON(w, 404, map[string]string{"error": "Invalid or expired invite token"})
		}
	})
	log.Fatal(http.ListenAndServe(":8080", nil))
}
