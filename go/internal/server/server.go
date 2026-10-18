// Package server wires the frozen OpenAPI contract to the stores, runner,
// MCP inventory, and telemetry service. Routes are mounted under the contract
// base path /api/tobor-kit.
package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/the-robot-lives/tobor-kit/go/internal/auth"
	"github.com/the-robot-lives/tobor-kit/go/internal/bundle"
	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
	"github.com/the-robot-lives/tobor-kit/go/internal/mcp"
	"github.com/the-robot-lives/tobor-kit/go/internal/session"
	"github.com/the-robot-lives/tobor-kit/go/internal/telemetry"
	"github.com/the-robot-lives/tobor-kit/go/internal/transcript"
	"github.com/the-robot-lives/tobor-kit/go/internal/turn"
)

// BasePath is the mount point from the OpenAPI servers entry.
const BasePath = "/api/tobor-kit"

// Config carries the wired collaborators.
type Config struct {
	Guide  *guide.Guide
	Bundle *bundle.Bundle
	// Tracer opens the per-exchange OTel span. nil = noop tracing.
	Tracer     trace.Tracer
	Sessions   *session.Store
	Runner     turn.Runner
	MCP        mcp.MCPClient
	Inventory  *mcp.Builder
	Telemetry  *telemetry.Service
	Transcript transcript.Store
	// VoiceTokenTTL bounds minted voice credentials (default 5m).
	VoiceTokenTTL time.Duration
	// Now is injectable for tests.
	Now func() time.Time
}

// Server implements the contract.
type Server struct {
	cfg    Config
	guide  *guide.Guide
	bundle *bundle.Bundle
	mux    *http.ServeMux
}

// New builds the server with all contract routes mounted.
func New(cfg Config) *Server {
	if cfg.VoiceTokenTTL == 0 {
		cfg.VoiceTokenTTL = 5 * time.Minute
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	s := &Server{cfg: cfg, guide: cfg.Guide, bundle: cfg.Bundle}
	mux := http.NewServeMux()
	p := BasePath

	mux.HandleFunc("GET "+p+"/guide", s.handleGuide)
	mux.HandleFunc("POST "+p+"/sessions", s.handleCreateSession)
	mux.HandleFunc("GET "+p+"/sessions/{sessionId}", s.handleGetSession)
	mux.HandleFunc("DELETE "+p+"/sessions/{sessionId}", s.handleDeleteSession)
	mux.HandleFunc("POST "+p+"/sessions/{sessionId}/turn", s.handleTurn)
	mux.HandleFunc("GET "+p+"/sessions/{sessionId}/transcript", s.handleTranscript)
	mux.HandleFunc("DELETE "+p+"/sessions/{sessionId}/transcript", s.handleDeleteTranscript)
	mux.HandleFunc("GET "+p+"/mcp/tools", s.handleMCPTools)
	mux.HandleFunc("POST "+p+"/voice/token", s.handleVoiceToken)
	mux.HandleFunc("GET "+p+"/telemetry/consent", s.handleGetConsent)
	mux.HandleFunc("PUT "+p+"/telemetry/consent", s.handlePutConsent)
	s.mux = mux
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	auth.Middleware(s.guide)(s.mux).ServeHTTP(w, r)
}

// ---------------------------------------------------------------------------
// handlers

func (s *Server) handleGuide(w http.ResponseWriter, r *http.Request) {
	if s.bundle == nil {
		writeError(w, http.StatusNotFound, "not_found", "no guide is configured")
		return
	}
	writeJSON(w, http.StatusOK, s.guide.Projection(s.bundle.Hash))
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ResumeID string `json:"resume_id"`
		Locale   string `json:"locale"`
		Client   string `json:"client"`
	}
	// Body is optional; an absent or unparseable body simply opens a new session.
	if r.Body != nil {
		_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body)
	}
	id, _ := auth.IdentityFrom(r.Context())
	if body.ResumeID != "" {
		sess, err := s.cfg.Sessions.Resume(body.ResumeID)
		if err != nil {
			writeError(w, http.StatusNotFound, "not_found", "no such session")
			return
		}
		writeJSON(w, http.StatusCreated, sess)
		return
	}
	var user *session.User
	if id.ID != "" {
		user = &session.User{ID: id.ID, Email: id.Email, DisplayName: id.Name}
	}
	writeJSON(w, http.StatusCreated, s.cfg.Sessions.Create(user))
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	sess, err := s.cfg.Sessions.Get(r.PathValue("sessionId"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no such session")
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	if err := s.cfg.Sessions.Delete(r.PathValue("sessionId")); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no such session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleTurn streams the assistant turn as SSE. The stream carries the six
// frozen event names and terminates with exactly one message or one error.
func (s *Server) handleTurn(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionId")
	if _, err := s.cfg.Sessions.Get(sessionID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no such session")
		return
	}

	var body struct {
		Input          string `json:"input"`
		TaskID         string `json:"task_id"`
		IdempotencyKey string `json:"idempotency_key"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "body must be JSON with an input field")
		return
	}

	// Idempotent replay: return the original turn without re-running.
	if body.IdempotencyKey != "" {
		if prior, err := s.cfg.Sessions.Replay(sessionID, body.IdempotencyKey); err == nil {
			s.streamTerminal(w, r, turn.Event{Name: turn.EventMessage, Data: prior})
			return
		}
	}

	if err := s.cfg.Sessions.TryBeginTurn(sessionID); err != nil {
		switch {
		case errors.Is(err, session.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "no such session")
		case errors.Is(err, session.ErrTurnInFlight):
			writeError(w, http.StatusConflict, "turn_in_flight", "a turn is already in flight for this session")
		default:
			writeError(w, http.StatusInternalServerError, "internal", err.Error())
		}
		return
	}
	// Release path is owned by runTurn from here.
	s.runTurn(w, r, sessionID, body)
}

func (s *Server) runTurn(w http.ResponseWriter, r *http.Request, sessionID string, body struct {
	Input          string `json:"input"`
	TaskID         string `json:"task_id"`
	IdempotencyKey string `json:"idempotency_key"`
}) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		s.cfg.Sessions.FailTurn(sessionID)
		writeError(w, http.StatusInternalServerError, "internal", "streaming unsupported")
		return
	}

	id, _ := auth.IdentityFrom(r.Context())
	consent := s.cfg.Telemetry.Resolve(id)
	var (
		content  telemetry.Content
		response strings.Builder
	)
	spanCtx := r.Context()

	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{}) // streams may outlive default timeouts
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	emit := func(ev turn.Event) error {
		data, err := json.Marshal(ev.Data)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, data); err != nil {
			return err
		}
		flusher.Flush()
		if consent.Enabled {
			switch ev.Name {
			case turn.EventDelta:
				if m, ok := ev.Data.(map[string]string); ok {
					response.WriteString(m["text"])
				}
			case turn.EventToolCall:
				if consent.Capture.ToolArgs {
					if m, ok := ev.Data.(map[string]any); ok {
						if raw, err := json.Marshal(m); err == nil {
							content.ToolArgs = string(raw)
						}
					}
				}
			case turn.EventToolResult:
				if consent.Capture.ToolResults {
					if raw, err := json.Marshal(ev.Data); err == nil {
						content.ToolResults = string(raw)
					}
				}
			}
		}
		return nil
	}

	terminal, runErr := s.cfg.Runner.Run(spanCtx, turn.Input{Text: body.Input, TaskID: body.TaskID}, emit)

	if terminal == nil && runErr == nil {
		s.cfg.Sessions.FailTurn(sessionID)
		s.emitError(w, flusher, "internal", "turn produced no result")
		return
	}
	if terminal == nil {
		// By runner contract a failed run emits its own terminal error event.
		s.cfg.Sessions.FailTurn(sessionID)
		return
	}

	content.Prompt = body.Input
	content.Response = response.String()
	if s.cfg.Tracer != nil {
		sp, _ := s.cfg.Telemetry.Span(spanCtx, s.cfg.Tracer, id, consent, sessionID, content)
		defer sp.End()
	}

	s.cfg.Sessions.EndTurn(sessionID, body.IdempotencyKey, terminal)
	if store := s.cfg.Transcript; store != nil && s.guide.ServerBackedTranscript() {
		_ = store.Append(sessionID, userTurn(sessionID, body.Input))
		_ = store.Append(sessionID, *terminal)
	}
}

func (s *Server) emitError(w http.ResponseWriter, flusher http.Flusher, code, message string) {
	data, _ := json.Marshal(map[string]string{"code": code, "message": message})
	_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", turn.EventError, data)
	flusher.Flush()
}

// streamTerminal writes a single terminal event (idempotent replay path).
func (s *Server) streamTerminal(w http.ResponseWriter, r *http.Request, ev turn.Event) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "internal", "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	data, _ := json.Marshal(ev.Data)
	_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, data)
	flusher.Flush()
}

func userTurn(sessionID, input string) turn.Turn {
	return turn.Turn{
		ID:        session.NewID(),
		Role:      "user",
		Content:   input,
		CreatedAt: time.Now().UTC(),
	}
}

func (s *Server) handleTranscript(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionId")
	if !s.guide.ServerBackedTranscript() || s.cfg.Transcript == nil {
		writeError(w, http.StatusNotImplemented, "not_backend_store",
			"this guide does not use the backend transcript store")
		return
	}
	limit := 200
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}
	var before *time.Time
	if raw := r.URL.Query().Get("before"); raw != "" {
		if t, err := time.Parse(time.RFC3339, raw); err == nil {
			before = &t
		}
	}
	turns, hasMore, err := s.cfg.Transcript.List(sessionID, limit, before)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no stored transcript for session")
		return
	}
	if turns == nil {
		turns = []turn.Turn{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"turns": turns, "has_more": hasMore})
}

func (s *Server) handleDeleteTranscript(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionId")
	if !s.guide.ServerBackedTranscript() || s.cfg.Transcript == nil {
		writeError(w, http.StatusNotImplemented, "not_backend_store",
			"this guide does not use the backend transcript store")
		return
	}
	if err := s.cfg.Transcript.Delete(sessionID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no stored transcript for session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMCPTools(w http.ResponseWriter, r *http.Request) {
	refresh := r.URL.Query().Get("refresh") == "true"
	inv, err := s.cfg.Inventory.Build(r.Context(), refresh)
	if err != nil {
		var req *mcp.RequiredServerUnreachableError
		if errors.As(err, &req) {
			writeError(w, http.StatusBadGateway, "required_server_unreachable",
				"a required MCP server was unreachable: "+req.Server)
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, inv)
}

func (s *Server) handleVoiceToken(w http.ResponseWriter, r *http.Request) {
	switch s.guide.Voice.Adapter {
	case "native":
		writeError(w, http.StatusConflict, "voice_native",
			"the configured voice adapter needs no server-minted credential")
	case "none", "":
		writeError(w, http.StatusServiceUnavailable, "voice_disabled",
			"voice is disabled or the provider is unconfigured")
	case "realtime":
		expires := s.cfg.Now().Add(s.cfg.VoiceTokenTTL)
		writeJSON(w, http.StatusCreated, map[string]any{
			"adapter":    "realtime",
			"expires_at": expires.UTC().Format(time.RFC3339),
			"realtime": map[string]any{
				"token": session.NewID() + session.NewID(),
				"url":   s.guide.Voice.Realtime.Provider,
				"model": s.guide.Voice.Realtime.Model,
				"voice": s.guide.Voice.Realtime.Voice,
			},
		})
	case "backend":
		expires := s.cfg.Now().Add(s.cfg.VoiceTokenTTL)
		writeJSON(w, http.StatusCreated, map[string]any{
			"adapter":    "backend",
			"expires_at": expires.UTC().Format(time.RFC3339),
			"backend": map[string]any{
				"stt_url": s.guide.Voice.Backend.STTURL,
				"tts_url": s.guide.Voice.Backend.TTSURL,
			},
		})
	default:
		writeError(w, http.StatusServiceUnavailable, "voice_unconfigured",
			"voice adapter \""+s.guide.Voice.Adapter+"\" is not supported")
	}
}

func (s *Server) handleGetConsent(w http.ResponseWriter, r *http.Request) {
	id, _ := auth.IdentityFrom(r.Context())
	writeJSON(w, http.StatusOK, s.cfg.Telemetry.Resolve(id))
}

func (s *Server) handlePutConsent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil || body.Enabled == nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "body must be JSON with an enabled boolean")
		return
	}
	id, _ := auth.IdentityFrom(r.Context())
	consent, ok := s.cfg.Telemetry.Record(id, *body.Enabled)
	if !ok {
		writeError(w, http.StatusForbidden, "consent_not_overridable",
			"telemetry.user_overridable is false for this guide; the default is binding")
		return
	}
	writeJSON(w, http.StatusOK, consent)
}

// ---------------------------------------------------------------------------
// helpers

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	_ = enc.Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"code": code, "message": message})
}
