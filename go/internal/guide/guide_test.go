package guide

import (
	"encoding/json"
	"os"
	"testing"
)

const fixturePath = "../../../schema/examples/deploy-guide.guide.yaml"

// The fixture guide-definition must parse and its runtime sections must land
// where the projection expects them.
func TestFixtureParses(t *testing.T) {
	g, err := LoadFile(fixturePath)
	if err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	if g.Core.Slug != "deploy-guide" || g.Core.Name != "Tobor" {
		t.Fatalf("core = %+v", g.Core)
	}
	if !g.Auth.Required || g.Auth.Provider != "authentik" || !g.Auth.PKCE {
		t.Fatalf("auth = %+v", g.Auth)
	}
	if g.Voice.Adapter != "realtime" || g.Voice.Realtime.Model == "" {
		t.Fatalf("voice = %+v", g.Voice)
	}
	if g.Telemetry.Default != "on" || !g.Telemetry.UserOverridable || len(g.Telemetry.Redact) != 2 {
		t.Fatalf("telemetry = %+v", g.Telemetry)
	}
	if g.ServerBackedTranscript() {
		t.Fatal("fixture transcript store must be client-side")
	}
	if len(g.MCP.Servers) != 1 || !g.MCP.Servers[0].Required {
		t.Fatalf("mcp servers = %+v", g.MCP.Servers)
	}
	if len(g.Capabilities) != 3 {
		t.Fatalf("capabilities = %+v", g.Capabilities)
	}
}

func TestProjectionShape(t *testing.T) {
	raw, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatal(err)
	}
	g, err := Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	p := g.Projection("sha256:test")
	if p.Slug != "deploy-guide" || p.BundleHash != "sha256:test" {
		t.Fatalf("projection = %+v", p)
	}
	if len(p.Modes) != 3 || p.DefaultMode != "text" || p.Greeting == "" {
		t.Fatalf("projection = %+v", p)
	}
	if p.Transcript.Store != "local" || p.Transcript.RetainTurns != 200 {
		t.Fatalf("transcript = %+v", p.Transcript)
	}
	if p.Voice.Adapter != "realtime" {
		t.Fatalf("voice = %+v", p.Voice)
	}
	// No server-side material: biography and preamble stay out by construction
	// (the projection struct has no fields for them).
}

func TestParseRejectsWrongSchemaAndMissingSlug(t *testing.T) {
	if _, err := Parse([]byte("schema: other.thing\ncore:\n  slug: x\n")); err == nil {
		t.Fatal("wrong schema must be rejected")
	}
	if _, err := Parse([]byte("core:\n  name: x\n")); err == nil {
		t.Fatal("missing core.slug must be rejected")
	}
}

// Guide-definition defaults are applied at parse time so projections are
// always fully populated, and the JSON emits every field (no omitempty holes).
func TestProjectionFullyPopulated(t *testing.T) {
	g, err := Parse([]byte("core:\n  slug: bare\n"))
	if err != nil {
		t.Fatal(err)
	}
	p := g.Projection("sha256:x")
	raw, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"slug", "name", "title", "greeting", "bundle_hash",
		"capabilities", "modes", "default_mode", "ui", "auth", "telemetry", "voice", "transcript"} {
		if _, ok := m[k]; !ok {
			t.Errorf("projection missing %q", k)
		}
	}
	ui, _ := m["ui"].(map[string]any)
	for _, k := range []string{"robot", "panel", "theme"} {
		if _, ok := ui[k]; !ok {
			t.Errorf("projection.ui missing %q", k)
		}
	}
	robot, _ := ui["robot"].(map[string]any)
	if robot["renderer"] != "glyph" {
		t.Errorf("default renderer = %v, want glyph", robot["renderer"])
	}
	if m["default_mode"] != "text" {
		t.Errorf("default_mode = %v", m["default_mode"])
	}
	voice, _ := m["voice"].(map[string]any)
	if voice["adapter"] != "none" {
		t.Errorf("default voice adapter = %v", voice["adapter"])
	}
}

// lottie/sprite without an asset projects glyph — never a renderer the client
// cannot satisfy.
func TestProjectionRendererFallback(t *testing.T) {
	g, err := Parse([]byte("core:\n  slug: bare\nui:\n  robot:\n    renderer: lottie\n"))
	if err != nil {
		t.Fatal(err)
	}
	if got := g.Projection("sha256:x").UI.Robot.Renderer; got != "glyph" {
		t.Fatalf("lottie without asset = %q, want glyph", got)
	}
	g.UI.Robot.Asset = "./assets/robot.lottie"
	if got := g.Projection("sha256:x").UI.Robot.Renderer; got != "lottie" {
		t.Fatalf("lottie with asset = %q, want lottie", got)
	}
}
