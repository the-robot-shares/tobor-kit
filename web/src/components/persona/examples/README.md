# persona family examples

No backend. Copy a snippet and mount `<tobor-persona-card>` and
`<tobor-persona-picker>`. The **host supplies the persona list**. Select emits
`persona-select` — do not treat it as navigation. Never put secrets on the
element.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to
`vendor/` — no import map. npm installs keep `lit` as a peer
(`import '@noizu/tobor-kit/persona-card.js'` /
`import '@noizu/tobor-kit/persona-picker.js'`).

Optional: load `robot-avatar.js` to fill the card `avatar` slot.

Server languages serve the page. They do not implement a persona API. Echo
`persona-select` in page JS if the host wants to persist; routing stays on the
host.

Contract: [../docs/backend-requirements.md](../docs/backend-requirements.md).
