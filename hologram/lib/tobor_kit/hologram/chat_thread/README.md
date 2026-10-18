# chat-thread — Hologram mirror (wave 4)

Mirror of `web/src/components/chat-thread/chat-thread.ts`
(`tobor-chat-thread`) → `ToborKit.Hologram.ChatThread.Thread`
(contract class B; composes `ToborKit.Hologram.TranscriptView.View`).

The inner view owns empty / not-server-backed / pending / clear. This
mirror adds the participant roster, the optional composer (`:thread_send`),
and the `messages` alias that maps onto turns with timestamps + participant
names baked into plain text (escaped interpolation, pre-wrapped; no raw
HTML anywhere).

Backend: None. Host owns data flow.

## Usage

```holo
<Thread
  cid="thread-1"
  messages={@messages}
  participants={@participants}
  pending={@pending}
  show_composer={true}
  clearable={@has_store?}
  target="page"
/>
```

`cid` is required (class B).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `turns` | `:list` | `[]` | Forwarded to the inner view; ignored when `messages` nonempty. |
| `messages` | `:list` | `[]` | `{id?, role, text, at?, participant?}` — wins over `turns`. |
| `participants` | `:list` | `[]` | `{id, name}` roster resolving `message.participant`. |
| `load` | `:any` | `nil` | Backend load outcome, forwarded to the inner view. |
| `pending` | `:string` | `""` | Streaming chunk not yet a turn. |
| `show_composer` | `:boolean` | `false` | Composer renders → can emit `:thread_send`. |
| `clearable` | `:boolean` | `false` | Inner view renders its clear affordance (Lit `store`). |
| `target` | `:string` | `""` | Host target for the clear relay / `:thread_send` (`"page"` / `"layout"` / cid; empty = containment). |
| `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params |
|---|---|---|
| `thread-send` | `:thread_send` | `%{text: trimmed}` |
| `tobor-transcript-clear` | `:tobor_transcript_clear` | (none) — relayed from the inner view |

`send_draft/1` keeps the Lit semantics: trim, refuse empty, emit, clear the
draft. The transcript-clear relay is render-tree wiring — the stateless
inner view's clear button defaults to this thread, whose `action/3` mirrors
Lit `#onClear` (the host learns through its own binding or by observing the
cleared snapshots).

## Theming

Shared tokens only (no family-specific var in the Lit source).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `thread.root` | root div |
| `thread.composer` | textarea |
| `thread.send` | send button |

## Divergences from the Lit component

1. **Enter-to-send drops the Shift+Enter newline.** `$key_down.enter.
   prevent_default` swallows the keystroke's default before `action/3` can
   inspect `shift_key`, so a Shift+Enter press sends nothing but also cannot
   reinsert the newline. Form submit (Send button) is always safe.
2. **`target` default is `""` (containment), not `"parent"`.** Hologram 0.10
   resolves no `"parent"` keyword ("page"/"layout"/cid only; the
   render-tree default target is the containing stateful component). When
   `:thread_send` fires with no resolvable target it lands on the thread's
   own no-op catch-all action — the same silence as a Lit CustomEvent with
   no listener. Pass explicit targets for guaranteed forwarding. Flagged
   for `docs/PORTING.md` revision (frozen doc — reported, not edited).
3. `messages` → turns mapping is computed per render from props (public
   pure helpers), so host snapshot updates flow without a re-mount.
