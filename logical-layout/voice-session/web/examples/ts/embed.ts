/**
 * Typed mount for <tobor-voice-session>.
 * Host npm: `import '@noizu/tobor-kit/voice-session.js'`
 * Point the client at elixir/ or go/ (`/api/tobor-kit`). Host-inject token.
 */
import {ToborKitClient, type TokenProvider} from '../../../../client.js';
import '../../voice-session.js';
import type {ToborVoiceSession} from '../../voice-session.js';
import type {GuideState, GuideVoice} from '../../../../types.js';
import type {VoiceTranscriptEntry} from '../../adapter.js';

export interface VoiceSessionMountOptions {
  baseUrl?: string;
  token?: TokenProvider;
  client?: ToborKitClient;
  voice?: GuideVoice;
  pushToTalk?: boolean;
  onState?: (detail: {state: GuideState}) => void;
  onTranscript?: (detail: {entry: VoiceTranscriptEntry}) => void;
  onError?: (detail: {error: {code: string; message: string}}) => void;
}

export function mountVoiceSession(
  parent: ParentNode = document.body,
  options: VoiceSessionMountOptions = {},
): ToborVoiceSession {
  const el = document.createElement('tobor-voice-session');
  // Host-owned: access token from the session, never a provider API key.
  el.client =
    options.client ??
    new ToborKitClient({
      baseUrl: options.baseUrl ?? '/api/tobor-kit',
      token: options.token,
    });
  el.voice = options.voice ?? {adapter: 'native', locale: 'en-US'};
  el.pushToTalk = options.pushToTalk === true;

  el.addEventListener('tobor-voice-state', (e) =>
    options.onState?.((e as CustomEvent<{state: GuideState}>).detail),
  );
  el.addEventListener('tobor-voice-transcript', (e) =>
    options.onTranscript?.((e as CustomEvent<{entry: VoiceTranscriptEntry}>).detail),
  );
  el.addEventListener('tobor-voice-error', (e) =>
    options.onError?.(
      (e as CustomEvent<{error: {code: string; message: string}}>).detail,
    ),
  );

  parent.append(el);
  return el;
}

// await el.start(); await el.stop(); el.sendText('hello');
