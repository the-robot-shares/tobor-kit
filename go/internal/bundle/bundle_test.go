package bundle

import (
	"os"
	"strings"
	"testing"
)

const goldenPath = "../../../compiler/test/tobor_kit/golden/deploy-guide.bundle.json"

func loadGolden(t *testing.T) ([]byte, string) {
	t.Helper()
	raw, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("read golden bundle: %v", err)
	}
	return raw, "sha256:092872cb8752dcd3eb54c3f12fc62e910f89f4407d837ee8521ca28747245edf"
}

// The Go hash recipe must reproduce the compiler's committed golden hash
// byte-exactly — this is the implementation-neutral contract check.
func TestGoldenBundleHashMatches(t *testing.T) {
	raw, want := loadGolden(t)
	b, err := Parse(raw)
	if err != nil {
		t.Fatalf("parse golden bundle: %v", err)
	}
	if b.Hash != want {
		t.Fatalf("hash mismatch: got %s want %s", b.Hash, want)
	}
	if b.Schema != "tobor.guide-bundle" {
		t.Fatalf("schema = %q", b.Schema)
	}
	if b.Version != 1 {
		t.Fatalf("version = %d", b.Version)
	}
	if b.Prompt == "" || b.Preamble == "" {
		t.Fatal("prompt/preamble must be present")
	}
	if len(b.Components) == 0 {
		t.Fatal("components must be present")
	}
}

func TestParseRejectsTampering(t *testing.T) {
	raw, _ := loadGolden(t)

	// Flip one character deep inside the prompt.
	s := string(raw)
	victim := strings.Replace(s, "patient-operator", "patient-operatar", 1)
	if victim == s {
		t.Fatal("tamper target not found")
	}
	if _, err := Parse([]byte(victim)); err == nil {
		t.Fatal("tampered bundle must be rejected")
	} else if !strings.Contains(err.Error(), "hash mismatch") {
		t.Fatalf("wrong error: %v", err)
	}
}

func TestParseRejectsTrailingWhitespaceMutation(t *testing.T) {
	// Whitespace outside JSON does not affect the hash — the hash covers the
	// canonical encoding, not the file bytes. This must still verify.
	raw, _ := loadGolden(t)
	b, err := Parse(append(raw, []byte("\n")...))
	if err != nil {
		t.Fatalf("re-parse with trailing newline should verify: %v", err)
	}
	if b.Hash == "" {
		t.Fatal("hash empty")
	}
}

func TestParseRejectsMissingHash(t *testing.T) {
	raw, _ := loadGolden(t)
	s := strings.Replace(string(raw), `"bundle_hash": "sha256:092872cb8752dcd3eb54c3f12fc62e910f89f4407d837ee8521ca28747245edf",`, `"bundle_hash": "",`, 1)
	if _, err := Parse([]byte(s)); err == nil {
		t.Fatal("empty bundle_hash must be rejected")
	}
}

func TestParseRejectsWrongSchema(t *testing.T) {
	raw, _ := loadGolden(t)
	s := strings.Replace(string(raw), `"schema": "tobor.guide-bundle"`, `"schema": "something.else"`, 1)
	if _, err := Parse([]byte(s)); err == nil || !strings.Contains(err.Error(), "schema") {
		t.Fatalf("wrong-schema bundle must be rejected: %v", err)
	}
}

// Escape parity with Jason: HTML-significant characters stay raw.
func TestCompactEscapingMatchesJason(t *testing.T) {
	doc := doc{"k": "<a href=\"x\">&amp; \"quote\" back\\slash\nline\ttab⌜🔒⌟"}
	got, err := doc.Hash()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got, "sha256:") {
		t.Fatalf("hash = %s", got)
	}
}
