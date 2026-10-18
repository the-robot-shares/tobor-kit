// @ts-nocheck — host snippet; copy against @noizu/tobor-kit.
import '@noizu/tobor-kit/guide-panel.js';
import type {ToborGuidePanel} from '@noizu/tobor-kit/guide-panel.js';
import type {GuideState, Turn} from '@noizu/tobor-kit';

const mount = document.querySelector('#guide-mount') ?? document.body;
const panel = document.createElement('tobor-guide-panel') as ToborGuidePanel;
panel.setAttribute('base-url', '/api/tobor-kit');
panel.placement = 'floating';
mount.append(panel);

// Host-owned; never assign a provider API key or refresh token.
panel.token = (window as Window & {__TOBOR_ACCESS_TOKEN?: string}).__TOBOR_ACCESS_TOKEN;

panel.addEventListener('tobor-task-invoked', (event: Event) => {
  console.debug('tobor-task-invoked', (event as CustomEvent<{task_id: string}>).detail);
});
panel.addEventListener('tobor-turn-submitted', (event: Event) => {
  console.debug(
    'tobor-turn-submitted',
    (event as CustomEvent<{input: string; task_id?: string}>).detail,
  );
});
panel.addEventListener('tobor-state-change', (event: Event) => {
  console.debug('tobor-state-change', (event as CustomEvent<{state: GuideState}>).detail);
});
panel.addEventListener('tobor-turn-error', (event: Event) => {
  console.warn(
    'tobor-turn-error',
    (event as CustomEvent<{error: {code: string; message: string}}>).detail,
  );
});
panel.addEventListener('tobor-turn-message', (event: Event) => {
  console.debug('tobor-turn-message', (event as CustomEvent<{turn: Turn}>).detail);
});
