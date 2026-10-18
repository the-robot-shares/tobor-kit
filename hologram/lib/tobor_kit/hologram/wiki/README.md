# wiki — Hologram mirrors (wave 4)

Mirrors of `web/src/components/wiki/`:

- `ToborKit.Hologram.Wiki.Space` (`tobor-wiki-space`) — space roster,
  contract class C.
- `ToborKit.Hologram.Wiki.Entry` (`tobor-wiki-entry`) — read view for one
  page, contract class A.
- `ToborKit.Hologram.Wiki.EntryEditor` (`tobor-wiki-entry-editor`) — title +
  body editor, contract class B.

Body is xhtml-first / NPL source rendered as escaped text (`<pre>` /
textarea) — never parsed as HTML. The host owns load and persistence; the
mirrors do not fetch or store.

Backend: None. Host owns data flow.

## Usage

```holo
<WikiSpace spaces={@spaces} selected_id={@selected_id} target="page" />
<WikiEntry entry={@entry} />
<WikiEntryEditor cid="wiki-editor-1" entry={@entry} target="page" />
```

## Props

| Module | Prop | Type | Default | Notes |
|---|---|---|---|---|
| Space | `spaces` | `:list` | `[]` | `{id, title, slug?}` roster. |
| Space | `selected_id` | `:string` | `""` | Host-controlled highlight (Lit `selected-id`). |
| Space | `target` | `:string` | `"parent"` | Host-notification target. |
| Entry | `entry` | `:any` | `nil` | `{id, title, body, spaceId?}` snapshot. |
| EntryEditor | `entry` | `:any` | `nil` | Seed for title/body/`spaceId`. |
| Space / EntryEditor | `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params | From |
|---|---|---|---|
| `wiki-space-select` | `:wiki_space_select` | `%{id}` | Space → `target` |
| `wiki-edit` | `:wiki_edit` | `%{id}` | Entry — class A default target; guarded on id |
| `wiki-save` | `:wiki_save` | `%{id, title, body, space_id?}` (`id` `""` when unseeded) | EntryEditor → `target` |

Mount-only (editor): drafts seed once in `init/3`; a new entry after mount
does not reseed (re-mount with a new `cid`).

## Theming

| Token | Default |
|---|---|
| `--tobor-kit-wiki-body-max-height` | `24rem` (entry body `<pre>`) |

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `wiki.space` | space nav |
| `wiki.space-item` | space button |
| `wiki.entry` | entry article |
| `wiki.editor` | editor article |
| `wiki.save` | editor save button |

## Divergences from the Lit component

1. **Space highlight is prop-driven only.** Lit sets `selectedId` locally
   on select (optimistic); the mirror binds nothing locally (class C) and
   reflects the host-controlled `selected_id` prop.
2. **Editor drafts are mount-only** (Lit reseeds via `willUpdate`).
3. `spaceId` in save params arrives snake_cased as `space_id` per the
   frozen param-mapping rule (`docs/PORTING.md` §2).
