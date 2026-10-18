# tobor-voice-session — configuration

Full options surface for `<tobor-voice-session>`. Condensed usage lives in
[../README.md](../README.md). If the two drift, this file wins.

## Tags

| Tag | Role |
|---|---|
| `tobor-voice-session` | Mic control + voice adapter host |

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `client` | `ToborKitClient` | yes | — | no | JS property only. `start()` is a no-op until this is set. Used to `POST /voice/token`. |
| `voice` | `GuideVoice` | no | — | no | JS property only. Projection voice block: `{adapter?, push_to_talk?, mint_path?, locale?}`. Omitted `adapter` constructs the **realtime** adapter. Explicit `none` disables voice. |
| `pushToTalk` (`push-to-talk`) | boolean | no | `false` | yes | Hold-to-talk when true (`pointerdown`/`pointerup`); click-to-toggle otherwise. Usually copied from `voice.push_to_talk`. |
| `adapterFactory` | `typeof createVoiceAdapter` | no | `createVoiceAdapter` | no | JS property only. Test seam; hosts should not set this. |

`client`, `voice`, and `adapterFactory` are never HTML attributes.

## Events

All events bubble and are composed.

| Event | Detail | When |
|---|---|---|
| `tobor-voice-state` | `{state: GuideState}` | Adapter reports a canonical guide state (`idle`, `listening`, `thinking`, `speaking`, `tool_running`, `error`, `offline`) |
| `tobor-voice-transcript` | `{entry: {speaker: "user" \| "guide", text: string, final: boolean}}` | A transcript entry arrives |
| `tobor-voice-error` | `{error: {code: string, message: string}}` | The session errors (disabled adapter, mint failure, provider error, …) |

`start()` resolves even when the adapter fails; failure is reported via `tobor-voice-error` / `tobor-voice-state`.

## Methods

| Method | Signature | Purpose |
|---|---|---|
| `start` | `start(): Promise<void>` | Build the adapter, mint a credential if needed, and begin capture |
| `stop` | `stop(): Promise<void>` | Tear down the adapter and return to `idle` |
| `sendText` | `sendText(text: string): void` | Forward typed text through the active adapter (realtime data channel / native TTS / backend TTS) |

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Tokens come from the shared kit theme (`web/src/components/mode-toggle/theme.ts`).

| Token | Default | Role |
|---|---|---|
| `--tobor-kit-accent` | `#6ee7c7` | Pressed mic fill / focus ring |
| `--tobor-kit-accent-fg` | `#08130f` | Text on accent |
| `--tobor-kit-muted` | `#9aa0b4` | Status label |
| `--tobor-kit-danger` | `#ff6b6b` | Status label when `data-state="error"` |
| `--tobor-kit-border` | `#2c2f3d` | Mic outline |
| `--tobor-kit-fg` | `#e8e9f0` | Inherited text |
| `--tobor-kit-radius` | `12px` | Control radius (mic is forced circular) |

| `::part()` | Node |
|---|---|
| `mic` | Start/stop button |
| `status` | Human-readable state label |

## `data-cy` / `data-testid` hooks

Registry `cy_prefix`: `voice`. This element still uses grandfathered `data-testid` hooks (no `data-cy` attributes yet).

| Hook | Selector | Node |
|---|---|---|
| mic | `[data-testid="voice-mic"]` | Push-to-talk / toggle button (`aria-pressed`, `aria-label`) |
| status | `[data-testid="voice-status"]` | Status span; `data-state` mirrors `GuideState` |

## Theming

Shadow + shared `--tobor-kit-*` tokens. Do not pierce Shadow DOM; set tokens on `:host` or an ancestor. Light-DOM host CSS cannot style the mic or status except through parts/tokens.
