import '@noizu/tobor-kit/wiki-space.js';
import '@noizu/tobor-kit/wiki-entry.js';
import '@noizu/tobor-kit/wiki-entry-editor.js';

const mount = document.querySelector('#wiki-mount') ?? document.body;
const spacesEl =
  document.querySelector('tobor-wiki-space') ?? document.createElement('tobor-wiki-space');
const entryEl =
  document.querySelector('tobor-wiki-entry') ?? document.createElement('tobor-wiki-entry');
const editorEl =
  document.querySelector('tobor-wiki-entry-editor') ??
  document.createElement('tobor-wiki-entry-editor');

if (!spacesEl.isConnected) mount.append(spacesEl);
if (!entryEl.isConnected) mount.append(entryEl);
if (!editorEl.isConnected) mount.append(editorEl);

const pages = {
  eng: {
    id: 'eng-readme',
    title: 'README',
    body: 'Ship the island.\nDo not render HTML.\n<section>stays source</section>',
    spaceId: 'eng',
  },
};

spacesEl.spaces = [{id: 'eng', title: 'Engineering', slug: 'eng'}];

spacesEl.addEventListener('wiki-space-select', (event) => {
  entryEl.entry = pages[event.detail.id] ?? null;
});

entryEl.addEventListener('wiki-edit', () => {
  editorEl.entry = entryEl.entry;
});

editorEl.addEventListener('wiki-save', (event) => {
  const saved = event.detail;
  // Host-owned; examples echo PUT /wiki/entries/{id}. Do not put secrets on the element.
  fetch(`/wiki/entries/${encodeURIComponent(saved.id || 'new')}`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(saved),
  }).catch(() => {});
  if (saved.spaceId) pages[saved.spaceId] = saved;
  entryEl.entry = saved;
  editorEl.entry = saved;
});
