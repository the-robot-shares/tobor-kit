package turn

import (
	"context"
	"strings"
	"testing"
	"unicode/utf8"
)

func collectScripted(t *testing.T, text string) (deltas []string, turn *Turn) {
	t.Helper()
	var terminal *Turn
	_, err := ScriptedRunner{}.Run(context.Background(), Input{Text: text}, func(e Event) error {
		if e.Name == EventDelta {
			deltas = append(deltas, e.Data.(map[string]string)["text"])
		}
		if e.Name == EventMessage {
			tv := e.Data.(Turn)
			turn = &tv
			terminal = &tv
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if terminal == nil {
		t.Fatal("no terminal message event")
	}
	return deltas, turn
}

// Regression: the scripted delta split must land on a rune boundary. A raw
// byte split cuts multi-byte UTF-8 sequences in half, producing invalid
// string halves over the wire.
func TestScriptedRunnerDeltaSplitRuneBoundary(t *testing.T) {
	inputs := []string{
		"សូមជួយរៀបចំផែនការ emoji 🎌 និង ASCII mix 123", // Khmer + emoji + ASCII, odd/even byte lengths
		"0x00 celebración 🚀🚀🚀", // 3-byte emoji run
		"aé",                   // minimal odd-length multi-byte case
		"日本語のテキスト",             // entirely multi-byte
	}
	for _, in := range inputs {
		deltas, turn := collectScripted(t, in)
		want := "On it. " + in
		if turn.Content != want {
			t.Errorf("content = %q, want %q", turn.Content, want)
		}
		if len(deltas) != 2 {
			t.Fatalf("got %d deltas, want 2", len(deltas))
		}
		if got := deltas[0] + deltas[1]; got != want {
			t.Errorf("reassembled %q, want %q", got, want)
		}
		for i, d := range deltas {
			if !utf8.ValidString(d) {
				t.Errorf("delta[%d] %q is not valid UTF-8 (input %q)", i, d, in)
			}
		}
	}
}

func TestScriptedRunnerASCIISplitUnchanged(t *testing.T) {
	deltas, _ := collectScripted(t, "hello world")
	if deltas[0]+deltas[1] != "On it. hello world" {
		t.Errorf("ASCII deltas = %q + %q, reassembly wrong", deltas[0], deltas[1])
	}
	if len(deltas[0]) != len("On it. hello world")/2 {
		t.Errorf("ASCII split point moved: %d bytes, want %d", len(deltas[0]), len("On it. hello world")/2)
	}
}

func TestScriptedRunnerEmptyInputError(t *testing.T) {
	var sawError bool
	_, err := ScriptedRunner{}.Run(context.Background(), Input{}, func(e Event) error {
		if e.Name == EventError {
			sawError = true
		}
		return nil
	})
	if err == nil || !sawError {
		t.Errorf("empty input: err=%v sawError=%v, want error + error event", err, sawError)
	}
	if !strings.Contains(err.Error(), "empty input") {
		t.Errorf("err = %v, want empty-input error", err)
	}
}
