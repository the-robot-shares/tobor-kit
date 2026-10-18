/**
 * OpenAI Realtime (WebRTC) client helpers.
 *
 * Ported from therobotplans.com `src/lib/pm/openai-realtime.ts` — deliberately
 * framework-free so `<tobor-voice-session>` is a thin wrapper over it and the
 * same code can be exercised without a DOM element.
 *
 * 1. The tobor-kit backend mints an ephemeral credential (POST /voice/token)
 * 2. Browser creates a WebRTC offer + mic track
 * 3. Browser POSTs raw SDP to the provider with the ephemeral bearer
 * 4. Audio + data-channel events ride the peer connection
 *
 * The client never holds a long-lived provider key — that is contract, not
 * preference.
 */

export const REALTIME_MODELS = [
  "gpt-realtime-2.1-mini",
  "gpt-realtime-2.1",
  "gpt-realtime-mini",
  "gpt-realtime",
  "gpt-4o-mini-realtime-preview",
  "gpt-4o-realtime-preview",
] as const;

export type RealtimeModel = (typeof REALTIME_MODELS)[number];

export const REALTIME_VOICES = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
] as const;

export type RealtimeVoice = (typeof REALTIME_VOICES)[number];

export const DEFAULT_REALTIME_MODEL: RealtimeModel = "gpt-realtime-2.1-mini";
export const DEFAULT_REALTIME_VOICE: RealtimeVoice = "marin";
export const DEFAULT_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
/** Warn this long (ms) before the ephemeral secret expires. */
export const EXPIRY_WARNING_MS = 60_000;

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "failed";

export type RealtimeUiStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

export interface RealtimeServerEvent {
  type: string;
  [key: string]: unknown;
}

export interface RealtimeTranscriptEntry {
  speaker: "you" | "tobor";
  text: string;
}

export function resolveRealtimeModel(input?: string | null): RealtimeModel {
  const trimmed = (input ?? "").trim();
  if ((REALTIME_MODELS as readonly string[]).includes(trimmed)) {
    return trimmed as RealtimeModel;
  }
  return DEFAULT_REALTIME_MODEL;
}

export function resolveRealtimeVoice(input?: string | null): RealtimeVoice {
  const trimmed = (input ?? "").trim();
  if ((REALTIME_VOICES as readonly string[]).includes(trimmed)) {
    return trimmed as RealtimeVoice;
  }
  return DEFAULT_REALTIME_VOICE;
}

export function statusFromRealtimeEvent(
  event: RealtimeServerEvent,
  current: RealtimeUiStatus,
): RealtimeUiStatus {
  switch (event.type) {
    case "input_audio_buffer.speech_started":
      return "listening";
    case "input_audio_buffer.speech_stopped":
      return current === "speaking" ? "speaking" : "listening";
    case "response.output_audio.delta":
    case "output_audio_buffer.started":
    case "response.created":
      return "speaking";
    case "response.done":
    case "output_audio_buffer.stopped":
      return "listening";
    case "error":
      return "error";
    case "session.created":
    case "session.updated":
      return current === "connecting" ? "listening" : current;
    default:
      return current;
  }
}

export function transcriptFromRealtimeEvent(
  event: RealtimeServerEvent,
): RealtimeTranscriptEntry | null {
  const type = event.type;
  if (type === "conversation.item.input_audio_transcription.completed") {
    const text = String(event.transcript ?? "").trim();
    return text ? { speaker: "you", text } : null;
  }
  if (
    type === "response.output_audio_transcript.done" ||
    type === "response.audio_transcript.done"
  ) {
    const text = String(event.transcript ?? "").trim();
    return text ? { speaker: "tobor", text } : null;
  }
  return null;
}

export function buildUserTextItemEvent(text: string): RealtimeServerEvent {
  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    },
  };
}

export function buildResponseCreateEvent(): RealtimeServerEvent {
  return { type: "response.create" };
}

/** Partial Realtime session fields we may update live over the data channel. */
export interface RealtimeSessionUpdate {
  voice?: string;
  instructions?: string;
  turn_detection?: Record<string, unknown>;
  temperature?: number;
}

/** `session.update` client event — only provided fields are included. */
export function buildSessionUpdateEvent(update: RealtimeSessionUpdate): RealtimeServerEvent {
  const session: Record<string, unknown> = {};
  if (update.voice && update.voice.trim()) {
    session.audio = { output: { voice: update.voice.trim() } };
  }
  if (update.instructions && update.instructions.trim()) {
    session.instructions = update.instructions;
  }
  if (update.turn_detection) {
    session.turn_detection = update.turn_detection;
  }
  if (typeof update.temperature === "number") {
    session.temperature = update.temperature;
  }
  return { type: "session.update", session };
}

export function errorMessageFromRealtimeEvent(event: RealtimeServerEvent): string {
  const nested = event.error;
  if (nested && typeof nested === "object" && "message" in nested) {
    const msg = String((nested as { message?: unknown }).message ?? "").trim();
    if (msg) return msg;
  }
  const direct = String(event.message ?? "").trim();
  return direct || "realtime voice error";
}

export interface RealtimeSessionMintBody {
  model?: string;
  voice?: string;
}

/** Body for minting an ephemeral client secret (no SDP). */
export function buildRealtimeSessionBody(opts: {
  model?: string | null;
  voice?: string | null;
}): RealtimeSessionMintBody {
  return {
    model: resolveRealtimeModel(opts.model),
    voice: resolveRealtimeVoice(opts.voice),
  };
}

export interface RealtimeSessionCredentials {
  client_secret: string;
  calls_url?: string;
  model?: string;
  voice?: string;
  /** Unix seconds — when the ephemeral secret expires (null when unreported). */
  expires_at?: number | null;
}

export type MintRealtimeSessionFn = (
  body: RealtimeSessionMintBody,
) => Promise<RealtimeSessionCredentials>;

export interface OpenAIRealtimeSession {
  state: RealtimeConnectionState;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  localStream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
  /** Unix ms when the ephemeral secret expires, if the backend reported it. */
  expiresAt: number | null;
  stop: () => void;
  sendEvent: (event: RealtimeServerEvent) => void;
  /** Live-switch the output voice (no reconnect needed). */
  setVoice: (voice: string) => void;
  /** Apply a partial session.update (voice, instructions, turn detection…). */
  updateSession: (update: RealtimeSessionUpdate) => void;
}

export interface ConnectRealtimeOptions {
  /** Start a receive-only audio session for text/image input, without requesting a microphone. */
  microphone?: boolean;
  /** Mint the ephemeral secret via the tobor-kit backend. */
  mintSession: MintRealtimeSessionFn;
  model?: string;
  voice?: string;
  onEvent?: (event: RealtimeServerEvent) => void;
  onState?: (state: RealtimeConnectionState) => void;
  /** Fires ~60s before the ephemeral secret expires so the UI can reconnect. */
  onSessionExpiring?: () => void;
  media?: {
    getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
    RTCPeerConnection: typeof RTCPeerConnection;
  };
  /** Injectable provider SDP exchange (tests). */
  postOfferToOpenAI?: (opts: {
    sdp: string;
    clientSecret: string;
    callsUrl: string;
    model: string;
  }) => Promise<string>;
  /** Where the remote audio element is attached. Defaults to document.body. */
  audioHost?: HTMLElement;
}

/** POST raw SDP offer to the Realtime calls endpoint with the ephemeral key. */
export async function exchangeSdpWithOpenAI(opts: {
  sdp: string;
  clientSecret: string;
  callsUrl?: string;
  model?: string;
}): Promise<string> {
  const model = resolveRealtimeModel(opts.model);
  const base = (opts.callsUrl || DEFAULT_CALLS_URL).replace(/\/$/, "");
  const url = `${base}?model=${encodeURIComponent(model)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: opts.sdp,
      headers: {
        Authorization: `Bearer ${opts.clientSecret}`,
        "Content-Type": "application/sdp",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      msg === "Failed to fetch"
        ? "could not reach the realtime provider (network/CORS). check connectivity."
        : `realtime provider network error: ${msg}`,
    );
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j?.error?.message) detail = j.error.message;
    } catch {
      /* keep raw */
    }
    throw new Error(`realtime call failed (${res.status}): ${detail}`);
  }
  if (!text.includes("v=")) {
    throw new Error("realtime provider returned empty SDP answer");
  }
  return text;
}

export async function connectOpenAIRealtime(
  opts: ConnectRealtimeOptions,
): Promise<OpenAIRealtimeSession> {
  const media = opts.media ?? {
    getUserMedia: (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c),
    RTCPeerConnection,
  };

  const mint = opts.mintSession;
  if (!mint) throw new Error("mintSession is required");

  const notify = (state: RealtimeConnectionState) => {
    session.state = state;
    opts.onState?.(state);
  };

  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearExpiryWatch = () => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  const startExpiryWatch = (expiresAtMs: number) => {
    clearExpiryWatch();
    const delay = expiresAtMs - EXPIRY_WARNING_MS - Date.now();
    if (delay > 0) {
      expiryTimer = setTimeout(() => {
        expiryTimer = null;
        if (session.state === "connected") opts.onSessionExpiring?.();
      }, delay);
    } else if (session.state === "connected") {
      opts.onSessionExpiring?.();
    }
  };

  const session: OpenAIRealtimeSession = {
    state: "connecting",
    pc: null,
    dc: null,
    localStream: null,
    audioEl: null,
    expiresAt: null,
    stop() {
      clearExpiryWatch();
      notify("disconnecting");
      try {
        session.dc?.close();
      } catch {
        /* ignore */
      }
      try {
        session.pc?.close();
      } catch {
        /* ignore */
      }
      session.localStream?.getTracks().forEach((t) => t.stop());
      if (session.audioEl) {
        session.audioEl.srcObject = null;
        session.audioEl.remove();
      }
      session.dc = null;
      session.pc = null;
      session.localStream = null;
      session.audioEl = null;
      notify("idle");
    },
    sendEvent(event) {
      if (session.dc && session.dc.readyState === "open") {
        session.dc.send(JSON.stringify(event));
      }
    },
    setVoice(voice: string) {
      session.updateSession({ voice });
    },
    updateSession(update: RealtimeSessionUpdate) {
      session.sendEvent(buildSessionUpdateEvent(update));
    },
  };

  notify("connecting");

  try {
    const model = resolveRealtimeModel(opts.model);
    const voice = (opts.voice ?? "").trim() || DEFAULT_REALTIME_VOICE;
    const mintBody = buildRealtimeSessionBody({ model, voice });

    let creds: RealtimeSessionCredentials;
    try {
      creds = await mint(mintBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        msg === "Failed to fetch" ? "could not reach the guide API to mint a voice session" : msg,
      );
    }

    const clientSecret = creds.client_secret;
    if (!clientSecret) {
      throw new Error("backend did not return an ephemeral realtime credential");
    }

    if (typeof creds.expires_at === "number" && creds.expires_at > 0) {
      const expiresAtMs = creds.expires_at * 1000;
      session.expiresAt = expiresAtMs;
      startExpiryWatch(expiresAtMs);
    }

    const pc = new media.RTCPeerConnection();
    session.pc = pc;

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.setAttribute("playsinline", "true");
    (opts.audioHost ?? document.body).appendChild(audioEl);
    session.audioEl = audioEl;

    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0] ?? null;
      void audioEl.play().catch(() => {
        /* user gesture already happened on start talk */
      });
    };

    if (opts.microphone === false) { pc.addTransceiver("audio", {direction:"sendrecv"}); } else {
      const stream = await media.getUserMedia({ audio: true });
      session.localStream = stream;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }

    const dc = pc.createDataChannel("oai-events");
    session.dc = dc;
    dc.addEventListener("message", (e) => {
      try {
        opts.onEvent?.(JSON.parse(String((e as MessageEvent).data)) as RealtimeServerEvent);
      } catch {
        /* ignore non-JSON */
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdp = offer.sdp;
    if (!sdp) throw new Error("failed to create local SDP offer");

    const post =
      opts.postOfferToOpenAI ??
      ((args: { sdp: string; clientSecret: string; callsUrl: string; model: string }) =>
        exchangeSdpWithOpenAI(args));

    const answerSdp = await post({
      sdp,
      clientSecret,
      callsUrl: creds.calls_url || DEFAULT_CALLS_URL,
      model: creds.model || model,
    });

    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    notify("connected");
    return session;
  } catch (err) {
    session.stop();
    notify("failed");
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function isRealtimeBusy(state: RealtimeConnectionState): boolean {
  return state === "connecting" || state === "disconnecting";
}

export function statusAfterRealtimeFailure(err: unknown): {
  uiStatus: "error";
  error: string;
  connection: "failed";
} {
  const message =
    err instanceof Error && err.message.trim() ? err.message : "could not start voice session";
  return { uiStatus: "error", error: message, connection: "failed" };
}
