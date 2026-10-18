/**
 * Vanilla mount for tobor-agent-card + tobor-user-card.
 * Host: import '@noizu/tobor-kit/agent-card.js'; import '@noizu/tobor-kit/user-card.js';
 *
 * Host-owned: projection + routing on agent-chat / user-profile.
 * Never put secrets on the element.
 */
import '../../../robot-avatar/robot-avatar.js';
import '../../agent-card.js';
import '../../user-card.js';

export function mountPartyCards(host = document.body, options = {}) {
  let agent = host.querySelector('tobor-agent-card');
  if (!agent) {
    agent = document.createElement('tobor-agent-card');
    const avatar = document.createElement('tobor-robot-avatar');
    avatar.setAttribute('slot', 'avatar');
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
  agent.addEventListener('agent-chat', (event) => {
    host.dataset.agentChat = event.detail.agentId;
    options.onAgentChat?.(event.detail);
  });

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
  user.addEventListener('user-profile', (event) => {
    host.dataset.userProfile = event.detail.userId;
    options.onUserProfile?.(event.detail);
  });

  return {agent, user};
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountPartyCards());
} else {
  mountPartyCards();
}
