// Package telemetry resolves consent, governs content capture, and opens the
// per-exchange OTel span.
//
// Rules encoded by the contract:
//
//   - A turn is never logged with content unless resolved consent is on.
//   - Resolved consent: explicit user record wins; otherwise the guide
//     default; when user_overridable is false the guide setting is binding
//     (source "forced").
//   - Content attributes are attached ONLY when consent resolves on, and
//     telemetry.redact[] regexes are applied even when consent is on.
package telemetry

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
)

// Source values per the TelemetryConsent schema.
const (
	SourceUser    = "user"
	SourceDefault = "default"
	SourceForced  = "forced"
)

// Consent is the resolved TelemetryConsent payload.
type Consent struct {
	Enabled         bool    `json:"enabled"`
	Source          string  `json:"source"`
	UserOverridable bool    `json:"user_overridable"`
	Capture         Capture `json:"capture,omitempty"`
}

// Capture mirrors the guide's capture flags.
type Capture struct {
	Prompt      bool `json:"prompt,omitempty"`
	Response    bool `json:"response,omitempty"`
	ToolArgs    bool `json:"tool_args,omitempty"`
	ToolResults bool `json:"tool_results,omitempty"`
}

// Identity is the caller the consent record binds to: the authenticated user,
// or an opaque client id for anonymous callers.
type Identity struct {
	ID    string
	Email string
	Name  string
}

// Key is the stable consent-record key for the identity.
func (i Identity) Key() string {
	if i.ID == "" {
		return "anonymous"
	}
	return i.Kind() + ":" + i.ID
}

// Kind reports user vs client identity.
func (i Identity) Kind() string {
	if i.Email != "" || i.Name != "" {
		return "user"
	}
	return "client"
}

// OpaqueClientID derives a stable anonymous id from a bearer token without
// trusting its contents.
func OpaqueClientID(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:16])
}

// Preferences stores explicit user consent records.
type Preferences interface {
	Get(key string) (enabled, ok bool)
	Set(key string, enabled bool) error
}

// MemoryPreferences is the in-memory consent store.
type MemoryPreferences struct {
	mu    sync.Mutex
	prefs map[string]bool
}

// NewMemoryPreferences builds an empty preference store.
func NewMemoryPreferences() *MemoryPreferences {
	return &MemoryPreferences{prefs: map[string]bool{}}
}

func (m *MemoryPreferences) Get(key string) (bool, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.prefs[key]
	return v, ok
}

func (m *MemoryPreferences) Set(key string, enabled bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.prefs[key] = enabled
	return nil
}

// Service resolves consent and opens spans for one guide.
type Service struct {
	guide  *guide.Guide
	prefs  Preferences
	redact []*regexp.Regexp
}

// New builds the service, compiling the guide's redact patterns (uncompilable
// patterns are skipped — fail-open toward NOT capturing, never toward capture).
func New(g *guide.Guide, prefs Preferences) *Service {
	var rs []*regexp.Regexp
	for _, p := range g.Telemetry.Redact {
		if re, err := regexp.Compile(p); err == nil {
			rs = append(rs, re)
		}
	}
	if prefs == nil {
		prefs = NewMemoryPreferences()
	}
	return &Service{guide: g, prefs: prefs, redact: rs}
}

// Resolve computes the consent governing this caller.
func (s *Service) Resolve(id Identity) Consent {
	overridable := s.guide.Telemetry.UserOverridable
	capture := Capture{
		Prompt:      s.guide.Telemetry.Capture.Prompt,
		Response:    s.guide.Telemetry.Capture.Response,
		ToolArgs:    s.guide.Telemetry.Capture.ToolArgs,
		ToolResults: s.guide.Telemetry.Capture.ToolResults,
	}
	if !overridable {
		return Consent{
			Enabled:         s.guide.Telemetry.Enabled,
			Source:          SourceForced,
			UserOverridable: false,
			Capture:         capture,
		}
	}
	if enabled, ok := s.prefs.Get(id.Key()); ok {
		return Consent{Enabled: enabled, Source: SourceUser, UserOverridable: true, Capture: capture}
	}
	return Consent{
		Enabled:         s.guide.Telemetry.Default == "on",
		Source:          SourceDefault,
		UserOverridable: true,
		Capture:         capture,
	}
}

// Record stores an explicit preference. Returns false when the guide does not
// allow user override (the PUT 403 path).
func (s *Service) Record(id Identity, enabled bool) (Consent, bool) {
	if !s.guide.Telemetry.UserOverridable {
		return s.Resolve(id), false
	}
	_ = s.prefs.Set(id.Key(), enabled)
	c := s.Resolve(id)
	c.Source = SourceUser
	c.Enabled = enabled
	return c, true
}

// Redact applies every configured redact pattern. It runs even when consent
// is on.
func (s *Service) Redact(v string) string {
	for _, re := range s.redact {
		v = re.ReplaceAllString(v, "[REDACTED]")
	}
	return v
}

// Span opens the per-exchange span. Content attributes (prompt, response,
// tool_args, tool_results) are attached only when consent resolves on AND the
// corresponding capture flag is set, and always pass through Redact first.
// Non-content attributes (guide slug, session id, state) are always attached.
func (s *Service) Span(
	ctx context.Context,
	tracer trace.Tracer,
	id Identity,
	consent Consent,
	sessionID string,
	content Content,
) (trace.Span, context.Context) {
	attrs := []attribute.KeyValue{
		attribute.String("tobor.guide", s.guide.Core.Slug),
		attribute.String("tobor.session_id", sessionID),
		attribute.Bool("tobor.telemetry.consent", consent.Enabled),
		attribute.String("tobor.telemetry.source", consent.Source),
	}
	if consent.Enabled {
		if content.Prompt != "" && consent.Capture.Prompt {
			attrs = append(attrs, attribute.String("tobor.prompt", s.Redact(content.Prompt)))
		}
		if content.Response != "" && consent.Capture.Response {
			attrs = append(attrs, attribute.String("tobor.response", s.Redact(content.Response)))
		}
		if content.ToolArgs != "" && consent.Capture.ToolArgs {
			attrs = append(attrs, attribute.String("tobor.tool_args", s.Redact(content.ToolArgs)))
		}
		if content.ToolResults != "" && consent.Capture.ToolResults {
			attrs = append(attrs, attribute.String("tobor.tool_results", s.Redact(content.ToolResults)))
		}
	}
	spanCtx, span := tracer.Start(ctx, "tobor-kit.turn", trace.WithAttributes(attrs...))
	return span, spanCtx
}

// Content carries the exchange content eligible for capture.
type Content struct {
	Prompt      string
	Response    string
	ToolArgs    string
	ToolResults string
}
