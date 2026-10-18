# PROJ-SCHEMA (summary)

No relational store — contract-shaped data model. Detail: [`PROJ-SCHEMA.md`](PROJ-SCHEMA.md).

- **Guide definition schema** — `schema/tobor.guide-definition.schema.yaml` (v1):
  sections core, agent, capabilities, dependencies, orchestration, npl, mcp,
  ui, auth, telemetry, voice, transcript, example. Example instance:
  `schema/examples/deploy-guide.guide.yaml`.
- **OpenAPI** — `openapi/tobor-kit.openapi.yaml` (3.1, 1.0.0 frozen): /guide,
  /sessions (CRUD-ish), /sessions/{id}/turn, /sessions/{id}/transcript,
  /mcp/tools, /voice/token, /telemetry/consent. Elixir = reference, Go = port.
- **Web registry** — `web/registry.yaml`: element tags, styleguide classes,
  slots, data-cy, event names (string attributes only).
- **Session store** — ETS (`:set`, public) + GenServer, volatile, no disk:
  fields id, created_at, state (default "idle"), turn_count, user, locale
  ("en-US"), client ("web"), in_flight, idempotency.
- **No first-party Liquibase/Ecto** — only vendored dep `noizu_mcp` carries
  changelogs (`elixir/deps/noizu_mcp/priv/liquibase/`).
