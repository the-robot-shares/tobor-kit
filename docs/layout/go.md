# go/ — Go Backend Port

Port of the Elixir reference backend against the same OpenAPI contract.

```
go/
├── cmd/
│   └── tobor-kit-go/          # main.go — server entrypoint
├── internal/
│   ├── server/                # HTTP server
│   ├── auth/                  # Auth handling
│   ├── guide/                 # Guide definitions
│   ├── transcript/            # Transcript domain
│   ├── mcp/                   # MCP wiring
│   ├── turn/                  # Turn execution
│   ├── session/               # Session domain
│   ├── telemetry/             # Telemetry domain
│   └── bundle/                # Asset bundling
├── config/
├── go.mod / go.sum
└── README.md
```

`go/bin/` is gitignored.
