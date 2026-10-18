# Voice agent

`<tobor-voice-agent>` is the reusable multimodal agent. Existing guide-panel and voice-session APIs remain available. The reference Node backend lives in `backend/` at the repository root; it is a separate service from existing Go/Elixir Guide API servers.

```js
import { createAvatarGroups } from '@noizu/tobor-kit/voice-agent.js';
const agent = document.querySelector('tobor-voice-agent');
Object.assign(agent, {
  organization: 'noizu-labs', project: 'example',
  backendUrl: 'http://localhost:8081', backend: 'litellm',
  engine: 'tts', model: 'gpt-4o-mini', voice: 'alloy',
  tools: [], mcpTools: [], systemPrompt: 'Help with this project.',
  avatarGroups: createAvatarGroups('https://your-cdn.example/tobor-kit/'),
  avatarGroup: 'orbit',
  contextActions: ['configure-avatar', 'copy-transcript', 'clear-transcript'],
});
```

## Configuration and transport

Public properties: `organization` (`org` JS alias), `project`, `backendUrl` (`backend-url` attribute), `backend`, `engine` (`voiceMode` JS alias), `model`, `voice`, `ttsModel`, `tools`, `mcpTools`, `systemPrompt`, `label`. Arrays are JS properties, not serialized HTML attributes. Engine values are `openai-realtime`, `elevenlabs`, `tts`. Choose a model appropriate for the engine. `backend` identifies the provider; `backendUrl` addresses this application's authenticated gateway. No provider secret belongs in properties or markup.

Connect posts configuration to `POST {backendUrl}/voice/sessions`, receives `{sessionId, websocketUrl, realtime?}`, opens the returned socket, and waits for `ready`/`session.ready`. Host configuration changes display a pending notice and disable new inputs until explicit reconnect. Requested tools are subject to server policy; hiding menus is a UX policy, never authorization.

Input frames: `input.text {text}`, `input.image`/`input.screenshot {dataUrl,text}`, `input.audio {data,mimeType,final:true}`, `interrupt {turnId}`. Output: `transcript`/`text {turnId,role,text,final,delta}`, `audio {turnId,data,mimeType,sampleRate}`, `animation {turnId,state}`, `error {code,message}`. Audio data is base64. PCM is little-endian signed 16-bit mono and scheduled continuously through Web Audio. Interruption immediately stops queued/playing audio and asks the backend to cancel generation. Backend state remains authoritative; cancelled-turn and obsolete-connection frames are ignored.

Realtime uses the existing therobotplans-derived WebRTC connector and backend-minted ephemeral credential. Typed text and images open an audio-receive session without requesting the microphone, then share the same conversation as microphone input. Provider transcript/tool events travel over the backend socket as `realtime.event`; returned function output frames are forwarded to the data channel. Browser microphone/screen permission still requires user consent. TTS mode records a clip and submits it on microphone stop; it is push-to-talk, with explicit Interrupt to cancel the reply.

## UI, events, and avatars

The textarea supports native horizontal/vertical resize and Ctrl/Cmd+Enter. Screenshot uses the browser screen/tab picker and stops capture tracks after the frame. Images support PNG, JPEG and WebP within the 8 MB encoded message limit. Transcript is a live log. Public methods: `connect`, `disconnect`, `sendText`, `sendImage`, `toggleVoice`, `captureScreenshot`, `interrupt`. `transcript`, `connection`, `agentState` expose current display state.

Bubbling/composed events: `tobor-agent-ready {sessionId}`, `tobor-agent-transcript {entry,transcript}`, `tobor-agent-state {state}`, `tobor-agent-error {message}`, `tobor-agent-event` with the accepted backend frame. React's `VoiceAgent` wrapper maps these events.

`avatarGroups` is an array of `{id,label,default,states}`; `avatarGroup` selects its ID. `avatar` overrides the selection. Each asset is `{src,columns?,rows?,column?,row?}`. `src` may address SVG/image resources; SVG markup is never injected. Per-state assets fall back to `default`, then the original glyph. `createAvatarGroups(baseUrl)` supplies Orbit, Pip, and Nova using the shipped 4×2 sprite sheets. Custom assets also work on `<tobor-robot-avatar .avatar=${group}>`.

Seven canonical states: idle, listening, thinking, speaking, tool_running, error, offline. Motion: idle slow vertical float; listening soft pulse; thinking float at 1.8 seconds; speaking pulse at .45 seconds; working float at .8 seconds; error one .3-second shake; offline still and desaturated. `prefers-reduced-motion` stops all motion, as does avatar `reducedMotion='force_static'`.

`contextActions` enables only listed actions: `configure-model`, `configure-prompt`, `configure-tools`, `configure-avatar`, `copy-transcript`, `clear-transcript`, `disconnect`. Empty array hides the menu. Right-click, Options button, or Shift+F10 opens it; Tab navigates controls and Escape dismisses. Configuration cannot turn disabled actions back on. A footer slot supports host content. Theme variables: `--tobor-agent-color`, `--tobor-agent-border`, `--tobor-agent-background`, plus existing robot size/accent variables.

See `docs/configuration.md` and `docs/backend-requirements.md` for the full options and gateway contract. Host snippets: `examples/`. Live Cypress harness: `web/e2e/voice-agent.cy.ts`; per-family stub: `test/e2e/tobor-voice-agent.cy.ts`. Direct playground: `web/VOICE-TESTING.md`. Fixture testing does not assert live provider billing, credentials, or microphone hardware.
