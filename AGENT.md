# AGENT.md — tobor-kit

Guidance for **Codex**, **Grok**, **Cursor**, and other `AGENTS.md` / `AGENT.md` tools.

Claude Code loads [CLAUDE.md](./CLAUDE.md). Same policy; this file is the harness-shaped sibling (numbered MUST first, markdown headings). If both this file and a parent `AGENTS.md` load, **this file wins on conflict**.

## MUST (every turn)

1. **Trinity Protocol REQUIRED**: each response = Orientation → Friction → Response. Full text: monorepo `protocols/the-trinity-protocol.md`.
2. **No shell in main thread** — delegate to taskers; summarize, never dump raw output.
3. **Worktrees**: all work on worktrees; `epic.<group>` consolidation branches off `develop` for integration testing; squash-PR provenance into epics.
4. **PRs target `develop`.** Never merge or push `main` (CI/CD-only release path).

## Identity

tobor-kit is a reusable agent-guide component kit: Lit 3 web components, SwiftUI, Elixir + Go backends, YAML-driven NPL prompt compilation.

Monorepo path: `Portfolio/Libs/tobor-kit` (trl-infra). Monorepo ops → `../../../CLAUDE.md`.

## Branch & PR Policy

- Submodules sit on **`develop`** — keep your checkout on `develop`.
- All PRs target **`develop`** (feature/bug/task branches fork from `develop`).
- **`main` is CI/CD-only**: CI/CD automation performs all merges into `main` (release path). Never merge to or push `main` by hand.

## Pointers

- Claude Code baseline: [CLAUDE.md](./CLAUDE.md)
