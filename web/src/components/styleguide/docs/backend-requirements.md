# Backend requirements — styleguide family

**None required.**

`<noizu-sg-btn>`, `<noizu-sg-card>`, `<noizu-sg-card-grid>`, `<noizu-sg-status>`, `<noizu-sg-input>`, `<noizu-sg-spec-table>`, and `<noizu-sg-steps>` do not call a server, set cookies, or verify session. They are host-only Shadow DOM atoms. There is no production tree in `elixir/`, `go/`, or `backend/` for this family.

## Auth

None on the elements.

## Host-owned navigation

`noizu-sg-card` with a nonempty `href` renders an inner `<a>`. Click still emits cancelable `sg-card-select` `{href}`. The **host** owns redirects: `preventDefault()` on that event to stop the browser from following the link. The elements do **not** `location.assign`, `Set-Cookie`, take payment, or hold secrets.

`noizu-sg-input` emits `sg-input` `{value}`. The **host** owns submit, validation beyond the `error` flag, and persistence.

`noizu-sg-spec-table` `rows` and `noizu-sg-steps` `steps` / `noizu-sg-status` copy are **text**. The islands never interpret markup (`unsafeHTML` / `dangerouslySetInnerHTML`).

Optional echo used in `examples/` (not a kit API): page JS may `console.log` or persist events. Do not put API keys or session cookies on the tags.

## What the components do not do

- HTTP / WebSocket / Stripe
- `Set-Cookie`, CSRF, JWT, or `credentials: 'include'`
- Redirects (unless the inner `<a>` is allowed to navigate)
- Server-side verification
- HTML rendering of spec / step / status / input strings

## Examples vs production

| Tree | Role |
|---|---|
| `examples/html`, `examples/js`, `examples/ts` | Mount the tags, listen for `sg-click` / `sg-card-select` / `sg-input` |
| `examples/{elixir,go,python,rust}` | Serve the page |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this family |
