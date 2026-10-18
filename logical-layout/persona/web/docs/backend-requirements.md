# Backend requirements — persona family

**None required.**

`<tobor-persona-card>` and `<tobor-persona-picker>` are host-only Shadow DOM
islands. They do not call a server, set cookies, or verify session. The
**host supplies the persona list** (card attributes / picker `personas`
property). Select is an **event, not navigation**.

The islands do **not** redirect, issue `Set-Cookie`, take payment, or perform
CSRF. They carry no secrets.

## Host-owned projection

Set attributes / properties from the host's directory, roster, or guide
projection. Typical fields:

| Field | Source |
|---|---|
| `persona-id`, `display-name`, `handle` | Persona record (card) |
| `personas` | `{id, name, handle?}[]` roster (picker; JS property) |
| `query` | Optional host-driven search string |

Do **not** put API keys, session cookies, or internal tokens on the element.

There is no kit HTTP API for personas. If the host loads a roster from its
own backend, that fetch stays in the host; the island only renders what it is
given.

## Events the host MAY handle

| Channel | Name | Detail | Host action |
|---|---|---|---|
| element (bubbles, composed) | `persona-select` | `{personaId: string}` | Switch / route to that persona |

The island does not `location.assign`, open a window, or fetch. Persistence
and routing stay in the host.

## Auth

None on the element. If the page is behind a session, that session stays on
the host.

## What the components do not do

- Navigate or redirect
- `Set-Cookie`, CSRF, JWT, or `credentials: 'include'`
- Load a persona directory
- Store or refresh the roster
- Call `elixir/`, `go/`, or `backend/` in this repo

## Examples vs production

| Tree | Role |
|---|---|
| Host app projection | Production data |
| `examples/html`, `examples/js`, `examples/ts` | Mount card + picker, set `personas`, listen for `persona-select` |
| `examples/{elixir,go,python,rust}` | Serve the page (optional in-page event log) |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this family |

No production tree implements a persona API.
