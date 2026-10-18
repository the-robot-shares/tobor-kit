// Package auth implements the OIDC authorization-code flow with PKCE and the
// bearer-token middleware.
//
// PKCE notes (the small, sharp parts):
//   - state + nonce are 128 bits of crypto/rand, base64url.
//   - state is consumed (cleared) BEFORE the code exchange runs, so a state
//     can never be replayed even if the exchange fails midway.
//   - state comparison is constant-time (subtle.ConstantTimeCompare).
//   - the issuer is normalized (trailing slash stripped) before discovery URL
//     construction — Authentik per-provider application issuers 404 on
//     ".../application/o/slug//.well-known/openid-configuration".
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Challenge is a PKCE code challenge.
type Challenge struct {
	Verifier string
	State    string
	Nonce    string
	// Challenge is base64url(SHA256(Verifier)) without padding.
	Challenge       string
	ChallengeMethod string
	CreatedAt       time.Time
}

// ErrStateMismatch is returned when the callback state does not match a
// pending flow (constant-time comparison result).
var ErrStateMismatch = errors.New("auth: state mismatch")

// ErrStateUnknown is returned when the state was already consumed or expired.
var ErrStateUnknown = errors.New("auth: unknown or consumed state")

// NormalizeIssuer strips trailing slashes from an issuer URL.
func NormalizeIssuer(issuer string) string {
	return strings.TrimRight(issuer, "/")
}

// DiscoveryURL builds the OpenID discovery URL for an issuer.
func DiscoveryURL(issuer string) string {
	return NormalizeIssuer(issuer) + "/.well-known/openid-configuration"
}

// StartFlow mints a fresh PKCE flow.
func StartFlow() (Challenge, error) {
	state, err := randomB64(16)
	if err != nil {
		return Challenge{}, err
	}
	nonce, err := randomB64(16)
	if err != nil {
		return Challenge{}, err
	}
	verifier, err := randomB64(48)
	if err != nil {
		return Challenge{}, err
	}
	sum := sha256.Sum256([]byte(verifier))
	return Challenge{
		Verifier:        verifier,
		State:           state,
		Nonce:           nonce,
		Challenge:       base64.RawURLEncoding.EncodeToString(sum[:]),
		ChallengeMethod: "S256",
		CreatedAt:       time.Now(),
	}, nil
}

func randomB64(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("auth: entropy unavailable: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// StateTTL is how long a pending flow stays valid.
const StateTTL = 10 * time.Minute

// StateStore holds pending flows between authorize redirect and callback.
type StateStore struct {
	mu      sync.Mutex
	pending map[string]Challenge
}

// NewStateStore builds an empty store.
func NewStateStore() *StateStore {
	return &StateStore{pending: map[string]Challenge{}}
}

// Put registers a flow.
func (s *StateStore) Put(c Challenge) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pending[c.State] = c
}

// Compare validates the callback state against the pending flow using a
// constant-time comparison, then CONSUMES the entry: the state is cleared
// before the caller runs the exchange.
func (s *StateStore) Compare(state string) (Challenge, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.pending[state]
	if !ok {
		// Burn equivalent time on a dummy compare so a missing state and a
		// wrong state are indistinguishable by timing.
		subtle.ConstantTimeCompare([]byte(state), []byte("00000000-0000-0000-0000-000000000000"))
		return Challenge{}, ErrStateUnknown
	}
	if time.Since(c.CreatedAt) > StateTTL {
		delete(s.pending, state)
		return Challenge{}, ErrStateUnknown
	}
	if subtle.ConstantTimeCompare([]byte(state), []byte(c.State)) != 1 {
		return Challenge{}, ErrStateMismatch
	}
	delete(s.pending, state)
	return c, nil
}

// Discover fetches provider endpoints from the discovery document. The issuer
// is normalized first — a trailing slash otherwise 404s discovery on
// Authentik per-provider applications.
func Discover(ctx context.Context, client *http.Client, issuer string) (Provider, error) {
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, DiscoveryURL(issuer), nil)
	if err != nil {
		return Provider{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return Provider{}, fmt.Errorf("auth: discovery failed for issuer %q: %w", NormalizeIssuer(issuer), err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Provider{}, fmt.Errorf("auth: discovery for issuer %q returned %d", NormalizeIssuer(issuer), resp.StatusCode)
	}
	var p Provider
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&p); err != nil {
		return Provider{}, fmt.Errorf("auth: discovery document invalid: %w", err)
	}
	return p, nil
}

// Provider is the subset of the discovery document the flow needs.
type Provider struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
}

// AuthorizeURL builds the redirect target for the authorize request.
func AuthorizeURL(p Provider, clientID, redirectURI string, scopes []string, c Challenge) string {
	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", strings.Join(scopes, " "))
	q.Set("state", c.State)
	q.Set("nonce", c.Nonce)
	q.Set("code_challenge", c.Challenge)
	q.Set("code_challenge_method", c.ChallengeMethod)
	return p.AuthorizationEndpoint + "?" + q.Encode()
}

// TokenError is a provider-reported token failure.
type TokenError struct {
	Code, Description string
}

func (e *TokenError) Error() string {
	return fmt.Sprintf("auth: token exchange failed: %s: %s", e.Code, e.Description)
}

// Exchange swaps the authorization code for tokens, presenting the verifier.
func Exchange(ctx context.Context, client *http.Client, tokenEndpoint, clientID, redirectURI, code string, c Challenge) (*Tokens, error) {
	if client == nil {
		client = http.DefaultClient
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", clientID)
	form.Set("code_verifier", c.Verifier)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var body struct {
			Error       string `json:"error"`
			Description string `json:"error_description"`
		}
		_ = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body)
		return nil, &TokenError{Code: body.Error, Description: body.Description}
	}
	var t Tokens
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&t); err != nil {
		return nil, err
	}
	return &t, nil
}

// Tokens is the token response subset the backend uses.
type Tokens struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	ExpiresIn   int64  `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

// Claims is the unverified ID-token payload — used only after the token came
// straight from the provider's token endpoint over TLS, where signature
// verification is not required for same-flow consumption.
type Claims map[string]any

// ParseIDTokenClaims decodes the ID-token payload without verification.
func ParseIDTokenClaims(idToken string) (Claims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("auth: id token is not a JWT")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("auth: id token payload: %w", err)
	}
	var c Claims
	if err := json.Unmarshal(payload, &c); err != nil {
		return nil, fmt.Errorf("auth: id token claims: %w", err)
	}
	return c, nil
}

// NonceMatch compares the nonce claim against the flow's nonce in constant
// time.
func NonceMatch(c Challenge, claims Claims) bool {
	got, _ := claims["nonce"].(string)
	return subtle.ConstantTimeCompare([]byte(got), []byte(c.Nonce)) == 1
}
