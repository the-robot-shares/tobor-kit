// Package mcp builds the dressed tool inventory served by GET /mcp/tools.
//
// The server discovers tools from the configured MCP servers, applies the
// guide's allow/deny globs (allow first, then deny removes), then the menu
// overlay (labels, grouping, order, hidden, confirm). Unreachable servers
// surface as degraded[] so the UI can say so; a REQUIRED unreachable server is
// a 502.
//
// The MCPClient interface is the seam: the Go port ships a fake for tests and
// local runs. Real MCP transport integration lands in the Elixir lane.
package mcp

import (
	"context"
	"sync"
	"time"

	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
)

// RawTool is a tool as discovered from an MCP server, before dressing.
type RawTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Category    string         `json:"category,omitempty"`
	ReadOnly    bool           `json:"read_only,omitempty"`
	InputSchema map[string]any `json:"input_schema,omitempty"`
}

// MCPClient discovers the tool inventory of one configured server.
type MCPClient interface {
	ListTools(ctx context.Context, server guide.MCPServer) ([]RawTool, error)
}

// Group is a menu group in the inventory response.
type Group struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// Tool is a dressed tool as defined by the OpenAPI Tool schema.
type Tool struct {
	Name        string         `json:"name"`
	Label       string         `json:"label"`
	Description string         `json:"description,omitempty"`
	Group       string         `json:"group"`
	Icon        string         `json:"icon,omitempty"`
	Server      string         `json:"server,omitempty"`
	Confirm     bool           `json:"confirm,omitempty"`
	ReadOnly    bool           `json:"read_only,omitempty"`
	InputSchema map[string]any `json:"input_schema,omitempty"`
}

// Degraded reports a server that could not be reached. Label is the human
// name for the UI — always present, falling back to the server id.
type Degraded struct {
	Server string `json:"server"`
	Label  string `json:"label"`
	Error  string `json:"error"`
}

// Inventory is the GET /mcp/tools response body.
type Inventory struct {
	Groups   []Group    `json:"groups"`
	Tools    []Tool     `json:"tools"`
	Degraded []Degraded `json:"degraded,omitempty"`
}

// RequiredServerUnreachableError marks a required server failure → 502.
type RequiredServerUnreachableError struct{ Server string }

func (e *RequiredServerUnreachableError) Error() string {
	return "required MCP server unreachable: " + e.Server
}

// Fake is an in-memory MCPClient for tests and local runs. A server with
// Err != nil is unreachable.
type Fake struct {
	mu      sync.Mutex
	servers map[string][]RawTool
	errs    map[string]error
}

// NewFake builds a fake client; tools maps server id → tools, errs maps
// server id → the error ListTools reports.
func NewFake(tools map[string][]RawTool, errs map[string]*FakeError) *Fake {
	f := &Fake{servers: tools, errs: map[string]error{}}
	for id, err := range errs {
		f.errs[id] = err
	}
	return f
}

// FakeError is a canned ListTools failure.
type FakeError struct{ Msg string }

func (e *FakeError) Error() string { return e.Msg }

// SetErr flips a server's reachability at runtime.
func (f *Fake) SetErr(serverID string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err == nil {
		delete(f.errs, serverID)
	} else {
		f.errs[serverID] = err
	}
}

func (f *Fake) ListTools(_ context.Context, server guide.MCPServer) ([]RawTool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err, ok := f.errs[server.ID]; ok {
		return nil, err
	}
	tools, ok := f.servers[server.ID]
	if !ok {
		return nil, &FakeError{Msg: "unknown server " + server.ID}
	}
	return tools, nil
}

// Cache holds the last good inventory per server. Refresh bypasses it.
type Cache struct {
	mu      sync.Mutex
	entries map[string]cached
	ttl     time.Duration
}

type cached struct {
	tools   []RawTool
	fetched time.Time
}

// NewCache builds an inventory cache with the given freshness window.
func NewCache(ttl time.Duration) *Cache {
	return &Cache{entries: map[string]cached{}, ttl: ttl}
}

func (c *Cache) get(id string, refresh bool) ([]RawTool, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[id]
	if !ok || refresh || time.Since(e.fetched) > c.ttl {
		return nil, false
	}
	return e.tools, true
}

func (c *Cache) put(id string, tools []RawTool) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[id] = cached{tools: tools, fetched: time.Now()}
}

// Builder assembles the inventory for a guide.
type Builder struct {
	Guide  *guide.Guide
	Client MCPClient
	Cache  *Cache
}

// rawTool pairs a discovered tool with its originating server.
type rawTool struct {
	server guide.MCPServer
	tool   RawTool
}

// Build produces the dressed inventory. ctx scopes discovery calls.
func (b *Builder) Build(ctx context.Context, refresh bool) (*Inventory, error) {
	inv := &Inventory{Tools: []Tool{}, Degraded: []Degraded{}}
	var raws []rawTool

	for _, server := range b.Guide.MCP.Servers {
		if tools, ok := b.Cache.get(server.ID, refresh); ok {
			raws = append(raws, wrap(server, tools)...)
			continue
		}
		tools, err := b.Client.ListTools(ctx, server)
		if err != nil {
			if server.Required {
				return nil, &RequiredServerUnreachableError{Server: server.ID}
			}
			label := server.Label
			if label == "" {
				label = server.ID
			}
			inv.Degraded = append(inv.Degraded, Degraded{Server: server.ID, Label: label, Error: err.Error()})
			continue
		}
		b.Cache.put(server.ID, tools)
		raws = append(raws, wrap(server, tools)...)
	}

	// allow (empty = all), then deny.
	allowed := make([]rawTool, 0, len(raws))
	for _, rt := range raws {
		if len(b.Guide.MCP.Allow) > 0 && !matchAny(b.Guide.MCP.Allow, rt.tool.Name) {
			continue
		}
		if matchAny(b.Guide.MCP.Deny, rt.tool.Name) {
			continue
		}
		allowed = append(allowed, rt)
	}

	// menu overlay: hidden removal + label/description/group/icon/confirm.
	type dressed struct {
		rt   rawTool
		ov   guide.MenuOverride
		tool Tool
	}
	var dressedTools []dressed
	for _, rt := range allowed {
		ov, hasOv := b.Guide.MCP.Menu.Overrides[rt.tool.Name]
		if hasOv && ov.Hidden {
			continue
		}
		d := dressed{rt: rt, ov: ov}
		t := Tool{
			Name:        rt.tool.Name,
			Label:       rt.tool.Name,
			Description: rt.tool.Description,
			Group:       b.groupFor(rt),
			Icon:        rt.tool.Category,
			Server:      rt.server.ID,
			Confirm:     false,
			ReadOnly:    rt.tool.ReadOnly,
			InputSchema: rt.tool.InputSchema,
		}
		if hasOv {
			if ov.Label != "" {
				t.Label = ov.Label
			}
			if ov.Description != "" {
				t.Description = ov.Description
			}
			if ov.Group != "" {
				t.Group = ov.Group
			}
			if ov.Icon != "" {
				t.Icon = ov.Icon
			}
			t.Confirm = ov.Confirm
		}
		d.tool = t
		dressedTools = append(dressedTools, d)
	}

	// order: menu.order first, remaining groups alphabetically; tools within a
	// group follow menu override insertion order then name.
	groupRank := func(g string) int {
		for i, o := range b.Guide.MCP.Menu.Order {
			if o == g {
				return i
			}
		}
		return len(b.Guide.MCP.Menu.Order)
	}
	sortTools(dressedTools, func(a, b dressed) bool {
		ga, gb := a.tool.Group, b.tool.Group
		ra, rb := groupRank(ga), groupRank(gb)
		if ra != rb {
			return ra < rb
		}
		if ga != gb {
			return ga < gb
		}
		return a.tool.Name < b.tool.Name
	})

	seen := map[string]bool{}
	for _, d := range dressedTools {
		inv.Tools = append(inv.Tools, d.tool)
		if !seen[d.tool.Group] {
			seen[d.tool.Group] = true
			inv.Groups = append(inv.Groups, Group{ID: d.tool.Group, Label: d.tool.Group})
		}
	}
	sortGroups(inv.Groups, groupRank)
	return inv, nil
}

func wrap(server guide.MCPServer, tools []RawTool) []rawTool {
	out := make([]rawTool, 0, len(tools))
	for _, t := range tools {
		out = append(out, rawTool{server: server, tool: t})
	}
	return out
}

func (b *Builder) groupFor(rt rawTool) string {
	switch b.Guide.MCP.Menu.GroupBy {
	case "none":
		return "tools"
	case "server":
		if rt.server.Label != "" {
			return rt.server.Label
		}
		return rt.server.ID
	default: // category
		if rt.tool.Category != "" {
			return rt.tool.Category
		}
		return rt.server.ID
	}
}

func sortGroups(groups []Group, rank func(string) int) {
	for i := 1; i < len(groups); i++ {
		for j := i; j > 0; j-- {
			a, b := groups[j], groups[j-1]
			if rank(a.ID) < rank(b.ID) || (rank(a.ID) == rank(b.ID) && a.ID < b.ID) {
				groups[j], groups[j-1] = groups[j-1], groups[j]
			} else {
				break
			}
		}
	}
}

func sortTools[T any](items []T, less func(a, b T) bool) {
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && less(items[j], items[j-1]); j-- {
			items[j], items[j-1] = items[j-1], items[j]
		}
	}
}

// matchAny reports whether name matches any glob. Globs support `*` (any run
// of characters, not crossing nothing — tool names are dot-qualified so
// "Github.*" matches every Github tool) and `?` for one character.
func matchAny(globs []string, name string) bool {
	for _, g := range globs {
		if Match(g, name) {
			return true
		}
	}
	return false
}

// Match is a minimal glob matcher: `*` matches any run of characters (so
// "Github.*" matches every Github tool), `?` matches exactly one, everything
// else is literal.
func Match(pattern, name string) bool {
	px, nx := 0, 0
	star, mark := -1, 0
	for nx < len(name) {
		if px < len(pattern) && (pattern[px] == '?' || pattern[px] == name[nx]) {
			px++
			nx++
		} else if px < len(pattern) && pattern[px] == '*' {
			star = px
			mark = nx
			px++
		} else if star >= 0 {
			px = star + 1
			mark++
			nx = mark
		} else {
			return false
		}
	}
	for px < len(pattern) && pattern[px] == '*' {
		px++
	}
	return px == len(pattern)
}
