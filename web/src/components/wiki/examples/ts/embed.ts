// Host apps: import '@noizu/tobor-kit/wiki-space.js' (and entry / entry-editor).
import {ToborWikiSpace} from '../../tobor-wiki-space.js';
import {ToborWikiEntry} from '../../tobor-wiki-entry.js';
import {ToborWikiEntryEditor} from '../../tobor-wiki-entry-editor.js';
import type {WikiEntry, WikiSaveDetail, WikiSpaceSelectDetail} from '../../types.js';

const mount = document.querySelector('#wiki-mount') ?? document.body;

const spacesEl =
  document.querySelector('tobor-wiki-space') ?? new ToborWikiSpace();
const entryEl = document.querySelector('tobor-wiki-entry') ?? new ToborWikiEntry();
const editorEl =
  document.querySelector('tobor-wiki-entry-editor') ?? new ToborWikiEntryEditor();

if (!spacesEl.isConnected) mount.append(spacesEl);
if (!entryEl.isConnected) mount.append(entryEl);
if (!editorEl.isConnected) mount.append(editorEl);

const pages: Record<string, WikiEntry> = {
  eng: {
    id: 'eng-readme',
    title: 'README',
    body: 'Ship the island.\nDo not render HTML.\n<section>stays source</section>',
    spaceId: 'eng',
  },
};

spacesEl.spaces = [{id: 'eng', title: 'Engineering', slug: 'eng'}];

spacesEl.addEventListener('wiki-space-select', (event: Event) => {
  const id = (event as CustomEvent<WikiSpaceSelectDetail>).detail.id;
  entryEl.entry = pages[id] ?? null;
});

entryEl.addEventListener('wiki-edit', () => {
  editorEl.entry = entryEl.entry;
});

editorEl.addEventListener('wiki-save', (event: Event) => {
  const saved = (event as CustomEvent<WikiSaveDetail>).detail;
  // Host-owned; examples echo PUT /wiki/entries/{id}. Do not put secrets on the element.
  void fetch(`/wiki/entries/${encodeURIComponent(saved.id || 'new')}`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(saved),
  });
  if (saved.spaceId) pages[saved.spaceId] = saved;
  entryEl.entry = saved;
  editorEl.entry = saved;
});
