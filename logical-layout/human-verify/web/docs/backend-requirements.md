# Backend requirements — noizu-human-verify

`backend: external`. The kit **never verifies**. `<noizu-human-verify>` only collects a browser token and emits `verified`. The host MUST POST that token to the provider’s **siteverify** API with the **secret key** that never leaves the server.

There is no kit HTTP route in `elixir/`, `go/`, or `backend/`. Family `examples/{elixir,go,python,rust}/` show a host serving the island **and** a same-origin `POST /verify` that calls siteverify.

## What the component does not do

- Call siteverify (Turnstile or reCAPTCHA)
- Hold or accept a secret / API secret
- Treat `verified` as proof of a human
- Set-Cookie, CSRF, JWT, session cookies
- Redirects, payment
- reCAPTCHA v2 checkbox / hCaptcha

`site-key` on the element is the **public** site key only.

## Event the host MUST consume

Bubbling, composed:

```json
{ "provider": "turnstile" | "recaptcha-v3" | "none", "token": "" }
```

| `provider` | `token` | Host |
|---|---|---|
| `none` | `""` | Host opted out. Do **not** call siteverify. Accept or reject per host policy. |
| `turnstile` | widget token | POST Cloudflare siteverify with server secret |
| `recaptcha-v3` | `grecaptcha.execute` token | POST Google siteverify with server secret; check `score` / `action` |

Never trust this event alone (it can be synthesized in DevTools).

## Host pattern (examples)

Not a kit contract — copy-paste from `examples/`. Same-origin, no cookies required.

```
POST /verify
Content-Type: application/json
```

```json
{ "provider": "turnstile", "token": "<from verified.detail>" }
```

| Status | Body | When |
|---|---|---|
| 200 | `{ok: true, skipped: true}` | `provider` is `none` |
| 200 | `{ok: true}` | siteverify `success: true` (and reCAPTCHA `action` matches when present) |
| 400 | `{ok: false, error: "token required"}` | widget provider with empty token |
| 403 | `{ok: false, error: "verification failed", "error-codes": []}` | siteverify `success: false` |
| 501 | `{ok: false, error: "set TURNSTILE_SECRET"}` / `set RECAPTCHA_SECRET` | secret env missing |
| 502 | `{ok: false, error: "siteverify unreachable"}` | upstream network error |

Optional: pass `remoteip` through to siteverify (not required by the island).

Auth: none on the example route. Production hosts own CSRF, rate limits, and session binding.

## Cloudflare Turnstile siteverify

```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
Content-Type: application/x-www-form-urlencoded
```

| Field | Source |
|---|---|
| `secret` | Server env `TURNSTILE_SECRET` — **never** on the element |
| `response` | `verified.detail.token` |
| `remoteip` | optional, host-derived |

200 body (shape):

```json
{
  "success": true,
  "challenge_ts": "2022-02-28T15:14:30.096Z",
  "hostname": "example.com",
  "error-codes": [],
  "action": "signup",
  "cdata": ""
}
```

Host should confirm `success === true` and, when present, `action` equals the element `action` (default `signup`).

Widget script (element-injected, public): `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`.

## Google reCAPTCHA v3 siteverify

```
POST https://www.google.com/recaptcha/api/siteverify
Content-Type: application/x-www-form-urlencoded
```

| Field | Source |
|---|---|
| `secret` | Server env `RECAPTCHA_SECRET` — **never** on the element |
| `response` | `verified.detail.token` |
| `remoteip` | optional, host-derived |

200 body (shape):

```json
{
  "success": true,
  "score": 0.9,
  "action": "signup",
  "challenge_ts": "2022-02-28T15:14:30Z",
  "hostname": "example.com",
  "error-codes": []
}
```

Host should confirm `success === true`, `action` matches, and `score` meets a host-chosen threshold (Google suggests 0.5 as a starting point). The kit does not score.

Widget script (element-injected, public): `https://www.google.com/recaptcha/api.js?render=<public-site-key>`.

## Secrets

| Name | Where | Role |
|---|---|---|
| Turnstile **site** key | HTML `site-key` | public |
| Turnstile **secret** key | server env `TURNSTILE_SECRET` | siteverify only |
| reCAPTCHA **site** key | HTML `site-key` | public |
| reCAPTCHA **secret** key | server env `RECAPTCHA_SECRET` | siteverify only |

Do not put secrets in attributes, examples, or client JS.

## Production vs examples

| Tree | Role |
|---|---|
| Cloudflare / Google siteverify | Production verification |
| `examples/elixir`, `examples/go`, `examples/python`, `examples/rust` | Copy-paste host: serve the island **and** `POST /verify` → siteverify |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
