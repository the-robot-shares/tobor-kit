import '@noizu/tobor-kit/robot-avatar.js';

const STATES = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'tool_running',
  'error',
  'offline',
];

/**
 * Mount <tobor-robot-avatar>. Host-owned: set `state` from your session.
 * No backend, no secrets. `states` is a JS property, not an HTML attribute.
 */
export function mountRobotAvatar(host, options = {}) {
  const el = document.createElement('tobor-robot-avatar');
  el.setAttribute('state', options.state ?? 'idle');
  el.setAttribute('label', options.label ?? 'Guide');
  el.setAttribute('renderer', options.renderer ?? 'glyph');
  el.setAttribute('reduced-motion', options.reducedMotion ?? 'respect');
  if (options.asset) el.setAttribute('asset', options.asset);
  if (options.states) el.states = options.states;
  if (options.avatar) el.avatar = options.avatar;
  host.append(el);
  return el;
}

export {STATES as ROBOT_STATES};
