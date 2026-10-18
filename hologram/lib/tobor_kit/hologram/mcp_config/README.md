# mcp-config — Hologram mirror (wave 4)

Mirror of `web/src/components/mcp-config/tobor-mcp-config.ts`
(`tobor-mcp-config`) → `ToborKit.Hologram.Mcp.Config` (contract class B).

MCP transport / server params form. Emits `:config_change` on save; the
host validates and persists. The mirror carries no secrets and does not
connect to MCP servers.

Backend: None. Host owns data flow.

## Usage

```holo
<Mcp.Config cid="mcp-config-1" url={@url} transport={@transport} extras={@extras} target="page" />
```

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `url` | `:string` | `""` | Server URL (http/sse) or command path (stdio). |
| `transport` | `:string` | `"http"` | `stdio` \| `http` \| `sse`; invalid clamps to `http` in `init/3`. |
| `extras` | `:any` | `nil` | Non-secret extras (`timeoutMs`, `args`, …). **Never tokens, env, or Authorization headers.** |
| `target` | `:string` | `"parent"` | Host-notification target. |
| `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params |
|---|---|---|
| `config-change` | `:config_change` | `%{url, transport}` + `extras` when nonempty (Lit `extrasForEvent`) |

Save keeps the Lit semantics: transport normalized at submit, url trimmed.

## Theming

Shared tokens only (no family-specific var in the Lit source).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `mcp.config` | form |
| `mcp.save` | save button |

## Divergences from the Lit component

1. **Form fields are state-backed copies** (`init/3`), not live property
   reflection (`live()` directive) — same observable behavior for the
   mount-then-edit flow the mirror supports.
2. **`target` semantics** — see the chat-thread README divergence 2
   (`"parent"` is not a runtime keyword; no-op catch-all mirrors an
   unlistened Lit CustomEvent). Flagged for `docs/PORTING.md` revision.
