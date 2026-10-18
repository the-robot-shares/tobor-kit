import {createAvatarGroups} from '@noizu/tobor-kit/voice-agent.js';

/** Vanilla mount. Host owns gateway auth; never assign provider keys. */
export function mountVoiceAgent(host = document.body, backendUrl = 'http://127.0.0.1:8081') {
  const agent = document.createElement('tobor-voice-agent');
  Object.assign(agent, {
    organization: 'acme',
    project: 'app',
    backendUrl,
    backend: 'litellm',
    engine: 'tts',
    model: 'gpt-4o-mini',
    voice: '',
    systemPrompt: 'You are a helpful voice assistant.',
    tools: [],
    mcpTools: [],
    avatarGroups: createAvatarGroups(new URL('/', import.meta.url).href),
    avatarGroup: 'orbit',
    contextActions: ['configure-avatar', 'copy-transcript', 'clear-transcript', 'disconnect'],
    label: 'Voice agent',
  });
  agent.addEventListener('tobor-agent-ready', (event) => {
    console.info('voice ready', event.detail.sessionId);
  });
  agent.addEventListener('tobor-agent-transcript', (event) => {
    console.info('transcript', event.detail.entry);
  });
  agent.addEventListener('tobor-agent-state', (event) => {
    console.info('state', event.detail.state);
  });
  agent.addEventListener('tobor-agent-error', (event) => {
    console.error(event.detail.message);
  });
  host.append(agent);
  return agent;
}
