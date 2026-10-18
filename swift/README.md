# ToborKit — Swift surface

SwiftUI robot guide + component mirrors for embedding a tobor-kit guide into
iOS (17+) and macOS (14+) apps. SPM package rooted at the repo root (see
`docs/SWIFT-CONVENTIONS.md`), Swift 6 language mode, zero third-party
dependencies.

```
ToborKit (Package.swift at repo root)
├── swift/
│   ├── Sources/ToborKitCore/  # Pure Swift, no SwiftUI — headless-testable
│   │   ├── Auth/              # PKCE (S256 only), token stores, OIDC client
│   │   ├── Models/            # GuideProjection, Session, Turn, ToolInventory, …
│   │   ├── Networking/        # GuideClient (one method per operationId), transport seam
│   │   ├── SSE/               # Incremental parser + turn-stream assembler
│   │   ├── Transcript/        # TranscriptStoring: memory + on-device `local` store
│   │   └── Voice/             # VoiceAdapting protocol, connection state, token host
│   ├── Catalog/               # ToborKitCatalog executable: the Swift component
│   │                          # browser (`swift run ToborKitCatalog`), mirroring
│   │                          # infra.noizu.com/lit-dev
│   └── Tests/
└── web/src/components/<slug>/swift/   # INTERSPERSED mirrors — live next to
                                       # the lit element they mirror
```

## Component mirrors (lit ↔ Swift)

Each mirror lives inside the lit component's folder so the pair stays in sync
by proximity. Full rules: `docs/SWIFT-CONVENTIONS.md`.

| Lit element | Swift type(s) | Folder |
|---|---|---|
| `tobor-guide-panel` | `GuidePanelView`, `GuideModel` | `guide-panel/swift/` |
| `tobor-robot-avatar` | `RobotAvatarView` | `robot-avatar/swift/` |
| `tobor-task-menu` | `TaskQueueStripView`, `ToolApprovalQueue` | `task-menu/swift/` |
| `tobor-telemetry-toggle` | `TelemetryConsentToggle` | `telemetry-toggle/swift/` |
| `noizu-model-config` | `ModelConfigView`, `ModelCatalog` | `model-config/swift/` |
| `tobor-llm-inference` | `LLMInferenceSettingsView`, `LLMInferenceClient`, `LLMInferenceConfig`, `LLMProvider` | `llm-inference/swift/` |
| `tobor-persona-card` / `-picker` | `PersonaCardView`, `PersonaPickerView` | `persona/swift/` |

Shared tokens (not a mirror): `styleguide/swift/ToborTheme.swift`.

Adding a mirror: files under `<slug>/swift/`, listed in the `uiSources`
inventory in `Package.swift`, entry in `swift/Catalog/ComponentCatalog.swift`,
row in the table above.

## Contract discipline

`ToborKitCore/Networking/GuideClient.swift` implements
`openapi/tobor-kit.openapi.yaml` and nothing else. The behavioral rules the
whole kit shares (and whose violation is the drift it exists to prevent):

- The client never sees the compiled NPL preamble. `GET /guide` returns a
  config projection; no model type here can hold prompt text.
- Guide states come from the SSE `state` event; the avatar is a state machine
  over exactly `idle, listening, thinking, speaking, tool_running, error,
  offline`. No client-side inference.
- The task menu renders `GET /mcp/tools` verbatim. The server applies the
  `mcp.menu` overlay; nothing client-side re-dresses labels/groups/order.
  `degraded[]` is surfaced in the UI, never dropped.
- `GET /transcript` 501 (`transcriptNotBackendStored`) is distinct from an
  empty page and distinct from an error state.
- `POST /voice/token` 409 is the *expected* answer for the `native` adapter
  (`VoiceTokenOutcome.notRequired`), not a failure.
- Telemetry consent: `source: forced` (or `user_overridable: false` — either
  signal alone) renders no toggle; `PUT` 403 maps to a distinct error.
- SSE streams terminate with exactly one `message` or `error`; anything else
  is `ToborError.streamEndedPrematurely`.
- Tokens live in the Keychain (never `UserDefaults`); voice credentials are
  short-lived and server-minted; no code path accepts a provider API key.

## Usage sketch

```swift
let client = GuideClient(baseURL: URL(string: "https://host/api/tobor-kit")!)
let model = GuideModel(client: client)
// floating companion:
GuidePanelView(model: model)
```

Auth (when `auth.required`):

```swift
let oidc = try OIDCAuthClient(auth: projection.auth, redirectURI: "app://callback")
let client = GuideClient(baseURL: base, auth: oidc)
// open oidc.authorizationURL() in ASWebAuthenticationSession, then:
_ = try await oidc.handleCallback(url: redirectURL)
```

## Tests

`swift test` — 77 tests, all green on macOS host. Core covers SSE parsing (all
six event names, premature close, post-terminal frames, unknown events),
projection/consent/inventory decoding, 501-vs-empty, 409-expected, PKCE (incl.
the RFC 7636 Appendix B vector), the OIDC round trip against a scripted
transport, and both transcript stores. UI smoke tests mount every view for all
seven states in a live `NSHostingView`.
