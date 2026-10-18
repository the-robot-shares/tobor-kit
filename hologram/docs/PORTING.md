# Porting — Lit → Hologram mirror contract (FROZEN)

This document is the frozen interface for porting tobor-kit Lit web
components (`web/src/components/`) to native Elixir Hologram components
(this app). Family waves implement against it; changes require a new
revision of this doc first.

Scope: Phase 1 covers **presentational components only**. Server-coupled
families stay Lit-side. Nothing under `web/` may be modified — `registry.yaml`
and the Lit sources are frozen inputs.

---

## 1. Component classes

Mirrors fall into three classes. The class decides the event/binding shape.

### Class A — stateless render-only

Pure presentation: no `init/3` state, no actions, no `use Hologram.Page`.

* Lit mechanism replaced: bubbling `CustomEvent`s.
* Host-side bindings replace events: the host (a class-B component or page)
  binds its own action to elements *inside* the mirror via longhand targeted
  bindings:

  ```holo
  <PersonaCard name={@name}>
    <button $click={action: :persona_select, params: %{persona_id: @id}, target: "parent"}>
      Choose
    </button>
  </PersonaCard>
  ```

* **Default target = containing stateful component** (the nearest page or
  stateful component in the render tree). A stateless mirror therefore binds
  nothing itself; whenever it must emit, it relies on the default target or
  an explicit `target:` from the host.
* Slot content is host-authored and renders via `<slot />` (same semantics as
  the Lit default slot).

### Class B — stateful interactive

Has `init/3` + `action/3`, owns local UI state (toggles, current step,
dirty input), and notifies the host of intent.

* The host passes `cid` (component id) when embedding it, so the mirror can
  be addressed. **Hard renderer requirement**: without a `cid` prop the
  Hologram server renderer treats the component as stateless — `init/3` is
  never called and no state exists (`Hologram.Template.Renderer`
  `has_cid_prop?/1` gate). Gallery/screenshot embeds of a class-B mirror
  without host actions still need `cid` for stateful init to run.
* Prop **`:target`** (string, default `"parent"`) names the host-notification
  target: `"parent"` (containing stateful component), `"layout"`, or `"page"`.
* Item-level elements (list rows, options, cards) carry **host-forwarding
  longhand bindings**:

  ```holo
  <button $click={action: :persona_select, params: %{persona_id: item.id}, target: @target}>
  ```

* Internal chrome (collapse toggles, drag handles, internal tabs) binds
  itself: `$click={:toggle_section}` — no target, default local semantics.

### Class C — composed views

Multi-component views (configurator, guide-panel composition) rendered as a
page/section. Props are **snapshots** — the host owns the data flow, the
view emits host-forwarding bindings per class-B rules. The view never fetches.

---

## 2. Event-name mapping (frozen)

Lit components notify with `CustomEvent`s named in `web/registry.yaml`.
Mirrors notify with client-side actions dispatched to the host via the
`:target` binding:

| Lit | Hologram |
|---|---|
| `persona-select` (event name) | action `:persona_select` |
| `detail: {personaId}` | `params: %{persona_id: ...}` |
| `detail.value` of `$change` inputs | `params.event.value` |

Rules:

1. **Event names are kept verbatim as atoms**: kebab → snake
   (`tobor-mode-change` → `:tobor_mode_change`). The Lit spelling is
   documentation; the atom is the runtime contract (`Support.Events`
   records the verbatim registry names).
2. **Params are snake_cased** from the Lit `detail` keys
   (`personaId` → `persona_id`).
3. `$change` inputs: Hologram delivers `params.event` — `params.event.value`
   replaces Lit's `event.detail.value`.
4. `prevent_default` etc. map to Hologram modifiers: `$submit.prevent_default`.

The full registry event list currently mirrored lives in
`Support.Events.all/0`; family waves extend it as mirrors land.

---

## 3. Prop typing rules

| Lit declaration | Hologram prop |
|---|---|
| string attribute (`@property`) | `prop :name, :string, default: <Lit default>` |
| attribute alias (`attribute: 'foo-bar'`) | prop `:foo_bar` (snake_case; attribute casing dies at the boundary) |
| property-only object/array | `:map` / `:list` |
| boolean | `prop :x, :boolean, default: <Lit default>` |
| enum string (`'cards' | 'rows'`) | `:string`, clamped in `init/3` (invalid → documented default) |
| number | `:integer` / `:float` |

* Boolean defaults keep the Lit defaults verbatim (e.g. Lit `highlighted?`
  default `false` → `default: false`).
* Enum clamping happens in `init/3` — templates never branch on unclamped
  input.
* Props are snapshots (class C) or presentation inputs (class A/B); mirrors
  never fetch data.

---

## 4. Known divergences (so far)

1. **faq** takes an `items` prop and renders native `<details>/<summary>`;
   the Lit version renders slotted, host-authored `<details>` elements
   (slots could not express the interactive contract without host-side
   duplication).
2. **cookie family** uses host-owned persistence: no `localStorage` in the
   mirror. The host reads/writes its own storage and passes state down;
   consent changes are host-forwarded actions (`cookie_consent_change`).
3. **Named slots are NOT supported** (resolved against hologram 0.10): the
   Renderer discards slot attributes entirely — only the default slot flows
   through. Mirrors of multi-slot Lit components use **prop fallbacks**
   (the card-family pattern: `header`, `footer`, `body` props render the
   content; the default slot hosts host-authored extras). Never reach for
   `slot="name"` in a mirror template.
4. **phone-input** validity: see §6 — regex-free client digit-filtering is
   transpilable; full E.164 validation is computed host-side from props.

---

## 5. Styling + scoping contract (frozen)

* Every mirror renders a light-DOM root: `<div class="tk tk-<name>">`.
* All rules live in `assets/css/tobor-kit.css`, scoped under `.tk`;
  **no bare selectors, ever** (a bare `button { ... }` would leak to the
  host page — the exact failure mode Shadow DOM used to prevent).
* Token translation table: `docs/THEMING.md`.
* `part="x"` hooks are dropped. `data-cy` attributes are the test contract:
  **copied verbatim from `web/registry.yaml`** (`cy:` entries, prefixed by
  the entry's `cy_prefix`). Mirrors never invent hooks, and the registry is
  never edited from this app. **Registry gap policy:** tags whose registry
  entry has no `cy:` entries keep the Lit source's `data-testid` attributes
  verbatim (task-menu, tool-list, transcript-view, …) — same rule, same
  discipline: carry the source contract across, never synthesize new ones.
* `@keyframes tk-*` are copied verbatim (prefix is collision-safe).

---

## 6. Transpiler spike — results (resolved BEFORE contract freeze)

Spiked against `hologram ~> 0.10.0` (dep source = ground truth). Fixture:
`test/support/spike.ex` (stateful component exercising all four operations
in `action/3`); gallery page renders it.

### 6.1 String ops in `action/3` (E.164 phone-input approach)

**Verdict: transpilable at compile level.** The fixture compiles clean with:

* `String.starts_with?/2` (Elixir macro expanding to binary pattern
  matching — no runtime function needed)
* `String.replace/3` (hand-ported JS: `assets/js/elixir/string.mjs`
  `"replace/3"`, binary pattern + replacement only)
* `String.graphemes/1` + filter + `Enum.join/2` (the regex-free digit
  filter — `:binary`, `:lists` leaves ported in `assets/js/erlang/`)
* `String.split/2` + `Enum.join/2` (`:binary.split/2,3` ported)

Bundle-level evidence (wave 0, `priv/static/hologram/`): the page bundle
contains the fully transpiled `Spike` action bodies (`String.starts_with?`
compiled to `defineElixirFunction("String","starts_with?",2,…)` with its
private `starts_with_string?/3` binary-match impl — the Elixir stdlib source
itself transpiled), and the runtime bundle ships the ported leaves the ops
reach: `Elixir_String["graphemes/1"|"replace/3"|"split/2"]`,
`Erlang_Binary["split/2"|"split/3"|"match/2"]`, `Erlang_Lists["filter/2"]`.

Constraints discovered (dep source):

* **No regexes client-side** (`Regular Expressions: todo` in
  `deps/hologram/llms-full.txt` roadmap; `assets/js/erlang/re.mjs` is
  minimal). The Lit `E164_RE = /^\+[1-9]\d{7,14}$/` cannot be evaluated in
  an action.
* `String.replace/3` accepts only non-empty binary pattern + binary
  replacement (function clauses raise otherwise).
* The compile step does **not** detect unported stdlib leaves
  (no compile-time "not ported" diagnostics in the compiler); a missing port
  surfaces as a client runtime error. Therefore: keep client action code to
  the verified op list above.

**Contract decision:** client stores **raw input** in state and applies the
regex-free digit-filter for display feedback; **validity is computed
host-side from props** (full E.164 check in Elixir, regex welcome there).
`phone-invalid` fires from the host side.

### 6.2 `:map` / `:list` props

**Verdict: flow into stateless components cleanly** (server-render path
verified by `GalleryRenderTest`: the placeholder receives `items` list +
`config` map props and renders both). Note for waves: template-passed map
literals arrive **string-keyed** — `Map.get(config, "key")`, not
`Map.get(config, :key)`.

### 6.3 Dynamic `target:` binding

**Verdict (revised after waves 1–4): accepted, with the runtime semantics
confirmed below.** Dep source (`assets/js/operation.mjs`,
`#constructFromExpressionLonghandSyntaxSpec`): `target` is read from the
keyword-list expression with `this.#defaultTarget` as fallback; nothing
requires a literal, so `$click={action: :x, target: @target}` evaluates
`@target` from component state at event time.

**Runtime-resolvable targets (waves 1–4 contract):**

* `"page"`, `"layout"`, or a **cid string** — all valid and runtime-evaluated.
* **`"parent"` is NOT runtime-resolvable** — do not emit it.
* `target:` key **absent** ⇒ containment (the component's own cid).

**Mirror contract:** stateful mirrors take a `:target` prop **verbatim**
and pass it through to every longhand binding; they also carry **no-op
catch-all action clauses** so an event landing on the mirror itself never
crashes the page. Hosts pass explicit targets (`target="page"` in the
gallery) — the mirror never guesses.

### 6.4 Verification limits (honesty note)

`mix compile`/`mix test` verify server-side rendering and the codegen
pipeline. Client-runtime behavior (actions firing in the browser) is NOT
verified by this suite — v0.10 no longer ships Mirage. The first wave that
lands an interactive mirror must run the gallery page in a browser once and
confirm §6.1–6.3 end to end. Recorded here so nobody mistakes compile-clean
for browser-proven.

### 6.5 Template authoring rules (waves 1–4 findings)

* **Keep longhand `$click={...}` bindings on ONE line.** A longhand spec
  broken across template lines fails to parse — multi-line attribute
  values are fine for plain props, never for `$`-bindings.
* **SSR strips `$`-bindings.** Render tests run against server-rendered
  HTML: assert DOM structure, classes and `data-cy` hooks only — never a
  serialized `$click` spec.
* **Template-passed map literals arrive string-keyed** (see §6.2) —
  `Map.get(row, "visibility")`, not atoms.
* **Stateful components don't get SSR default prop values.** The Lit-style
  `default:` on a `prop` declaration does not materialize for class-B/C
  mirrors in the server-rendered pass — set every default in `init/3`
  (`Map.get(props, :x, default)`).
* **Parenthesize `if` inside `{}` template braces** (phase 2 finding) —
  the keyword form `if cond, do: …` fails inside `{}` interpolation with
  syntax-error-before-comma; use `if(cond, do: …)`.

### 6.6 Host integration — path-dep compile trap

When the mirror is consumed as a **path dep**, the hologram compile task
resolves `deps/hologram/assets` via `File.cwd!` (the mirror's own dir) and
the npm bundle stage fails with **ENOENT** — the mirror ships no npm deps
by design. Workaround before `mix compile`:

```bash
ln -s <host-project>/backend/deps hologram/deps
```

(untracked; the mirror `.gitignore` already covers `deps/`).

### 6.7 Server commands — component-scoped (phase-2 spike a)

**Verdict: components CAN own `command/3`.** `use Hologram.Component`
declares `command(atom, params, Server.t()) :: Server.t()` as an optional
behaviour callback (`Hologram.Component` `@optional_callbacks`). Routing
evidence (dep source):

* Client: `assets/js/client.mjs` `buildCommandPayload/1` resolves the
  command's `target` cid → module via `ComponentRegistry.getComponentModule`
  and sends `{instance_id, module, name, params, target}` to
  `POST /hologram/command`. A command whose `target` cid is not registered
  throws client-side (`invalid command target`).
* Binding default: `assets/js/operation.mjs`
  `#constructFromExpressionLonghandSyntaxSpec` — a longhand
  `$click={command: :submit, params: %{…}}` with no `target:` key falls
  back to `#defaultTarget`, which is the cid of the component whose
  template is rendering (threaded through `Renderer.renderDom/5`). So a
  stateful mirror's command bindings default to its own cid → its own
  `command/3`. Explicit `target:` re-addresses to any registered cid.
* Server: `lib/hologram/controller.ex` `handle_validated_command_request`
  calls `module.command(name, params, server)` — the component module
  named by the payload — with `server.cid` set to the target cid.
* Return path: exactly ONE `next_action` flows back per command
  (`put_action/2,3` on the `Server` struct; its `target` defaults to the
  command's target cid, so `put_action(server, :x, %{...})` updates the
  calling component). Plus `selfEchoes`: `put_broadcast/3,4` entries
  whose channels the originator subscribes to are echoed back in the same
  response.

**Mirror contract:** a server-coupled mirror defines BOTH `action/3`
(client state) and `command/3` (server I/O) on the same module. Client
actions dispatch `put_command/2,3`; `command/3` performs HTTP and returns
`put_action(server, result_action, %{...})` back to itself. Commands are
one-shot request/response — see §6.9.

### 6.8 External redirect — JS interop (phase-2 spike b)

**Verdict: `Hologram.JS` interop is the working pattern; `<a href>` is
the declarative fallback.** `put_page/2,3` accepts page modules only —
it cannot navigate to an external URL, and `Server.put_redirect/2`
(302 + location header) is a terminal-HTTP-response helper, not honored
by the JSON command response path. In an `action/3` clause:

```elixir
use Hologram.JS

location = JS.get(:window, :location)
JS.call(location, :assign, [authorize_url])
```

`JS.get/:call/:set` run client-side only (server pass-through); globals
resolve as atom receivers (`:window`, `:document`) per the dep's JS
interop API. Fallback: a plain `<a href="https://…">` is NOT intercepted
by the Hologram runtime — links render native (vdom/renderer key `<a>`
nodes by `__hologramLink__:<href>` for diffing only, no global click
interception), so declarative external links work as-is. Preferred:
JS interop for programmatic redirects (login-flow OIDC authorize built
from server-provided state, subscription-gate redirect after a command);
`<a href>` where a link element is natural.

### 6.9 Server→client streaming — one-shot commands (phase-2 spike c)

**Verdict: commands are one-shot request/response.** The client
(`client.mjs` `sendCommand/1`) awaits a single JSON response
(`{action, selfEchoes, status, subReceiptAdds, subReceiptDrops}`);
there is no channel for a `command/3` to push multiple `put_action`s
over time. `next_action` is a single struct field — last write wins.

**Recorded upgrade path (NOT built here):** the realtime layer supports
true server push — `put_subscription(server, channel)` inside
`init/3`/`command/3` plus `Hologram.Realtime.broadcast_action/3`
callable from any server process (GenServer/background job), delivered
over SSE (`assets/js/sse.mjs` listens for `broadcast` events). A v2
streaming lane for guide-panel/llm-inference can hang turn deltas off
this; phase 2 does not.

**v1 degradation:** guide-panel and llm-inference mirrors run
request/response turns — user submits → command performs the (possibly
slow) full turn server-side → single `put_action` delivers the completed
turn. No streaming infra, no partial UI.


---

## 7. Gallery + test harness

* `test/support/gallery.ex` — test-scope page at `/gallery`; one
  `<section data-cy="gallery.section.<slug>">` per family, appended per wave.
* `test/support/placeholder.ex` — canonical class-A shape fixture.
* `test/support/spike.ex` — canonical class-B shape fixture (§6 evidence).
* Render tests are conn-based (`Hologram.Router.call/2` after
  `Hologram.Test.setup()`); logic tests are plain ExUnit.

## 8. Wave checklist (per family)

1. Read the family Lit sources + `registry.yaml` entry (attrs, events, `cy`).
2. Append CSS under the family header in `assets/css/tobor-kit.css`
   (scoped under `.tk`, family-local classes `.tk-<name>__*`), copy to
   `priv/static/tobor-kit.css`, re-run install task if testing locally.
3. Port per class A/B/C above; copy `data-cy` verbatim.
4. Add logic tests (pure functions) + extend the gallery section + render
   smoke test.
5. Extend `Support.Events` with the family's registry events.
6. Update `ToborKit.Hologram.tag_index/0`.

---

## 9. Phase 2 — server-coupled mirrors (commands, HostConfig, HTTP)

Phase 1 covered presentational mirrors only. Phase 2 adds the eight
server-coupled families (telemetry-toggle, model-config, configurator,
noizu-waitlist, subscription-gate, login-flow, guide-panel,
llm-inference). The frozen phase-1 contract above still applies in full
(classes, event mapping, prop typing, styling, `data-cy` verbatim);
this section extends it with the server round-trip.

### 9.1 Command-per-request pattern

```
action/3 (client)
  ├─ put_state/2          local UI feedback (pending flag, raw input)
  └─ put_command/3        %{...user input} — NO secrets, NO endpoints
                              ↓ (HTTP POST /hologram/command)
command/3 (server)
  ├─ HostConfig.from_params!/1      deny reserved keys at the door
  ├─ HostConfig.resolve/1           base_url/token/API keys, server-side
  ├─ Support.Http.post/get          typed {:ok, body} | {:error, map}
  └─ put_action(server, name, %{…}) single result action back
                              ↓
action/3 (client, same module)   map result → state / *-error action
```

Rules:

1. **One command = one request.** §6.9 — no streaming, one `put_action`
   per command return.
2. **Error mapping.** `{:error, %{status: s, body: b}}` from the HTTP
   layer maps to the family's existing event-name actions
   (`llm_inference` → `:llm_inference_error`, `login` → `:login_error`,
   etc. — kebab registry names, snake_case atoms, per §2). Never raise
   across the wire for expected failure modes; command exceptions surface
   as client `command failed` runtime errors with no UI hook.
3. **Secrets stay server-side.** Props/params/state are client-visible.
   `HostConfig.from_params!/1` guards every command entry; endpoints and
   keys come only from `HostConfig.resolve/1` at execution time.
4. **External redirects** per §6.8 (JS interop in the client action or
   `<a href>`; never `put_page` with a non-module).

### 9.2 HostConfig contract

* Behaviour: `ToborKit.Hologram.HostConfig` — one callback,
  `resolve(scope :: atom) :: map`.
* Scopes: `:tobor_kit_api` (`%{base_url, token}`), `:llm_providers`
  (`%{provider => %{base_url, api_key_spec}}`), `:waitlist_api`
  (`%{base_url, token}`), `:catalog` (`%{base_url, ...}`).
* Resolution module: `Application.get_env(:tobor_kit_hologram,
  :host_config_module, ToborKit.Hologram.HostConfig.Env)`. The `Env`
  default reads `Application.get_env(:tobor_kit_hologram, :host_config)`
  — a scope → map keyword list — and raises on unknown/malformed scopes.
* Called only inside `command/3` at execution time. Never in `init/3`
  (server render would bake resolved config into SSR output/state) and
  never client-side.
* Reserved param keys (`from_params!/1` raises): `base_url`, `token`,
  `api_key`, `api_key_spec`, `authorization` — atom or string keyed.

Host wiring example lives in the README.
