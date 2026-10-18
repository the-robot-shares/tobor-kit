# compiler/ — NPL Prompt Compiler (Elixir)

YAML-driven Noizu Prompt Lingua compiler: turns a guide definition into
compiled NPL prompts.

```
compiler/
├── lib/tobor_kit/
│   ├── compiler.ex            # Compiler top-level API
│   └── compiler/
│       ├── catalog.ex         # Component catalog
│       ├── cli.ex             # Mix/CLI entry
│       ├── conventions.ex     # NPL convention handling
│       ├── error.ex
│       ├── expression.ex
│       ├── guide.ex           # Guide definition loading
│       ├── json.ex
│       ├── npl.ex + npl/      # NPL generation core
│       ├── preamble.ex
│       └── prompt.ex          # Prompt assembly
├── priv/
├── test/
├── mix.exs / mix.lock
└── VENDORED.md                # Notes on vendored code
```

`_build/`, `deps/` are gitignored build artifacts.
