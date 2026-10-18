# asset — Hologram mirrors (wave 4)

Mirrors of `web/src/components/asset/`:

- `ToborKit.Hologram.Asset.View` (`tobor-asset-view`) — mime-aware preview,
  contract class A.
- `ToborKit.Hologram.Asset.Editor` (`tobor-asset-editor`) — name + text body
  editor, contract class B.
- `ToborKit.Hologram.Asset.Assets` — port of `asset.ts` (`mimeKind`,
  `textBody`, `previewSrc`, …). Regex-free (`javascript:` guard = case-folded
  prefix check) so the class-A template helpers stay client-transpilable.

The kit never persists; the host owns the asset snapshot. Text is escaped
interpolation in `<pre>` — never `unsafeHTML`.

Backend: None. Host owns data flow.

## Usage

```holo
<AssetView asset={@asset} />
<AssetEditor cid="asset-editor-1" asset={@asset} target="page" />
```

## Props

| Module | Prop | Type | Default | Notes |
|---|---|---|---|---|
| View / Editor | `asset` | `:any` | `nil` | `{id, name, mime, src?, body?, meta?}` snapshot. |
| Editor | `target` | `:string` | `"parent"` | Host-notification target. |
| both | `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params | From |
|---|---|---|---|
| `asset-open` | `:asset_open` | `%{id}` | View — class A default target (nearest stateful component) |
| `asset-save` | `:asset_save` | `%{id, name, body?}` (`body` only for `text/*`) | Editor — dispatched to `target` |

Editor save keeps the Lit semantics: guard on `asset.id`, empty trimmed
name falls back to the current name. Mount-only: drafts seed from the
`asset` prop once in `init/3` — a new asset after mount does not reseed
(re-mount with a new `cid`).

## Theming

Shared tokens only (no family-specific var in the Lit source).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `asset.view` | view frame article |
| `asset.preview` | preview element (`data-kind` = image / text / other) |
| `asset.editor` | editor form |
| `asset.save` | save button |

## Divergences from the Lit component

1. **Download clicks also emit `:asset_open`.** Lit stops propagation on
   the download link; Hologram bindings on the frame article fire for any
   click inside it. Hosts should ignore `:asset_open` for ids the user is
   already downloading, or bind per-element host-side.
2. **`previewSrc` guard is a prefix check, not a regex** (client codegen
   constraint, `docs/PORTING.md` §6.1) — same accept/reject surface for
   `javascript:` URLs.
3. **Editor drafts are mount-only** (Lit reseeds via `willUpdate` on asset
   change).
4. Editor emits the raw trimmed-or-current name and body; the host owns any
   further validation (parity with the Lit contract — the trim itself is
   preserved).
