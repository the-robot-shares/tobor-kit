package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"testing"
)

func s256(v string) string {
	sum := sha256.Sum256([]byte(v))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func mustQuery(t *testing.T, raw, base string) url.Values {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("authorize url: %v", err)
	}
	if u.String()[:len(base)] != base {
		t.Fatalf("base = %q", u.String())
	}
	return u.Query()
}

// idToken mints an unsigned JWT carrying the given nonce.
func idToken(nonce string) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none"}`))
	payload, _ := json.Marshal(map[string]string{"nonce": nonce})
	body := base64.RawURLEncoding.EncodeToString(payload)
	return header + "." + body + "."
}
