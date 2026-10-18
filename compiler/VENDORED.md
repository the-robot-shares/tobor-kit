# Vendored: Noizu Prompt Lingua (NPL) core modules + conventions

The files under `lib/tobor_kit/compiler/npl/` and the convention set under
`priv/conventions/` are vendored (renamed-namespace copies) from the Noizu
Prompt Lingua backend so this compiler has **no runtime dependency on the NPL
Phoenix application**. The parent app pulls in Ecto/Phoenix/Broadway; the 8
modules here need only `yaml_elixir` + `logger`.

## Provenance

- **Upstream repo:** `the-robot-lives/NoizuPromptLingo` (submodule at
  `Portfolio/Apps/AI/NoizuPromptLingo`)
- **Upstream git SHA:** `e07a7d7bbf412708792af7c8c4a6a7ebcbf3bf99`
- **Upstream paths:**
  - `backend/lib/noizu_prompt_lingua/npl/*.ex` → `lib/tobor_kit/compiler/npl/*.ex`
  - `backend/priv/conventions/*.yaml` → `priv/conventions/*.yaml`

## Files

| Vendored file | Upstream file |
| --- | --- |
| `npl.ex` | `noizu_prompt_lingua/npl.ex` (module facade) |
| `npl/definition.ex` | `npl/definition.ex` |
| `npl/resolver.ex` | `npl/resolver.ex` |
| `npl/parser.ex` | `npl/parser.ex` |
| `npl/loader.ex` | `npl/loader.ex` |
| `npl/layout.ex` | `npl/layout.ex` |
| `npl/convention_formatter.ex` | `npl/convention_formatter.ex` |
| `npl/reader.ex` | `npl/reader.ex` |
| `priv/conventions/*.yaml` (8 files) | `priv/conventions/*.yaml` (byte-identical) |

Note: upstream has **no** `priv/conventions/fences.yaml` even though `fences`
appears in NPL's section whitelist; the vendored set mirrors that (8 files).
Requesting a `fences#…` term fails validation with the available-sections
message rather than at load time.

## Renames

- `NoizuPromptLingua.NPL.*` → `ToborKit.Compiler.NPL.*`
- `NoizuPromptLingua` → `ToborKit.Compiler` (facade references)
- `NoizuPromptLingua.conventions_dir/0` app-env lookup →
  `ToborKit.Compiler.Conventions.dir/0`, which embeds the convention files at
  compile time so a built escript is self-contained.

## Deviations from upstream (beyond the rename)

1. `Definition.resolve_dependencies/3` was `defp` upstream; it is `def` here.
   The compiler computes the transitive `require:` closure through it
   (`ToborKit.Compiler.Expression.close/3`) without rendering through
   `format/2`, and `Definition.format/2` itself is used unchanged for the
   default `yaml_order` preamble rendering.
2. `Loader.load/2` accepts `skip:` terms by folding them into the parsed
   expression's subtractions (`fold_skip/2`) so `npl.preamble.skip[]` works on
   the `classic`/`grouped` layout paths. Upstream callers pass skip through
   their own tooling.

Everything else is byte-identical modulo the namespace rename (verified by
diff against SHA `e07a7d7b`).

## Update procedure

Copy the upstream files, re-apply the two deviations above (both marked with
`VENDOR DEVIATION` comments in place), re-run `mix test`, and update the SHA in
this file. The convention YAMLs must stay byte-identical —
`ToborKit.Compiler.Conventions.digest/0` (which is embedded in every bundle as
`npl.conventions_digest`) changes whenever they do, so a drift here is a
deliberate act.
