// Host apps: import '@noizu/tobor-kit/asset-view.js' and '@noizu/tobor-kit/asset-editor.js'.
import '../../asset-view.js';
import '../../asset-editor.js';
import type {Asset, AssetSaveDetail} from '../../asset.js';
import type {ToborAssetEditor} from '../../asset-editor.js';
import type {ToborAssetView} from '../../asset-view.js';

const view = (document.querySelector('tobor-asset-view') ??
  document.createElement('tobor-asset-view')) as ToborAssetView;
const editor = (document.querySelector('tobor-asset-editor') ??
  document.createElement('tobor-asset-editor')) as ToborAssetEditor;

const asset: Asset = {
  id: 'note-1',
  name: 'readme.txt',
  mime: 'text/plain',
  body: 'Hello from the host.',
};

// Host-owned snapshot. Kit does not persist.
view.asset = asset;
editor.asset = asset;

view.addEventListener('asset-open', () => {
  // Optional. Host may open a viewer. Kit does not navigate.
});

editor.addEventListener('asset-save', (event: Event) => {
  const detail = (event as CustomEvent<AssetSaveDetail>).detail;
  // Host-owned persist — not a kit API.
  void saveHostAsset(detail);
});

if (!view.isConnected) document.body.append(view);
if (!editor.isConnected) document.body.append(editor);

/** Host route — secrets stay on the server. */
async function saveHostAsset(detail: AssetSaveDetail): Promise<void> {
  await fetch(`/assets/${detail.id}`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(detail),
  });
}
