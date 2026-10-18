// Package turn defines the assistant-turn execution seam.
//
// The endpoint semantics (SSE event order, exactly one terminal message or
// error, in-flight locking, idempotent replay) live in the server; a Runner
// supplies the actual exchange with the model. The Go port ships a scripted
// runner that emits the full canonical event sequence deterministically —
// real model driving is the reference lane's integration job.
package turn

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"
)

// Event names — frozen by the OpenAPI contract.
const (
	EventState      = "state"
	EventDelta      = "delta"
	EventToolCall   = "tool_call"
	EventToolResult = "tool_result"
	EventMessage    = "message"
	EventError      = "error"
)

// Canonical guide states (GuideState schema).
const (
	StateIdle      = "idle"
	StateListening = "listening"
	StateThinking  = "thinking"
	StateSpeaking  = "speaking"
	StateToolRun   = "tool_running"
	StateError     = "error"
	StateOffline   = "offline"
)

// Event is one SSE event. Name is one of the six frozen names; Data is
// JSON-encoded into the data: line.
type Event struct {
	Name string
	Data any
}

// ErrNoTerminal is returned by a Runner that ended its stream without
// emitting a terminal message or error event.
var ErrNoTerminal = errors.New("turn: runner ended without a terminal message or error event")

// Input is the user side of the exchange.
type Input struct {
	Text   string
	TaskID string
}

// ToolCallRef records a tool exchange inside a finished turn.
type ToolCallRef struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Summary string `json:"summary"`
}

// Usage is token accounting for a turn.
type Usage struct {
	InputTokens  int64 `json:"input_tokens,omitempty"`
	OutputTokens int64 `json:"output_tokens,omitempty"`
}

// Turn is the OpenAPI Turn object — the terminal message payload.
type Turn struct {
	ID        string        `json:"id"`
	Role      string        `json:"role"` // user | assistant | system
	Content   string        `json:"content"`
	CreatedAt time.Time     `json:"created_at"`
	ToolCalls []ToolCallRef `json:"tool_calls,omitempty"`
	Usage     *Usage        `json:"usage,omitempty"`
}

// Runner executes one assistant turn, streaming events through emit and
// returning the terminal assistant Turn. The runner must emit exactly one
// terminal event (message carrying the returned Turn, or an error event) and
// return either the Turn or a non-nil error.
type Runner interface {
	Run(ctx context.Context, in Input, emit func(Event) error) (*Turn, error)
}

// RunnerFunc adapts a function to Runner.
type RunnerFunc func(ctx context.Context, in Input, emit func(Event) error) (*Turn, error)

func (f RunnerFunc) Run(ctx context.Context, in Input, emit func(Event) error) (*Turn, error) {
	return f(ctx, in, emit)
}

// ScriptedRunner emits the canonical sequence: state(thinking) → deltas →
// tool_call → tool_result → state(speaking) → message. TaskID biases the
// summary text so menu-initiated turns are distinguishable. Errors on empty
// input with an error event, exercising the error terminal path.
type ScriptedRunner struct{}

// Run implements Runner.
func (ScriptedRunner) Run(ctx context.Context, in Input, emit func(Event) error) (*Turn, error) {
	state := func(s string) error {
		return emit(Event{Name: EventState, Data: map[string]string{"state": s}})
	}
	if err := state(StateThinking); err != nil {
		return nil, err
	}
	if in.Text == "" {
		err := map[string]string{"code": "invalid_input", "message": "input is required"}
		_ = emit(Event{Name: EventError, Data: err})
		return nil, errors.New("turn: empty input")
	}
	text := "On it. " + in.Text
	runes := []rune(text)
	half := len(runes) / 2
	for _, chunk := range []string{string(runes[:half]), string(runes[half:])} {
		if err := emit(Event{Name: EventDelta, Data: map[string]string{"text": chunk}}); err != nil {
			return nil, err
		}
	}
	toolName := "Github.PullCreate"
	if in.TaskID != "" {
		toolName = in.TaskID
	}
	if err := emit(Event{Name: EventToolCall, Data: map[string]any{"id": "call_1", "name": toolName}}); err != nil {
		return nil, err
	}
	if err := state(StateToolRun); err != nil {
		return nil, err
	}
	if err := emit(Event{Name: EventToolResult, Data: map[string]any{
		"id": "call_1", "ok": true, "summary": toolName + " completed",
	}}); err != nil {
		return nil, err
	}
	if err := state(StateSpeaking); err != nil {
		return nil, err
	}
	assistant := Turn{
		ID:        newID(),
		Role:      "assistant",
		Content:   text,
		CreatedAt: time.Now().UTC(),
		ToolCalls: []ToolCallRef{{ID: "call_1", Name: toolName, OK: true, Summary: toolName + " completed"}},
		Usage:     &Usage{InputTokens: int64(len(in.Text)), OutputTokens: int64(len(text))},
	}
	if err := emit(Event{Name: EventMessage, Data: assistant}); err != nil {
		return nil, err
	}
	return &assistant, nil
}

// newID mints a random UUIDv4-shaped identifier.
func newID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("turn: entropy unavailable: " + err.Error())
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
