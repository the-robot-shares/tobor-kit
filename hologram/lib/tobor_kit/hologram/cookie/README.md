# cookie family (wave 1)

Mirrors of `web/src/components/cookie/` — **host-owned persistence**
(PORTING.md §4.2):

- `ToborKit.Hologram.Cookie.CookieConsent` — class B (stateful). **Embed
  with a `cid`.**
- `ToborKit.Hologram.Cookie.CookieSettings` — class A (trigger button).

## Usage

```holo
<Cookie.CookieConsent cid="cookie" consent={@consent} settings_open={@settings_open} target="parent" />
<Cookie.CookieSettings target="parent" />

# host, on :cookie_consent_change -> params:
%{version: 1, categories: %{necessary: true, analytics: ..., marketing: ..., preferences: ...}}
```

The host stamps `acceptedAt`/`updatedAt` when persisting; the mirror never
touches `localStorage` and never listens to window events.

## Props (init snapshot)

| Component | Prop | Type | Default | Notes |
|---|---|---|---|---|
| Consent | `consent` | map | `%{}` | stored decision, Lit shape (`version: 1`, `categories`), string- or atom-keyed; wrong/missing version ⇒ no decision |
| Consent | `mode` | string | `categories` | `essential-all` hides category checkboxes |
| Consent | `settings_open` | boolean | `false` | re-open panel (replaces the Lit `cookie-settings-open` window-event listen) |
| Consent | `target` / `class` | string | `parent` / `""` | |
| Settings | `label` | string | `Cookie Settings` | prop fallback for the default slot |
| Settings | `target` / `class` | string | `parent` / `""` | |

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `cookie-consent-change` | `:cookie_consent_change` | full consent map `%{version, categories}` (host adds timestamps) |
| `cookie-settings-open` | `:cookie_settings_open` | — (host toggles the consent embed's `settings_open`) |

Local actions: `accept_all`, `reject_optional`, `save` (commit + close +
forward), `cancel_settings` (reset draft), `toggle_category` (checkbox
`$change`; checkbox `params.event.value` is a boolean; `necessary` forced
true, Lit parity).

The `start-app:cookie-consent-change` alias has no mirror equivalent
(same-page Lit island bridge).

## Theming

Banner: `.tk-cookie-consent .card` + `.checkbox-wrap` + `.btn/.btn-outline/
.btn-sm` controls (registry classes preserved); trigger:
`.tk-cookie-settings__button`.

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `cookie.banner` | consent `<section role="dialog">` |
| `cookie.category` | each category checkbox |
| `cookie.accept-all` / `cookie.reject-optional` / `cookie.save` | action buttons |
| `cookie.settings` | settings trigger button |

## Divergences from Lit

- **Persistence**: host-owned (Phoenix session / API) — no localStorage,
  no `storage` event sync, no window-event listening (§4.2).
- **Settings re-open**: `settings_open` prop instead of the
  `cookie-settings-open` window event.
- **Slot fallback** (Settings): `label` prop (§4.3).

Backend: None. Host owns consent persistence.
