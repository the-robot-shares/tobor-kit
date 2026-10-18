# tobor-kit Swift mirror conventions

This file governs the **SwiftUI surface** of tobor-kit: the Swift mirrors of
the lit components and the rules that keep each mirror pair conceptually
aligned. The lit spec (`docs/CONVENTIONS.md`) stays authoritative for the
web side; where the two disagree about *behavior*, the lit element and its
tests win and the Swift mirror follows.

Companion: `swift/README.md` (usage + target map).

---

## 1. Interspersed layout (the rule)

A Swift mirror lives **inside the lit component's folder**, not in a parallel
Swift tree:

```
web/src/components/<slug>/
├── <slug>.ts                 # lit element
├── configurator.ts
├── examples/
├── test/
├── README.md
└── swift/                    # the Swift mirror
    ├── <TypeName>.swift
    └── …
```

Lit and Swift variants of the same agent component therefore stay in sync by
proximity: a change to an element's props/events is visible in the same diff
as its mirror.

Because the sources span both trees, the **package root is the repo root**
(`Package.swift` at the tobor-kit root). SPM cannot auto-discover `.swift`
files inside a folder that also holds TypeScript, so the `ToborKitUI` target
enumerates its sources explicitly. Adding a mirror means:

1. add the files under `web/src/components/<slug>/swift/`,
2. add them to the `uiSources` inventory in `Package.swift`,
3. add an entry to `swift/Catalog/ComponentCatalog.swift` (the browser),
4. update the mirror table in `swift/README.md`.

## 2. Targets

| Target | Path | Contents |
|---|---|---|
| `ToborKitCore` | `swift/Sources/ToborKitCore` | Pure Swift, no SwiftUI: OpenAPI client, models, SSE, auth. Headless-testable. |
| `ToborKitUI` | `web/src/components` (enumerated) | Every Swift mirror + shared tokens. |
| `ToborKitCatalog` | `swift/Catalog` | The component browser executable (see §5). |

Platforms: macOS 14+ and iOS 17+, Swift 6 language mode, zero third-party
dependencies. Keep view code multiplatform where practical; platform-only
APIs need a guard, not a fork.

## 3. Mirroring rules

- **Props down, callbacks up.** A lit element's properties/attributes map to
  the Swift view's init parameters; its events map to callbacks
  (`model-change` → `onModelChange`, `tobor-task-invoked` → `onInvoke`).
  Sentinels keep their exact string values (`inherit`, `custom:`) so host
  storage is format-compatible across platforms.
- **Contract discipline is inherited, not re-derived.** Whatever
  `docs/CONVENTIONS.md` and the OpenAPI contract say the web element may not
  do, the Swift mirror may not do either: no client-side state inference, no
  re-dressing of the task menu, no prompt text in any model type, masked
  API-key echoes are data and are never logged or overwritten.
- **The lit folder is a family; so is the mirror.** Multiple elements in one
  folder (`persona/` → card + picker) mirror to multiple types in the same
  `swift/` subfolder.
- **Shared tokens are not a mirror.** `styleguide/swift/ToborTheme.swift`
  holds the token set; it maps the `--tobor-*` CSS custom properties onto
  SwiftUI colors and ignores unknown keys.

## 4. Mirror table

| Lit element | Swift type(s) | Folder |
|---|---|---|
| `tobor-guide-panel` | `GuidePanelView`, `GuideModel` | `web/src/components/guide-panel/swift/` |
| `tobor-robot-avatar` | `RobotAvatarView` | `web/src/components/robot-avatar/swift/` |
| `tobor-task-menu` | `TaskQueueStripView`, `ToolApprovalQueue` | `web/src/components/task-menu/swift/` |
| `tobor-telemetry-toggle` | `TelemetryConsentToggle` | `web/src/components/telemetry-toggle/swift/` |
| `noizu-model-config` | `ModelConfigView` (+ `ModelCatalog.swift` semantics) | `web/src/components/model-config/swift/` |
| `llm-inference` (`tobor-llm-inference`) | `LLMInferenceSettingsView`, `LLMInferenceClient`, `LLMInferenceConfig`, `LLMProvider`, `LLMModality` | `web/src/components/llm-inference/swift/` |
| `tobor-persona-card` / `tobor-persona-picker` | `PersonaCardView`, `PersonaPickerView` | `web/src/components/persona/swift/` |

Not yet mirrored (pattern above applies when they are): `voice-agent`,
`voice-session`, `transcript-view`, `chat-thread`, `mode-toggle`,
`tool-list`, `mcp-config`, `npl-queue-board`, and the non-agent islands.

## 5. Component browser

`swift run ToborKitCatalog` launches the Swift mirror of the infra browser
(`infra.noizu.com/lit-dev`): catalog sidebar grouped by the YAML `group`
field, detail pane with description + tag, and a **live preview** fed with
sample data. The registry is `swift/Catalog/ComponentCatalog.swift`; it
mirrors the fields of the web catalog (`data/lit-components.yaml` in the
infra repo) — the YAML stays the source of truth for the web side, and the
Swift registry must be updated in the same change as any mirror.

## 6. Tests

- Mirror logic that is pure (parsing, selection semantics, masked-key
  handling) gets unit tests in `swift/Tests/ToborKitUITests/` ported from the
  lit element's `test/` suite where applicable.
- Every view gets a construct-and-render smoke test over its canonical
  states (see `ViewSmokeTests.swift`) — a view that fails to build for any
  state is a shipped crash.
