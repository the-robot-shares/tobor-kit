# tobor-npl-view

Shadow-DOM viewer for NPL / prompt-lingua source. Properties down, events up.
Foldable sections (lines starting with `#` or `⌜NPL`). Highlight is CSS classes
on **escaped** text spans — never `unsafeHTML` of raw source.

Options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (none).
Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/npl-view/npl-view.js"></script>

<tobor-npl-view id="npl"></tobor-npl-view>
<script type="module">
  const el = document.querySelector('#npl');
  el.source = `⌜NPL@1.0⌝

# Syntax
Greet {user.name}.
`;
  el.addEventListener('npl-copy', (event) => {
    /* event.detail = {text} — clipboard write is best-effort in the island */
  });
</script>
```

`source` is a string property (also the `source` attribute). Do not put secrets
on the tag.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | String | no | `""` | NPL / prompt-lingua text |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `npl-copy` | `{text}` | Copy is clicked. Island also writes `navigator.clipboard` when available |

## data-cy

`npl.view`, `npl.copy`, `npl.fold`

## Theming

Shadow DOM. Consumes `--tobor-kit-*` tokens (`theme.ts` / `web/README.md`).
Also `--tobor-kit-npl-max-height` (default `32rem`).
