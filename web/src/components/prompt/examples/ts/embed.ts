// Host apps: import '@noizu/tobor-kit/prompt-library.js' (and prompt-history).
import {ToborPromptLibrary} from '../../tobor-prompt-library.js';
import {ToborPromptHistory} from '../../tobor-prompt-history.js';
import type {PromptForkDetail, PromptHistoryEntry, PromptRecord, PromptStarDetail} from '../../types.js';

const mount = document.querySelector('#prompt-mount') ?? document.body;

const libraryEl =
  document.querySelector('tobor-prompt-library') ?? new ToborPromptLibrary();
const historyEl =
  document.querySelector('tobor-prompt-history') ?? new ToborPromptHistory();

if (!libraryEl.isConnected) mount.append(libraryEl);
if (!historyEl.isConnected) mount.append(historyEl);

const prompts: PromptRecord[] = [
  {
    id: 'sys',
    title: 'System',
    body: 'You are a helpful assistant.\nDo not render HTML.\n<section>stays source</section>',
    starred: true,
  },
  {id: 'brief', title: 'Brief', body: 'Be concise.\nNo HTML.'},
];

const entries: PromptHistoryEntry[] = [
  {id: 'sys-v1', title: 'System', at: '2026-01-01T12:00:00Z', version: 1},
  {id: 'sys-v2', title: 'System', at: '2026-02-01T12:00:00Z', version: 2, starred: true},
];

libraryEl.prompts = prompts;
historyEl.entries = entries;
historyEl.diff = {
  left: {label: 'v1', body: 'You are a helpful assistant.'},
  right: {label: 'v2', body: 'You are a concise assistant.\nNo HTML.\n<section>stays source</section>'},
};

libraryEl.addEventListener('prompt-select', (event: Event) => {
  libraryEl.selectedId = (event as CustomEvent<{id: string}>).detail.id;
});

const persistStar = (event: Event): void => {
  const detail = (event as CustomEvent<PromptStarDetail>).detail;
  // Host-owned; examples echo PUT /prompts/{id}/star. Do not put secrets on the element.
  void fetch(`/prompts/${encodeURIComponent(detail.id)}/star`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(detail),
  });
};

libraryEl.addEventListener('prompt-star', persistStar);
historyEl.addEventListener('prompt-star', persistStar);
historyEl.addEventListener('prompt-fork', (event: Event) => {
  const detail = (event as CustomEvent<PromptForkDetail>).detail;
  void fetch(`/prompts/${encodeURIComponent(detail.id)}/fork`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(detail),
  });
});
