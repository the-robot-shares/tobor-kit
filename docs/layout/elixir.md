# elixir/ — Reference Backend (Elixir)

Implements the `openapi/tobor-kit.openapi.yaml` guide API; the Go tree is a
port of this reference.

```
elixir/
├── lib/tobor_kit/
│   ├── application.ex         # OTP app
│   ├── endpoint.ex            # HTTP/WS endpoint (auth-socket: docs/auth-socket.md)
│   ├── session.ex / turn.ex / turn_runner.ex   # Session + turn execution
│   ├── completion.ex / budget.ex               # Completion + budget handling
│   ├── prompt.ex / provider.ex + provider/     # Prompt + LLM providers
│   ├── json.ex / uuid.ex
│   └── components/            # Per-domain modules: auth, guide, mcp,
│                              #   telemetry, transcript, voice, voice_gateway
├── config/                    # config.exs, dev.exs, prod.exs, runtime.exs, test.exs
├── test/
├── mix.exs / mix.lock
└── README.md
```

`_build/`, `deps/`, `tobor_kit-*.tar` are gitignored.
