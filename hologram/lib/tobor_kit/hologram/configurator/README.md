# configurator mirror (phase 2, group A)

Mirror of `web/src/components/configurator/tobor-configurator.ts` —
contract class B + commands. Module:
`ToborKit.Hologram.Configurator.Playground`. Schema type per
`web/src/configurator-schema.ts` (frozen shape, not forked).

**Embed with a `cid`** — without it the Hologram renderer treats the
component as stateless and `init/3` never runs.

## Usage

```holo
<Configurator.Playground cid="cfg" schema={@schema_map} target="page" />
```

The `schema` prop is a string-keyed ConfiguratorSchema map (template
literals arrive string-keyed, §6.2). Host wiring is optional — only the
transport injection uses it:

```elixir
config :tobor_kit_hologram, :host_config,
  catalog: %{transport: MyApp.SchemaTransport}
```

## Schema resolution order (Lit parity)

1. `schema` prop — normalized in `init/3` (no fetch)
2. child `script[type=application/json]` — **N/A in Hologram** (no
   slotted-DOM text is readable); documented divergence
3. `schema-src` URL — via the `:load_schema` command (public data, GET),
   triggered by the built-in "Load schema" button that appears when a
   `schema_src` is set but no schema has loaded

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `schema` | map | nil | string- or atom-keyed ConfiguratorSchema (`{configurator}` / `{configurators}` wrappers unwrapped) |
| `schema_src` | string | `""` | JSON schema URL for the `:load_schema` command |
| `target` | string | `parent` | notification target |
| `class` | string | `""` | extra root class |

## Command contract

| Command | HTTP (server-side) | Result action |
|---|---|---|
| `:load_schema` `%{src}` | `GET {src}` | `:schema_loaded %{schema}` / `:schema_error %{message}` (`"schema-src failed (404)"` on non-2xx, Lit copy) |

`HostConfig.from_params!/1` guards the params. The schema document is
normalized server-side (unwrap → `tag`/`fields` validation → atom-keyed
fields); errors return as `:schema_error` actions, never raises across the
wire. Transport: a `transport` key on the `:catalog` scope map (tolerant —
unwired scope falls through to `Support.Http`).

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `configurator-change` | `:configurator_change` | `%{tag, attributes, slots}` snapshot |
| `configurator-apply` | `:configurator_apply` | same snapshot |

Form submission (`$submit={:apply}`) emits apply; field edits emit change
per mutation (Lit batched once per update cycle).

## Field types

`string` (text input), `text` (textarea), `number`, `boolean` (checkbox),
`select`, `multiselect` (checkboxes), `color` (text input), `url`,
`tag-list` (chips + Enter-to-add input), `json` (raw-text textarea).
`required` → `required` attr; `uneditable` → `disabled`; `propertyOnly`
fields are seeded into values but excluded from the snippet (Lit parity).

## data-cy (registry.yaml)

| Hook | Element |
|---|---|
| `configurator.form` | the form |
| `configurator.preview` | live-preview frame |
| `configurator.snippet` | snippet `<pre>` |
| `configurator.apply` | Apply button |
| `configurator.field` | per-field wrapper (with `data-field=<attr>`) |

## Theming

`.tk-configurator__*` classes over shared tokens; two-column layout
collapses under 800px. No extra vars.

## Divergences from Lit

- **No live custom-element preview.** Dynamic element tags are not
  expressible in a Hologram template; the preview frame renders the
  escaped snippet source instead (structural preview). The snippet `<pre>`
  shows the same text.
- **No group `<fieldset>`s** — consecutive-group fieldset chrome is
  dropped; fields render flat (`group` is still normalized).
- **No demoHtml seeding** — the mirror has no HTML parser; values seed
  from field defaults only, slots seed empty (so snippets are void
  elements unless the host edits `slots` state through its own flow).
- **json fields pass raw strings** (no client JSON.parse): values,
  attributes payloads, and snippets carry the raw text; Lit parsed then
  re-stringified.
- **tag-list**: Enter commits the draft; comma in a draft commits as one
  tag with commas stripped (split-on-comma would need the unverified
  client op set). `blur`-commit and the copy button are dropped; the
  native color picker is a text input.
- `required` is attribute-level only (the form is `novalidate` in Lit too);
  the mirror adds no validation of its own.

Backend: none required (public schema URL); optional `transport` injection
via the `:catalog` scope. Never resolved from `init/3`.
