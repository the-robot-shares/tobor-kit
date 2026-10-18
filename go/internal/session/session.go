// Package session holds conversation sessions and turn bookkeeping:
// in-flight locking (409 on a concurrent turn) and idempotent replay.
package session

import (
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/the-robot-lives/tobor-kit/go/internal/turn"
)

// User is the bound identity for a session, per the Session schema.
type User struct {
	ID          string `json:"id"`
	Email       string `json:"email,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
}

// Session is the OpenAPI Session object.
type Session struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	State     string    `json:"state"`
	TurnCount int       `json:"turn_count"`
	User      *User     `json:"user"`
}

// ErrNotFound is returned for an unknown or closed session id.
var ErrNotFound = errors.New("session: not found")

// ErrTurnInFlight marks the 409 path.
var ErrTurnInFlight = errors.New("session: a turn is already in flight")

// ErrIdempotencyMiss is internal: replay requested but the original turn is
// not recorded under the key (e.g. it failed before completing).
var ErrIdempotencyMiss = errors.New("session: idempotency key has no completed turn")

// Store is the in-memory session store.
type Store struct {
	mu       sync.Mutex
	sessions map[string]*entry
	retain   int
}

type entry struct {
	session     *Session
	inFlight    chan struct{}
	replays     map[string]turn.Turn
	lastTurnIDs []string
}

// NewStore builds a store retaining up to retain replayable turns per session
// (0 = unbounded).
func NewStore(retain int) *Store {
	return &Store{sessions: map[string]*entry{}, retain: retain}
}

// Create opens a session bound to user (nil = anonymous).
func (s *Store) Create(user *User) *Session {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess := &Session{
		ID:        NewID(),
		CreatedAt: time.Now().UTC(),
		State:     "idle",
		User:      user,
	}
	s.sessions[sess.ID] = &entry{
		session:  sess,
		inFlight: make(chan struct{}, 1),
		replays:  map[string]turn.Turn{},
	}
	return clone(sess)
}

// Resume reopens an existing session, returning it with its prior state.
func (s *Store) Resume(id string) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.sessions[id]
	if !ok {
		return nil, ErrNotFound
	}
	return clone(e.session), nil
}

// Get returns a copy of the session.
func (s *Store) Get(id string) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.sessions[id]
	if !ok {
		return nil, ErrNotFound
	}
	return clone(e.session), nil
}

// Delete closes a session.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[id]; !ok {
		return ErrNotFound
	}
	delete(s.sessions, id)
	return nil
}

// TryBeginTurn acquires the per-session in-flight slot (409 when held).
func (s *Store) TryBeginTurn(id string) error {
	s.mu.Lock()
	e, ok := s.sessions[id]
	s.mu.Unlock()
	if !ok {
		return ErrNotFound
	}
	select {
	case e.inFlight <- struct{}{}:
		return nil
	default:
		return ErrTurnInFlight
	}
}

// EndTurn releases the in-flight slot and records the completed terminal turn
// for idempotent replay.
func (s *Store) EndTurn(id, idempotencyKey string, terminal *turn.Turn) {
	s.mu.Lock()
	e, ok := s.sessions[id]
	s.mu.Unlock()
	if !ok {
		return
	}
	<-e.inFlight
	if idempotencyKey != "" && terminal != nil {
		s.mu.Lock()
		e.replays[idempotencyKey] = *terminal
		e.lastTurnIDs = append(e.lastTurnIDs, idempotencyKey)
		if s.retain > 0 && len(e.lastTurnIDs) > s.retain {
			delete(e.replays, e.lastTurnIDs[0])
			e.lastTurnIDs = e.lastTurnIDs[1:]
		}
		s.mu.Unlock()
	}
	s.mu.Lock()
	e.session.TurnCount++
	e.session.State = "idle"
	s.mu.Unlock()
}

// FailTurn releases the in-flight slot without recording a replay.
func (s *Store) FailTurn(id string) {
	s.mu.Lock()
	e, ok := s.sessions[id]
	s.mu.Unlock()
	if !ok {
		return
	}
	<-e.inFlight
	s.mu.Lock()
	e.session.State = "error"
	s.mu.Unlock()
}

// Replay returns the original terminal turn recorded under key.
func (s *Store) Replay(id, key string) (turn.Turn, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.sessions[id]
	if !ok {
		return turn.Turn{}, ErrNotFound
	}
	t, ok := e.replays[key]
	if !ok {
		return turn.Turn{}, ErrIdempotencyMiss
	}
	return t, nil
}

func clone(s *Session) *Session {
	c := *s
	return &c
}

// NewID mints a random UUIDv4-shaped identifier.
func NewID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("session: entropy unavailable: " + err.Error())
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
