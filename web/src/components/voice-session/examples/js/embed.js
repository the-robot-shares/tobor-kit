/**
 * Vanilla mount for <tobor-voice-session>.
 * Point the client at elixir/ or go/ (`/api/tobor-kit`). Host-inject token.
 */
import {ToborKitClient} from '@noizu/tobor-kit/client.js';
import '@noizu/tobor-kit/voice-session.js';

const TAG = 'tobor-voice-session';

export function mountVoiceSession(parent = document.body, options = {}) {
  const el = document.createElement(TAG);
  // Host-owned: access token from the session, never a provider API key.
  el.client =
    options.client ??
    new ToborKitClient({
      baseUrl: options.baseUrl ?? '/api/tobor-kit',
      token: options.token,
    });
  el.voice = options.voice ?? {adapter: 'native', locale: 'en-US'};
  el.pushToTalk = options.pushToTalk === true;

  el.addEventListener('tobor-voice-state', (e) => options.onState?.(e.detail));
  el.addEventListener('tobor-voice-transcript', (e) => options.onTranscript?.(e.detail));
  el.addEventListener('tobor-voice-error', (e) => options.onError?.(e.detail));

  parent.append(el);
  return el;
}

if (typeof document !== 'undefined' && document.currentScript) {
  mountVoiceSession();
}

// el.start() / el.stop() / el.sendText('hello')
