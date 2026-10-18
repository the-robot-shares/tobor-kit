import {ToborKitClient} from '@noizu/tobor-kit/client.js';
import {createBackendStore, storeForGuide} from '@noizu/tobor-kit/transcript-store.js';
import '@noizu/tobor-kit/chat-thread.js';

const mount = document.querySelector('#chat-thread-mount') ?? document.body;
const el = document.createElement('tobor-chat-thread');
el.showComposer = true;
mount.append(el);

const sessionId = new URLSearchParams(location.search).get('session') ?? undefined;
const client = new ToborKitClient({
  baseUrl: '/api/tobor-kit',
  token: () => window.__TOBOR_ACCESS_TOKEN, // host-owned; never a provider key
});

const store = sessionId
  ? createBackendStore(client, sessionId)
  : storeForGuide({store: 'memory'});

el.participants = [{id: 'guide', name: 'Guide'}];
el.addEventListener('tobor-transcript-clear', () => {
  el.turns = [];
  el.messages = [];
  el.load = null;
});
el.addEventListener('thread-send', (event) => {
  // Host-owned: POST /api/tobor-kit/sessions/{id}/turn if you persist.
  console.info('thread-send', event.detail.text);
});

const load = await store.load();
el.store = store;
el.load = load;
if (load.status === 'ok') el.turns = load.turns;
