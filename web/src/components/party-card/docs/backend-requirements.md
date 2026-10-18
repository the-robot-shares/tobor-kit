# Backend requirements — party-card family

**None required.**

`<tobor-party-card>`, `<tobor-agent-card>`, and `<tobor-user-card>` are host-only
Shadow DOM islands. They do not call a server, set cookies, or verify session.
The **host supplies the projection** (name, handle, presence, badges,
`capabilities`, ids). Chat and Profile are **events, not navigation**.

The islands do **not** redirect, issue `Set-Cookie`, take payment, or perform
CSRF. They carry no secrets.

## Host-owned projection

Set attributes / properties from the host's directory, roster, or guide
projection. Typical fields:

| Field | Source |
|---|---|
| `display-name`, `handle`, `presence` | Party record |
| `agent-id`, `model-badge`, `capabilities` | Agent record (chips are a JS `string[]`) |
| `user-id`, `role`, `org` | User record |

Do **not** put API keys, session cookies, or internal tokens on the element.

## Events the host MAY handle

| Channel | Name | Detail | Host action |
|---|---|---|---|
| element (bubbles, composed) | `agent-chat` | `{agentId: string}` | Open / route to that agent's conversation |
| element (bubbles, composed) | `user-profile` | `{userId: string}` | Open / route to that user's profile |

The island does not `location.assign`, open a window, or fetch. Persistence
and routing stay in the host.

## Auth

None on the element. If the page is behind a session, that session stays on
the host.

## What the components do not do

- Navigate or redirect
- `Set-Cookie`, CSRF, JWT, or `credentials: 'include'`
- Load a party directory
- Store or refresh the projection
- Chat transport or profile APIs

## Examples vs production

| Tree | Role |
|---|---|
| Host app projection | Production data |
| `examples/html`, `examples/js`, `examples/ts` | Mount agent-card + user-card, set chips, listen for CTAs |
| `examples/{elixir,go,python,rust}` | Serve the page (optional in-page event log) |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this family |

No production tree implements a party-card API.
