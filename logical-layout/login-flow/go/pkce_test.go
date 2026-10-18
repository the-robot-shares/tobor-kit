package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNormalizeIssuer(t *testing.T) {
	cases := map[string]string{
		"https://auth.example.com/application/o/tobor-kit/": "https://auth.example.com/application/o/tobor-kit",
		"https://auth.example.com/application/o/tobor-kit":  "https://auth.example.com/application/o/tobor-kit",
		"https://auth.example.com///":                       "https://auth.example.com",
	}
	for in, want := range cases {
		if got := NormalizeIssuer(in); got != want {
			t.Errorf("NormalizeIssuer(%q) = %q, want %q", in, got, want)
		}
	}
}

// Authentik per-provider issuers: discovery with a trailing slash 404s unless
// normalized.
func TestDiscoveryNormalizesTrailingSlash(t *testing.T) {
	var gotPath string
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(Provider{
			Issuer:                "x",
			AuthorizationEndpoint: srv.URL + "/authorize",
			TokenEndpoint:         srv.URL + "/token",
		})
	}))
	defer srv.Close()

	issuer := srv.URL + "/application/o/tobor-kit/"
	p, err := Discover(context.Background(), srv.Client(), issuer)
	if err != nil {
		t.Fatalf("discover: %v", err)
	}
	if gotPath != "/application/o/tobor-kit/.well-known/openid-configuration" {
		t.Fatalf("discovery path = %q", gotPath)
	}
	if p.TokenEndpoint != srv.URL+"/token" {
		t.Fatalf("token endpoint = %q", p.TokenEndpoint)
	}
}

func TestStartFlowShape(t *testing.T) {
	c, err := StartFlow()
	if err != nil {
		t.Fatal(err)
	}
	if len(c.State) < 20 || len(c.Nonce) < 20 || len(c.Verifier) < 40 {
		t.Fatalf("flow entropy too small: state=%d nonce=%d verifier=%d", len(c.State), len(c.Nonce), len(c.Verifier))
	}
	// Challenge must be base64url(SHA256(verifier)) unpadded, method S256.
	if got := s256(c.Verifier); got != c.Challenge {
		t.Fatalf("challenge mismatch: %s vs %s", got, c.Challenge)
	}
	if c.ChallengeMethod != "S256" {
		t.Fatalf("method = %s", c.ChallengeMethod)
	}
	// Uniqueness across flows.
	c2, _ := StartFlow()
	if c2.State == c.State || c2.Verifier == c.Verifier {
		t.Fatal("flows must be unique")
	}
}

func TestStateStoreConsumeOnceAndConstantTime(t *testing.T) {
	s := NewStateStore()
	c, _ := StartFlow()
	s.Put(c)

	got, err := s.Compare(c.State)
	if err != nil {
		t.Fatalf("first compare: %v", err)
	}
	if got.Verifier != c.Verifier {
		t.Fatal("verifier lost")
	}
	// Second use must fail: state cleared before the exchange runs.
	if _, err := s.Compare(c.State); err == nil {
		t.Fatal("replayed state must be rejected")
	}
	// Wrong state fails.
	if _, err := s.Compare("totally-bogus"); err == nil {
		t.Fatal("bogus state must be rejected")
	}
}

func TestAuthorizeURLShape(t *testing.T) {
	c, _ := StartFlow()
	u := AuthorizeURL(Provider{AuthorizationEndpoint: "https://idp/authorize"}, "client-x", "https://app/cb", []string{"openid", "email"}, c)
	q := mustQuery(t, u, "https://idp/authorize")
	for k, want := range map[string]string{
		"response_type":         "code",
		"client_id":             "client-x",
		"redirect_uri":          "https://app/cb",
		"scope":                 "openid email",
		"code_challenge_method": "S256",
	} {
		if q.Get(k) != want {
			t.Errorf("%s = %q, want %q", k, q.Get(k), want)
		}
	}
	if q.Get("code_challenge") != c.Challenge || q.Get("state") != c.State || q.Get("nonce") != c.Nonce {
		t.Fatal("challenge/state/nonce not carried")
	}
}

func TestExchangeSendsVerifier(t *testing.T) {
	c, _ := StartFlow()
	var gotForm map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		gotForm = map[string]string{}
		for k := range r.PostForm {
			gotForm[k] = r.PostForm.Get(k)
		}
		_ = json.NewEncoder(w).Encode(Tokens{AccessToken: "at", IDToken: idToken(c.Nonce), ExpiresIn: 300})
	}))
	defer srv.Close()

	toks, err := Exchange(context.Background(), srv.Client(), srv.URL, "client-x", "https://app/cb", "the-code", c)
	if err != nil {
		t.Fatalf("exchange: %v", err)
	}
	if toks.AccessToken != "at" {
		t.Fatal("token not decoded")
	}
	if gotForm["code_verifier"] != c.Verifier {
		t.Fatal("code_verifier missing from exchange")
	}
	if gotForm["code"] != "the-code" || gotForm["grant_type"] != "authorization_code" {
		t.Fatalf("form = %v", gotForm)
	}
	// Nonce check ties the id token to the flow.
	claims, err := ParseIDTokenClaims(toks.IDToken)
	if err != nil {
		t.Fatal(err)
	}
	if !NonceMatch(c, claims) {
		t.Fatal("flow nonce should match its own token")
	}
	c2, _ := StartFlow()
	if NonceMatch(c2, claims) {
		t.Fatal("a foreign flow nonce must not match")
	}
}

func TestExchangeTokenError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant", "error_description": "code expired"})
	}))
	defer srv.Close()
	c, _ := StartFlow()
	if _, err := Exchange(context.Background(), srv.Client(), srv.URL, "c", "r", "code", c); err == nil {
		t.Fatal("expected token error")
	}
}
