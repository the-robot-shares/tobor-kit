/**
 * Typed mount for tobor-persona-card + tobor-persona-picker.
 * Host (published): import {ToborPersonaCard, type PersonaSelectDetail} from '@noizu/tobor-kit/persona-card.js';
 *                   import {ToborPersonaPicker, type PersonaEntry} from '@noizu/tobor-kit/persona-picker.js';
 *
 * Host-owned: roster + routing. Never put secrets on the element.
 */
import '../../../robot-avatar/robot-avatar.js';
import '../../persona-card.js';
import '../../persona-picker.js';
import type {ToborPersonaCard} from '../../persona-card.js';
import type {ToborPersonaPicker} from '../../persona-picker.js';
import type {PersonaEntry, PersonaSelectDetail} from '../../types.js';

const SAMPLE: PersonaEntry[] = [
  {id: 'nova', name: 'Nova', handle: '@nova'},
  {id: 'orbit', name: 'Orbit', handle: '@orbit'},
  {id: 'pip', name: 'Pip'},
];

export interface MountPersonaFamilyOptions {
  personaId?: string;
  displayName?: string;
  handle?: string;
  query?: string;
  personas?: PersonaEntry[];
  onSelect?: (detail: PersonaSelectDetail) => void;
}

export function mountPersonaFamily(
  host: HTMLElement = document.body,
  options: MountPersonaFamilyOptions = {},
): {card: ToborPersonaCard; picker: ToborPersonaPicker} {
  let card = host.querySelector('tobor-persona-card');
  if (!card) {
    card = document.createElement('tobor-persona-card');
    const avatar = document.createElement('tobor-robot-avatar');
    avatar.slot = 'avatar';
    avatar.setAttribute('state', 'idle');
    avatar.setAttribute('label', options.displayName ?? 'Nova');
    card.append(avatar);
    host.append(card);
  }
  card.personaId = options.personaId ?? 'nova';
  card.displayName = options.displayName ?? 'Nova';
  card.handle = options.handle ?? '@nova';
  card.addEventListener('persona-select', ((event: CustomEvent<PersonaSelectDetail>) => {
    host.dataset.personaId = event.detail.personaId;
    options.onSelect?.(event.detail);
  }) as EventListener);

  let picker = host.querySelector('tobor-persona-picker');
  if (!picker) {
    picker = document.createElement('tobor-persona-picker');
    host.append(picker);
  }
  picker.query = options.query ?? '';
  picker.personas = options.personas ?? SAMPLE;
  picker.addEventListener('persona-select', ((event: CustomEvent<PersonaSelectDetail>) => {
    host.dataset.personaId = event.detail.personaId;
    options.onSelect?.(event.detail);
  }) as EventListener);

  return {card, picker};
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountPersonaFamily();
  });
} else {
  mountPersonaFamily();
}
