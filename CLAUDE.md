# CLAUDE.md — tobor-kit

tobor-kit is a reusable agent-guide component kit: Lit 3 web components, SwiftUI, Elixir + Go backends, YAML-driven NPL prompt compilation.

Monorepo path: `Portfolio/Libs/tobor-kit` (trl-infra). Monorepo ops → `../../../CLAUDE.md`.

## Universal Rules

- **Trinity Protocol REQUIRED**: each response = Orientation → Friction → Response. Full text: monorepo `protocols/the-trinity-protocol.md`.
- **No shell in main thread** — delegate to taskers; summarize, never dump raw output.
- **Worktrees**: all work on worktrees; `epic.<group>` consolidation branches off `develop` for integration testing; squash-PR provenance into epics.

## Branch & PR Policy

- Submodules sit on **`develop`** — keep your checkout on `develop`.
- All PRs target **`develop`** (feature/bug/task branches fork from `develop`).
- **Releases are manual:** after checks pass, merge a `develop` → `main` release PR with a regular merge commit, never squash. No workflow may promote branches automatically. Keep local checkouts on `develop` and fast-forward them after PRs merge.
- CI builds and publishes release artifacts and updates chart tags after the manual merge to `main`; ArgoCD syncs those chart updates. Do not push source changes directly to `main`.
