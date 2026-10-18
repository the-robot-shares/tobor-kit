package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
	"github.com/the-robot-lives/tobor-kit/go/internal/telemetry"
)

type identityKey struct{}

// IdentityFrom returns the identity a previous Authenticate bound, if any.
func IdentityFrom(ctx context.Context) (telemetry.Identity, bool) {
	id, ok := ctx.Value(identityKey{}).(telemetry.Identity)
	return id, ok
}

// Middleware returns the auth middleware for the guide.
func Middleware(g *guide.Guide) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id, ok := bearerIdentity(r)
			if !ok && g.Auth.Required {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"code":"unauthorized","message":"missing or invalid bearer token"}`))
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), identityKey{}, id)))
		})
	}
}

// bearerIdentity extracts the caller identity. Anonymous callers get a stable
// client id derived from the X-Client-Id header (unauthenticated mode) or the
// literal "anonymous".
func bearerIdentity(r *http.Request) (telemetry.Identity, bool) {
	h := r.Header.Get("Authorization")
	if tok, ok := strings.CutPrefix(h, "Bearer "); ok && strings.TrimSpace(tok) != "" {
		return telemetry.Identity{ID: telemetry.OpaqueClientID(strings.TrimSpace(tok))}, true
	}
	if cid := r.Header.Get("X-Client-Id"); cid != "" {
		return telemetry.Identity{ID: "client-" + telemetry.OpaqueClientID(cid)}, false
	}
	return telemetry.Identity{}, false
}
