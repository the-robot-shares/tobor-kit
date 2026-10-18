import '@noizu/tobor-kit/guide-panel.js';

const mount = document.querySelector('#guide-mount') ?? document.body;
const panel = document.createElement('tobor-guide-panel');
panel.setAttribute('base-url', '/api/tobor-kit');
panel.setAttribute('placement', 'floating');
mount.append(panel);

// Host-owned; never assign a provider API key or refresh token.
panel.token = window.__TOBOR_ACCESS_TOKEN;

panel.addEventListener('tobor-task-invoked', (event) => {
  console.debug('tobor-task-invoked', event.detail);
});
panel.addEventListener('tobor-turn-submitted', (event) => {
  console.debug('tobor-turn-submitted', event.detail);
});
panel.addEventListener('tobor-state-change', (event) => {
  console.debug('tobor-state-change', event.detail);
});
panel.addEventListener('tobor-turn-error', (event) => {
  console.warn('tobor-turn-error', event.detail);
});
panel.addEventListener('tobor-turn-message', (event) => {
  console.debug('tobor-turn-message', event.detail);
});
