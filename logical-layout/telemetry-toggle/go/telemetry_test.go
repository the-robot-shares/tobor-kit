package telemetry

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
)

func fixtureGuide(def string, overridable bool) *guide.Guide {
	return &guide.Guide{
		Core: guide.Core{Slug: "deploy-guide", Name: "Tobor"},
		Telemetry: guide.Telemetry{
			Enabled:         true,
			Default:         def,
			UserOverridable: overridable,
			Capture: guide.Capture{
				Prompt:      true,
				Response:    true,
				ToolArgs:    false,
				ToolResults: false,
			},
			Redact: []string{
				`(?i)bearer\s+[a-z0-9._-]+`,
				`(?i)\bsk-[a-z0-9]{16,}\b`,
			},
			ServiceName: "tobor-kit-deploy-guide",
		},
	}
}

func TestResolveDefault(t *testing.T) {
	s := New(fixtureGuide("on", true), NewMemoryPreferences())
	c := s.Resolve(Identity{ID: "abc"})
	if !c.Enabled || c.Source != SourceDefault || !c.UserOverridable {
		t.Fatalf("consent = %+v", c)
	}
	if !c.Capture.Prompt || c.Capture.ToolArgs {
		t.Fatalf("capture = %+v", c.Capture)
	}

	off := New(fixtureGuide("off", true), NewMemoryPreferences())
	if off.Resolve(Identity{ID: "abc"}).Enabled {
		t.Fatal("default off must resolve off")
	}
}

func TestResolveUserRecordWins(t *testing.T) {
	s := New(fixtureGuide("on", true), NewMemoryPreferences())
	id := Identity{ID: "abc"}
	// Default is on; user turns it off.
	if _, ok := s.Record(id, false); !ok {
		t.Fatal("record should succeed when overridable")
	}
	c := s.Resolve(id)
	if c.Enabled || c.Source != SourceUser {
		t.Fatalf("consent = %+v", c)
	}
	// A different caller keeps the default.
	if !s.Resolve(Identity{ID: "other"}).Enabled {
		t.Fatal("other caller should still get default")
	}
}

func TestForcedWhenNotOverridable(t *testing.T) {
	g := fixtureGuide("on", false)
	g.Telemetry.Enabled = true
	s := New(g, NewMemoryPreferences())
	c := s.Resolve(Identity{ID: "abc"})
	if !c.Enabled || c.Source != SourceForced || c.UserOverridable {
		t.Fatalf("consent = %+v", c)
	}
	// Recording is refused: the PUT 403 path.
	if _, ok := s.Record(Identity{ID: "abc"}, false); ok {
		t.Fatal("record must be refused when not overridable")
	}
}

func TestRedaction(t *testing.T) {
	s := New(fixtureGuide("on", true), NewMemoryPreferences())
	in := "use bearer abc123.def456 and key sk-abcdefghijklmnop1234 please"
	out := s.Redact(in)
	if out != "use [REDACTED] and key [REDACTED] please" {
		t.Fatalf("redacted = %q", out)
	}
	// Uncompilable patterns are skipped, not fatal.
	g := fixtureGuide("on", true)
	g.Telemetry.Redact = append(g.Telemetry.Redact, "(")
	if New(g, nil) == nil {
		t.Fatal("bad pattern must not panic")
	}
}

func spanFrom(t *testing.T, exporter *tracetest.InMemoryExporter, consent bool) tracetest.SpanStub {
	t.Helper()
	s := New(fixtureGuide("on", true), NewMemoryPreferences())
	tp := sdktrace.NewTracerProvider(sdktrace.WithSyncer(exporter))
	defer func() { _ = tp.Shutdown(context.Background()) }()
	id := Identity{ID: "abc"}
	c := s.Resolve(id)
	if c.Enabled != consent {
		// Force the resolved value for the off case via a user record.
		if _, ok := s.Record(id, false); !ok || consent {
			t.Fatalf("cannot arrange consent=%v", consent)
		}
		c = s.Resolve(id)
	}
	content := Content{
		Prompt:      "my token is bearer supersecret99",
		Response:    "key sk-abcdefghijklmnop1234 leaked",
		ToolArgs:    `{"x":1}`,
		ToolResults: "result",
	}
	span, ctx := s.Span(context.Background(), tp.Tracer("test"), id, c, "sess-1", content)
	span.End()
	_ = ctx
	stubs := exporter.GetSpans()
	if len(stubs) != 1 {
		t.Fatalf("spans = %d", len(stubs))
	}
	return stubs[0]
}

func attrMap(stub tracetest.SpanStub) map[attribute.Key]attribute.Value {
	m := map[attribute.Key]attribute.Value{}
	for _, kv := range stub.Attributes {
		m[kv.Key] = kv.Value
	}
	return m
}

// Consent off → non-content attributes only; nothing from the exchange body.
func TestSpanConsentOffNoContentAttributes(t *testing.T) {
	exp := tracetest.NewInMemoryExporter()
	stub := spanFrom(t, exp, false)
	m := attrMap(stub)

	if m[attribute.Key("tobor.telemetry.consent")].AsBool() {
		t.Fatal("consent attr should be false")
	}
	if got := m[attribute.Key("tobor.telemetry.source")].AsString(); got != SourceUser {
		t.Fatalf("source = %q", got)
	}
	for _, k := range []string{"tobor.prompt", "tobor.response", "tobor.tool_args", "tobor.tool_results"} {
		if _, ok := m[attribute.Key(k)]; ok {
			t.Fatalf("content attribute %s present with consent off", k)
		}
	}
	if got := m[attribute.Key("tobor.session_id")].AsString(); got != "sess-1" {
		t.Fatalf("session attr = %q", got)
	}
	if stub.Name != "tobor-kit.turn" {
		t.Fatalf("span name = %q", stub.Name)
	}
}

// Consent on → captured fields present AND redacted, even though the source
// text contains credentials.
func TestSpanConsentOnRedacted(t *testing.T) {
	exp := tracetest.NewInMemoryExporter()
	stub := spanFrom(t, exp, true)
	m := attrMap(stub)

	prompt := m[attribute.Key("tobor.prompt")].AsString()
	if prompt == "" {
		t.Fatal("prompt attribute missing with consent on")
	}
	if prompt != "my token is [REDACTED]" {
		t.Fatalf("prompt not redacted: %q", prompt)
	}
	resp := m[attribute.Key("tobor.response")].AsString()
	if resp != "key [REDACTED] leaked" {
		t.Fatalf("response not redacted: %q", resp)
	}
	// tool_args / tool_results are capture:false in the guide — never present.
	for _, k := range []string{"tobor.tool_args", "tobor.tool_results"} {
		if _, ok := m[attribute.Key(k)]; ok {
			t.Fatalf("%s present despite capture:false", k)
		}
	}
}

// Compile-time sanity: the exported span list satisfies what tests read.
var _ = tracetest.NewInMemoryExporter
