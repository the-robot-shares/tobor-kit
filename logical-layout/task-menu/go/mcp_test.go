package mcp

import (
	"context"
	"testing"

	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
)

func tool(name, category string) RawTool {
	return RawTool{Name: name, Description: "desc " + name, Category: category}
}

func fixtureGuide() *guide.Guide {
	return &guide.Guide{
		Core: guide.Core{Slug: "deploy-guide"},
		MCP: guide.MCP{
			Servers: []guide.MCPServer{
				{ID: "tobor", URL: "https://tobor.locker/mcp", Label: "Tobor", Required: true},
				{ID: "extra", URL: "https://extra.example/mcp", Label: "Extra"},
			},
			Allow: []string{"Github.*", "Ticket.*", "Session.*"},
			Deny:  []string{"Github.PullMerge"},
			Menu: guide.Menu{
				GroupBy: "category",
				Order:   []string{"Github", "Tickets", "Sessions"},
				Overrides: map[string]guide.MenuOverride{
					"Github.PullCreate": {Label: "Open a PR", Group: "Github", Confirm: true},
					"Ticket.Create":     {Label: "File a ticket"},
					"Session.Secret":    {Hidden: true},
				},
			},
		},
	}
}

func fakeTools() map[string][]RawTool {
	return map[string][]RawTool{
		"tobor": {
			{Name: "Github.PullCreate", Category: "Github"},
			{Name: "Github.PullMerge", Category: "Github"},
			{Name: "Ticket.Create", Category: "Tickets"},
			{Name: "Session.List", Category: "Sessions", ReadOnly: true},
			{Name: "Session.Secret", Category: "Sessions"},
			{Name: "Wildcard.Unmatched", Category: "Github"}, // filtered by allow
		},
		"extra": {
			{Name: "Ticket.Read", Category: "Tickets"},
		},
	}
}

func build(t *testing.T, g *guide.Guide, f MCPClient, refresh bool) (*Inventory, error) {
	t.Helper()
	return (&Builder{Guide: g, Client: f, Cache: NewCache(0)}).Build(context.Background(), refresh)
}

func TestInventoryOverlayAndFiltering(t *testing.T) {
	g := fixtureGuide()
	f := NewFake(fakeTools(), nil)

	inv, err := build(t, g, f, false)
	if err != nil {
		t.Fatal(err)
	}

	names := map[string]Tool{}
	for _, tool := range inv.Tools {
		names[tool.Name] = tool
	}

	// deny removes Github.PullMerge; allow removes Wildcard.Unmatched.
	if _, ok := names["Github.PullMerge"]; ok {
		t.Fatal("denied tool present")
	}
	if _, ok := names["Wildcard.Unmatched"]; ok {
		t.Fatal("tool not matching allow present")
	}
	// hidden removes Session.Secret.
	if _, ok := names["Session.Secret"]; ok {
		t.Fatal("hidden tool present")
	}

	// overlay applied server-side.
	pr := names["Github.PullCreate"]
	if pr.Label != "Open a PR" || !pr.Confirm {
		t.Fatalf("PullCreate overlay not applied: %+v", pr)
	}
	tc := names["Ticket.Create"]
	if tc.Label != "File a ticket" {
		t.Fatalf("Ticket.Create label = %q", tc.Label)
	}
	sl := names["Session.List"]
	if sl.Label != "Session.List" || !sl.ReadOnly {
		t.Fatalf("Session.List default label/read_only wrong: %+v", sl)
	}

	// groups ordered by menu.order.
	var got []string
	for _, grp := range inv.Groups {
		got = append(got, grp.ID)
	}
	want := []string{"Github", "Tickets", "Sessions"}
	if len(got) != len(want) {
		t.Fatalf("groups = %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("groups = %v, want %v", got, want)
		}
	}
}

func TestInventoryDegradedAndRequired502(t *testing.T) {
	g := fixtureGuide()
	boom := &FakeError{Msg: "connection refused"}

	// extra down (not required) → degraded entry, tobor still served.
	f := NewFake(fakeTools(), map[string]*FakeError{"extra": boom})
	inv, err := build(t, g, f, false)
	if err != nil {
		t.Fatalf("non-required outage must degrade, not fail: %v", err)
	}
	if len(inv.Degraded) != 1 || inv.Degraded[0].Server != "extra" || inv.Degraded[0].Error != "connection refused" {
		t.Fatalf("degraded = %+v", inv.Degraded)
	}
	if inv.Degraded[0].Label == "" {
		t.Fatal("degraded entry must carry a human label")
	}
	if len(inv.Tools) == 0 {
		t.Fatal("reachable server's tools missing")
	}

	// tobor down (required) → error the endpoint maps to 502.
	f2 := NewFake(fakeTools(), map[string]*FakeError{"tobor": boom})
	_, err = build(t, g, f2, false)
	var req *RequiredServerUnreachableError
	if err == nil {
		t.Fatal("required outage must fail")
	}
	if !asRequired(err, &req) || req.Server != "tobor" {
		t.Fatalf("wrong error: %v", err)
	}
}

func asRequired(err error, target **RequiredServerUnreachableError) bool {
	if e, ok := err.(*RequiredServerUnreachableError); ok {
		*target = e
		return true
	}
	return false
}

func TestGroupByServerAndNone(t *testing.T) {
	// Note: the Github.PullCreate override pins group "Github", and an
	// explicit override group wins over the group_by derivation.
	g := fixtureGuide()
	f := NewFake(fakeTools(), nil)

	g.MCP.Menu.GroupBy = "server"
	inv, _ := build(t, g, f, false)
	got := groupIDs(inv)
	want := []string{"Github", "Extra", "Tobor"} // order rank, then alphabetical
	if len(got) != len(want) {
		t.Fatalf("server groups = %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("server groups = %v, want %v", got, want)
		}
	}

	g.MCP.Menu.GroupBy = "none"
	inv, _ = build(t, g, f, false)
	got = groupIDs(inv)
	want = []string{"Github", "tools"}
	if len(got) != len(want) {
		t.Fatalf("none groups = %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("none groups = %v, want %v", got, want)
		}
	}
}

func groupIDs(inv *Inventory) []string {
	var out []string
	for _, g := range inv.Groups {
		out = append(out, g.ID)
	}
	return out
}

func TestGlobMatch(t *testing.T) {
	cases := []struct {
		pattern, name string
		want          bool
	}{
		{"Github.*", "Github.PullCreate", true},
		{"Github.*", "Github.PullMerge", true},
		{"Github.*", "Ticket.Create", false},
		{"Github.PullMerge", "Github.PullMerge", true},
		{"Github.PullMerge", "Github.PullCreate", false},
		{"Session.?ist", "Session.List", true},
		{"*", "anything.at.all", true},
	}
	for _, c := range cases {
		if got := Match(c.pattern, c.name); got != c.want {
			t.Errorf("Match(%q, %q) = %v, want %v", c.pattern, c.name, got, c.want)
		}
	}
}
