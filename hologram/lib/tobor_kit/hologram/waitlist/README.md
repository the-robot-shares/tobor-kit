# waitlist mirror (phase 2, group A)

Mirror of `web/src/components/waitlist/noizu-waitlist.ts` (+ `model.ts`) —
contract class B + commands. Module: `ToborKit.Hologram.Waitlist.Form`.

**Embed with a `cid`** — without it the Hologram renderer treats the
component as stateless and `init/3` never runs.

## Usage

```holo
<Waitlist.Form cid="waitlist" slug="launch" target="page" />
```

Host wiring (needed unless the public `api` attr is set):

```elixir
config :tobor_kit_hologram, :host_config,
  waitlist_api: %{base_url: "https://foryou.therobotlives.com"}
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `slug` | string | `""` | list slug (manifest key) |
| `service` | string | `""` | service+`list` pair alternative to slug |
| `list` | string | `""` | see above |
| `api` | string | `""` | public API base; overrides `:waitlist_api` when set |
| `source` | string | `""` | attribution source; default `widget` |
| `target` | string | `parent` | notification target |
| `class` | string | `""` | extra root class |

The `data-foryou-*` attribute aliases die at the boundary (§3) — hosts pass
the canonical props.

## Command contract

| Command | HTTP (server-side) | Result action |
|---|---|---|
| `:load_manifest` `%{base, slug, service, list}` | `GET {base}/api/v1/public/lists/{slug}` (or `/services/{s}/lists/{l}`) | `:manifest_loaded %{attributes, list_name, list_description, opt_in_mode, success_message}` / `:manifest_error %{message, status}` |
| `:signup` `%{base, slug, service, list, source, values, company_website}` | `POST {manifest}/signups` body `%{values, source, company_website}` | `:signup_success %{values, source}` / `:signup_error %{message, status}` |

The foryou API is public (Lit used `credentials: omit`) — no token is
attached even when the scope carries one; `token` in the scope is unused
here. 404 → the not-found copy; 429 → the rate-limit copy; other non-2xx →
generic/unavailable. Transport injection: `transport` key on the
`:waitlist_api` scope (public-`api`-attr path always uses `Support.Http`).

## Render states

`form` (fallback email field until a manifest upgrades the fields — Lit
parity), `loading`, `success` (manifest `success_message` or the
single/double opt-in copy), `unavailable`.

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `waitlist-success` | `:waitlist_success` | `%{values, source}` (Lit also carried the numeric status — 2xx bodies don't expose it through the transport shape) |
| `waitlist-error` | `:waitlist_error` | `%{error, status}` (status nil on transport failures) |

## data-cy (registry.yaml)

| Hook | Element |
|---|---|
| `waitlist.form` | the form |
| `waitlist.email` | the email control |
| `waitlist.submit` | submit button |
| `waitlist.status` | status line (role=status, aria-live=polite) |

## Theming

Light-DOM registry classes (`field-group`, `field-label`, `field-input`,
`field-select`, `field-textarea`, `btn`, `success`, `danger`) scoped under
`.tk-waitlist`; `.tk-waitlist__honeypot` hides the honeypot.

## Divergences from Lit

- **No mount-time manifest fetch** (no `$load` event); hosts trigger the
  `:load` action / `:load_manifest` command (e.g. from host-authored
  trigger content targeted at the cid). The fallback email form renders
  immediately either way.
- **Client-side validation is reduced**: required, select/multiselect
  membership, and a regex-free email shape check (`x@y.z`). Lit's guid/int/
  float/date regexes and `validation.pattern` run server-side only — the
  API's error copy surfaces through `:signup_error`.
- **Honeypot is visual only**: the hidden `company_website` input renders
  (CSS-hidden) but bot-filled values cannot be observed without DOM events,
  so POSTs always carry `""`. (Real bots POST the API directly, which is
  unaffected.)
- No URL-query prefill (reads `window.location.search` in Lit; not in the
  verified client op set).
- int/float values are not coerced client-side; `values` carry raw strings
  (the API coerces).
- `values` in `waitlist-success` keep raw strings for the same reason.

Backend: `:waitlist_api` HostConfig scope (`%{base_url}`, optional
`transport`); resolved in `command/3` only.
