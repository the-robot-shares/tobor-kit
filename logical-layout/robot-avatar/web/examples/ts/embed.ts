// Host apps: import {ROBOT_STATES, type ToborRobotAvatar} from '@noizu/tobor-kit/robot-avatar.js';
import {ROBOT_STATES, type ToborRobotAvatar} from '../../robot-avatar.js';

export interface MountRobotAvatarOptions {
  state?: ToborRobotAvatar['state'];
  renderer?: ToborRobotAvatar['renderer'];
  asset?: string;
  reducedMotion?: ToborRobotAvatar['reducedMotion'];
  label?: string;
  states?: ToborRobotAvatar['states'];
  avatar?: ToborRobotAvatar['avatar'];
}

/**
 * Mount <tobor-robot-avatar>. Host-owned: set `state` from your session / SSE.
 * No backend, no secrets. `states` and `avatar` are JS properties.
 */
export function mountRobotAvatar(
  host: HTMLElement,
  options: MountRobotAvatarOptions = {},
): ToborRobotAvatar {
  const el = document.createElement('tobor-robot-avatar') as ToborRobotAvatar;
  el.state = options.state ?? 'idle';
  el.label = options.label ?? 'Guide';
  el.renderer = options.renderer ?? 'glyph';
  el.reducedMotion = options.reducedMotion ?? 'respect';
  if (options.asset) el.asset = options.asset;
  if (options.states) el.states = options.states;
  if (options.avatar) el.avatar = options.avatar;
  host.append(el);
  return el;
}

export {ROBOT_STATES};
