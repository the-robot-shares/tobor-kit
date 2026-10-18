/**
 * Typed mount for tobor-agent-card + tobor-user-card.
 * Host (published): import {ToborAgentCard, type AgentChatDetail} from '@noizu/tobor-kit/agent-card.js';
 *                   import {ToborUserCard, type UserProfileDetail} from '@noizu/tobor-kit/user-card.js';
 *
 * Host-owned: projection + routing. Never put secrets on the element.
 */
import '../../../robot-avatar/robot-avatar.js';
import '../../agent-card.js';
import '../../user-card.js';
import type {ToborAgentCard, AgentChatDetail} from '../../agent-card.js';
import type {ToborUserCard, UserProfileDetail} from '../../user-card.js';
import type {PartyPresence} from '../../party-card.js';

export interface MountPartyCardsOptions {
  agentName?: string;
  agentHandle?: string;
  agentPresence?: PartyPresence;
  agentId?: string;
  modelBadge?: string;
  showCapabilities?: boolean;
  capabilities?: string[];
  userName?: string;
  userHandle?: string;
  userPresence?: PartyPresence;
  userId?: string;
  role?: string;
  org?: string;
  onAgentChat?: (detail: AgentChatDetail) => void;
  onUserProfile?: (detail: UserProfileDetail) => void;
}

export function mountPartyCards(
  host: HTMLElement = document.body,
  options: MountPartyCardsOptions = {},
): {agent: ToborAgentCard; user: ToborUserCard} {
  let agent = host.querySelector('tobor-agent-card');
  if (!agent) {
    agent = document.createElement('tobor-agent-card');
    const avatar = document.createElement('tobor-robot-avatar');
    avatar.slot = 'avatar';
    avatar.setAttribute('state', 'idle');
    avatar.setAttribute('label', options.agentName ?? 'Nova');
    agent.append(avatar);
    host.append(agent);
  }
  agent.displayName = options.agentName ?? 'Nova';
  agent.handle = options.agentHandle ?? '@nova';
  agent.presence = options.agentPresence ?? 'online';
  agent.agentId = options.agentId ?? 'nova';
  agent.modelBadge = options.modelBadge ?? 'gpt-4o';
  agent.showCapabilities = options.showCapabilities ?? true;
  agent.capabilities = options.capabilities ?? ['voice', 'tools', 'mcp'];
  agent.addEventListener('agent-chat', ((event: CustomEvent<AgentChatDetail>) => {
    host.dataset.agentChat = event.detail.agentId;
    options.onAgentChat?.(event.detail);
  }) as EventListener);

  let user = host.querySelector('tobor-user-card');
  if (!user) {
    user = document.createElement('tobor-user-card');
    host.append(user);
  }
  user.displayName = options.userName ?? 'Keith';
  user.handle = options.userHandle ?? '@keith';
  user.presence = options.userPresence ?? 'away';
  user.userId = options.userId ?? 'keith';
  user.role = options.role ?? 'Owner';
  user.org = options.org ?? 'Noizu';
  user.addEventListener('user-profile', ((event: CustomEvent<UserProfileDetail>) => {
    host.dataset.userProfile = event.detail.userId;
    options.onUserProfile?.(event.detail);
  }) as EventListener);

  return {agent, user};
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountPartyCards();
  });
} else {
  mountPartyCards();
}
