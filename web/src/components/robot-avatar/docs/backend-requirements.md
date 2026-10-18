# Backend requirements — tobor-robot-avatar

None required. Host tells it the state; it never infers.

## Contract

`tobor-robot-avatar` is a view. It renders exactly the `state` attribute/property the host sets (`idle`, `listening`, `thinking`, `speaking`, `tool_running`, `error`, `offline`). Unknown values clamp to `idle`.

There are **no endpoints** to implement. Do not point this tag at the Guide API, the voice gateway, or the auth socket.

| `backend` (configurator) | Production tree |
|---|---|
| `none` | — |

## What the host must do

Set `state` (and optionally `renderer`, `asset`, `reduced-motion`, `label`, `states`, `avatar`) from **your** session. Typical source is the SSE `state` event on `POST /sessions/{id}/turn`, applied by `<tobor-guide-panel>` or an equivalent orchestrator. This element does not subscribe to that stream.

## What this element does not do

- Infer state from microphone level, WebRTC, playback, or fetch activity
- Open sockets, send cookies, or attach `Authorization`
- Redirect, `Set-Cookie`, payment, or CSRF
- Persist anything (no localStorage, no cookies)

Examples under `examples/` only **serve a page** that mounts the tag. They are not a backend for the avatar.
