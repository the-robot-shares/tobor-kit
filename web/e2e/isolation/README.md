# Isolation component lane

Every component family is mounted on a blank page (`harness.html`) with all
backend calls mocked via `cy.intercept`. No dev server, no app shell — specs
import built components straight from `/dist/**`. Video recording is ON for
this lane only (see `cypress.isolation.config.ts`).

## Files

- `harness.html` — blank host page; `MODULES` map maps tag → `/dist` entry so a
  spec can declare which modules must load before mounting. The `noizu-sg-*`
  styleguide spec manages its own import list (see `styleguide.cy.ts`).
- `lit-importmap.json` — generated import map (regenerate after adding dist
  entry points).
- `<family>.cy.ts` — one spec per component family (34).
- `fixtures/**` — mocked JSON payloads.

## Run

```bash
# from web/
npm run build          # dist must be current
npm run isolation:server   # serves web/ at http://127.0.0.1:8091 (keep running)
npx cypress run --config-file cypress.isolation.config.ts   # all specs, videos on
```

Artifacts land in `cypress/videos/isolation/*.mp4` and
`cypress/screenshots/<spec>.cy.ts/*.png` (named state shots +
failure captures).

## Showcase report (MHTML)

```bash
npx cypress run --config-file cypress.isolation.config.ts \
  > /tmp/isolation-run.log          # run log supplies per-family pass/fail counts
npm run isolation:report -- --log /tmp/isolation-run.log
```

Emits a single self-contained `cypress/report/tobor-kit-components.mhtml`
(alphabetized families, grouped Roster / Agent-kit surfaces / Styleguide
conversions / Site & marketing): registry.yaml attrs/slots/events tables,
embedded state screenshots (cid: image parts) and the per-family run video
(cid: video/mp4). Open directly in Chrome.
