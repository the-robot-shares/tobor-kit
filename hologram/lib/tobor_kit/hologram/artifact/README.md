# artifact — Hologram mirrors (wave 4)

Mirrors of `web/src/components/artifact/`:

- `ToborKit.Hologram.Artifact.View` (`tobor-artifact-view`) — version-aware
  reader, contract class A.
- `ToborKit.Hologram.Artifact.Editor` (`tobor-artifact-editor`) — title +
  body editor, contract class B.

Body is always text in `<pre>` (escaped interpolation). Never raw HTML. The
host owns persistence, version bumps, and the review flow; the mirrors only
emit.

Backend: None. Host owns data flow.

## Usage

```holo
<ArtifactView artifact={@artifact} />
<ArtifactEditor cid="artifact-editor-1" artifact={@artifact} target="page" />
```

## Props

| Module | Prop | Type | Default | Notes |
|---|---|---|---|---|
| View / Editor | `artifact` | `:any` | `nil` | `{id, title, version, body, mime?}` snapshot. |
| Editor | `target` | `:string` | `"parent"` | Host-notification target. |
| both | `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params | From |
|---|---|---|---|
| `review-start` | `:review_start` | `%{artifact_id, version}` | View — class A default target; guarded on id |
| `artifact-save` | `:artifact_save` | `%{id, title, body, version?}` (`id` `""` when unseeded) | Editor — dispatched to `target` |

Mount-only (editor): drafts seed from the `artifact` prop once in
`init/3`; a new artifact after mount does not reseed (re-mount with a new
`cid`).

## Theming

| Token | Default |
|---|---|
| `--tobor-kit-artifact-max-height` | `24rem` (view body `<pre>`) |

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `artifact.view` | view article |
| `artifact.review` | start-review button |
| `artifact.editor` | editor article |
| `artifact.save` | save button |

## Divergences from the Lit component

1. **Editor drafts are mount-only** (Lit reseeds via `willUpdate`).
2. **No random label uid** — inputs are wrapped in their `<label>`, so the
   `for`/id pairing the Lit version generated is unnecessary.
3. View's review button uses the class-A default target; hosts needing a
   different target bind host-side per `docs/PORTING.md` §1.
