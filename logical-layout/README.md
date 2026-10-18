# logical-layout/ — per-component view across trees

The real sources stay nested per tree (`web/src/components/<name>/`,
`elixir/lib/tobor_kit/components/<domain>/`, `web/src/components/<name>/swift/…` (Swift mirrors live beside their lit element),
`go/internal/<domain>/`, `schema/`). This folder is a **read-only navigation
view**: one folder per component holding RELATIVE symlinks to that
component's slices in each tree. Nothing here is a build input — edit the
real files through these links or in place; compilers and tests never touch
`logical-layout/`.

`web` → Lit/TS component sources · `elixir` → backend domain modules ·
`swift` → SwiftUI views/models (suffixed variants when a component spans
more than one file) · `go` → backend domain package · `schema` → the frozen
guide-definition contract (shared, listed under `guide-panel`).

Shared domains: `task-menu` and `tool-list` both point at the shared
`mcp` elixir/go packages.
