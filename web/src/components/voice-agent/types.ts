import type { GuideState } from "../../types.js";
export type VoiceEngine = "openai-realtime" | "elevenlabs" | "tts";
export interface AvatarAsset { src: string; columns?: number; rows?: number; column?: number; row?: number; }
export interface AvatarGroup { id: string; label?: string; default?: AvatarAsset; states?: Partial<Record<GuideState, AvatarAsset>>; }
export type ContextAction = "configure-model" | "configure-prompt" | "configure-tools" | "configure-avatar" | "copy-transcript" | "clear-transcript" | "disconnect";
export interface AgentTranscript { id: string; role: string; text: string; final: boolean; }
export interface VoiceAgentConfig { organization: string; project: string; backend: string; engine: VoiceEngine; model: string; tools: unknown[]; mcpTools: string[]; systemPrompt: string; voice: string; ttsModel: string; }
export interface AgentServerEvent { type: string; sessionId?: string; turnId?: string; role?: string; text?: string; delta?: boolean; final?: boolean; data?: string; mimeType?: string; state?: GuideState; code?: string; message?: string; [key: string]: unknown; }
