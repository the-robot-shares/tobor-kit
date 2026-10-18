// @ts-nocheck — host snippet; copy against @noizu/tobor-kit.
import {ToborKitClient} from '@noizu/tobor-kit/client.js';
import type {Turn} from '@noizu/tobor-kit';
import {
  createBackendStore,
  createMemoryStore,
  type TranscriptLoad,
  type TranscriptStore,
} from '@noizu/tobor-kit/transcript-store.js';
import {
  ToborChatThread,
  type ThreadSendDetail,
} from '@noizu/tobor-kit/chat-thread.js';

const mount = document.querySelector('#chat-thread-mount') ?? document.body;
const el = document.createElement('tobor-chat-thread') as ToborChatThread;
el.showComposer = true;
mount.append(el);

const sessionId = new URLSearchParams(location.search).get('session') ?? undefined;
const client = new ToborKitClient({
  baseUrl: '/api/tobor-kit',
  token: () => (window as Window & {__TOBOR_ACCESS_TOKEN?: string}).__TOBOR_ACCESS_TOKEN,
});

const store: TranscriptStore = sessionId
  ? createBackendStore(client, sessionId)
  : createMemoryStore();

el.participants = [{id: 'guide', name: 'Guide'}];
el.addEventListener('tobor-transcript-clear', () => {
  el.turns = [];
  el.messages = [];
  el.load = null;
});
el.addEventListener('thread-send', (event: CustomEvent<ThreadSendDetail>) => {
  // Host-owned: POST /api/tobor-kit/sessions/{id}/turn if you persist.
  console.info('thread-send', event.detail.text);
});

const load: TranscriptLoad = await store.load();
el.store = store;
el.load = load;
if (load.status === 'ok') {
  const turns: Turn[] = load.turns;
  el.turns = turns;
}
