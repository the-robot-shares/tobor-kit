# Project Layout

tobor-kit is a reusable agent-guide component kit spanning six surfaces:
Lit 3 web components, SwiftUI, Elixir backend, Go backend, YAML-driven NPL
prompt compiler, and shared schema/OpenAPI contracts. Entry point:
[`README.md`](../README.md).

```
tobor-kit/
├── schema/                    # Shared data contracts → [layout/schema.md](layout/schema.md)
├── compiler/                  # Elixir NPL prompt compiler → [layout/compiler.md](layout/compiler.md)
├── web/                       # Lit 3 component package (@noizu/tobor-kit) → [layout/web.md](layout/web.md)
├── swift/                     # SwiftUI components (ToborKitCore, SPM) → [layout/swift.md](layout/swift.md)
├── elixir/                    # Elixir reference backend → [layout/elixir.md](layout/elixir.md)
├── go/                        # Go backend port → [layout/go.md](layout/go.md)
├── backend/                   # Node voice-backend prototype (@noizu/tobor-voice-backend)
├── hologram/                  # Elixir Hologram app wrapping the kit for Elixir-side rendering
├── logical-layout/            # Read-only per-component nav view across trees → [layout/logical-layout.md](layout/logical-layout.md)
├── openapi/                   # OpenAPI 3.1 guide API contract (tobor-kit.openapi.yaml)
├── helm/                      # Vendored Helm chart (tobor-kit: deployment, service, InfisicalSecret)
├── scripts/                   # CI/CD + CDN publish tooling → [layout/scripts.md](layout/scripts.md)
├── docs/                      # Long-form docs (CONVENTIONS, auth-socket, SWIFT-CONVENTIONS, …)
├── .github/workflows/         # CI (ci.yml) + Lit CDN publish (publish-lit.yml)
├── .tool-versions             # Toolchain pins (asdf/mise)
├── Dockerfile                 # Container image for the backend services
├── Makefile                   # Lit isolation validation targets (isolation-setup/run/report)
├── Package.swift              # Swift package manifest (root, SPM)
├── AGENT.md / AGENTS.md       # Agent guidance (kept aligned)
├── CI.md                      # CI pipeline notes
├── CLAUDE.md                  # Claude Code guidance
└── README.md                  # Start here — contracts + surfaces overview
```

## Key Files Requiring Setup

| File | Action |
|------|--------|
| `.tool-versions` | Install pinned toolchains (asdf/mise) |
| `elixir/config/*.exs` | Elixir backend runtime config (see `elixir/` README) |
| `helm/tobor-kit/values.yaml` | Chart values — Infisical secret refs required per env |

## Component Surfaces

Every kit component (auth, voice-agent, transcript-view, …) exists as slices
across trees: `web/src/components/<name>/`, `elixir/lib/tobor_kit/components/<domain>/`,
Swift mirrors beside the lit element, `go/internal/<domain>/`, `schema/`.
Use `logical-layout/<name>/` to navigate a component's full footprint —
it is a symlink view only, never a build input.
