// Package transcript defines backend-stored transcript access.
//
// Only the `backend` transcript store is server-backed; `memory` and `local`
// stores live client-side and the endpoints answer 501 so a misconfigured
// client fails loudly instead of showing an empty transcript.
package transcript

import (
	"errors"
	"sync"
	"time"

	"github.com/the-robot-lives/tobor-kit/go/internal/turn"
)

// ErrNotBackend marks the 501 path: the guide does not use the backend store.
var ErrNotBackend = errors.New("transcript: guide does not use the backend transcript store")

// ErrNotFound marks the 404 path for an unknown session.
var ErrNotFound = errors.New("transcript: no stored transcript for session")

// Store persists turns for server-backed access.
type Store interface {
	Append(sessionID string, t turn.Turn) error
	List(sessionID string, limit int, before *time.Time) ([]turn.Turn, bool, error)
	Delete(sessionID string) error
}

// MemoryStore is the in-memory Store implementation.
type MemoryStore struct {
	mu       sync.Mutex
	sessions map[string][]turn.Turn
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{sessions: map[string][]turn.Turn{}}
}

func (m *MemoryStore) Append(sessionID string, t turn.Turn) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[sessionID] = append(m.sessions[sessionID], t)
	return nil
}

// List returns up to limit turns oldest-first; hasMore reports whether older
// turns remain beyond the returned window.
func (m *MemoryStore) List(sessionID string, limit int, before *time.Time) ([]turn.Turn, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	all, ok := m.sessions[sessionID]
	if !ok {
		return nil, false, ErrNotFound
	}
	if before != nil {
		kept := all[:0]
		for _, t := range all {
			if t.CreatedAt.Before(*before) {
				kept = append(kept, t)
			}
		}
		all = kept
	}
	if limit <= 0 {
		limit = 200
	}
	hasMore := false
	if len(all) > limit {
		all = all[len(all)-limit:]
		hasMore = true
	}
	out := make([]turn.Turn, len(all))
	copy(out, all)
	return out, hasMore, nil
}

func (m *MemoryStore) Delete(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.sessions[sessionID]; !ok {
		return ErrNotFound
	}
	delete(m.sessions, sessionID)
	return nil
}
