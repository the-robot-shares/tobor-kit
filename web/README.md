# @noizu/tobor-kit

Lit 3 element kit for the [tobor-kit Guide API](../openapi/tobor-kit.openapi.yaml) —
a drop-in robot guide panel (avatar, voice, transcript, MCP task menu) for any
web host, with React wrappers included.

The frontend **never sees the compiled NPL preamble**. It consumes the config
projection from `GET /guide` and nothing prompt-shaped ever reaches this code.

Portfolio islands (`<noizu-waitlist>`, `<noizu-cookie-consent>`, `<noizu-faq>`) ship from this same package (`@noizu/tobor-kit/waitlist`, `/cookie`, `/faq`). Name freeze: `registry.yaml`.

Family layout (configurator, docs, backend examples, Cypress stubs): **[`docs/CONVENTIONS.md`](../docs/CONVENTIONS.md)**. Each element lives in `src/components/<slug>/`.

## Install

```bash
npm install @noizu/tobor-kit
# lit is a peer dependency — bring your own (must not be bundled):
npm install lit
```

## Quick start

### Script (any framework, or none)

```html
<script type="module">
  import "@noizu/tobor-kit/guide-panel.js";
</script>

<tobor-guide-panel></tobor-guide-panel>
```

The panel fetches `GET /api/tobor-kit/guide` itself. To point it elsewhere or
pass a bearer token:

```html
<tobor-guide-panel base-url="https://host.example/api/tobor-kit" token="…"></tobor-guide-panel>
```

### React

```tsx
"use client";
import { GuidePanel } from "@noizu/tobor-kit/react.js";

<GuidePanel client={client} guide={projection} onTurnMessage={(e) => …} />;
```

### Individual elements

Every subpath export loads standalone — importing one element never drags the
rest of the kit in:

```js
import "@noizu/tobor-kit/robot-avatar.js";
import { ToborKitClient } from "@noizu/tobor-kit/client.js";
import { createVoiceAdapter } from "@noizu/tobor-kit/voice.js";
import { createMemoryStore, createLocalStore, createBackendStore } from "@noizu/tobor-kit/transcript-store.js";
```

## Elements

| Tag | Subpath | Job |
|---|---|---|
| `<tobor-guide-panel>` | `./guide-panel.js` | Orchestrator: header + avatar, modes, turn streaming, task menu, tool list, telemetry footer |
| `<tobor-robot-avatar>` | `./robot-avatar.js` | State machine over the seven canonical guide states |
| `<tobor-mode-toggle>` | `./mode-toggle.js` | voice ⇄ text ⇄ transcript switcher |
| `<tobor-voice-session>` | `./voice-session.js` | Mic button + voice adapter host |
| `<tobor-transcript-view>` | `./transcript-view.js` | Conversation log with distinct empty / not-server-backed states |
| `<tobor-task-menu>` | `./task-menu.js` | Server-dressed MCP task menu with confirm step |
| `<tobor-tool-list>` | `./tool-list.js` | Browsable tool inventory, degraded servers surfaced |
| `<tobor-login-flow>` | `./login-flow.js` | OIDC Authorization Code + PKCE (helpers exported for framework use) |
| `<tobor-telemetry-toggle>` | `./telemetry-toggle.js` | Consent toggle; renders nothing when consent is forced |
| — | `./react.js` | `@lit/react` wrappers for all of the above |

### `<tobor-robot-avatar>`

The avatar is a pure state machine over `idle, listening, thinking, speaking,
tool_running, error, offline` — it renders exactly what it is told and never
infers a state from voice activity or network traffic. The SSE `state` event
is the single source of truth.

- Properties: `state`, `renderer` (`lottie | sprite | glyph`), `asset`,
  `states` (from `ui.robot.states` — per-state segment/loop/speed),
  `reduced-motion` (`respect | force_static | ignore`), `label`.
- `glyph` (inline SVG, zero dependencies) is implemented in full and is the
  default. `lottie`/`sprite` share the same state interface; until art lands
  they fall back to the glyph and say so via `data-renderer-fallback`.
- `reduced_motion: respect` freezes animation when `prefers-reduced-motion:
  reduce` matches; `force_static` always freezes; the element exposes
  `data-motion="animated|static"`.
- Themable via `--tobor-kit-robot-shell`, `-edge`, `-visor`, `-accent`, `-size`.

### `<tobor-guide-panel>`

Properties: `client` (ToborKitClient) or `baseUrl` + `token`; `guide` (an
already-fetched projection — otherwise the panel fetches it); `placement`
(from `ui.panel.placement`); `start-expanded`.

Events up: `tobor-turn-submitted`, `tobor-turn-message`, `tobor-turn-error`,
`tobor-state-change`, `tobor-task-invoked`.

The panel streams turns over SSE (`POST /sessions/{id}/turn`), drives the
avatar from `state` events, accumulates `delta` into a pending bubble, and
finalizes on the guaranteed single terminal `message` or `error`. A stream
that closes without either surfaces `stream_incomplete` — the avatar never
spins forever. A task-menu selection rides the next turn as the advisory
`task_id`.

### `<tobor-task-menu>` / `<tobor-tool-list>`

Both are views over the same `GET /mcp/tools` response, which the server has
already dressed (allow/deny, labels, grouping, order, hidden, confirm). They
render it **verbatim** — the overlay is never re-applied client-side, so web
and Swift cannot drift. `degraded[]` servers are rendered prominently in both;
a shortened list is information, not an accident to hide.

`confirm: true` tools get a two-step inline confirmation in the task menu
before `tobor-task-select` fires. Selecting a tool does not invoke it — it
names the tool the guide should prefer next turn.

Events: `tobor-task-select`, `tobor-tool-select` — `detail.tool` is the
contract `Tool` object.

### `<tobor-telemetry-toggle>`

Reads `GET /telemetry/consent`. When the resolved `source` is `forced` (or
`user_overridable` is false) it renders **nothing** — a toggle that cannot
change anything is a lie in the UI. `PUT /telemetry/consent` answering 403
makes the element revert to inert. Event: `tobor-telemetry-change`.

### `<tobor-transcript-view>`

Properties: `turns`, `load` (a backend-store load outcome), `store`,
`pending` (streaming text). A `GET /sessions/{id}/transcript` answer of 501
renders the dedicated *not server-backed* notice — distinct from the empty
state, never an error. Event: `tobor-transcript-clear`.

### `<tobor-voice-session>`

Builds the adapter named by `voice.adapter` in the projection. `realtime`
mints an ephemeral token via `POST /voice/token` (409 for `native` is the
expected answer, not a failure) and exchanges SDP directly with the provider —
the client never holds a provider key. Properties: `client`, `voice`,
`push-to-talk`, `adapter-factory` (test seam). Events: `tobor-voice-state`
(canonical `GuideState`), `tobor-voice-transcript`, `tobor-voice-error`.

### `<tobor-login-flow>`

OIDC Authorization Code + PKCE from the projection's `auth` block, including
the Authentik trailing-slash issuer quirk. Framework-free helpers
(`beginLogin`, `completeLogin`, `buildAuthorizeUrl`, `exchangeCode`) are
exported for hosts that run their own flow. Events: `tobor-auth-redirect`,
`tobor-auth-token`, `tobor-auth-error`.

## Theming

All styling goes through CSS custom properties on `:host` — no shadow piercing:

| Property | Default | Role |
|---|---|---|
| `--tobor-kit-bg` | `#12131a` | Panel background |
| `--tobor-kit-surface` | `#1b1d27` | Cards, assistant bubbles |
| `--tobor-kit-fg` | `#e8e9f0` | Text |
| `--tobor-kit-muted` | `#9aa0b4` | Secondary text |
| `--tobor-kit-accent` | `#6ee7c7` | Accent (user bubbles, active states) |
| `--tobor-kit-accent-fg` | `#08130f` | Text on accent |
| `--tobor-kit-border` | `#2c2f3d` | Borders |
| `--tobor-kit-danger` / `--tobor-kit-warn` | red / amber | Error + confirm badges |
| `--tobor-kit-radius`, `-gap`, `-shadow`, `-duration` | … | Shape + rhythm |
| `--tobor-kit-panel-width` | `360px` | Panel width |
| `--tobor-kit-robot-size`, `-shell`, `-edge`, `-visor`, `-accent` | … | Avatar |

The projection's free-form `ui.theme` map is applied by the guide panel: keys
become `--tobor-kit-*` variables (e.g. `"--tobor-accent": "#7c5cff"` →
`--tobor-accent`; keys already starting with `--` are applied as-is).

## API client

`ToborKitClient` (subpath `./client.js`) implements
`openapi/tobor-kit.openapi.yaml` and nothing else. Status codes the contract
gives meaning to are returned as typed outcomes, not thrown:
`mintVoiceToken()` → `{ok:false, reason:"not_required"}` on 409;
`setTelemetryConsent()` → `{ok:false, reason:"forbidden"}` on 403;
`getTranscript()` → `{supported:false}` on 501. A custom `fetchImpl` is
supported for tests and non-browser hosts.

## Development

```bash
npm install
npm run build      # tsc declarations + vite multi-entry build + lit-external assertion
npm test           # @web/test-runner suite + node react-wrapper smoke
npm run typecheck  # strict tsc over src + tests
```

The build fails if `lit`, `@lit/*` or `react` end up bundled into `dist/` —
they are peer dependencies and every entry imports them externally.

## Standard authentication

`noizu-auth` provides modal/interstitial/dropdown sign-in and email-first registration over either of two selectable transports: a same-host WebSocket (default, cookie session) or `transport="rest"` against `POST {api-base}/auth/*` with Bearer-token sessions. See [component API and theming](src/components/auth/README.md), [backend adapter](../docs/auth-socket.md), and [demo](examples/auth.html).
