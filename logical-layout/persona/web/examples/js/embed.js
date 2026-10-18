/**
 * Vanilla mount for tobor-persona-card + tobor-persona-picker.
 * Host: import '@noizu/tobor-kit/persona-card.js'; import '@noizu/tobor-kit/persona-picker.js';
 *
 * Host-owned: roster + routing on persona-select.
 * Never put secrets on the element.
 */
import '../../../robot-avatar/robot-avatar.js';
import '../../persona-card.js';
import '../../persona-picker.js';

const SAMPLE = [
  {id: 'nova', name: 'Nova', handle: '@nova'},
  {id: 'orbit', name: 'Orbit', handle: '@orbit'},
  {id: 'pip', name: 'Pip'},
];

export function mountPersonaFamily(host = document.body, options = {}) {
  let card = host.querySelector('tobor-persona-card');
  if (!card) {
    card = document.createElement('tobor-persona-card');
    const avatar = document.createElement('tobor-robot-avatar');
    avatar.setAttribute('slot', 'avatar');
    avatar.setAttribute('state', 'idle');
    avatar.setAttribute('label', options.displayName ?? 'Nova');
    card.append(avatar);
    host.append(card);
  }
  card.personaId = options.personaId ?? 'nova';
  card.displayName = options.displayName ?? 'Nova';
  card.handle = options.handle ?? '@nova';
  card.addEventListener('persona-select', (event) => {
    host.dataset.personaId = event.detail.personaId;
    options.onSelect?.(event.detail);
  });

  let picker = host.querySelector('tobor-persona-picker');
  if (!picker) {
    picker = document.createElement('tobor-persona-picker');
    host.append(picker);
  }
  picker.query = options.query ?? '';
  picker.personas = options.personas ?? SAMPLE;
  picker.addEventListener('persona-select', (event) => {
    host.dataset.personaId = event.detail.personaId;
    options.onSelect?.(event.detail);
  });

  return {card, picker};
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountPersonaFamily());
} else {
  mountPersonaFamily();
}
