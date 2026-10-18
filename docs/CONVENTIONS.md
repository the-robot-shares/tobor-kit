# tobor-kit Lit component conventions

This file is the **source of truth** for how a Lit toolkit entry is laid out.
Agents **must read this file before creating or changing a component**.
The existing tree is a starting point; when it disagrees with this spec, **this spec wins**.

Companion: the **lit-dev** skill (`noizu-tobor-kit.md`, `noizu-bdd-cypress.md`)
points here and must not duplicate the file tree.

Governing product rule (from the kit charter): a kit widget is a UI island that
emits events. Hosts own redirects, payments, session cookies, and server-side
verification. Components carry **no secrets** and no server trust.

---

## 1. Where things live

| Kind | Home |
|------|------|
| Shared / portfolio Lit elements | `web/src/components/<slug>/` **in this repo** |
| App-only elements | the consuming app, not here |
| Production backends (Guide API, auth socket, voice gateway) | `elixir/`, `go/`, `backend/` — **not** copied into the component folder |
| Host catalog pages, import maps, CDN wiring | the host app (e.g. `infra.noizu.com`) |
| This spec | `docs/CONVENTIONS.md` (this file) |

`<slug>` is the folder name (kebab-case). It usually matches the primary tag
without the `tobor-` / `noizu-` prefix (`guide-panel`, `waitlist`, `cookie`).

Naming:

| Prefix | Use |
|--------|-----|
| `tobor-*` | Agent / guide-kit surfaces |
| `noizu-*` | Portfolio islands (waitlist, cookies, FAQ, auth, …) |

**Hologram mirrors (`hologram/`):** native Elixir Hologram mirrors of the
presentational Lit tags live under `hologram/` — namespace
`ToborKit.Hologram.*`, one folder per family with its own README + tests,
all tags rendered in the test-scope gallery (`test/support/gallery.ex`),
tag→module index in `ToborKit.Hologram.tag_index/0`. The contract for the
Lit → Hologram translation (slots, targets, prop typing, template rules)
is `hologram/docs/PORTING.md` — read it before mirroring anything. The
`web/` Lit lane above is unchanged and remains the source of truth for
component behavior; mirrors never edit registry or Lit sources.

A folder is a **family**. It may contain more than one custom element
(`cookie/` → `noizu-cookie-consent` + `noizu-cookie-settings`). Each **tag**
still gets its own configurator entry, docs tables, and e2e spec.

Implementation sources stay in the family folder root (`guide-panel.ts`,
helpers). Do **not** nest them under an extra `src/` — that churns every import.

**Swift mirrors.** A component with a SwiftUI mirror keeps it inside the same
family folder under `swift/` (`web/src/components/<slug>/swift/`), and the
`swift/` subfolder is exempt from the no-nesting rule. Mirror placement,
target inventory, and the lit↔Swift pairing rules live in
`docs/SWIFT-CONVENTIONS.md`; this spec stays authoritative for the lit side.

---

## 2. Canonical family tree

Every family under `web/src/components/<slug>/` **must** look like this:

```
web/src/components/<slug>/
├── README.md                      # human API (usage, attrs, events, theming)
├── configurator.ts                # playground schema — one entry per tag
├── <impl>.ts                      # Lit element(s) + colocated helpers
├── docs/
│   ├── configuration.md           # options, defaults, theming, slots, methods
│   └── backend-requirements.md    # host/API contract (or explicit "none")
├── examples/
│   ├── README.md                  # which snippet to copy for which host
│   ├── html/
│   │   └── embed.html             # CDN / import-map mount
│   ├── elixir/
│   │   └── embed.ex               # Phoenix/Hologram host (+ handler if needed)
│   ├── go/
│   │   └── embed.go
│   ├── python/
│   │   └── embed.py
│   ├── ts/
│   │   └── embed.ts
│   ├── js/
│   │   └── embed.js
│   └── rust/
│       └── embed.rs
└── test/
    ├── unit/
    │   └── <slug>.test.ts         # Web Test Runner (open-wc)
    ├── e2e/
    │   └── <tag>.cy.ts            # Cypress stub against a live host
    ├── steps.ts                   # loadable Given/When/Then helpers
    ├── asserts.ts                 # loadable custom assertions
    └── commands.ts                # optional Cypress.Commands.add wrappers
```

Multi-tag families: one `configurator.ts` exporting all entries; one
`docs/configuration.md` covering every tag; one e2e spec **per tag**.

### Required vs optional

| Artifact | Required |
|----------|----------|
| `README.md` | yes |
| `configurator.ts` | yes (every tag) |
| `docs/configuration.md` | yes |
| `docs/backend-requirements.md` | yes (write `None.` if the island is host-only) |
| `examples/{elixir,go,python,ts,js,rust,html}/` | yes — all seven, even for no-backend islands |
| `test/unit/` | yes |
| `test/e2e/<tag>.cy.ts` | yes |
| `test/steps.ts` + `test/asserts.ts` | yes |
| `test/commands.ts` | yes if the family has interactive flows |
| `web/registry.yaml` entry | yes, every tag |
| `package.json` `exports` map | yes, every independently loadable tag |
| React wrapper in `web/src/react.ts` | yes for new tags; retrofit islands when touched |

### What this replaces

| Old location | New location |
|--------------|--------------|
| `web/test/<slug>.test.ts` | `web/src/components/<slug>/test/unit/<slug>.test.ts` |
| `web/e2e/<tag>.cy.ts` | `web/src/components/<slug>/test/e2e/<tag>.cy.ts` |
| `web/examples/<slug>.html` | `web/src/components/<slug>/examples/html/embed.html` |
| imagined `data/lit-components.yaml` in this repo | **does not live here** — host catalogs derive from `configurator.ts` + `registry.yaml` |

Package-level tests that are **not** a component (`client`, `sse`, `subpaths`)
stay in `web/test/`. Cross-component demo harnesses may stay in `web/e2e/`
**in addition to** the per-family stub, not instead of it.

`logical-layout/` remains a read-only symlink view onto production language
trees. Do not put examples or Cypress stubs there.

---

## 3. Configurator entry

The planned core element `tobor-configurator` consumes a **declarative schema**,
not a per-component form. Adding playground support = drop in `configurator.ts`.

Shared types: `web/src/configurator-schema.ts`. Import them; do not fork the shape.

```ts
import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-robot-avatar',
  group: 'agent',            // agent | island | input | display | auth
  importPath: 'components/robot-avatar/robot-avatar.js',
  demoHtml: '<tobor-robot-avatar state="idle" label="Guide"></tobor-robot-avatar>',
  backend: 'none',           // none | elixir | go | voice | external
  fields: [
    {attr: 'state', type: 'select', options: ['idle','listening','thinking','speaking','tool_running','error','offline'], default: 'idle'},
    {attr: 'label', type: 'string', default: 'Guide'},
  ],
  slots: [],
  events: [{name: '', detail: '', description: ''}], // omit empty
  cssVariables: [{name: '--tobor-kit-robot-size', default: '96px'}],
  methods: [],
};
```

Multi-tag family:

```ts
export const configurators: ConfiguratorSchema[] = [consent, settings];
export const configurator = consent; // primary tag
```

Field types (v1): `string`, `text`, `number`, `boolean`, `select`,
`multiselect`, `color`, `url`, `tag-list`, `json` (object/array properties that
are **not** HTML attributes — mark `propertyOnly: true`).

Modifiers: `required`, `uneditable`, `default`, `options`, `placeholder`,
`group`, `propertyOnly`.

Rules:

- Schema must match the live `@property` / events / slots / CSS variables.
- Object properties (`client`, `guide`, `inventory`) are `type: 'json'` +
  `propertyOnly: true`. Never pretend they are HTML attributes.
- `backend` reflects `docs/backend-requirements.md`, not wishful catalog labels.
- Do not invent styleguide classes or `data-cy` names here — those freeze in
  `web/registry.yaml`.

`tobor-configurator` itself may land later. The sibling file is required **now**
so the playground can be wired without rewriting families.

---

## 4. `docs/configuration.md`

Human-readable options surface. Must include:

1. Tags in this family
2. Properties / attributes table (name, type, required, default, reflect?, notes)
3. Events table (name, detail payload, when)
4. Methods table (if any)
5. Slots
6. CSS custom properties / `::part()` names
7. `data-cy` / `data-testid` hooks (must match `registry.yaml`)
8. Theming notes (Light DOM vs Shadow + tokens)

Keep `README.md` short (usage + condensed tables). Configuration.md is the
full options list. Do not contradict the README; if they drift, configuration.md
wins and the README is updated in the same change.

---

## 5. `docs/backend-requirements.md`

What a host must provide for the component to function. Always present.

| `backend` value | Typical contents |
|------------------|------------------|
| `none` | Explicit **None required.** Optional: how to persist events if the host wants to. |
| `external` | Upstream HTTP API (e.g. waitlist → foryou). URLs, methods, bodies, status codes. |
| `elixir` / `go` | Guide API routes from `openapi/tobor-kit.openapi.yaml`. Auth, SSE, error codes. |
| `voice` | Node gateway (`backend/`): `POST /voice/sessions`, WebSocket frames. |
| `auth` | Same-host auth WebSocket (`docs/auth-socket.md`). |

Always document:

- Endpoints (method, path, request, response, error codes)
- Auth (bearer, cookie, anonymous WS) — **never** put secrets in the element
- What the component does **not** do (redirects, Set-Cookie, payment, CSRF)
- Which production tree implements it (`elixir/`, `go/`, `backend/`) vs what
  the examples/ stubs show

---

## 6. `examples/` — six languages + HTML

Purpose: a host engineer (or agent) can copy a snippet and mount the element
against a real backend. These are **not** the production servers.

Required files, every family:

| Path | Host |
|------|------|
| `examples/html/embed.html` | import map + CDN script + sample markup |
| `examples/js/embed.js` | vanilla custom-element setup (properties, listeners) |
| `examples/ts/embed.ts` | typed mount; use kit types when they exist |
| `examples/elixir/embed.ex` | Phoenix/Hologram: render the tag + (if needed) a Plug/controller stub |
| `examples/go/embed.go` | `net/http` handler that serves the page and/or the API the element calls |
| `examples/python/embed.py` | FastAPI/Flask equivalent |
| `examples/rust/embed.rs` | axum/actix equivalent |

Rules:

- Copy-pasteable, typically 40–120 lines. Comments mark host-owned work
  (secrets, real IdP, persistence).
- Call the **real** routes/payloads from `backend-requirements.md`. Do not
  invent a parallel API.
- No-backend islands still get all seven files: HTML/JS/TS mount the tag;
  elixir/go/python/rust show how to **serve the page** (and optionally echo
  events). Do not skip a language because "this is frontend-only".
- Never embed provider API keys, client secrets, or session cookies in snippets.
- `examples/README.md` says which file to start from (CDN vs npm vs Elixir host).

Production Guide API code stays in `elixir/` and `go/`. If an example needs a
route those trees already implement, the snippet **calls** them; it does not
reimplement the service.

---

## 7. `test/` — live-implementation Cypress stubs

Unit tests (Web Test Runner, real browser, `await updateComplete`) live in
`test/unit/`. They prove the element in isolation.

`test/e2e/` + `steps.ts` + `asserts.ts` prove a **host's live implementation**.
A consuming app copies or imports these helpers into its Cypress suite.

### 7.1 Steps (`test/steps.ts`)

Export a namespaced object of functions a spec can call. No `describe`/`it`
here — only actions.

```ts
/// <reference types="cypress" />
export const waitlistSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-waitlist', timeout = 15_000): void {
    cy.window().then((win) => win.customElements.whenDefined(tag), {timeout});
  },
  fillEmail(value: string): void {
    cy.get('[data-cy="waitlist.email"]').clear().type(value);
  },
  submit(): void {
    cy.get('[data-cy="waitlist.submit"]').click();
  },
};
```

### 7.2 Asserts (`test/asserts.ts`)

```ts
/// <reference types="cypress" />
export const waitlistAsserts = {
  mounted(tag = 'noizu-waitlist'): void {
    cy.get(tag).should('exist');
    cy.get(tag).parents('.demo-frame').should('be.visible', {timeout: 15_000});
  },
  noLoadError(): void {
    cy.get('body').should('not.contain', "Couldn't load");
    cy.get('body').should('not.contain', 'may not be published');
  },
  success(): void {
    cy.get('[data-cy="waitlist.status"]').should('be.visible');
  },
};
```

Every family **must** ship:

1. **Mount-proof** — `customElements.whenDefined(tag)` (and, on catalog pages,
   the demo-frame visibility pattern). Page render is not evidence the island
   loaded.
2. **Absence-of-error** — known failure copy must not appear.
3. At least one behavior assert (event, attribute, or `data-cy` state).

Prefer `data-cy` hooks listed in `registry.yaml`. `data-testid` already in
agent elements is grandfathered; new hooks are `data-cy="<prefix>.<name>"`.

### 7.3 Spec stub (`test/e2e/<tag>.cy.ts`)

BDD as `describe`/`it` with Given/When/Then comments. **No `.feature` files.**

```ts
/// <reference types="cypress" />
import {waitlistSteps as steps} from '../steps';
import {waitlistAsserts as asserts} from '../asserts';

describe('noizu-waitlist (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
  });
});
```

Host override: `CYPRESS_BASE_URL` (already in `web/cypress.config.ts`) and
optional `COMPONENT_PATH`. Stubs must not assume `infra.noizu.com`.

### 7.4 Commands (`test/commands.ts`)

Wrap steps/asserts as `Cypress.Commands.add` so a host can

```ts
// cypress/support/e2e.ts
import '../../../path/to/tobor-kit/web/src/components/waitlist/test/commands';
```

and write `cy.waitlistMount(); cy.waitlistNoLoadError();`.

### 7.5 How Cypress finds the specs

`web/cypress.config.ts` `specPattern` includes:

```
e2e/**/*.cy.ts
src/components/**/test/e2e/**/*.cy.ts
```

`supportFile` stays false at the kit level; helpers are imported. Host apps
may set a supportFile that loads `commands.ts`.

Shared mount-proof helpers: `web/src/lit-test/cypress.ts`.

---

## 8. Registry, exports, React, CDN

Same change that adds a family must also:

1. **`web/registry.yaml`** — tag, file, string attrs, attr aliases, slots,
   styleguide classes, `cy_prefix` / `cy` hooks, events. The registry is the
   name freeze: do not invent tags or CSS classes elsewhere.
2. **`web/package.json` `exports`** — `./<subpath>` pointing at `dist/...`.
   `lit` stays a peerDependency. `scripts/assert-no-lit.mjs` must still pass.
3. **`web/src/react.ts`** — `@lit/react` wrapper for new tags.
4. **`logical-layout/<slug>/`** — symlink(s) to the web (and backend) slices.
5. Host catalog (`infra.noizu.com/data/lit-components.yaml`) is **derived**.
   Update it in the host repo when the kit ships; do not recreate that YAML
   inside tobor-kit.

---

## 9. Agent checklist (new or existing family)

Before writing code, read:

1. This file
2. The family's current sources + README
3. `web/registry.yaml` (name freeze)
4. lit-dev skill references as needed (`noizu-cdn-deploy.md`, `noizu-bdd-cypress.md`)

Then, in one change:

- [ ] Family tree matches §2
- [ ] `configurator.ts` matches live properties/events
- [ ] `docs/configuration.md` + `docs/backend-requirements.md` written
- [ ] Seven example languages present and consistent with the backend doc
- [ ] Unit test moved/created under `test/unit/`
- [ ] Cypress stub + steps + asserts under `test/`
- [ ] Registry + exports (+ React wrapper for new tags)
- [ ] Register the element with `@defineElement('<tag>')` from `web/src/define.ts`, never Lit's `@customElement` (idempotent, no-DOM safe; the CDN registration gate reads these tags)
- [ ] Do not put secrets in examples or attributes
- [ ] Do not reimplement `elixir/` / `go/` / `backend/` inside `examples/`

---

## 10. Anti-patterns

- Catalog YAML invented at repo root (`data/lit-components.yaml` is a **host** file)
- Cypress `.feature` files
- Bundling `lit` into `dist/` (except `dist/vendor/`)
- Publishing to registry.npmjs.org
- Object properties serialized as HTML attributes
- Skipping elixir/go/python/rust examples because the island "has no backend"
- Treating page render as mount-proof
- Putting production server code in the component folder
- Worktree/branch of the **monorepo** root for this work (tobor-kit is its own remote)
