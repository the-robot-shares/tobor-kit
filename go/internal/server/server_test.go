package server

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/the-robot-lives/tobor-kit/go/internal/bundle"
	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
	"github.com/the-robot-lives/tobor-kit/go/internal/mcp"
	"github.com/the-robot-lives/tobor-kit/go/internal/session"
	"github.com/the-robot-lives/tobor-kit/go/internal/telemetry"
	"github.com/the-robot-lives/tobor-kit/go/internal/transcript"
	"github.com/the-robot-lives/tobor-kit/go/internal/turn"
)

const (
	goldenBundlePath = "../../../compiler/test/tobor_kit/golden/deploy-guide.bundle.json"
	fixtureGuidePath = "../../../schema/examples/deploy-guide.guide.yaml"
	bearer           = "Bearer test-token-1"
)

func loadFixture(t *testing.T) (*guide.Guide, *bundle.Bundle) {
	t.Helper()
	g, err := guide.LoadFile(fixtureGuidePath)
	if err != nil {
		t.Fatalf("guide fixture: %v", err)
	}
	raw, err := os.ReadFile(goldenBundlePath)
	if err != nil {
		t.Fatalf("bundle fixture: %v", err)
	}
	b, err := bundle.Parse(raw)
	if err != nil {
		t.Fatalf("bundle fixture: %v", err)
	}
	return g, b
}

type harness struct {
	t        *testing.T
	g        *guide.Guide
	b        *bundle.Bundle
	sessions *session.Store
	fake     *mcp.Fake
	prefs    *telemetry.MemoryPreferences
	exporter *tracetest.InMemoryExporter
	store    transcript.Store
	runner   turn.Runner
	srv      *httptest.Server
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	g, b := loadFixture(t)
	// A second, non-required server so the degraded[] path is exercisable.
	g.MCP.Servers = append(g.MCP.Servers, guide.MCPServer{ID: "extra", URL: "https://extra.example/mcp", Label: "Extra"})
	h := &harness{
		t:        t,
		g:        g,
		b:        b,
		sessions: session.NewStore(100),
		fake: mcp.NewFake(map[string][]mcp.RawTool{
			"tobor": {
				{Name: "Github.PullCreate", Category: "Github"},
				{Name: "Github.PullMerge", Category: "Github"},
				{Name: "Ticket.Create", Category: "Tickets"},
			},
			"extra": {
				{Name: "Ticket.Read", Category: "Tickets"},
			},
		}, map[string]*mcp.FakeError{"extra": {Msg: "connection refused"}}),
		prefs:    telemetry.NewMemoryPreferences(),
		exporter: tracetest.NewInMemoryExporter(),
	}
	h.mount()
	return h
}

func (h *harness) mount() {
	tp := sdktrace.NewTracerProvider(sdktrace.WithSyncer(h.exporter))
	h.srv = httptest.NewServer(New(Config{
		Guide:      h.g,
		Bundle:     h.b,
		Tracer:     tp.Tracer("test"),
		Sessions:   h.sessions,
		Runner:     h.runnerOrScripted(),
		Inventory:  &mcp.Builder{Guide: h.g, Client: h.fake, Cache: mcp.NewCache(0)},
		Telemetry:  telemetry.New(h.g, h.prefs),
		Transcript: h.store,
	}))
	h.t.Cleanup(h.srv.Close)
}

func (h *harness) runnerOrScripted() turn.Runner {
	if h.runner != nil {
		return h.runner
	}
	return turn.ScriptedRunner{}
}

func (h *harness) do(method, path, body string) *http.Response {
	h.t.Helper()
	var rd *strings.Reader
	if body == "" {
		rd = strings.NewReader("")
	} else {
		rd = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, h.srv.URL+path, rd)
	if err != nil {
		h.t.Fatal(err)
	}
	req.Header.Set("Authorization", bearer)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	return resp
}

func decode(t *testing.T, resp *http.Response, into any) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(into); err != nil {
		t.Fatalf("decode %s: %v", resp.Status, err)
	}
}

// sseEvents parses an SSE body into name/data pairs.
func sseEvents(t *testing.T, resp *http.Response) []struct {
	Name string
	Data map[string]any
} {
	t.Helper()
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content-type = %q", ct)
	}
	var out []struct {
		Name string
		Data map[string]any
	}
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "event: ") {
			out = append(out, struct {
				Name string
				Data map[string]any
			}{Name: strings.TrimPrefix(line, "event: ")})
			continue
		}
		if strings.HasPrefix(line, "data: ") && len(out) > 0 {
			_ = json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &out[len(out)-1].Data)
		}
	}
	if err := sc.Err(); err != nil {
		t.Fatalf("read sse: %v", err)
	}
	return out
}

// ---------------------------------------------------------------------------

func TestGuideProjection(t *testing.T) {
	h := newHarness(t)
	resp := h.do(http.MethodGet, "/api/tobor-kit/guide", "")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	var p guide.Projection
	decode(t, resp, &p)
	if p.Slug != "deploy-guide" || p.Name != "Tobor" || p.Title != "Deployment Guide" {
		t.Fatalf("projection = %+v", p)
	}
	if p.BundleHash != "sha256:092872cb8752dcd3eb54c3f12fc62e910f89f4407d837ee8521ca28747245edf" {
		t.Fatalf("bundle_hash = %s", p.BundleHash)
	}
	if len(p.Modes) != 3 || p.DefaultMode != "text" {
		t.Fatalf("modes = %v default = %q", p.Modes, p.DefaultMode)
	}
	if p.Auth.Required != true || p.Auth.Provider != "authentik" {
		t.Fatalf("auth = %+v", p.Auth)
	}
	if p.Voice.Adapter != "realtime" || p.Transcript.Store != "local" {
		t.Fatalf("voice/transcript = %+v / %+v", p.Voice, p.Transcript)
	}
	if len(p.Capabilities) != 3 {
		t.Fatalf("capabilities = %+v", p.Capabilities)
	}
	// The projection must not leak server-side content.
	if strings.Contains(p.Greeting, "helm-upgrade") {
		t.Fatal("secure block leaked into projection")
	}
}

func TestGuide404WithoutBundle(t *testing.T) {
	g, _ := loadFixture(t)
	h := &harness{t: t, g: g, sessions: session.NewStore(0), prefs: telemetry.NewMemoryPreferences()}
	h.b = nil
	// mount without bundle
	tp := sdktrace.NewTracerProvider()
	h.srv = httptest.NewServer(New(Config{
		Guide: h.g, Sessions: h.sessions, Runner: turn.ScriptedRunner{},
		Inventory: &mcp.Builder{Guide: h.g, Client: mcp.NewFake(nil, nil)},
		Telemetry: telemetry.New(h.g, h.prefs),
	}))
	_ = tp
	defer h.srv.Close()
	resp := h.do(http.MethodGet, "/api/tobor-kit/guide", "")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d", resp.StatusCode)
	}
}

func TestAuthRequired(t *testing.T) {
	h := newHarness(t)
	req, _ := http.NewRequest(http.MethodPost, h.srv.URL+"/api/tobor-kit/sessions", strings.NewReader("{}"))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d, want 401", resp.StatusCode)
	}
}

func TestSessionLifecycle(t *testing.T) {
	h := newHarness(t)

	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)
	if created.ID == "" || created.State != "idle" || created.User == nil {
		t.Fatalf("created = %+v", created)
	}

	var fetched session.Session
	decode(t, h.do(http.MethodGet, "/api/tobor-kit/sessions/"+created.ID, ""), &fetched)
	if fetched.ID != created.ID {
		t.Fatal("fetched id mismatch")
	}

	// resume
	var resumed session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{"resume_id":"`+created.ID+`"}`), &resumed)
	if resumed.ID != created.ID {
		t.Fatal("resume returned a different session")
	}

	if code := h.do(http.MethodDelete, "/api/tobor-kit/sessions/"+created.ID, "").StatusCode; code != http.StatusNoContent {
		t.Fatalf("delete status = %d", code)
	}
	if code := h.do(http.MethodGet, "/api/tobor-kit/sessions/"+created.ID, "").StatusCode; code != http.StatusNotFound {
		t.Fatalf("get-after-delete status = %d", code)
	}
}

// The canonical SSE shape: state → delta(s) → tool_call → tool_result →
// state → exactly one terminal message.
func TestTurnSSEShape(t *testing.T) {
	h := newHarness(t)
	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)

	resp := h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", `{"input":"ship the app"}`)
	events := sseEvents(t, resp)

	want := []string{"state", "delta", "delta", "tool_call", "state", "tool_result", "state", "message"}
	if len(events) != len(want) {
		t.Fatalf("got %d events (%v), want %d", len(events), names(events), len(want))
	}
	for i, w := range want {
		if events[i].Name != w {
			t.Fatalf("event %d = %s, want %s (full: %v)", i, events[i].Name, w, names(events))
		}
	}
	terminal := 0
	for _, ev := range events {
		if ev.Name == "message" || ev.Name == "error" {
			terminal++
		}
	}
	if terminal != 1 {
		t.Fatalf("terminal events = %d, want exactly 1", terminal)
	}
	// terminal message is a full Turn object
	msg := events[len(events)-1].Data
	if msg["role"] != "assistant" || msg["content"] == "" || msg["id"] == "" || msg["created_at"] == nil {
		t.Fatalf("terminal message = %v", msg)
	}
	if _, ok := msg["usage"]; !ok {
		t.Fatal("usage missing on terminal turn")
	}
	// state values are canonical guide states
	if s0 := events[0].Data["state"]; s0 != "thinking" {
		t.Fatalf("first state = %v", s0)
	}
}

func names(events []struct {
	Name string
	Data map[string]any
}) []string {
	var out []string
	for _, ev := range events {
		out = append(out, ev.Name)
	}
	return out
}

func TestTurnErrorTerminal(t *testing.T) {
	h := newHarness(t)
	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)

	resp := h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", `{"input":""}`)
	events := sseEvents(t, resp)
	last := events[len(events)-1]
	if last.Name != "error" {
		t.Fatalf("terminal = %s, want error", last.Name)
	}
	if last.Data["code"] == "" || last.Data["message"] == "" {
		t.Fatalf("error payload = %v", last.Data)
	}
	terminal := 0
	for _, ev := range events {
		if ev.Name == "message" || ev.Name == "error" {
			terminal++
		}
	}
	if terminal != 1 {
		t.Fatalf("terminal events = %d", terminal)
	}
}

func TestTurn404UnknownSession(t *testing.T) {
	h := newHarness(t)
	resp := h.do(http.MethodPost, "/api/tobor-kit/sessions/00000000-0000-4000-8000-000000000000/turn", `{"input":"x"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d", resp.StatusCode)
	}
}

// A mid-stream provider failure is an `error` FRAME over an HTTP 200 — the
// status must never fail after headers went out. Non-200 is pre-stream only.
func TestTurnMidStreamFailureIs200WithErrorFrame(t *testing.T) {
	h := newHarness(t)
	h.runner = turn.RunnerFunc(func(ctx context.Context, in turn.Input, emit func(turn.Event) error) (*turn.Turn, error) {
		if err := emit(turn.Event{Name: turn.EventState, Data: map[string]string{"state": "thinking"}}); err != nil {
			return nil, err
		}
		_ = emit(turn.Event{Name: turn.EventError, Data: map[string]string{"code": "provider_down", "message": "upstream failed"}})
		return nil, errors.New("provider exploded")
	})
	h.mount()

	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)
	resp := h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", `{"input":"go"}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("mid-stream failure status = %d, want 200", resp.StatusCode)
	}
	events := sseEvents(t, resp)
	if len(events) == 0 || events[len(events)-1].Name != "error" {
		t.Fatalf("terminal event = %v, want error frame", names(events))
	}
	if events[len(events)-1].Data["code"] != "provider_down" {
		t.Fatalf("error payload = %v", events[len(events)-1].Data)
	}
	terminal := 0
	for _, ev := range events {
		if ev.Name == "message" || ev.Name == "error" {
			terminal++
		}
	}
	if terminal != 1 {
		t.Fatalf("terminal events = %d, want exactly 1", terminal)
	}
}

// A second concurrent turn on the same session must 409.
func TestTurnInFlightConflict(t *testing.T) {
	h := newHarness(t)
	started := make(chan struct{})
	release := make(chan struct{})
	h.runner = turn.RunnerFunc(func(ctx context.Context, in turn.Input, emit func(turn.Event) error) (*turn.Turn, error) {
		close(started)
		<-release
		return turn.ScriptedRunner{}.Run(ctx, in, emit)
	})
	h.mount()

	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)

	done := make(chan struct{})
	go func() {
		defer close(done)
		resp := h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", `{"input":"slow"}`)
		sseEvents(t, resp)
	}()

	<-started
	resp := h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", `{"input":"fast"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("concurrent turn status = %d, want 409", resp.StatusCode)
	}
	close(release)
	<-done
}

// Idempotency key replays the original turn instead of re-running it.
func TestTurnIdempotentReplay(t *testing.T) {
	h := newHarness(t)
	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)

	body := `{"input":"once","idempotency_key":"key-1"}`
	first := sseEvents(t, h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", body))
	replay := sseEvents(t, h.do(http.MethodPost, "/api/tobor-kit/sessions/"+created.ID+"/turn", body))

	if len(replay) != 1 || replay[0].Name != "message" {
		t.Fatalf("replay events = %v", names(replay))
	}
	firstMsg, _ := json.Marshal(first[len(first)-1].Data)
	replayMsg, _ := json.Marshal(replay[0].Data)
	if string(firstMsg) != string(replayMsg) {
		t.Fatalf("replay differs:\nfirst:  %s\nreplay: %s", firstMsg, replayMsg)
	}
}

func TestVoiceToken(t *testing.T) {
	h := newHarness(t)

	// fixture guide: realtime adapter → 201 with short-lived credential
	var cred struct {
		Adapter   string `json:"adapter"`
		ExpiresAt string `json:"expires_at"`
		Realtime  struct {
			Token string `json:"token"`
			URL   string `json:"url"`
			Model string `json:"model"`
			Voice string `json:"voice"`
		} `json:"realtime"`
	}
	resp := h.do(http.MethodPost, "/api/tobor-kit/voice/token", "")
	decode(t, resp, &cred)
	if resp.StatusCode != http.StatusCreated || cred.Adapter != "realtime" || cred.Realtime.Token == "" {
		t.Fatalf("voice = %d %+v", resp.StatusCode, cred)
	}
	exp, err := time.Parse(time.RFC3339, cred.ExpiresAt)
	if err != nil || time.Until(exp) > 5*time.Minute || time.Until(exp) <= 0 {
		t.Fatalf("expires_at = %v (err %v) — must be short-lived", cred.ExpiresAt, err)
	}

	// native → 409
	g, b := loadFixture(t)
	g.Voice.Adapter = "native"
	h2 := &harness{t: t, g: g, b: b, sessions: session.NewStore(0), prefs: telemetry.NewMemoryPreferences()}
	h2.mount()
	if code := h2.do(http.MethodPost, "/api/tobor-kit/voice/token", "").StatusCode; code != http.StatusConflict {
		t.Fatalf("native status = %d, want 409", code)
	}

	// none → 503
	g.Voice.Adapter = "none"
	h3 := &harness{t: t, g: g, b: b, sessions: session.NewStore(0), prefs: telemetry.NewMemoryPreferences()}
	h3.mount()
	if code := h3.do(http.MethodPost, "/api/tobor-kit/voice/token", "").StatusCode; code != http.StatusServiceUnavailable {
		t.Fatalf("none status = %d, want 503", code)
	}
}

// The fixture uses a client-side transcript store → 501 on both endpoints.
func TestTranscript501ForNonBackendStore(t *testing.T) {
	h := newHarness(t)
	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)
	sid := "/api/tobor-kit/sessions/" + created.ID + "/transcript"

	if code := h.do(http.MethodGet, sid, "").StatusCode; code != http.StatusNotImplemented {
		t.Fatalf("GET status = %d, want 501", code)
	}
	if code := h.do(http.MethodDelete, sid, "").StatusCode; code != http.StatusNotImplemented {
		t.Fatalf("DELETE status = %d, want 501", code)
	}
}

// With store=backend the endpoints serve from the in-memory store.
func TestTranscriptBackendStore(t *testing.T) {
	h := newHarness(t)
	h.g.Transcript.Store = "backend"
	h.store = transcript.NewMemoryStore()
	h.mount()

	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)
	base := "/api/tobor-kit/sessions/" + created.ID
	sid := base + "/transcript"

	// run two turns
	sseEvents(t, h.do(http.MethodPost, base+"/turn", `{"input":"one"}`))
	sseEvents(t, h.do(http.MethodPost, base+"/turn", `{"input":"two"}`))

	var list struct {
		Turns   []turn.Turn `json:"turns"`
		HasMore bool        `json:"has_more"`
	}
	decode(t, h.do(http.MethodGet, sid, ""), &list)
	if len(list.Turns) != 4 || list.HasMore {
		t.Fatalf("turns = %d has_more = %v", len(list.Turns), list.HasMore)
	}
	if list.Turns[0].Role != "user" || list.Turns[0].Content != "one" {
		t.Fatalf("first turn = %+v", list.Turns[0])
	}
	// limit + has_more
	var limited struct {
		Turns   []turn.Turn `json:"turns"`
		HasMore bool        `json:"has_more"`
	}
	decode(t, h.do(http.MethodGet, sid+"?limit=2", ""), &limited)
	if len(limited.Turns) != 2 || !limited.HasMore {
		t.Fatalf("limited = %d has_more = %v", len(limited.Turns), limited.HasMore)
	}

	if code := h.do(http.MethodDelete, sid, "").StatusCode; code != http.StatusNoContent {
		t.Fatalf("delete status = %d", code)
	}
	if code := h.do(http.MethodGet, sid, "").StatusCode; code != http.StatusNotFound {
		t.Fatalf("get-after-delete status = %d", code)
	}
}

func TestMCPToolsEndpoint(t *testing.T) {
	h := newHarness(t)

	var inv mcp.Inventory
	decode(t, h.do(http.MethodGet, "/api/tobor-kit/mcp/tools", ""), &inv)
	// deny: Github.PullMerge gone; degraded: extra server down.
	for _, tool := range inv.Tools {
		if tool.Name == "Github.PullMerge" {
			t.Fatal("denied tool served")
		}
	}
	if len(inv.Degraded) != 1 || inv.Degraded[0].Server != "extra" {
		t.Fatalf("degraded = %+v", inv.Degraded)
	}

	// required server down → 502
	h.fake.SetErr("tobor", &mcp.FakeError{Msg: "connection refused"})
	resp := h.do(http.MethodGet, "/api/tobor-kit/mcp/tools", "")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("required outage status = %d, want 502", resp.StatusCode)
	}
}

// Telemetry through the whole stack: consent off → no content attributes on
// the turn span; consent on → attributes redacted.
func TestTelemetryConsentGovernsSpanContent(t *testing.T) {
	h := newHarness(t)
	var created session.Session
	decode(t, h.do(http.MethodPost, "/api/tobor-kit/sessions", `{}`), &created)
	turnPath := "/api/tobor-kit/sessions/" + created.ID + "/turn"

	// record explicit consent OFF for our bearer identity
	var consent telemetry.Consent
	decode(t, h.do(http.MethodPut, "/api/tobor-kit/telemetry/consent", `{"enabled":false}`), &consent)
	if consent.Enabled || consent.Source != "user" {
		t.Fatalf("consent after PUT = %+v", consent)
	}

	h.exporter.Reset()
	sseEvents(t, h.do(http.MethodPost, turnPath, `{"input":"my key is sk-abcdefghijklmnop1234"}`))
	spans := h.exporter.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("spans = %d", len(spans))
	}
	attrs := map[string]string{}
	for _, kv := range spans[0].Attributes {
		attrs[string(kv.Key)] = kv.Value.Emit()
	}
	for _, k := range []string{"tobor.prompt", "tobor.response"} {
		if _, ok := attrs[k]; ok {
			t.Fatalf("content attribute %s captured with consent off", k)
		}
	}
	if attrs["tobor.telemetry.consent"] != "false" {
		t.Fatalf("consent attr = %q", attrs["tobor.telemetry.consent"])
	}

	// flip consent ON, run again — content captured AND redacted
	decode(t, h.do(http.MethodPut, "/api/tobor-kit/telemetry/consent", `{"enabled":true}`), &consent)
	h.exporter.Reset()
	sseEvents(t, h.do(http.MethodPost, turnPath, `{"input":"my key is sk-abcdefghijklmnop1234"}`))
	spans = h.exporter.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("spans = %d", len(spans))
	}
	attrs = map[string]string{}
	for _, kv := range spans[0].Attributes {
		attrs[string(kv.Key)] = kv.Value.AsString()
	}
	if attrs["tobor.prompt"] != "my key is [REDACTED]" {
		t.Fatalf("prompt attr = %q — redaction not applied", attrs["tobor.prompt"])
	}
	if !strings.Contains(attrs["tobor.response"], "[REDACTED]") && strings.Contains(attrs["tobor.response"], "sk-") {
		t.Fatalf("response attr leaks a key: %q", attrs["tobor.response"])
	}
}

func TestConsentGETAndForbidden(t *testing.T) {
	h := newHarness(t)

	var consent telemetry.Consent
	decode(t, h.do(http.MethodGet, "/api/tobor-kit/telemetry/consent", ""), &consent)
	// fixture: default on, user_overridable true → never expressed → default
	if !consent.Enabled || consent.Source != "default" || !consent.UserOverridable {
		t.Fatalf("consent = %+v", consent)
	}

	// forced guide: PUT must 403
	g, b := loadFixture(t)
	g.Telemetry.UserOverridable = false
	h2 := &harness{t: t, g: g, b: b, sessions: session.NewStore(0), prefs: telemetry.NewMemoryPreferences()}
	h2.mount()
	var forced telemetry.Consent
	decode(t, h2.do(http.MethodGet, "/api/tobor-kit/telemetry/consent", ""), &forced)
	if forced.Source != "forced" || forced.UserOverridable {
		t.Fatalf("forced consent = %+v", forced)
	}
	resp := h2.do(http.MethodPut, "/api/tobor-kit/telemetry/consent", `{"enabled":false}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("PUT on forced guide = %d, want 403", resp.StatusCode)
	}
}
