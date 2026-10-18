# Backend requirements — noizu-waitlist

`backend: external`. Production API is **ForYou** at `https://foryou.therobotlives.com`. It is **not** implemented in this repo’s `elixir/`, `go/`, or `backend/` trees. Family `examples/{elixir,go,python,rust}/` show a host serving the island **and** the same public list/signup HTTP contract the element calls.

The element never sends cookies, bearer tokens, or CSRF fields (`credentials: 'omit'`, `mode: 'cors'`). Host JWT / session / Set-Cookie / redirects / payment are out of scope.

## Default origin

| | |
|---|---|
| Default `api` | `https://foryou.therobotlives.com` |
| Override | `api` attribute / property / `data-foryou-api` (origin only, no trailing slash required) |

Empty `api` still uses the default.

## Auth

Anonymous. **Credentials omit** on every `fetch`. Do not set `Access-Control-Allow-Credentials: true`. CORS may be `Access-Control-Allow-Origin: *` with `GET, POST, OPTIONS` and headers `Accept, Content-Type`. JSON POST triggers a CORS preflight when the page origin differs from `api`.

## URL resolution

`{api}` is the stripped origin.

| When | List URL (GET manifest, POST `{url}/signups`) |
|---|---|
| `slug` nonempty | `{api}/api/v1/public/lists/{slug}` |
| else `service` and `list` nonempty | `{api}/api/v1/public/services/{service}/lists/{list}` |
| else | no request; fallback email field only |

`slug` / `service` / `list` are URI-encoded. Signup path is the list URL plus `/signups`.

## GET list manifest

```
GET {listUrl}
Accept: application/json
credentials: omit
```

### 200 body

```json
{
  "list": {
    "name": "Beta",
    "description": "Early access.",
    "opt_in_mode": "single",
    "settings": {"success_message": "You're on the list!"},
    "attributes": [
      {
        "slug": "email",
        "name": "Email",
        "type": "email",
        "required": true,
        "is_identity": true,
        "sort_order": 0,
        "options": [],
        "validation": {}
      }
    ]
  }
}
```

| Field | Role |
|---|---|
| `list.name` / `list.description` | Heading / lead copy |
| `list.opt_in_mode` | `"double"` → default success “Check your inbox to confirm your spot.”; anything else → “You're on the list!” |
| `list.settings.success_message` | Overrides the default success copy when nonempty |
| `list.attributes` | Fields. Empty / missing → fallback required `email`. Types: `email`, `string`, `text`, `int`, `float`, `date`, `guid`, `select`, `multiselect`. `options` is `{label, value}[]` (or strings). `validation`: `pattern`, `min`, `max`, `length`. `is_identity` / `isIdentity` accepted. Unknown `type` → `string`. |

### GET status codes

| Status | Island |
|---|---|
| 200 | Render the form |
| 404 | Unavailable + copy “This sign-up form isn't available right now.” + `waitlist-error` `{status: 404}` |
| other !ok | Unavailable + “We couldn't load this form. Please try again later.” + `waitlist-error` |
| network / abort | Same unavailable copy; `status: null` (abort is silent) |

## POST signups

```
POST {listUrl}/signups
Content-Type: application/json
Accept: application/json
credentials: omit
```

### Body the element sends

```json
{
  "values": {"email": "a@b.co"},
  "source": "widget",
  "company_website": ""
}
```

| Field | Rules |
|---|---|
| `values` | Coerced visible fields only. Empty strings omitted; `int`/`float` numeric; `multiselect` is `string[]` when nonempty. |
| `source` | Resolved `source` (default `widget`). |
| `company_website` | **Honeypot.** Hidden `name="company_website"` input. Humans leave it `""`. Treat a nonempty value as a bot and **do not persist**; still return **202**. |

### POST status codes

ForYou **always-202** on accept (including discarded honeypot traffic). The island treats any non-4xx as success and records `detail.status` from the response.

| Status | Island |
|---|---|
| 202 (and other 2xx/3xx) | Success UI + `waitlist-success` `{values, status, source}` |
| 429 | Stay on form; “Too many attempts — please wait a moment and try again.” + `waitlist-error` |
| other 4xx/5xx | Stay on form; “Something went wrong — please try again.” + `waitlist-error` |
| network | Same generic copy; `status: null` |

Do not 302 the browser; the island does not follow a signup with navigation.

## What the component does not do

- Set-Cookie, `credentials: 'include'`, Authorization headers
- CSRF tokens, JWT, session cookies
- Redirects after success
- Payment
- Server-side verification beyond posting JSON
- Reading or writing host session storage

## Production vs examples

| Tree | Role |
|---|---|
| ForYou (`foryou.therobotlives.com`) | Production lists + signups |
| `examples/elixir`, `examples/go`, `examples/python`, `examples/rust` | Copy-paste host: serve the island **and** GET/POST handlers on the real paths |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
