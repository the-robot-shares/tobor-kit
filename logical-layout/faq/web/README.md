# noizu-faq

Light-DOM FAQ enhancer: decorates host-supplied `<details>/<summary>` and optionally enforces single-open accordion behavior.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/faq/noizu-faq.js"></script>

<noizu-faq mode="many">
  <details><summary>Question?</summary><p>Answer.</p></details>
  <details><summary>Another?</summary><p>Answer.</p></details>
</noizu-faq>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `mode` | String | no | `many` | `many` = independent details; `one` = accordion (single open) |

Consumes the default slot: the host supplies `<details>/<summary>`; the element decorates them and handles single-open.

## Events

| Event | Detail | Fired when |
|---|---|---|
| `faq-toggle` | `{open, index}` | A details entry toggles (bubbles + composed) |

## Theming

Light DOM — styled via host-page CSS on its markup; consumes no CSS custom properties.

## Docs

- [docs/configuration.md](docs/configuration.md) — options, slots, events, `data-cy`
- [docs/backend-requirements.md](docs/backend-requirements.md) — none required
- [examples/](examples/) — CDN, npm, and page-serving hosts
