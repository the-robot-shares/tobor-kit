# Backend requirements — cookie family

**None required.**

`<noizu-cookie-consent>` and `<noizu-cookie-settings>` are browser islands. They persist consent in `localStorage` and coordinate with window events. There is no kit HTTP API, WebSocket, cookie header, or production tree (`elixir/`, `go/`, `backend/`) for this family.

## What the components do not do

- Set `Set-Cookie` or HttpOnly session cookies
- Redirect
- Verify consent on a server
- CSRF, payments, or authentication
- Carry secrets or tokens

## Default storage

Key: `start-app.cookie-consent.v1` (`storage-key` attribute / `storageKey` property).

Value JSON:

```json
{
  "version": 1,
  "categories": {
    "necessary": true,
    "analytics": false,
    "marketing": false,
    "preferences": false
  },
  "acceptedAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`necessary` is always `true`. `acceptedAt` is set on the first save and kept; `updatedAt` is set on every save. Invalid JSON, missing `categories`, or `version !== 1` is treated as no consent.

## Events the host MAY persist

| Channel | Name | Detail |
|---|---|---|
| element (bubbles, composed) | `cookie-consent-change` | `ConsentState \| null` |
| `window` alias | `start-app:cookie-consent-change` | same |

The host MAY listen and store the payload (Phoenix session, JWT `PUT`, analytics gate, etc.). That store is host-owned, not a kit contract.

Optional echo used in `examples/{elixir,go,python,rust}/` (not a production route):

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/consent` | JSON body = event `detail` | `{ok: true, consent: <body>}` |

No auth. Examples skip CSRF (`:api` / raw JSON). Production hosts own CSRF, auth, and persistence.

## Settings reopen

`<noizu-cookie-consent>` listens on `window` for `cookie-settings-open`.

`<noizu-cookie-settings>` dispatches `cookie-settings-open` (bubbles, composed) on click.

## Examples vs production

`examples/html|js|ts` mount the two tags. `examples/{elixir,go,python,rust}` serve the page and optionally echo `POST /consent`. They are not production servers.
