/**
 * Voice adapters — one per `voice.adapter` value in the guide projection.
 *
 * All four are framework-free; `<tobor-voice-session>` is a thin element over
 * whichever one the projection names. Every adapter reports progress as
 * canonical `GuideState` values so the avatar is driven from a single
 * vocabulary regardless of how audio actually happens.
 */

import type { ToborKitClient } from "../../client.js";
import type { GuideState, GuideVoice, VoiceAdapterName } from "../../types.js";
import {
  connectOpenAIRealtime,
  errorMessageFromRealtimeEvent,
  statusFromRealtimeEvent,
  transcriptFromRealtimeEvent,
  buildResponseCreateEvent,
  buildUserTextItemEvent,
  type OpenAIRealtimeSession,
  type RealtimeUiStatus,
} from "./openai-realtime.js";

export interface VoiceTranscriptEntry {
  speaker: "user" | "guide";
  text: string;
  final: boolean;
}

export interface VoiceAdapterHooks {
  onState?: (state: GuideState) => void;
  onTranscript?: (entry: VoiceTranscriptEntry) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface VoiceAdapter {
  readonly name: VoiceAdapterName;
  /** False when the adapter is always open-mic. */
  readonly supportsPushToTalk: boolean;
  readonly active: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Push typed text through the voice channel, when the adapter allows it. */
  sendText(text: string): void;
}

export function guideStateFromRealtimeStatus(status: RealtimeUiStatus): GuideState {
  switch (status) {
    case "connecting":
      return "thinking";
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

/* ------------------------------------------------------------------ none */

class NoneAdapter implements VoiceAdapter {
  readonly name: VoiceAdapterName = "none";
  readonly supportsPushToTalk = false;
  active = false;
  #hooks: VoiceAdapterHooks;

  constructor(hooks: VoiceAdapterHooks) {
    this.#hooks = hooks;
  }

  async start(): Promise<void> {
    this.#hooks.onError?.({ code: "voice_disabled", message: "voice is disabled for this guide" });
  }

  async stop(): Promise<void> {
    /* nothing to stop */
  }

  sendText(): void {
    /* nothing to send */
  }
}

/* -------------------------------------------------------------- realtime */

export interface RealtimeAdapterOptions {
  client: ToborKitClient;
  hooks: VoiceAdapterHooks;
  audioHost?: HTMLElement;
  /** Test seam mirroring `connectOpenAIRealtime`. */
  connect?: typeof connectOpenAIRealtime;
}

class RealtimeAdapter implements VoiceAdapter {
  readonly name: VoiceAdapterName = "realtime";
  readonly supportsPushToTalk = false;
  active = false;

  #opts: RealtimeAdapterOptions;
  #session: OpenAIRealtimeSession | null = null;
  #status: RealtimeUiStatus = "idle";

  constructor(opts: RealtimeAdapterOptions) {
    this.#opts = opts;
  }

  async start(): Promise<void> {
    if (this.active) return;
    const { client, hooks } = this.#opts;
    const connect = this.#opts.connect ?? connectOpenAIRealtime;

    this.#setStatus("connecting");
    try {
      this.#session = await connect({
        audioHost: this.#opts.audioHost,
        mintSession: async () => {
          const result = await client.mintVoiceToken();
          if (!result.ok) {
            throw new Error(
              result.reason === "not_required"
                ? "server says this adapter needs no credential; the guide's voice.adapter and the server disagree"
                : result.message,
            );
          }
          const rt = result.credential.realtime ?? {};
          if (!rt.token) throw new Error("voice credential carried no ephemeral token");
          const expires = Date.parse(result.credential.expires_at);
          return {
            client_secret: rt.token,
            calls_url: rt.url,
            model: rt.model,
            voice: rt.voice,
            expires_at: Number.isFinite(expires) ? Math.floor(expires / 1000) : null,
          };
        },
        onEvent: (event) => {
          this.#setStatus(statusFromRealtimeEvent(event, this.#status));
          if (event.type === "error") {
            hooks.onError?.({ code: "realtime_error", message: errorMessageFromRealtimeEvent(event) });
          }
          const entry = transcriptFromRealtimeEvent(event);
          if (entry) {
            hooks.onTranscript?.({
              speaker: entry.speaker === "you" ? "user" : "guide",
              text: entry.text,
              final: true,
            });
          }
        },
        onSessionExpiring: () => {
          hooks.onError?.({
            code: "credential_expiring",
            message: "voice credential expires shortly; reconnect to continue",
          });
        },
      });
      this.active = true;
      this.#setStatus("listening");
    } catch (err) {
      this.active = false;
      this.#setStatus("error");
      hooks.onError?.({
        code: "voice_start_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async stop(): Promise<void> {
    this.#session?.stop();
    this.#session = null;
    this.active = false;
    this.#setStatus("idle");
  }

  sendText(text: string): void {
    if (!this.#session) return;
    this.#session.sendEvent(buildUserTextItemEvent(text));
    this.#session.sendEvent(buildResponseCreateEvent());
  }

  #setStatus(status: RealtimeUiStatus): void {
    this.#status = status;
    this.#opts.hooks.onState?.(guideStateFromRealtimeStatus(status));
  }
}

/* ---------------------------------------------------------------- native */

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface NativeAdapterOptions {
  client?: ToborKitClient;
  hooks: VoiceAdapterHooks;
  locale?: string;
  recognitionCtor?: SpeechRecognitionCtor;
  synthesis?: SpeechSynthesis;
}

/**
 * Browser-native speech. `POST /voice/token` answers 409 for this adapter —
 * that is the expected answer, not a failure, so it is consulted once purely
 * to confirm the server agrees with the projection.
 */
class NativeAdapter implements VoiceAdapter {
  readonly name: VoiceAdapterName = "native";
  readonly supportsPushToTalk = true;
  active = false;

  #opts: NativeAdapterOptions;
  #recognition: SpeechRecognitionLike | null = null;

  constructor(opts: NativeAdapterOptions) {
    this.#opts = opts;
  }

  async start(): Promise<void> {
    if (this.active) return;
    const { hooks } = this.#opts;

    if (this.#opts.client) {
      const result = await this.#opts.client.mintVoiceToken();
      if (result.ok) {
        hooks.onError?.({
          code: "adapter_mismatch",
          message: "server minted a credential for a native adapter; check voice.adapter",
        });
      } else if (result.reason === "unavailable") {
        hooks.onError?.({ code: "voice_unavailable", message: result.message });
        hooks.onState?.("error");
        return;
      }
      // reason === "not_required" is the documented, expected answer.
    }

    const Ctor =
      this.#opts.recognitionCtor ??
      ((globalThis as any).SpeechRecognition as SpeechRecognitionCtor | undefined) ??
      ((globalThis as any).webkitSpeechRecognition as SpeechRecognitionCtor | undefined);

    if (!Ctor) {
      hooks.onError?.({
        code: "native_unsupported",
        message: "this browser has no SpeechRecognition; choose a different voice adapter",
      });
      hooks.onState?.("error");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = this.#opts.locale ?? "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      const results = event?.results ?? [];
      for (let i = event?.resultIndex ?? 0; i < results.length; i += 1) {
        const result = results[i];
        const text = String(result?.[0]?.transcript ?? "").trim();
        if (text) {
          hooks.onTranscript?.({ speaker: "user", text, final: result?.isFinal === true });
        }
      }
    };
    recognition.onerror = (event: any) => {
      hooks.onError?.({ code: "native_error", message: String(event?.error ?? "recognition error") });
      hooks.onState?.("error");
    };
    recognition.onend = () => {
      if (this.active) {
        this.active = false;
        hooks.onState?.("idle");
      }
    };

    this.#recognition = recognition;
    recognition.start();
    this.active = true;
    hooks.onState?.("listening");
  }

  async stop(): Promise<void> {
    this.active = false;
    try {
      this.#recognition?.stop();
    } catch {
      /* already stopped */
    }
    this.#recognition = null;
    this.#opts.hooks.onState?.("idle");
  }

  sendText(text: string): void {
    const synth = this.#opts.synthesis ?? globalThis.speechSynthesis;
    if (!synth || !text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.#opts.locale ?? "en-US";
    utterance.onstart = () => this.#opts.hooks.onState?.("speaking");
    utterance.onend = () => this.#opts.hooks.onState?.(this.active ? "listening" : "idle");
    synth.speak(utterance);
  }
}

/* --------------------------------------------------------------- backend */

export interface BackendAdapterOptions {
  client: ToborKitClient;
  hooks: VoiceAdapterHooks;
  fetchImpl?: typeof fetch;
  audioHost?: HTMLElement;
  getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
}

/**
 * Server-side STT/TTS. Push-to-talk by nature: a clip is recorded, posted to
 * `stt_url`, and the reply is spoken from `tts_url`.
 */
class BackendAdapter implements VoiceAdapter {
  readonly name: VoiceAdapterName = "backend";
  readonly supportsPushToTalk = true;
  active = false;

  #opts: BackendAdapterOptions;
  #recorder: MediaRecorder | null = null;
  #stream: MediaStream | null = null;
  #sttUrl = "";
  #ttsUrl = "";

  constructor(opts: BackendAdapterOptions) {
    this.#opts = opts;
  }

  async start(): Promise<void> {
    if (this.active) return;
    const { hooks } = this.#opts;
    const result = await this.#opts.client.mintVoiceToken();
    if (!result.ok) {
      hooks.onError?.({
        code: result.reason === "not_required" ? "adapter_mismatch" : "voice_unavailable",
        message:
          result.reason === "not_required"
            ? "server says no credential is needed; check voice.adapter"
            : result.message,
      });
      hooks.onState?.("error");
      return;
    }
    this.#sttUrl = result.credential.backend?.stt_url ?? "";
    this.#ttsUrl = result.credential.backend?.tts_url ?? "";
    if (!this.#sttUrl) {
      hooks.onError?.({ code: "voice_unconfigured", message: "credential carried no stt_url" });
      hooks.onState?.("error");
      return;
    }

    const getUserMedia =
      this.#opts.getUserMedia ?? ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c));
    try {
      this.#stream = await getUserMedia({ audio: true });
    } catch (err) {
      hooks.onError?.({
        code: "mic_denied",
        message: err instanceof Error ? err.message : String(err),
      });
      hooks.onState?.("error");
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(this.#stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks.splice(0), { type: recorder.mimeType || "audio/webm" });
      void this.#transcribe(blob);
    };
    this.#recorder = recorder;
    recorder.start();
    this.active = true;
    hooks.onState?.("listening");
  }

  async stop(): Promise<void> {
    this.active = false;
    try {
      this.#recorder?.stop();
    } catch {
      /* not recording */
    }
    this.#recorder = null;
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = null;
    this.#opts.hooks.onState?.("idle");
  }

  sendText(text: string): void {
    if (this.#ttsUrl && text.trim()) void this.#speak(text);
  }

  async #transcribe(blob: Blob): Promise<void> {
    const { hooks } = this.#opts;
    const doFetch = this.#opts.fetchImpl ?? globalThis.fetch;
    hooks.onState?.("thinking");
    try {
      const res = await doFetch(this.#sttUrl, { method: "POST", body: blob });
      if (!res.ok) throw new Error(`stt failed (${res.status})`);
      const body = (await res.json()) as { text?: string };
      if (body.text) hooks.onTranscript?.({ speaker: "user", text: body.text, final: true });
      hooks.onState?.("idle");
    } catch (err) {
      hooks.onError?.({ code: "stt_failed", message: err instanceof Error ? err.message : String(err) });
      hooks.onState?.("error");
    }
  }

  async #speak(text: string): Promise<void> {
    const { hooks } = this.#opts;
    const doFetch = this.#opts.fetchImpl ?? globalThis.fetch;
    try {
      hooks.onState?.("speaking");
      const res = await doFetch(this.#ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`tts failed (${res.status})`);
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.src = URL.createObjectURL(await res.blob());
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        audio.remove();
        hooks.onState?.(this.active ? "listening" : "idle");
      };
      (this.#opts.audioHost ?? document.body).appendChild(audio);
    } catch (err) {
      hooks.onError?.({ code: "tts_failed", message: err instanceof Error ? err.message : String(err) });
      hooks.onState?.("error");
    }
  }
}

/* --------------------------------------------------------------- factory */

export interface CreateVoiceAdapterOptions {
  voice: GuideVoice | undefined;
  client: ToborKitClient;
  hooks: VoiceAdapterHooks;
  audioHost?: HTMLElement;
  /** Test seam handed through to the realtime adapter. */
  connect?: typeof connectOpenAIRealtime;
  recognitionCtor?: new () => SpeechRecognitionLike;
}

export function createVoiceAdapter(options: CreateVoiceAdapterOptions): VoiceAdapter {
  const { voice, client, hooks } = options;
  // Contract resolution: an OMITTED adapter means the schema default
  // (`realtime`). Only an explicit `none` disables voice.
  switch (voice?.adapter) {
    case "realtime":
    case undefined:
      return new RealtimeAdapter({
        client,
        hooks,
        audioHost: options.audioHost,
        connect: options.connect,
      });
    case "native":
      return new NativeAdapter({
        client,
        hooks,
        locale: voice.locale,
        recognitionCtor: options.recognitionCtor,
      });
    case "backend":
      return new BackendAdapter({ client, hooks, audioHost: options.audioHost });
    default:
      return new NoneAdapter(hooks);
  }
}
