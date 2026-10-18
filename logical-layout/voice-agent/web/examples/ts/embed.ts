import {
  createAvatarGroups,
  type ContextAction,
  type ToborVoiceAgent,
} from '../../voice-agent.js';

export interface VoiceAgentMount {
  backendUrl: string;
  organization: string;
  project: string;
}

/** Typed mount. Hosts can switch the import to `@noizu/tobor-kit/voice-agent.js`. */
export function mountVoiceAgent(host: ParentNode, options: VoiceAgentMount): ToborVoiceAgent {
  const agent = document.createElement('tobor-voice-agent') as ToborVoiceAgent;
  const contextActions: ContextAction[] = [
    'configure-avatar',
    'copy-transcript',
    'clear-transcript',
    'disconnect',
  ];
  Object.assign(agent, {
    organization: options.organization,
    project: options.project,
    backendUrl: options.backendUrl,
    backend: 'litellm',
    engine: 'tts' as const,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful voice assistant.',
    tools: [] as unknown[],
    mcpTools: [] as string[],
    avatarGroups: createAvatarGroups(new URL('/', import.meta.url).href),
    avatarGroup: 'orbit',
    contextActions,
    label: 'Voice agent',
  });
  agent.addEventListener('tobor-agent-error', (event: Event) => {
    console.error((event as CustomEvent<{message: string}>).detail.message);
  });
  host.appendChild(agent);
  return agent;
}
