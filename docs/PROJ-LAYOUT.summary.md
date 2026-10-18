# PROJ-LAYOUT (summary)

Quick-reference tree for tools/agents. Detail: [`PROJ-LAYOUT.md`](PROJ-LAYOUT.md).

```
tobor-kit/
├── schema/                # YAML guide-definition schema + examples
├── compiler/              # Elixir NPL prompt compiler
├── web/                   # Lit 3 component package (@noizu/tobor-kit)
├── swift/                 # SwiftUI components (ToborKitCore, SPM)
├── elixir/                # Elixir reference backend
├── go/                    # Go backend port
├── backend/               # Node voice-backend prototype
├── hologram/              # Elixir Hologram app wrapping the kit
├── logical-layout/        # Read-only per-component symlink nav view
├── openapi/               # OpenAPI 3.1 guide API contract
├── helm/                  # Vendored Helm chart (tobor-kit)
├── scripts/               # CI/CD + CDN publish tooling
├── docs/                  # Long-form docs + PROJ-LAYOUT/ARCH/schema docs
├── .github/workflows/     # ci.yml, publish-lit.yml
├── .tool-versions
├── Dockerfile
├── Makefile               # Lit isolation validation targets
├── Package.swift
├── AGENT.md / AGENTS.md / CI.md / CLAUDE.md
└── README.md
```
