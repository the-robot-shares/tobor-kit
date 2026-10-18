# Direct toolkit voice playground and Cypress BDD

Run from the toolkit worktree:

```sh
npm --prefix web install
npm --prefix backend install
npm --prefix web run build
npm --prefix backend run test:debug
```

In another terminal: `npm --prefix web run demo:voice`. Open http://127.0.0.1:8090. In another terminal: `npm --prefix web run test:e2e:voice`.

The demo serves the toolkit distribution directly, including local Lit vendor modules and generated avatar sprites. It requires no infra.noizu.com checkout, CDN publishing, authentication, or deployment. Its connection settings allow selecting backend URL, organization, project, backend, engine and model; prompt/tools/avatar controls live in the component options.

The default mode deliberately uses the backend's test-only loopback fixture. Cypress exercises actual session HTTP requests and bidirectional WebSockets. Browser media input is deterministic, so the suite does not require microphone hardware or OS screen-sharing permission. This is not a live OpenAI/ElevenLabs/TTS-provider smoke test. To test a live provider, run the production gateway using its backend README, choose Live provider gateway, and configure the provider/model allowed by its server policy. Provider credentials must stay server-side.

BDD scenarios cover configuration initialization, transcripts, text, image and screenshot input, voice recording, server-driven animation, generated/custom avatars, interruption, reconnection, configurable context actions, and resizable input.
