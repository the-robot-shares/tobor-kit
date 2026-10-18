# persona family — Hologram mirrors (wave 2)

Mirrors of `web/src/components/persona/` (`tobor-persona-card`,
`tobor-persona-picker`). Contract: `docs/PORTING.md`; tokens:
`docs/THEMING.md`.

## Modules

| Lit tag | Mirror | Class |
|---|---|---|
| `tobor-persona-card` | `ToborKit.Hologram.Persona.PersonaCard` | A (CTA = host-forwarding binding) |
| `tobor-persona-picker` | `ToborKit.Hologram.Persona.Picker` | B (stateful: query search state; **embeds require a host `cid`**) |

## PersonaCard

Identity chrome for a selectable persona; extends the party-card family
(`ToborKit.Hologram.PartyCard.Card` helpers, same prop-fallback surface —
see `../party_card/README.md`).

```holo
<PersonaCard display_name="Weego" handle="@weego" presence="online" persona_id="weego" />
```

Event contract: Lit `persona-select` `{personaId}` → CTA binding
`$click={action: :persona_select, params: %{persona_id: @persona_id}, target: @target}`
(default `"parent"`). The host owns the switch; never navigates. Disabled
when `persona_id` is blank.

Registry note: only `persona.card` is a data-cy hook — the Lit Select button
has a `part` (dropped), not a `data-cy`.

## Picker

Searchable grid of host-supplied personas.

```holo
<Picker
  cid="my-picker"
  personas={[
    %{"id" => "weego", "name" => "Weego", "handle" => "@weego"},
    %{"id" => "mask", "name" => "The Mask"}
  ]}
/>
```

* **`cid` required** for stateful init (hard renderer gate
  `Hologram.Template.Renderer.has_cid_prop?/1` — without it the mirror
  renders stateless and `init/3` never runs).
* `personas` — `:list` of **string-keyed** maps
  (`%{"id" => ..., "name" => ..., "handle" => ...}`; template-passed map
  literals arrive string-keyed, PORTING.md §6.2). Host supplies the roster;
  the mirror never fetches.
* `query` — optional seeded filter; `init/3` copies it into state, the
  search input's `$change` (native `input` event for text inputs — every
  keystroke, like the Lit `@input`) drives `:set_query`.
* Filtering (`Picker.filter_personas/2`) drops rows without `id`+`name`,
  then case-insensitively matches id/name/handle on the trimmed query —
  using only client-verified string ops (`String.trim/1`,
  `String.downcase/1`, `String.contains?/2`, PORTING.md §6.1).
* Event contract: item binding
  `$click={action: :persona_select, params: %{persona_id: ...}, target: @target}`.
* Empty copy: `"No personas"` (empty roster) vs `"No matching personas"`
  (roster present, query filtered out) — Lit `emptyCopy`.

### data-cy hooks (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `persona.picker` | picker root |
| `persona.search` | search input (also `placeholder="Search personas"`) |
| `persona.item` | each item button (also `data-persona-id`) |

## Theming

* Picker honors `--tobor-kit-persona-min` (grid column min, default `16rem`).
* PersonaCard reuses the party-card family classes; same tokens
  (`docs/THEMING.md`).

## Divergences from Lit

1. **PersonaCard named slots → prop fallbacks** — same as the party-card
   family (`avatar`/`badges` slots → `avatar_src`/`badges` props, actions →
   default slot); Lit subclass hierarchy flattened into the party-card
   helper reuse.
2. **Picker filtering runs in template-called public functions** (Lit does
   it in `render/1`); client-transpilable ops only. Row accessors
   (`persona_id/1`, `persona_name/1`, `handle_text/1`) exist because
   template-passed maps are string-keyed.
3. `data-persona-id` renders only for valid rows (rows without `id`/`name`
   are filtered out before rendering, as in Lit).

Backend: None. Host owns the persona roster, selection, and switching; the
mirrors never fetch and never navigate.
