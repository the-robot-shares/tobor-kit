# tobor-voice-agent configuration

Family tag: `tobor-voice-agent`. Implementation: `voice-agent.ts`. Condensed usage stays in `README.md`; this file is the options list.

The element is a Shadow DOM island. It posts host configuration to an authenticated voice gateway, then renders transcript, avatar state, and controls. Hosts own redirects, cookies, and provider secrets.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|------|------|----------|---------|----------|-------|
| `organization` | string | yes | `""` | no | Session scope. JS alias: `org`. |
| `project` | string | yes | `""` | no | Session scope. |
| `backendUrl` / `backend-url` | url | yes | `""` | no | Gateway origin for `POST {backendUrl}/voice/sessions`. Not a provider base URL. Falls back to `location.origin` when empty (still required for a working host). |
| `backend` | string | no | `"litellm"` | no | Logical provider name. Server policy allowlists it. Never treated as an outbound URL. |
| `engine` | `"openai-realtime"` \| `"elevenlabs"` \| `"tts"` | no | `"openai-realtime"` | no | JS alias: `voiceMode`. |
| `model` | string | no | `"gpt-realtime-mini"` | no | Must be allowed by gateway policy. |
| `voice` | string | no | `""` | no | Optional provider voice id. |
| `ttsModel` / `tts-model` | string | no | `""` | no | Optional speech model (ElevenLabs / TTS). |
| `systemPrompt` / `system-prompt` | string | no | `"You are a helpful voice assistant."` | no | May be rejected when the gateway disables overrides. |
| `tools` | `unknown[]` | no | `[]` | — | **JS property only.** Requested tool names. Server catalog is authoritative. |
| `mcpTools` | `string[]` | no | `[]` | — | **JS property only.** |
| `avatarGroups` | `AvatarGroup[]` | no | Orbit / Pip / Nova from `createAvatarGroups` | — | **JS property only.** `{id,label,default,states}`. |
| `avatarGroup` / `avatar-group` | string | no | `""` | no | Selects `avatarGroups` by `id`. |
| `avatar` | `AvatarGroup` | no | unset | — | **JS property only.** Overrides group selection. `src` is an image URL; SVG markup is never injected. |
| `contextActions` | `ContextAction[]` | no | all actions | — | **JS property only.** Empty array hides the menu. Disabled actions cannot be turned back on from the UI. |
| `label` | string | no | `"Voice agent"` | no | Header + nested avatar label. |
| `fetchImpl` | `typeof fetch` | no | `fetch` | — | Test/host injection. Not a playground field. |
| `socketFactory` | `(url: string) => WebSocket` | no | `new WebSocket(url)` | — | Test/host injection. |
| `realtimeConnector` | function | no | `connectOpenAIRealtime` | — | Test/host injection. |

`ContextAction`: `configure-model` \| `configure-prompt` \| `configure-tools` \| `configure-avatar` \| `copy-transcript` \| `clear-transcript` \| `disconnect`.

Read-only display state (not attributes): `connection` (`disconnected` \| `connecting` \| `ready`), `agentState` (canonical guide state), `transcript` (`{id,role,text,final}[]`), `config` (posted session payload).

Changing session keys while connected sets pending configuration and disables new inputs until `connect()` / Reconnect.

## Events

Bubbling, composed `CustomEvent`s.

| Name | Detail | When |
|------|--------|------|
| `tobor-agent-ready` | `{sessionId}` | Backend frame `ready` or `session.ready`. |
| `tobor-agent-transcript` | `{entry, transcript}` | A transcript row is inserted or merged. |
| `tobor-agent-state` | `{state}` | Canonical avatar/agent state changes. |
| `tobor-agent-error` | `{message}` | Session, media, or backend error. |
| `tobor-agent-event` | `AgentServerEvent` | Each accepted backend frame after ready. |

React wrapper `VoiceAgent` maps `onReady`, `onTranscript`, `onState`, `onError`.

## Methods

| Name | Args | Notes |
|------|------|-------|
| `connect()` | — | `POST {backendUrl}/voice/sessions` with `config`, then open `websocketUrl`. Waits for `ready`. |
| `disconnect()` | — | Closes socket, realtime peer, recorder, and audio. |
| `sendText(text?)` | composer draft if omitted | No-op until `connection === "ready"` and not pending. Realtime uses the data channel; otherwise `input.text`. |
| `sendImage(dataUrl, kind?, text?)` | `kind`: `"image"` (default) or `"screenshot"` | PNG / JPEG / WebP data URL. Combined payload ≤ 8 MB. |
| `toggleVoice()` | — | Realtime: attach/detach mic. TTS / ElevenLabs: record clip, submit `input.audio` on stop (push-to-talk). |
| `captureScreenshot()` | — | User-gesture `getDisplayMedia`; tracks stop after one still. |
| `interrupt()` | — | Stops queued/playing audio immediately; sends `interrupt {turnId}`; realtime also `response.cancel`. |

## Slots

| Name | Purpose |
|------|---------|
| `footer` | Host content below controls. |

## CSS custom properties / `::part()`

| Token | Default | Where |
|-------|---------|--------|
| `--tobor-agent-color` | `#e8edf7` | Host text |
| `--tobor-agent-border` | `#34425a` | Panel border |
| `--tobor-agent-background` | `#101827` | Panel background |
| `--tobor-kit-robot-size` | `96px` | Nested `<tobor-robot-avatar>` |
| `--tobor-kit-robot-accent` | theme accent | Nested avatar |
| `--tobor-kit-robot-shell` | theme surface | Nested avatar |
| `--tobor-kit-robot-edge` | theme border | Nested avatar |
| `--tobor-kit-robot-visor` | `#0d0f16` | Nested avatar |

`tobor-voice-agent` exposes no `::part()` names. Nested `tobor-robot-avatar` parts: `image`, `svg`, `antenna`, `head`, `visor`, `torso`, `eyes`, `mouth`, `badge`, `thinking-dots`.

## `data-testid` / `data-cy` hooks

Registry `cy_prefix`: `agent`. Hooks are grandfathered `data-testid="agent-*"` (not `data-cy`).

| Hook | Control |
|------|---------|
| `agent-status` | Connection · agent state |
| `agent-pending` | Reconnect notice |
| `agent-connect` | Connect / Reconnect |
| `agent-disconnect` | Disconnect |
| `agent-options` | Context menu |
| `agent-configure-model` | Action |
| `agent-configure-prompt` | Action |
| `agent-configure-tools` | Action |
| `agent-configure-avatar` | Action |
| `agent-copy-transcript` | Action |
| `agent-clear-transcript` | Action |
| `agent-disconnect` (menu) | Action (same prefix as header button when listed) |
| `agent-transcript` | Live log |
| `agent-input` | Composer (resize both; Ctrl/Cmd+Enter sends) |
| `agent-send` | Send text |
| `agent-mic` | Microphone (`aria-pressed`) |
| `agent-interrupt` | Interrupt |
| `agent-image` | File input |
| `agent-screenshot` | Site screenshot |
| `agent-config` | Configuration region |
| `agent-config-engine` | Engine select |
| `agent-config-model` | Model |
| `agent-config-voice` | Voice |
| `agent-config-ttsModel` | Speech model |
| `agent-config-systemPrompt` | System prompt |
| `agent-config-mcpTools` | MCP tool names |
| `agent-config-avatar` | Avatar group select |

## Avatar states

Backend `animation.state` is authoritative. Seven canonical states:

| State | Motion |
|-------|--------|
| `idle` | Slow vertical float |
| `listening` | Soft pulse |
| `thinking` | Float, 1.8s |
| `speaking` | Pulse, 0.45s |
| `tool_running` | Float, 0.8s |
| `error` | One 0.3s shake |
| `offline` | Still, desaturated |

`prefers-reduced-motion: reduce` stops motion. Nested avatar `reducedMotion="force_static"` also freezes (`data-motion="static"`). Per-state artwork falls back to group `default`, then the glyph renderer. `createAvatarGroups(baseUrl)` ships Orbit, Pip, and Nova 4×2 sprite sheets.

## Theming

Shadow DOM. Set `--tobor-agent-*` on the host or a parent. Robot tokens apply to the inner avatar. Do not style by invented class names; registry classes are empty for this tag.
