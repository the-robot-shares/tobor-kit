# Project Schema

tobor-kit has **no relational persistence layer**: sessions live in an ETS
backed GenServer (see `elixir/lib/tobor_kit/session.ex`), and the only
Liquibase changelogs in the tree belong to the vendored `noizu_mcp` dep
(`elixir/deps/noizu_mcp/priv/liquibase/`) — not this project. The data model
is contract-shaped instead: a YAML guide-definition schema, an OpenAPI
interface, a web component registry, and compiler output. Layout context:
[`PROJ-LAYOUT.md`](PROJ-LAYOUT.md).

## Guide Definition (config schema — primary contract)

`schema/tobor.guide-definition.schema.yaml` (v1, self-describing) defines a
guide definition. Top-level sections:

| Section | Contents |
|---------|----------|
| `core` | Core identity/metadata |
| `agent` | Agent identity |
| `capabilities` | Feature capability flags |
| `dependencies` | External dependencies |
| `orchestration` | Orchestration rules |
| `npl` | NPL compilation inputs (consumed by `compiler/`) |
| `mcp` | MCP tool wiring |
| `ui` | UI/component selection |
| `auth` | Auth method + OIDC config |
| `telemetry` | Telemetry/consent settings |
| `voice` | Voice agent config |
| `transcript` | Transcript rendering config |
| `example` | Inline worked example |

Worked example instance: `schema/examples/deploy-guide.guide.yaml`.

## Interface Schemas

### OpenAPI (`openapi/tobor-kit.openapi.yaml`, 3.1, frozen 1.0.0)

| Path | Purpose |
|------|---------|
| `GET /guide` | Fetch guide definition |
| `POST /sessions` | Create session |
| `GET /sessions/{sessionId}` | Session state |
| `POST /sessions/{sessionId}/turn` | Execute a turn |
| `GET /mcp/tools` | List MCP tools |
| `POST /voice/token` | Mint voice token |
| `GET/POST /telemetry/consent` | Telemetry consent |
| `GET /sessions/{sessionId}/transcript` | Transcript |

Implemented by both `elixir/` (reference) and `go/` (port). Socket protocol
(auth) documented in [`auth-socket.md`](auth-socket.md).

### Web registry (`web/registry.yaml`)

`@noizu/lit` name directory — element tags, existing styleguide classes,
slots, `data-cy`, event names. Not an API spec; string attributes only;
components may not invent tags/classes not listed.

## Runtime State (non-relational)

### Session store (ETS)

Sessions are held in a named public ETS table (`:set`, read_concurrency)
owned by a GenServer (`ToborKit.Session`), single registered name, volatile —
no disk persistence.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String | — | Key in ETS table |
| created_at | DateTime | — | Serialized ISO 8601 |
| state | String | `"idle"` | Session lifecycle state |
| turn_count | Integer | 0 | Turns executed |
| user | map \| nil | nil | `%{id, email, display_name}` |
| locale | String | `"en-US"` | |
| client | String | `"web"` | Originating surface |
| in_flight | Boolean | false | Turn in progress |
| idempotency | map | `%{}` | Request-key → payload |

## Fixtures / Data Files

- `hologram/fixtures/` — Hologram test fixtures
- `web/e2e/isolation/` — Cypress isolation specs/fixtures
- `schema/examples/deploy-guide.guide.yaml` — canonical example instance
