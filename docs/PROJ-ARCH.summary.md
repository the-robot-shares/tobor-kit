# PROJ-ARCH (summary)

Contract-first agent-guide component kit. Detail: [`PROJ-ARCH.md`](PROJ-ARCH.md).

- **Flow**: guide-definition.yaml (schema v1, frozen) → compiler/ NPL prompt
  compilation → Guide API (OpenAPI 3.1, 1.0.0 frozen) → LLM providers.
- **Backends**: elixir/ = reference (sessions in volatile ETS, turns,
  providers, voice gateway); go/ = port of same contract; backend/ = Node 22+
  voice/session backend for `<tobor-voice-agent>` (adds to, not replaces,
  Guide API). No relational DB.
- **UI surfaces**: web/ Lit 3 canonical (@noizu/tobor-kit on npm.noizu.com +
  CDN); swift/ SwiftUI + ToborKitCore; hologram/ Elixir mirrors (Phase 1 =
  presentational only). web/registry.yaml is the frozen naming authority —
  mirrors copy verbatim.
- **Infra**: vendored helm/tobor-kit chart (image ops.noizu.com/tobor-kit/backend,
  CI sha-* tags, InfisicalSecret); CI ci.yml + publish-lit.yml; cypress
  isolation via Makefile.
- **Key decisions**: frozen contracts across six surfaces; Elixir-reference /
  Go-port pairing; CDN cache-bust (?vsn=) never purge; mirror discipline via
  registry.
