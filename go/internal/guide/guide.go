// Package guide parses the guide-definition YAML (the runtime sections the
// compiler leaves out: ui, auth, telemetry, voice, transcript, mcp) and
// projects the UI-facing GuideProjection defined by the OpenAPI contract.
package guide

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Guide is the runtime subset of tobor.guide-definition the backend needs.
type Guide struct {
	Schema        string         `yaml:"schema"`
	Version       int            `yaml:"version"`
	Core          Core           `yaml:"core"`
	Capabilities  []Capability   `yaml:"capabilities"`
	MCP           MCP            `yaml:"mcp"`
	UI            UI             `yaml:"ui"`
	Auth          Auth           `yaml:"auth"`
	Telemetry     Telemetry      `yaml:"telemetry"`
	Voice         Voice          `yaml:"voice"`
	Transcript    Transcript     `yaml:"transcript"`
	Orchestration Orchestration  `yaml:"orchestration"`
	Extra         map[string]any `yaml:"-"`
}

type Core struct {
	Slug         string   `yaml:"slug"`
	Name         string   `yaml:"name"`
	Title        string   `yaml:"title"`
	Archetype    string   `yaml:"archetype"`
	Tags         []string `yaml:"tags"`
	Status       string   `yaml:"status"`
	Organization string   `yaml:"organization"`
	Project      string   `yaml:"project"`
}

type Capability struct {
	ID          string   `yaml:"id"`
	Description string   `yaml:"description"`
	Inputs      []string `yaml:"inputs"`
	Outputs     []string `yaml:"outputs"`
}

type MCPServer struct {
	ID       string   `yaml:"id"`
	URL      string   `yaml:"url"`
	Label    string   `yaml:"label"`
	Scopes   []string `yaml:"scopes"`
	Required bool     `yaml:"required"`
}

type MenuOverride struct {
	Label       string `yaml:"label"`
	Description string `yaml:"description"`
	Group       string `yaml:"group"`
	Icon        string `yaml:"icon"`
	Hidden      bool   `yaml:"hidden"`
	Confirm     bool   `yaml:"confirm"`
}

type Menu struct {
	GroupBy   string                  `yaml:"group_by"` // category | server | none
	Order     []string                `yaml:"order"`
	Overrides map[string]MenuOverride `yaml:"overrides"`
}

type MCP struct {
	Servers []MCPServer `yaml:"servers"`
	Allow   []string    `yaml:"allow"`
	Deny    []string    `yaml:"deny"`
	Menu    Menu        `yaml:"menu"`
}

type RobotState struct {
	Segment string  `yaml:"segment"`
	Loop    bool    `yaml:"loop"`
	Speed   float64 `yaml:"speed"`
}

type Robot struct {
	Renderer      string                `yaml:"renderer"` // lottie | sprite | glyph
	Asset         string                `yaml:"asset"`
	States        map[string]RobotState `yaml:"states"`
	ReducedMotion string                `yaml:"reduced_motion"`
}

type Panel struct {
	Placement     string `yaml:"placement"`
	StartExpanded bool   `yaml:"start_expanded"`
	ShowToolList  bool   `yaml:"show_tool_list"`
	ShowTaskMenu  bool   `yaml:"show_task_menu"`
	Greeting      string `yaml:"greeting"`
}

type UI struct {
	Modes       []string          `yaml:"modes"`
	DefaultMode string            `yaml:"default_mode"`
	Robot       Robot             `yaml:"robot"`
	Panel       Panel             `yaml:"panel"`
	Theme       map[string]string `yaml:"theme"`
}

type Auth struct {
	Required     bool     `yaml:"required"`
	Provider     string   `yaml:"provider"` // oidc | authentik | none
	Issuer       string   `yaml:"issuer"`
	ClientID     string   `yaml:"client_id"`
	Scopes       []string `yaml:"scopes"`
	RedirectPath string   `yaml:"redirect_path"`
	PKCE         bool     `yaml:"pkce"`
}

type Capture struct {
	Prompt      bool `yaml:"prompt"`
	Response    bool `yaml:"response"`
	ToolArgs    bool `yaml:"tool_args"`
	ToolResults bool `yaml:"tool_results"`
}

type Telemetry struct {
	Enabled         bool     `yaml:"enabled"`
	Default         string   `yaml:"default"` // on | off
	UserOverridable bool     `yaml:"user_overridable"`
	Capture         Capture  `yaml:"capture"`
	Redact          []string `yaml:"redact"`
	ServiceName     string   `yaml:"service_name"`
}

type VoiceRealtime struct {
	Provider string `yaml:"provider"`
	Model    string `yaml:"model"`
	Voice    string `yaml:"voice"`
	MintPath string `yaml:"mint_path"`
}

type VoiceBackend struct {
	STTURL string `yaml:"stt_url"`
	TTSURL string `yaml:"tts_url"`
}

type Voice struct {
	Adapter    string        `yaml:"adapter"` // realtime | native | backend | none
	Realtime   VoiceRealtime `yaml:"realtime"`
	Backend    VoiceBackend  `yaml:"backend"`
	PushToTalk bool          `yaml:"push_to_talk"`
	Locale     string        `yaml:"locale"`
}

type Transcript struct {
	Store       string `yaml:"store"` // memory | local | backend
	RetainTurns int    `yaml:"retain_turns"`
}

type Orchestration struct {
	MaxTurns             int `yaml:"max_turns"`
	TimeoutSeconds       int `yaml:"timeout_seconds"`
	MaxInternalToolSteps int `yaml:"max_internal_tool_steps"`
}

// LoadFile parses a guide-definition YAML file.
func LoadFile(path string) (*Guide, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(raw)
}

// Parse parses a guide-definition YAML document.
func Parse(raw []byte) (*Guide, error) {
	var g Guide
	if err := yaml.Unmarshal(raw, &g); err != nil {
		return nil, fmt.Errorf("guide: %w", err)
	}
	if g.Schema != "" && g.Schema != "tobor.guide-definition" {
		return nil, fmt.Errorf("guide: schema %q, want %q", g.Schema, "tobor.guide-definition")
	}
	if g.Core.Slug == "" {
		return nil, fmt.Errorf("guide: core.slug is required")
	}
	if g.Telemetry.Default == "" {
		g.Telemetry.Default = "on"
	}
	if g.Transcript.Store == "" {
		g.Transcript.Store = "local"
	}
	if g.MCP.Menu.GroupBy == "" {
		g.MCP.Menu.GroupBy = "category"
	}
	// Guide-definition defaults, applied so projections are always fully
	// populated (clients render verbatim; omitted fields are NOT their job to
	// default).
	if len(g.UI.Modes) == 0 {
		g.UI.Modes = []string{"text"}
	}
	if g.UI.DefaultMode == "" {
		if len(g.UI.Modes) > 0 {
			g.UI.DefaultMode = g.UI.Modes[0]
		} else {
			g.UI.DefaultMode = "text"
		}
	}
	if g.UI.Robot.Renderer == "" {
		g.UI.Robot.Renderer = "glyph"
	}
	if g.Auth.Provider == "" {
		g.Auth.Provider = "none"
	}
	if g.Voice.Adapter == "" {
		g.Voice.Adapter = "none"
	}
	return &g, nil
}

// Slug returns the guide slug.
func (g *Guide) Slug() string { return g.Core.Slug }

// ServerBackend reports whether the backend serves the transcript endpoints.
func (g *Guide) ServerBackedTranscript() bool { return g.Transcript.Store == "backend" }

// Projection is the GET /guide payload — everything the client renders,
// nothing server-side (no preamble, no biography, no model ids, no credentials).
// All fields are always emitted, fully populated: clients render verbatim and
// never carry guide-definition defaults of their own.
type Projection struct {
	Slug         string                `json:"slug"`
	Name         string                `json:"name"`
	Title        string                `json:"title"`
	Greeting     string                `json:"greeting"`
	BundleHash   string                `json:"bundle_hash"`
	Capabilities []ProjectedCapability `json:"capabilities"`
	Modes        []string              `json:"modes"`
	DefaultMode  string                `json:"default_mode"`
	UI           UIProjection          `json:"ui"`
	Auth         AuthProjection        `json:"auth"`
	Telemetry    TelemetryProjection   `json:"telemetry"`
	Voice        VoiceProjection       `json:"voice"`
	Transcript   TranscriptProjection  `json:"transcript"`
}

type ProjectedCapability struct {
	ID          string `json:"id"`
	Description string `json:"description"`
}

type UIProjection struct {
	Robot RobotProjection   `json:"robot"`
	Panel PanelProjection   `json:"panel"`
	Theme map[string]string `json:"theme"`
}

type RobotProjection struct {
	Renderer      string                     `json:"renderer"`
	Asset         string                     `json:"asset"`
	States        map[string]RobotStateState `json:"states"`
	ReducedMotion string                     `json:"reduced_motion"`
}

type RobotStateState struct {
	Segment string  `json:"segment"`
	Loop    bool    `json:"loop"`
	Speed   float64 `json:"speed"`
}

type PanelProjection struct {
	Placement     string `json:"placement"`
	StartExpanded bool   `json:"start_expanded"`
	ShowToolList  bool   `json:"show_tool_list"`
	ShowTaskMenu  bool   `json:"show_task_menu"`
}

type AuthProjection struct {
	Required     bool     `json:"required"`
	Provider     string   `json:"provider"`
	Issuer       string   `json:"issuer"`
	ClientID     string   `json:"client_id"`
	Scopes       []string `json:"scopes"`
	RedirectPath string   `json:"redirect_path"`
}

type TelemetryProjection struct {
	Enabled         bool   `json:"enabled"`
	Default         string `json:"default"`
	UserOverridable bool   `json:"user_overridable"`
}

type VoiceProjection struct {
	Adapter    string `json:"adapter"`
	PushToTalk bool   `json:"push_to_talk"`
	MintPath   string `json:"mint_path"`
	Locale     string `json:"locale"`
}

type TranscriptProjection struct {
	Store       string `json:"store"`
	RetainTurns int    `json:"retain_turns"`
}

// Projection renders the UI-facing config projection. bundleHash is the
// verified hash of the frozen bundle in use.
func (g *Guide) Projection(bundleHash string) *Projection {
	caps := make([]ProjectedCapability, 0, len(g.Capabilities))
	for _, c := range g.Capabilities {
		caps = append(caps, ProjectedCapability{ID: c.ID, Description: c.Description})
	}
	states := make(map[string]RobotStateState, len(g.UI.Robot.States))
	for k, s := range g.UI.Robot.States {
		states[k] = RobotStateState{Segment: s.Segment, Loop: s.Loop, Speed: s.Speed}
	}
	theme := g.UI.Theme
	if theme == nil {
		theme = map[string]string{}
	}
	scopes := g.Auth.Scopes
	if scopes == nil {
		scopes = []string{}
	}
	// Never project a renderer the client cannot satisfy: lottie/sprite
	// without an asset degrades to glyph.
	renderer := g.UI.Robot.Renderer
	if (renderer == "lottie" || renderer == "sprite") && g.UI.Robot.Asset == "" {
		renderer = "glyph"
	}
	return &Projection{
		Slug:         g.Core.Slug,
		Name:         g.Core.Name,
		Title:        g.Core.Title,
		Greeting:     g.UI.Panel.Greeting,
		BundleHash:   bundleHash,
		Capabilities: caps,
		Modes:        g.UI.Modes,
		DefaultMode:  g.UI.DefaultMode,
		UI: UIProjection{
			Robot: RobotProjection{
				Renderer:      renderer,
				Asset:         g.UI.Robot.Asset,
				States:        states,
				ReducedMotion: g.UI.Robot.ReducedMotion,
			},
			Panel: PanelProjection{
				Placement:     g.UI.Panel.Placement,
				StartExpanded: g.UI.Panel.StartExpanded,
				ShowToolList:  g.UI.Panel.ShowToolList,
				ShowTaskMenu:  g.UI.Panel.ShowTaskMenu,
			},
			Theme: theme,
		},
		Auth: AuthProjection{
			Required:     g.Auth.Required,
			Provider:     g.Auth.Provider,
			Issuer:       g.Auth.Issuer,
			ClientID:     g.Auth.ClientID,
			Scopes:       scopes,
			RedirectPath: g.Auth.RedirectPath,
		},
		Telemetry: TelemetryProjection{
			Enabled:         g.Telemetry.Enabled,
			Default:         g.Telemetry.Default,
			UserOverridable: g.Telemetry.UserOverridable,
		},
		Voice: VoiceProjection{
			Adapter:    g.Voice.Adapter,
			PushToTalk: g.Voice.PushToTalk,
			MintPath:   g.Voice.Realtime.MintPath,
			Locale:     g.Voice.Locale,
		},
		Transcript: TranscriptProjection{
			Store:       g.Transcript.Store,
			RetainTurns: g.Transcript.RetainTurns,
		},
	}
}
