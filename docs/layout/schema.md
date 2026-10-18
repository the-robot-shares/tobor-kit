# schema/ + openapi/ — Shared Contracts

```
schema/
├── tobor.guide-definition.schema.yaml   # Self-describing YAML schema for a guide
│                                        #   definition (identity, NPL compilation,
│                                        #   MCP wiring, UI, auth, telemetry,
│                                        #   voice, transcript) — v1
└── examples/
    └── deploy-guide.guide.yaml          # Standalone worked example validating
                                         #   against the schema

openapi/
└── tobor-kit.openapi.yaml               # Guide API contract (OpenAPI 3.1, 1.0.0
                                         #   frozen) implemented by both the
                                         #   Elixir reference backend and Go port
```

Liquibase note does not apply here — schema/ holds YAML contracts, not DB
migrations.
