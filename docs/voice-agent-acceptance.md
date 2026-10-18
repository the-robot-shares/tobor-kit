# Reusable voice agent acceptance criteria

The toolkit voice agent brings the existing robot, transcript, and voice UI into a reusable Lit element. It initializes a backend session from host-supplied properties and renders backend conversation and animation events. Testing and debugging run directly from the toolkit library, as requested in the updated scope.

## Scope and verification

| Requirement | Expected behavior | Evidence required |
| --- | --- | --- |
| Explicit voice engine | Select OpenAI Realtime, or an LLM with interruptible TTS; configure the model separately. | Initialization payload and provider adapter tests; live-provider results identified separately. |
| Multimodal conversation | Send text, microphone audio, an image, or a user-requested screenshot; show user and assistant transcript output. | Browser tests for each input and backend request mapping tests. |
| Initialization fields | Pass organization, project, backend, model, tools, MCP tool selection, and system prompt into session initialization. | Assert the actual request, validation, and server policy intersection. |
| Avatar groups and overrides | Select a predefined group or supply default and per-state SVG/image URLs. | Browser assertions for selected and custom state assets. |
| Generated avatars | Ship three Nano Banana character sets with consistent identity across states and reproducible prompt files. | Generated files, model provenance, and visual inspection. |
| Animation transport | Backend can change idle, listening, thinking, speaking, tool-running, error, and offline states. | Actual WebSocket events drive rendered state; document motion and reduced-motion behavior. |
| Resizable input | User can resize the text composer. | Browser checks for the textarea resize behavior and layout. |
| Context options | Provide configuration and conversation actions; the host can disable individual actions. | Keyboard and pointer menu tests, including disabled configuration actions. |
| Toolkit integration | The library demo loads the local component bundle and exercises the backend connection. | Cypress BDD results from the toolkit library's local demo. |

## Session and interruption behavior

- Inputs are enabled only after session initialization completes. Initialization errors are visible and recoverable.
- Changes to session configuration must reinitialize explicitly or be clearly pending until reconnect; displayed configuration must not silently diverge from the active backend session.
- Interrupt stops local playback immediately and cancels backend work. Cancelled responses must not append transcript, restart audio, or restore stale animation state.
- Old sockets and old turns cannot mutate a replacement session. Removing the element closes its connection and releases microphone and capture tracks.
- Screenshot capture requires a user action. Cancellation is recoverable and capture tracks are stopped after the still image is obtained.
- Errors remain distinguishable from successful responses, including provider errors and unavailable media APIs.

## Trust boundaries

Component configuration expresses requested capabilities. The backend authenticates the caller and authorizes organization, project, model, and tools. Disabling a context-menu item is a UI policy, not server authorization. Provider credentials and MCP connection credentials stay on the server. Client-supplied tool names cannot select arbitrary MCP hosts or expand a server allowlist.

Custom avatars use image URLs rather than injecting untrusted SVG markup into the document. Media requests have bounded sizes and supported MIME types. A reference backend must not expose an unauthenticated provider proxy on a public interface by default.

## Test result terminology

- **Component tests:** browser behavior with controlled events and media APIs.
- **Toolkit E2E:** the local toolkit demo and component communicate with the actual local WebSocket server using a deterministic test provider.
- **Provider adapter tests:** actual adapter code runs against controlled HTTP responses and validates provider request/response mapping.
- **Live-provider smoke:** real provider credentials and services complete a request. This must be reported separately and cannot be inferred from fixture success.

These criteria describe the required outcome, not a claim that every check has passed. Consult the implementation delivery notes and test output for completed verification and remaining limitations.

## Verification recorded on 2026-09-07

- Toolkit Cypress BDD: 7/7 passing against the local demo and real HTTP/WebSocket test backend, including native PCM playback cancellation. Browser media and provider responses are deterministic fixtures.
- Backend tests: 13/13 passing, covering WebSocket policy/cancellation and controlled HTTP provider/MCP adapters.
- Final focused browser tests: 9/9 passing, including removal and stale realtime handshake regressions. The earlier full browser suite passed 109 tests before those final focused additions.
- Package production build, type checking, React wrapper smoke, and code diff whitespace checks passed. The final realtime-only refinement was verified by focused tests and build after the Cypress run.
- Desktop and 375px mobile visuals inspected, including generated sprite and custom SVG rendering.
- Actual OpenAI adapter smoke passed for chat (`gpt-4.1-mini`), PCM TTS, and realtime credential creation (`gpt-realtime-mini`). Full browser-to-provider WebRTC audio was not verified. Live ElevenLabs and LiteLLM were not tested because their local credentials/configuration were absent.
- TTS interruption is push-to-talk or explicit interrupt; automatic TTS voice-activity detection is not implemented. Realtime mode uses provider voice-activity behavior.

See `web/VOICE-TESTING.md` for direct toolkit demo and Cypress commands, `web/src/components/voice-agent/README.md` for the component API, and `backend/README.md` for server policy and live-provider configuration.
