# tobor-kit Go

Go port of the tobor-kit Guide API backend. Implements the frozen contract in
`../openapi/tobor-kit.openapi.yaml` — the point is proving that contract is
implementation-neutral. The Elixir tree is the reference implementation; this
port mirrors its semantics, nothing more.

## Layout

```
go.mod                     module github.com/the-robot-lives/tobor-kit/go (go 1.25)
cmd/tobor-kit-go/          server entrypoint
config/policy.example.yaml deployment knobs (paths, OTel endpoint, TTLs)
internal/bundle/           frozen bundle loader; byte-exact bundle_hash recipe
internal/guide/            guide-definition runtime sections + GuideProjection
internal/mcp/              tool inventory: allow/deny globs, menu overlay, degraded[]; fake MCP client
internal/session/          session store, in-flight 409 lock, idempotency replay
internal/turn/             SSE event names, Turn type, Runner seam + scripted runner
internal/telemetry/        consent resolution, redaction, per-exchange OTel span
internal/auth/             OIDC PKCE (state/nonce/verifier), bearer middleware
internal/transcript/       Store interface + in-memory impl (backend store only)
internal/server/           HTTP surface, mounted at /api/tobor-kit
```

## Conformance notes

- **bundle_hash** is `sha256:` + hex over the compact, key-sorted JSON encoding
  of the bundle minus the hash field, matching `compiler/lib/tobor_kit/compiler/json.ex`
  byte-for-byte (Jason-compatible escaping; no HTML escaping). Verified against
  the committed golden bundle in `internal/bundle`.
- **SSE** streams the six frozen event names (`state`, `delta`, `tool_call`,
  `tool_result`, `message`, `error`); a stream always terminates with exactly
  one `message` or one `error`.
- **Telemetry**: content attributes only when consent resolves on;
  `telemetry.redact[]` applies even when consent is on; PUT 403 when the guide
  is not user-overridable.
- **PKCE**: state is consumed before the token exchange, compared in constant
  time; the issuer is trailing-slash-normalized before discovery (Authentik
  per-provider issuers otherwise 404).

The MCP client and the turn Runner are seams: this tree ships a fake MCP client
and a scripted runner for tests and local runs; real MCP transport and model
driving are the reference lane's integration job.

## Run

```
go test ./...
go run ./cmd/tobor-kit-go -guide ../schema/examples/deploy-guide.guide.yaml \
  -bundle ../compiler/test/tobor_kit/golden/deploy-guide.bundle.json
```
