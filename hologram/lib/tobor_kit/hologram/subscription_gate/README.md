# subscription-gate mirror (phase 2, group A)

Mirror of `web/src/components/subscription-gate/noizu-subscription-gate.ts`
— contract class B + commands. Module:
`ToborKit.Hologram.SubscriptionGate.Gate`.

**Embed with a `cid`** — without it the Hologram renderer treats the
component as stateless and `init/3` never runs.

## Usage

```holo
<SubscriptionGate.Gate cid="gate" entitled={@is_entitled} redirect_to="/pricing" target="page">
  Premium content (default slot — renders when entitled)
</SubscriptionGate.Gate>
```

Host wiring (only for the command-side check):

```elixir
config :tobor_kit_hologram, :host_config,
  tobor_kit_api: %{
    base_url: "https://api.example.com",
    token: System.fetch_env!("TOBOR_KIT_API_TOKEN")
  }
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `entitled` | boolean | `false` | host-owned entitlement truth — set it and no network runs |
| `check_url` | string | `""` | optional entitlement probe path/URL for the `:check_entitlement` command |
| `redirect_to` | string | `/pricing` | upgrade link target |
| `auto_redirect` | boolean | `false` | navigate after `gate_blocked` (see veto delta) |
| `target` | string | `parent` | notification target |
| `class` | string | `""` | extra root class |

## Command contract

| Command | HTTP (server-side) | Result action |
|---|---|---|
| `:check_entitlement` `%{url}` | `GET {url}` — relative paths prepend `HostConfig.resolve(:tobor_kit_api).base_url` + bearer token; absolute `https://` URLs pass through | `:entitled_confirmed` (200 + `entitled: true`) / `:check_unconfirmed` (anything else — Lit ignores non-200s but still blocks) |

The `check_url` prop value rides the command params (it is a public
address, not a secret); the base URL and token come from HostConfig at
execution time. Transport injection via the scope's `transport` key.

## Render states

entitled → default slot content; otherwise the blocked panel
(`data-cy="gate.blocked"`, `role="status"`) with the upgrade link
(`data-cy="gate.link"`, a native `<a href>` — §6.8 declarative fallback)
and a "Check entitlement" trigger when a `check_url` is set.

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `gate-blocked` | `:gate_blocked` | `%{redirect_to}` |

## data-cy (registry.yaml)

| Hook | Element |
|---|---|
| `gate.root` | root div |
| `gate.blocked` | blocked panel |
| `gate.link` | upgrade link |

## Divergences from Lit

- **No mount-time check** (no `$load` event): hosts trigger `:check` via
  the built-in trigger button or their own action dispatch to the cid.
- **Cookie-session checks are not portable to the command**: Lit fetched
  `check-url` with `credentials: same-origin`, and a server-side command
  cannot forward the browser's session cookie. Hosts whose entitlement
  endpoint authenticates by cookie should do the check host-side and pass
  `entitled` down; the command path suits token-bearing APIs.
- **`gate-blocked` cancelability is not representable** — an action
  dispatch cannot be declined by the host. With `auto_redirect` the mirror
  navigates via §6.8 JS interop immediately after forwarding `:gate_blocked`,
  unconditionally. Hosts needing a veto keep `auto_redirect` false and
  navigate in their own `:gate_blocked` handler.
- The redirect target is resolved once in `init/3` (blank → `/pricing`),
  matching Lit's `resolvedRedirect()`.

Backend: `:tobor_kit_api` HostConfig scope (`%{base_url, token}`, optional
`transport`); resolved in `command/3` only.
