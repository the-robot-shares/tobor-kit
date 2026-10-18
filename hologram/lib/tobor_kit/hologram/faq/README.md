# faq mirror (wave 1)

Mirror of `web/src/components/faq/noizu-faq.ts` — contract class B
(stateful interactive). Module: `ToborKit.Hologram.Faq.Faq`.

**Embed with a `cid`.**

## Usage

```holo
<Faq.Faq
  cid="faq"
  mode="one"
  items={[
    %{"question" => "What is tobor-kit?", "answer" => "An agent-guide component kit."}
  ]}
/>
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `items` | list | `[]` | `%{question, answer}` maps (string- or atom-keyed); items start closed |
| `mode` | string | `many` | `one` = accordion (opening one closes the others) |
| `target` | string | `parent` | |
| `class` | string | `""` | |

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `faq-toggle` | `:faq_toggle` | `%{open, index}` (0-based item index) |

Local action `:toggle` (bound on each `<summary>`) flips state, enforces
the accordion in `one` mode, then forwards. The browser toggles the native
`open` attribute; the mirror re-renders it from state.

## Theming

Lit disclosure classes preserved on the rendered elements (`hui`,
`disclosure`, `disclosure-button`, `disclosure-panel`) so the registry CSS
continues to apply; component-local classes are `.tk-faq__*`.

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `faq.list` | list container `<div>` |
| `faq.item` | each `<details>` |
| `faq.trigger` | each `<summary>` |

## Divergences from Lit

- **`items` prop instead of slotted `<details>`** (documented, PORTING.md
  §4.1): the mirror renders native `<details>/<summary>` itself. With an
  empty `items` list it renders a plain `<slot />` display-only mode — no
  accordion, no `:faq_toggle` forwarding (hosts needing the slotted Lit
  behavior keep using the Lit element).
- The Lit MutationObserver decoration pass has no equivalent — classes and
  hooks are rendered directly in `one`/`many` mode.

Backend: None.
