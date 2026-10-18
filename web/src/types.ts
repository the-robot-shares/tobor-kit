/**
 * Types mirroring `openapi/tobor-kit.openapi.yaml` v1.0.0.
 *
 * Hand-written rather than generated so the kit has zero build-time codegen,
 * but the shapes track the contract exactly. If the contract moves, this file
 * moves with it — nothing here is inferred or invented.
 */

/** Canonical guide states. The avatar is driven from these and nothing else. */
export const GUIDE_STATES = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "tool_running",
  "error",
  "offline",
] as const;

export type GuideState = (typeof GUIDE_STATES)[number];

export function isGuideState(value: unknown): value is GuideState {
  return typeof value === "string" && (GUIDE_STATES as readonly string[]).includes(value);
}

export type GuideMode = "voice" | "text" | "transcript";
export type RobotRenderer = "lottie" | "sprite" | "glyph";
export type ReducedMotionPolicy = "respect" | "force_static" | "ignore";
export type PanelPlacement = "floating" | "docked" | "inline";
export type VoiceAdapterName = "realtime" | "native" | "backend" | "none";
export type TranscriptStoreName = "memory" | "local" | "backend";
export type TelemetrySource = "user" | "default" | "forced";

export interface ApiError {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
}

export interface GuideCapability {
  id?: string;
  description?: string;
}

export interface RobotStateAnimation {
  segment?: string;
  loop?: boolean;
  speed?: number;
}

export interface GuideUiRobot {
  renderer?: RobotRenderer;
  asset?: string;
  states?: Record<string, RobotStateAnimation>;
  reduced_motion?: ReducedMotionPolicy;
}

export interface GuideUiPanel {
  placement?: PanelPlacement;
  start_expanded?: boolean;
  show_tool_list?: boolean;
  show_task_menu?: boolean;
}

export interface GuideUi {
  robot?: GuideUiRobot;
  panel?: GuideUiPanel;
  /** Free-form theme map; each key becomes `--tobor-kit-<key>`. */
  theme?: Record<string, string>;
}

export interface GuideAuth {
  required?: boolean;
  provider?: "oidc" | "authentik" | "none";
  issuer?: string;
  client_id?: string;
  scopes?: string[];
  redirect_path?: string;
}

export interface GuideTelemetry {
  enabled?: boolean;
  default?: "on" | "off";
  user_overridable?: boolean;
}

export interface GuideVoice {
  adapter?: VoiceAdapterName;
  push_to_talk?: boolean;
  mint_path?: string;
  locale?: string;
}

export interface GuideTranscript {
  store?: TranscriptStoreName;
  retain_turns?: number;
}

export interface GuideProjection {
  slug: string;
  name: string;
  title?: string;
  greeting?: string;
  bundle_hash?: string;
  capabilities?: GuideCapability[];
  modes: GuideMode[];
  default_mode?: GuideMode;
  ui: GuideUi;
  auth: GuideAuth;
  telemetry: GuideTelemetry;
  voice: GuideVoice;
  transcript: GuideTranscript;
}

export interface SessionUser {
  id?: string;
  email?: string;
  display_name?: string;
}

export interface Session {
  id: string;
  created_at: string;
  state: GuideState;
  turn_count?: number;
  user?: SessionUser | null;
}

export interface TurnToolCall {
  id?: string;
  name?: string;
  ok?: boolean;
  summary?: string;
}

export interface Turn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  tool_calls?: TurnToolCall[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface ToolGroup {
  id: string;
  label: string;
}

export interface Tool {
  name: string;
  label: string;
  description?: string;
  group: string;
  icon?: string;
  server?: string;
  confirm?: boolean;
  read_only?: boolean;
  input_schema?: Record<string, unknown>;
}

export interface DegradedServer {
  server?: string;
  error?: string;
}

export interface ToolInventory {
  groups: ToolGroup[];
  tools: Tool[];
  degraded?: DegradedServer[];
}

export interface VoiceCredential {
  adapter: "realtime" | "backend";
  expires_at: string;
  realtime?: {
    token?: string;
    url?: string;
    model?: string;
    voice?: string;
  };
  backend?: {
    stt_url?: string;
    tts_url?: string;
  };
}

export interface TelemetryConsent {
  enabled: boolean;
  source: TelemetrySource;
  user_overridable: boolean;
  capture?: {
    prompt?: boolean;
    response?: boolean;
    tool_args?: boolean;
    tool_results?: boolean;
  };
}

/* -------------------------------------------------------------------------
 * SSE turn stream events (contract table under POST /sessions/{id}/turn)
 * ---------------------------------------------------------------------- */

export interface TurnStreamHandlers {
  onState?: (state: GuideState) => void;
  onDelta?: (text: string) => void;
  onToolCall?: (call: { id: string; name: string; args?: unknown }) => void;
  onToolResult?: (result: { id: string; ok: boolean; summary?: string }) => void;
  /** Terminal. Exactly one of onMessage / onError fires per stream. */
  onMessage?: (turn: Turn) => void;
  /** Terminal. Also fires with code `stream_incomplete` on a premature close. */
  onError?: (error: ApiError) => void;
}
