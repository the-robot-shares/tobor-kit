# party-card family — Hologram mirrors (wave 2)

Mirrors of `web/src/components/party-card/` (`tobor-party-card`,
`tobor-agent-card`, `tobor-user-card`). Contract: `docs/PORTING.md`;
tokens: `docs/THEMING.md`.

## Modules

| Lit tag | Mirror | Class |
|---|---|---|
| `tobor-party-card` | `ToborKit.Hologram.PartyCard.Card` | A (stateless) |
| `tobor-agent-card` | `ToborKit.Hologram.PartyCard.AgentCard` | A (CTA = host-forwarding binding) |
| `tobor-user-card` | `ToborKit.Hologram.PartyCard.UserCard` | A (CTA = host-forwarding binding) |

`PersonaCard` (`Persona.PersonaCard`) extends this family — see
`../persona/README.md`.

## Usage

```holo
<AgentCard
  display_name="Tobor Guide"
  handle="@tobor"
  presence="online"
  agent_id="agent-123"
  model_badge="fable-5"
  capabilities={["search", "summarize"]}
/>
```

The Chat/Profile CTAs are **host-forwarding bindings**, not client events:
the host (containing stateful component, or whatever `target` names) handles
`:agent_chat` / `:user_profile` with snake_case params (`%{agent_id: ...}`,
`%{user_id: ...}`) — PORTING.md §2. Override `target` to route elsewhere
(default `"parent"`).

## Props

| Prop | Type | Default | Lit source |
|---|---|---|---|
| `display_name` | string | `""` | `display-name` attr |
| `handle` | string | `""` | `handle` attr |
| `presence` | string | `"offline"` | `presence` attr; invalid → `"offline"` (Lit `willUpdate` clamp) |
| `avatar_src` | string | `""` | `avatar` slot fallback — image URL; empty → initials |
| `badges` | list | `[]` | `badges` slot fallback — chip strings |
| `agent_id` | string | `""` | `agent-id` attr (AgentCard) |
| `model_badge` | string | `""` | `model-badge` attr (AgentCard) |
| `show_capabilities` | boolean | `true` | `show-capabilities` (Lit `"false"` converter dies at the boundary) |
| `capabilities` | list | `[]` | JS `capabilities` property; chips are trimmed, blanks dropped |
| `user_id` | string | `""` | `user-id` attr (UserCard) |
| `role` / `org` | string | `""` | attrs (UserCard badges) |
| `target` | string | `"parent"` | mirror-only — host-notification target |
| `class` | string | `""` | mirror-only — extra root classes |

## Event contract

| Lit event | Mirror action | Params |
|---|---|---|
| `agent-chat` | `:agent_chat` | `%{agent_id: ...}` |
| `user-profile` | `:user_profile` | `%{user_id: ...}` |

Hosts with class-B/page components implement `action/3` clauses for these;
the card itself binds nothing (class A).

## Theming

* `--tobor-kit-party-avatar-size` (avatar box; default `48px`) — **mirrors
  onto `--tobor-kit-robot-size`** exactly as the Lit `:host` did, so
  `<tobor-robot-avatar>` slotted inside picks up the size. Preserved in
  `assets/css/tobor-kit.css` (`.tk .tk-party-card` block).
* All tokens (`--tobor-kit-bg`, `--tk-accent`, …) per `docs/THEMING.md`.

## data-cy hooks (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `party.card` / `agent.card` / `user.card` | card `<article>` (also carries `data-presence`) |
| `party.name` | display name |
| `party.handle` | handle |
| `party.presence` | presence dot (also `data-presence`; `hidden` attr when presence = hidden) |
| `agent.chat` | Chat CTA button |
| `agent.caps` | capability chip `<ul>` (omitted when `show_capabilities` false) |
| `user.profile` | Profile CTA button |

## Divergences from Lit

1. **Named slots → prop fallbacks** (Hologram v0.10 default-slot only —
   verified against `Hologram.Template.Renderer.render_dom/3`, which drops
   slot attrs, and `expand_slots/2`, which resolves `slots[:default]` only;
   PORTING.md §4.3):
   - `avatar` slot → `avatar_src` prop (`<img>`); falls back to the computed
     initials span (Lit's fallback content). The Lit initials regex
     (`/\s+/` split) became a regex-free `" "` split + blank rejection —
     client-transpilable ops only.
   - `badges` slot → `badges` prop (chips render after the subclass extras —
     role/org/model — matching the Lit order).
   - `actions` slot → **default slot**: host children render into the
     actions area carrying their own host bindings.
   - `below` slot: base renders the (empty) grid area only; AgentCard fills
     it with the caps list, as in Lit.
2. **Lit subclass hierarchy flattened**: no module inheritance — each card
   repeats the card-grid markup with its own `data-cy` prefix and calls the
   shared public helpers on `Card` (presence clamp, labels, initials).
3. `show-capabilities` attribute converter (`true` unless literal `"false"`)
   → plain `:boolean` prop (attribute stringification dies at the boundary).

Backend: None. Host owns conversations, profiles, persona switching, and
navigation; the mirrors never fetch and never navigate.
