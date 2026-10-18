import '@noizu/tobor-kit/asset-view.js';
import '@noizu/tobor-kit/asset-editor.js';

const view =
  document.querySelector('tobor-asset-view') ?? document.createElement('tobor-asset-view');
const editor =
  document.querySelector('tobor-asset-editor') ?? document.createElement('tobor-asset-editor');

// Host-owned snapshot. Kit does not persist.
const asset = {
  id: 'note-1',
  name: 'readme.txt',
  mime: 'text/plain',
  body: 'Hello from the host.',
};
view.asset = asset;
editor.asset = asset;

view.addEventListener('asset-open', () => {
  // Optional. Host may open a viewer. Kit does not navigate.
});

editor.addEventListener('asset-save', (event) => {
  // Host-owned persist — not a kit API.
  fetch('/assets/' + event.detail.id, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(event.detail),
  }).catch(() => {});
});

if (!view.isConnected) document.body.append(view);
if (!editor.isConnected) document.body.append(editor);
