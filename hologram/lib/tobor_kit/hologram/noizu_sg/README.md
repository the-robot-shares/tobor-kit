# noizu-sg — styleguide mirrors (wave 1)

Hologram mirrors of `web/src/components/styleguide/` — seven contract
class-A (stateless render-only) components. All rules live in
`assets/css/tobor-kit.css` under `.tk`, scoped per component.

| Module | Lit tag | Shape |
|---|---|---|
| `ToborKit.Hologram.Sg.Btn` | `noizu-sg-btn` | A |
| `ToborKit.Hologram.Sg.Card` | `noizu-sg-card` | A |
| `ToborKit.Hologram.Sg.CardGrid` | `noizu-sg-card-grid` | A |
| `ToborKit.Hologram.Sg.Status` | `noizu-sg-status` | A |
| `ToborKit.Hologram.Sg.Input` | `noizu-sg-input` | A |
| `ToborKit.Hologram.Sg.SpecTable` | `noizu-sg-spec-table` | A |
| `ToborKit.Hologram.Sg.Steps` | `noizu-sg-steps` | A |

## Usage

```holo
<SgBtn variant="primary" size="lg" $click={...host binding via :sg_click}>Save</SgBtn>
<SgCard href="/somewhere" header="Title" footer="Hint" target="page">Body slot</SgCard>
<SgCardGrid columns={2}>…cards…</SgCardGrid>
<SgStatus status="ok" label="Operational" description="All systems nominal" />
<SgInput name="email" type="email" error={true} value={@email} />
<SgSpecTable rows={[%{"key" => "Model", "value" => "guide-1"}]} />
<SgSteps steps={["Connect", "Configure"]} current={1} />
```

## Props

Common: `class` (extra root class), `target` (`"parent"`/`"layout"`/`"page"`, on emitting components).

| Component | Prop | Type | Default | Notes |
|---|---|---|---|---|
| Btn | `variant` | string | `primary` | clamp: primary/secondary/ghost/danger |
| Btn | `size` | string | `md` | clamp: sm/md/lg |
| Btn | `disabled` | boolean | `false` | native `disabled` attr |
| Btn | `type` | string | `button` | clamp: button/submit |
| Card | `href` | string | `""` | non-empty → `<a>`; host owns navigation |
| Card | `header` / `footer` | string | `""` | prop fallback for named slots (divergence) |
| CardGrid | `columns` | integer | `3` | clamps non-positive → 3; projects `--sg-columns` |
| Status | `status` | string | `idle` | clamp: ok/warn/error/idle |
| Status | `label` / `description` | string | `""` | description hidden when empty |
| Input | `name` / `type` / `value` | string | `""`/`text`/`""` | type clamp: textarea or text/password/email/number/url/tel/search |
| Input | `disabled` / `error` | boolean | `false` | `data-error` + `aria-invalid` |
| SpecTable | `rows` | list | `[]` | `{key, value}` maps (string- or atom-keyed); text-only cells |
| Steps | `steps` | list | `[]` | labels |
| Steps | `current` | integer | `0` | 0-based index |

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `sg-click` | `:sg_click` | — (Btn click) |
| `sg-card-select` | `:sg_card_select` | `%{href}` (trimmed? no — as passed) |
| `sg-input` | `:sg_input` | host reads `params.event.value` |

Class A emits via longhand host bindings (`target: @target`, default
`"parent"`); the containing stateful component/page handles the action.
`sg-card-select` fires on the card surface; the mirror never navigates.

## Theming

Token translation per `docs/THEMING.md`: public `--tobor-kit-*` vars,
private `--tk-*` aliases on `.tk`. Component-local classes are
`.tk-sg-<name>__*`. CardGrid sets `--sg-columns` inline (Lit parity).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `sg.btn` | Btn `<button>` |
| `sg.card` | Card `<a>`/`<article>` |
| `sg.grid` | CardGrid grid `<div>` |
| `sg.status` | Status row |
| `sg.input` | Input field (`input`/`textarea`) |
| `sg.spec` | SpecTable `<table>` |
| `sg.steps` | Steps `<ol>` |

## Divergences from Lit

- **Named slots** (Card header/footer): rendered from `header`/`footer`
  string props instead (PORTING.md §4.3 — slot semantics unverified).
- **Card nested-control suppression** (`fromNestedControl`): not portable —
  the mirror always dispatches `:sg_card_select`; hosts suppress nested
  activation themselves (they author the slot content).
- **Card cancelable event** (`cancelable: true` + preventDefault dance):
  replaced by host decision — the host action decides what happens.
- **Input value**: the mirror is value-prop driven (no internal copy); the
  host re-renders with the new value after `:sg_input`.

Backend: None. Host owns navigation, click behavior, and input values.
