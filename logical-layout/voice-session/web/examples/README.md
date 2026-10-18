# tobor-voice-session examples

Copy a snippet, point `ToborKitClient` at a real Guide API, mount the tag.

These files are **not** the production servers. Voice minting lives in
`elixir/` (reference) and `go/` (port). Examples call `POST /voice/token`;
they do not hold a provider API key.

| Host | File | Start here when |
|------|------|-----------------|
| CDN / static HTML | `html/embed.html` | Import-map or CDN script tag |
| npm, vanilla JS | `js/embed.js` | Bundler or native ESM |
| npm, TypeScript | `ts/embed.ts` | Typed mount + kit events |
| Phoenix / Plug / Hologram | `elixir/embed.ex` | Serve the page; pass `/api/tobor-kit` to `ToborKit.Endpoint` |
| Go `net/http` | `go/embed.go` | Serve the page; reverse-proxy the Guide API |
| FastAPI / stdlib | `python/embed.py` | Serve the page; proxy `POST /voice/token` to elixir/go |
| axum | `rust/embed.rs` | Same as Python |

Local Guide API:

```sh
# elixir/ — Bandit on :8080 when ToborKit.HTTP is enabled
# go/
go run ./cmd/tobor-kit-go \
  -guide ../schema/examples/deploy-guide.guide.yaml \
  -bundle ../compiler/test/tobor_kit/golden/deploy-guide.bundle.json
```

`client`, `voice`, and `adapterFactory` are JS properties — do not serialize
them as HTML attributes. Do not put bearer tokens, provider keys, or session
cookies in markup.

`POST /voice/token`: **409** native (expected), **503** disabled / unconfigured.
