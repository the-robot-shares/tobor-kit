// Package bundle loads frozen tobor-kit prompt bundles and verifies their
// content hash.
//
// The bundle file is the compiler's output: pretty-printed, sorted-key JSON
// with a trailing newline. The hash is computed over the COMPACT, sorted-key
// encoding of the bundle with the bundle_hash field removed — byte-identical
// to compiler/lib/tobor_kit/compiler/json.ex compact/1 fed to :crypto.hash.
//
// JSON escaping matches Jason: only `"`, `\`, control characters (short forms
// for \b \f \n \r \t, \u00xx for the rest) are escaped; `<`, `>`, `&` and
// non-ASCII characters are emitted raw. Key order is byte-wise lexicographic.
package bundle

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

// Version / Schema are the discriminator fields the compiler stamps.
const (
	SchemaField = "tobor.guide-bundle"
)

// Bundle is the frozen compiled guide. Only the fields the backend needs are
// typed; the full document round-trips through Doc for hashing.
type Bundle struct {
	Hash       string
	Schema     string
	Version    int
	Core       map[string]any
	Components []string
	Expression string
	Prompt     string
	Preamble   string
}

// doc is the full bundle document, kept key-faithful so hashing sees exactly
// what the compiler hashed.
type doc map[string]any

// LoadFile reads, parses, and hash-verifies a bundle JSON file.
func LoadFile(path string) (*Bundle, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(raw)
}

// Parse verifies a bundle from raw JSON bytes.
func Parse(raw []byte) (*Bundle, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var d doc
	if err := dec.Decode(&d); err != nil {
		return nil, fmt.Errorf("bundle: invalid JSON: %w", err)
	}
	if d["schema"] != SchemaField {
		return nil, fmt.Errorf("bundle: schema %v, want %q", d["schema"], SchemaField)
	}
	claimed, _ := d["bundle_hash"].(string)
	if claimed == "" {
		return nil, fmt.Errorf("bundle: missing bundle_hash")
	}
	got, err := d.Hash()
	if err != nil {
		return nil, err
	}
	if got != claimed {
		return nil, fmt.Errorf("bundle: hash mismatch: bundle_hash %q does not match computed %q (tampered or stale bundle)", claimed, got)
	}
	b := &Bundle{Hash: claimed, Prompt: "", Preamble: ""}
	if s, ok := d["schema"].(string); ok {
		b.Schema = s
	}
	if v, ok := d["version"].(json.Number); ok {
		if i, err := v.Int64(); err == nil {
			b.Version = int(i)
		}
	}
	if m, ok := d["core"].(map[string]any); ok {
		b.Core = m
	}
	if e, ok := d["expression"].(string); ok {
		b.Expression = e
	}
	if p, ok := d["prompt"].(string); ok {
		b.Prompt = p
	}
	if p, ok := d["preamble"].(string); ok {
		b.Preamble = p
	}
	if cs, ok := d["components"].([]any); ok {
		for _, c := range cs {
			if s, ok := c.(string); ok {
				b.Components = append(b.Components, s)
			}
		}
	}
	return b, nil
}

// Hash computes "sha256:<hex>" over the compact, sorted-key encoding of the
// document minus bundle_hash. The recipe must match the compiler's Json.compact
// byte-for-byte.
func (d doc) Hash() (string, error) {
	body := make(map[string]any, len(d)-1)
	for k, v := range d {
		if k == "bundle_hash" {
			continue
		}
		body[k] = v
	}
	var buf bytes.Buffer
	if err := compact(&buf, body); err != nil {
		return "", fmt.Errorf("bundle: canonical encode: %w", err)
	}
	sum := sha256.Sum256(buf.Bytes())
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}

// HashBytes is Hash for an already-decoded value tree (maps, slices, strings,
// json.Number). Numbers must be json.Number so integer formatting survives.
func HashBytes(v any) (string, error) {
	var buf bytes.Buffer
	if err := compact(&buf, v); err != nil {
		return "", err
	}
	sum := sha256.Sum256(buf.Bytes())
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}

func compact(buf *bytes.Buffer, v any) error {
	return encode(buf, v)
}

func encode(buf *bytes.Buffer, v any) error {
	switch x := v.(type) {
	case nil:
		buf.WriteString("null")
	case bool:
		if x {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
	case json.Number:
		buf.WriteString(x.String())
	case string:
		encodeString(buf, x)
	case []any:
		buf.WriteByte('[')
		for i, e := range x {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := encode(buf, e); err != nil {
				return err
			}
		}
		buf.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		buf.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			encodeString(buf, k)
			buf.WriteByte(':')
			if err := encode(buf, x[k]); err != nil {
				return err
			}
		}
		buf.WriteByte('}')
	default:
		return fmt.Errorf("bundle: unhashable value type %T", v)
	}
	return nil
}

func encodeString(buf *bytes.Buffer, s string) {
	buf.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			buf.WriteString(`\"`)
		case '\\':
			buf.WriteString(`\\`)
		case '\b':
			buf.WriteString(`\b`)
		case '\f':
			buf.WriteString(`\f`)
		case '\n':
			buf.WriteString(`\n`)
		case '\r':
			buf.WriteString(`\r`)
		case '\t':
			buf.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(buf, `\u%04x`, r)
			} else {
				buf.WriteRune(r)
			}
		}
	}
	buf.WriteByte('"')
}
