# tobor-kit

tobor-kit is a reusable agent-guide component kit: Lit 3 web components, SwiftUI, Elixir + Go backends, YAML-driven NPL prompt compilation.

## Directory Layout

| Directory   | Purpose                                             |
|-------------|------------------------------------------------------|
| `schema/`   | Shared data/schema definitions                        |
| `compiler/` | YAML-driven NPL prompt compiler                       |
| `web/`      | Lit 3 web components (`@noizu/tobor-kit` on npm.noizu.com) |
| `swift/`    | SwiftUI components                                     |
| `elixir/`   | Elixir backend package                                 |
| `go/`       | Go backend package                                      |
| `openapi/`  | OpenAPI specs                                            |
| `docs/`     | Documentation. **Lit family layout: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)** |

Status: all six surfaces landed on main — compiler, web, swift, elixir, go, contracts/docs (schema v1, OpenAPI 1.0.0 frozen)

## Contracts

- `schema/tobor.guide-definition.schema.yaml` — self-describing YAML schema for a guide definition (identity, NPL compilation, MCP wiring, UI, auth, telemetry, voice, transcript).
- `schema/examples/deploy-guide.guide.yaml` — standalone worked example instance validating against the schema above.
- `openapi/tobor-kit.openapi.yaml` — the guide API contract (OpenAPI 3.1) that the Elixir reference backend and the Go port both implement.

## Isolation validation (lit components)

Manual validation of lit component isolation via cypress:

```sh
make isolation-setup   # install deps + importmap + build (if needed)
make isolation-run     # start server, run cypress, tee log
make isolation-report  # generate MHTML report from run log
make isolation         # all of the above + open the report
```
