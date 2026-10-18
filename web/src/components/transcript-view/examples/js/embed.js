import {ToborKitClient} from '@noizu/tobor-kit/client.js';
import {createBackendStore, storeForGuide} from '@noizu/tobor-kit/transcript-store.js';
import '@noizu/tobor-kit/transcript-view.js';

const mount = document.querySelector('#transcript-mount') ?? document.body;
const el = document.createElement('tobor-transcript-view');
mount.append(el);

const sessionId = new URLSearchParams(location.search).get('session') ?? undefined;
const client = new ToborKitClient({
  baseUrl: '/api/tobor-kit',
  token: () => window.__TOBOR_ACCESS_TOKEN, // host-owned; never a provider key
});

const store = sessionId
  ? createBackendStore(client, sessionId)
  : storeForGuide({store: 'memory'});

el.addEventListener('tobor-transcript-clear', () => {
  el.turns = [];
  el.load = null;
});

const load = await store.load();
el.store = store;
el.load = load;
if (load.status === 'ok') el.turns = load.turns;
