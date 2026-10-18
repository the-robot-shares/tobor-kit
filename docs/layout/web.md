# web/ — Lit 3 Component Package

Published as `@noizu/tobor-kit` on npm.noizu.com. Lit family conventions:
[`../CONVENTIONS.md`](../CONVENTIONS.md).

```
web/
├── src/
│   ├── components/          # One dir per lit element (auth, voice-agent,
│   │                        #   transcript-view, styleguide, wiki, … ~35 dirs;
│   │                        #   Swift mirrors live beside their lit element)
│   ├── lit-test/            # Lit component test helpers
│   ├── client.ts            # Backend API client
│   ├── configurator-schema.ts
│   ├── define.ts            # Custom element registration
│   ├── events.ts            # Event name constants
│   ├── react.ts / jsx.d.ts  # React wrappers
│   ├── sse.ts               # Server-sent events client
│   ├── types.ts
│   └── index.ts             # Package entry
├── registry.yaml            # @noizu/lit name directory — tags, styleguide
│                            #   classes, slots, data-cy, event names (not an API spec)
├── scripts/                 # Build guards + isolation/voice demo servers
│                            #   (assert-no-lit, assert-bundle-side-effects, …)
├── demo/                    # Static HTML demos (index, auth, voice-agent)
├── examples/                # Embedding examples (auth.html)
├── e2e/                     # Cypress specs (isolation/, voice-agent.cy.ts)
├── cypress/                 # Cypress support code
├── cypress.config.ts        # Main e2e config
├── cypress.isolation.config.ts  # Component-isolation run config
├── test/                    # Unit tests
├── dist/                    # Build output (gitignored)
├── public/                  # Static assets
├── docs/publish.md          # CDN publish notes
├── CHANGELOG.md / LICENSE / README.md
├── package.json / package-lock.json
└── tsconfig.build.json
```

Gotchas: `sideEffects` tree-shaking trap — import classes and call
`customElements.define` explicitly (see assert-bundle-side-effects.mjs guard).
