import '@noizu/tobor-kit/prompt-library.js';
import '@noizu/tobor-kit/prompt-history.js';

const mount = document.querySelector('#prompt-mount') ?? document.body;
const libraryEl =
  document.querySelector('tobor-prompt-library') ??
  document.createElement('tobor-prompt-library');
const historyEl =
  document.querySelector('tobor-prompt-history') ??
  document.createElement('tobor-prompt-history');

if (!libraryEl.isConnected) mount.append(libraryEl);
if (!historyEl.isConnected) mount.append(historyEl);

libraryEl.prompts = [
  {
    id: 'sys',
    title: 'System',
    body: 'You are a helpful assistant.\nDo not render HTML.\n<section>stays source</section>',
    starred: true,
  },
  {id: 'brief', title: 'Brief', body: 'Be concise.\nNo HTML.'},
];

historyEl.entries = [
  {id: 'sys-v1', title: 'System', at: '2026-01-01T12:00:00Z', version: 1},
  {id: 'sys-v2', title: 'System', at: '2026-02-01T12:00:00Z', version: 2, starred: true},
];
historyEl.diff = {
  left: {label: 'v1', body: 'You are a helpful assistant.'},
  right: {label: 'v2', body: 'You are a concise assistant.\nNo HTML.\n<section>stays source</section>'},
};

libraryEl.addEventListener('prompt-select', (event) => {
  libraryEl.selectedId = event.detail.id;
});

const persistStar = (event) => {
  // Host-owned; examples echo PUT /prompts/{id}/star. Do not put secrets on the element.
  fetch(`/prompts/${encodeURIComponent(event.detail.id)}/star`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(event.detail),
  }).catch(() => {});
};

libraryEl.addEventListener('prompt-star', persistStar);
historyEl.addEventListener('prompt-star', persistStar);
historyEl.addEventListener('prompt-fork', (event) => {
  fetch(`/prompts/${encodeURIComponent(event.detail.id)}/fork`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(event.detail),
  }).catch(() => {});
});
