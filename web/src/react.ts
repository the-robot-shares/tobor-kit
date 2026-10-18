/**
 * React wrappers for every tobor-kit element, via `@lit/react`.
 *
 * Props map straight through as element properties; events listen for the
 * composed CustomEvents the elements emit. Import this module from a
 * client-side ("use client") component — the element modules register their
 * tags as a side effect of being imported here.
 *
 * Pattern proven in bladeofeternity.com's boe-map-react.ts.
 */

import * as React from "react";
import { createComponent, type EventName } from "@lit/react";

import { ToborGuidePanel } from "./components/guide-panel/guide-panel.js";
import { ToborRobotAvatar } from "./components/robot-avatar/robot-avatar.js";
import { ToborModeToggle } from "./components/mode-toggle/mode-toggle.js";
import { ToborVoiceSession } from "./components/voice-session/voice-session.js";
import { ToborTranscriptView } from "./components/transcript-view/transcript-view.js";
import { ToborTaskMenu } from "./components/task-menu/task-menu.js";
import { ToborToolList } from "./components/tool-list/tool-list.js";
import { ToborLoginFlow } from "./components/login-flow/login-flow.js";
import { ToborTelemetryToggle } from "./components/telemetry-toggle/telemetry-toggle.js";
import type {
  GuideMode,
  GuideState,
  TelemetryConsent,
  Tool,
  Turn,
} from "./types.js";
import type { VoiceTranscriptEntry } from "./components/voice-session/adapter.js";

export type {
  GuideProjection,
  GuideState,
  GuideMode,
  Tool,
  ToolInventory,
  Turn,
  TelemetryConsent,
} from "./types.js";
export type { TranscriptLoad } from "./components/transcript-view/transcript-store.js";
export type { VoiceTranscriptEntry } from "./components/voice-session/adapter.js";

export const GuidePanel = createComponent({
  tagName: "tobor-guide-panel",
  elementClass: ToborGuidePanel,
  react: React,
  events: {
    onTurnSubmitted: "tobor-turn-submitted" as EventName<CustomEvent<{ input: string }>>,
    onTurnMessage: "tobor-turn-message" as EventName<CustomEvent<{ turn: Turn }>>,
    onTurnError:
      "tobor-turn-error" as EventName<CustomEvent<{ error: { code: string; message: string } }>>,
    onStateChange: "tobor-state-change" as EventName<CustomEvent<{ state: GuideState }>>,
    onTaskInvoked: "tobor-task-invoked" as EventName<CustomEvent<{ task_id: string }>>,
  },
});

export const RobotAvatar = createComponent({
  tagName: "tobor-robot-avatar",
  elementClass: ToborRobotAvatar,
  react: React,
});

export const ModeToggle = createComponent({
  tagName: "tobor-mode-toggle",
  elementClass: ToborModeToggle,
  react: React,
  events: {
    onModeChange:
      "tobor-mode-change" as EventName<CustomEvent<{ mode: GuideMode; previous: GuideMode }>>,
  },
});

export const VoiceSession = createComponent({
  tagName: "tobor-voice-session",
  elementClass: ToborVoiceSession,
  react: React,
  events: {
    onVoiceState: "tobor-voice-state" as EventName<CustomEvent<{ state: GuideState }>>,
    onVoiceTranscript:
      "tobor-voice-transcript" as EventName<CustomEvent<{ entry: VoiceTranscriptEntry }>>,
    onVoiceError:
      "tobor-voice-error" as EventName<CustomEvent<{ error: { code: string; message: string } }>>,
  },
});

export const TranscriptView = createComponent({
  tagName: "tobor-transcript-view",
  elementClass: ToborTranscriptView,
  react: React,
  events: {
    onTranscriptClear: "tobor-transcript-clear" as EventName<CustomEvent<Record<string, never>>>,
  },
});

export const TaskMenu = createComponent({
  tagName: "tobor-task-menu",
  elementClass: ToborTaskMenu,
  react: React,
  events: {
    onTaskSelect: "tobor-task-select" as EventName<CustomEvent<{ tool: Tool }>>,
  },
});

export const ToolList = createComponent({
  tagName: "tobor-tool-list",
  elementClass: ToborToolList,
  react: React,
  events: {
    onToolSelect: "tobor-tool-select" as EventName<CustomEvent<{ tool: Tool }>>,
  },
});

export const LoginFlow = createComponent({
  tagName: "tobor-login-flow",
  elementClass: ToborLoginFlow,
  react: React,
  events: {
    onAuthToken: "tobor-auth-token" as EventName<CustomEvent<{ tokens: unknown }>>,
    onAuthError: "tobor-auth-error" as EventName<CustomEvent<{ error: string }>>,
  },
});

export const TelemetryToggle = createComponent({
  tagName: "tobor-telemetry-toggle",
  elementClass: ToborTelemetryToggle,
  react: React,
  events: {
    onTelemetryChange:
      "tobor-telemetry-change" as EventName<CustomEvent<{ consent: TelemetryConsent }>>,
  },
});

import {NoizuAuth, type AuthMergeChallenge, type AuthSession} from './components/auth/noizu-auth.js';
export const Auth = createComponent({tagName: 'noizu-auth', elementClass: NoizuAuth, react: React, events: {
  // `session` is present only on the REST transport (Bearer tokens); the socket transport emits `{}`.
  onAuthSuccess: 'auth-success' as EventName<CustomEvent<{session?: AuthSession}>>,
  onAuthError: 'auth-error' as EventName<CustomEvent<{message: string}>>,
  onAuthClose: 'auth-close' as EventName<CustomEvent>,
  onAuthRedirect: 'auth-redirect' as EventName<CustomEvent<{url: string}>>,
  // Additive — fired alongside the events above in `pipes` mode; no existing event is removed or renamed.
  onSubmit: 'noizu-auth-submit' as EventName<CustomEvent<{pipe: string; flow: 'login' | 'signup'}>>,
  onPipeSuccess: 'noizu-auth-success' as EventName<CustomEvent<{session?: AuthSession}>>,
  onPipeError: 'noizu-auth-error' as EventName<CustomEvent<{message: string}>>,
  onMergeRequired: 'noizu-auth-merge-required' as EventName<CustomEvent<AuthMergeChallenge>>,
  onMergeConfirmed: 'noizu-auth-merge-confirmed' as EventName<CustomEvent<{challengeId?: string}>>,
  onOtpRequested: 'noizu-auth-otp-requested' as EventName<CustomEvent<{pipe: string}>>,
  onSmsRegionUnsupported: 'noizu-auth-sms-region-unsupported' as EventName<CustomEvent<{pipe: string; message: string}>>,
  // `customMethod` passes through as a prop; `complete()` / `fail()` are called on the element ref.
  onFlowChange: 'noizu-auth-flow-change' as EventName<CustomEvent<{flow: 'login' | 'signup'}>>,
  // Explicit `inviteTokenMode="optional"` only: a held signup is about to route to the interstitial (cancelable).
  onInviteRequired: 'noizu-auth-invite-required' as EventName<CustomEvent<{url: string; source: 'register' | 'register-error'}>>,
}});

import { ToborVoiceAgent } from "./components/voice-agent/voice-agent.js";
export const VoiceAgent = createComponent({tagName:"tobor-voice-agent",elementClass:ToborVoiceAgent,react:React,events:{onReady:"tobor-agent-ready",onTranscript:"tobor-agent-transcript",onState:"tobor-agent-state",onError:"tobor-agent-error"}});

import {NoizuPhoneInput} from "./components/phone-input/noizu-phone-input.js";
export const PhoneInput = createComponent({
  tagName: "noizu-phone-input",
  elementClass: NoizuPhoneInput,
  react: React,
  events: {
    onCountryChange: "country-change" as EventName<CustomEvent<{country: string; dial: string}>>,
    onPhoneChange: "phone-change" as EventName<CustomEvent<{value: string}>>,
    onPhoneInvalid: "phone-invalid" as EventName<CustomEvent<{value: string}>>,
  },
});

import {ToborChatThread} from "./components/chat-thread/chat-thread.js";
export const ChatThread = createComponent({
  tagName: "tobor-chat-thread",
  elementClass: ToborChatThread,
  react: React,
  events: {
    onTranscriptClear: "tobor-transcript-clear" as EventName<CustomEvent<Record<string, never>>>,
    onThreadSend: "thread-send" as EventName<CustomEvent<{text: string}>>,
  },
});

import {ToborConfigurator} from "./components/configurator/tobor-configurator.js";
import type {ConfiguratorSnapshot} from "./components/configurator/tobor-configurator.js";
export const Configurator = createComponent({
  tagName: "tobor-configurator",
  elementClass: ToborConfigurator,
  react: React,
  events: {
    onConfiguratorChange: "configurator-change" as EventName<CustomEvent<ConfiguratorSnapshot>>,
    onConfiguratorApply: "configurator-apply" as EventName<CustomEvent<ConfiguratorSnapshot>>,
  },
});

import {NoizuModelConfig} from "./components/model-config/noizu-model-config.js";
export const ModelConfig = createComponent({
  tagName: "noizu-model-config",
  elementClass: NoizuModelConfig,
  react: React,
  events: {
    onModelChange: "model-change" as EventName<CustomEvent<{value: string}>>,
    onCustomEndpointSave: "custom-endpoint-save" as EventName<CustomEvent<{baseUrl: string; model: string; apiKey: string}>>,
    onBudgetChange: "budget-change" as EventName<CustomEvent<{amount: number}>>,
  },
});

import {NoizuSubscriptionGate} from "./components/subscription-gate/noizu-subscription-gate.js";
import type {GateBlockedDetail} from "./components/subscription-gate/noizu-subscription-gate.js";
export const SubscriptionGate = createComponent({
  tagName: "noizu-subscription-gate",
  elementClass: NoizuSubscriptionGate,
  react: React,
  events: {
    onGateBlocked: "gate-blocked" as EventName<CustomEvent<GateBlockedDetail>>,
  },
});

import {NoizuInviteGate} from "./components/invite-gate/noizu-invite-gate.js";
import type {InviteErrorDetail, InviteRedeemedDetail, InviteSignOutDetail} from "./components/invite-gate/noizu-invite-gate.js";
export const InviteGate = createComponent({
  tagName: "noizu-invite-gate",
  elementClass: NoizuInviteGate,
  react: React,
  events: {
    onInviteRedeemed: "noizu-invite-redeemed" as EventName<CustomEvent<InviteRedeemedDetail>>,
    onInviteError: "noizu-invite-error" as EventName<CustomEvent<InviteErrorDetail>>,
    onInviteSignOut: "noizu-invite-sign-out" as EventName<CustomEvent<InviteSignOutDetail>>,
  },
});

import {NoizuHumanVerify} from "./components/human-verify/noizu-human-verify.js";
export const HumanVerify = createComponent({
  tagName: "noizu-human-verify",
  elementClass: NoizuHumanVerify,
  react: React,
  events: {
    onVerified: "verified" as EventName<CustomEvent<{provider: string; token: string}>>,
  },
});

import {NoizuPlanCompare} from "./components/plan-compare/noizu-plan-compare.js";
import type {PlanSelectDetail} from "./components/plan-compare/plans.js";
export const PlanCompare = createComponent({
  tagName: "noizu-plan-compare",
  elementClass: NoizuPlanCompare,
  react: React,
  events: {
    onPlanSelect: "plan-select" as EventName<CustomEvent<PlanSelectDetail>>,
  },
});

import {NoizuBillingStatus} from "./components/billing-status/noizu-billing-status.js";
export const BillingStatus = createComponent({
  tagName: "noizu-billing-status",
  elementClass: NoizuBillingStatus,
  react: React,
  events: {
    onPortalOpen: "portal-open" as EventName<CustomEvent<Record<string, never>>>,
  },
});

import {ToborPersonaCard} from "./components/persona/persona-card.js";
import {ToborPersonaPicker} from "./components/persona/persona-picker.js";
import type {PersonaSelectDetail} from "./components/persona/types.js";
export const PersonaCard = createComponent({
  tagName: "tobor-persona-card",
  elementClass: ToborPersonaCard,
  react: React,
  events: {
    onPersonaSelect: "persona-select" as EventName<CustomEvent<PersonaSelectDetail>>,
  },
});
export const PersonaPicker = createComponent({
  tagName: "tobor-persona-picker",
  elementClass: ToborPersonaPicker,
  react: React,
  events: {
    onPersonaSelect: "persona-select" as EventName<CustomEvent<PersonaSelectDetail>>,
  },
});

import {ToborPartyCard} from "./components/party-card/party-card.js";
import {ToborAgentCard} from "./components/party-card/agent-card.js";
import {ToborUserCard} from "./components/party-card/user-card.js";
export const PartyCard = createComponent({tagName: "tobor-party-card", elementClass: ToborPartyCard, react: React});
export const AgentCard = createComponent({
  tagName: "tobor-agent-card",
  elementClass: ToborAgentCard,
  react: React,
  events: {onAgentChat: "agent-chat" as EventName<CustomEvent<{agentId: string}>>},
});
export const UserCard = createComponent({
  tagName: "tobor-user-card",
  elementClass: ToborUserCard,
  react: React,
  events: {onUserProfile: "user-profile" as EventName<CustomEvent<{userId: string}>>},
});

import {NoizuSgBtn} from "./components/styleguide/noizu-sg-btn.js";
import {NoizuSgCard} from "./components/styleguide/noizu-sg-card.js";
import {NoizuSgCardGrid} from "./components/styleguide/noizu-sg-card-grid.js";
export const SgBtn = createComponent({
  tagName: "noizu-sg-btn",
  elementClass: NoizuSgBtn,
  react: React,
  events: {onSgClick: "sg-click" as EventName<CustomEvent<Record<string, never>>>},
});
export const SgCard = createComponent({
  tagName: "noizu-sg-card",
  elementClass: NoizuSgCard,
  react: React,
  events: {onSgCardSelect: "sg-card-select" as EventName<CustomEvent<{href: string}>>},
});
export const SgCardGrid = createComponent({tagName: "noizu-sg-card-grid", elementClass: NoizuSgCardGrid, react: React});

import {NoizuSgStatus} from "./components/styleguide/noizu-sg-status.js";
import {NoizuSgInput} from "./components/styleguide/noizu-sg-input.js";
import {NoizuSgSpecTable} from "./components/styleguide/noizu-sg-spec-table.js";
import {NoizuSgSteps} from "./components/styleguide/noizu-sg-steps.js";
export const SgStatus = createComponent({tagName: "noizu-sg-status", elementClass: NoizuSgStatus, react: React});
export const SgInput = createComponent({
  tagName: "noizu-sg-input",
  elementClass: NoizuSgInput,
  react: React,
  events: {onSgInput: "sg-input" as EventName<CustomEvent<{value: string}>>},
});
export const SgSpecTable = createComponent({tagName: "noizu-sg-spec-table", elementClass: NoizuSgSpecTable, react: React});
export const SgSteps = createComponent({tagName: "noizu-sg-steps", elementClass: NoizuSgSteps, react: React});

import {ToborAssetView} from "./components/asset/asset-view.js";
import {ToborAssetEditor} from "./components/asset/asset-editor.js";
export const AssetView = createComponent({
  tagName: "tobor-asset-view",
  elementClass: ToborAssetView,
  react: React,
  events: {onAssetOpen: "asset-open" as EventName<CustomEvent<{id: string}>>},
});
export const AssetEditor = createComponent({
  tagName: "tobor-asset-editor",
  elementClass: ToborAssetEditor,
  react: React,
  events: {onAssetSave: "asset-save" as EventName<CustomEvent<{id: string; name: string; body?: string}>>},
});

import {ToborArtifactView} from "./components/artifact/tobor-artifact-view.js";
import {ToborArtifactEditor} from "./components/artifact/tobor-artifact-editor.js";
export const ArtifactView = createComponent({
  tagName: "tobor-artifact-view",
  elementClass: ToborArtifactView,
  react: React,
  events: {onReviewStart: "review-start" as EventName<CustomEvent<{artifactId: string; version: string}>>},
});
export const ArtifactEditor = createComponent({
  tagName: "tobor-artifact-editor",
  elementClass: ToborArtifactEditor,
  react: React,
  events: {onArtifactSave: "artifact-save" as EventName<CustomEvent<{id: string; title: string; body: string; version?: string}>>},
});

import {ToborReviewPanel} from "./components/review-panel/review-panel.js";
export const ReviewPanel = createComponent({
  tagName: "tobor-review-panel",
  elementClass: ToborReviewPanel,
  react: React,
  events: {
    onReviewSubmit: "review-submit" as EventName<CustomEvent<{artifactId: string; body: string}>>,
    onReviewResolve: "review-resolve" as EventName<CustomEvent<{id: string}>>,
  },
});

import {ToborWikiSpace} from "./components/wiki/tobor-wiki-space.js";
import {ToborWikiEntry} from "./components/wiki/tobor-wiki-entry.js";
import {ToborWikiEntryEditor} from "./components/wiki/tobor-wiki-entry-editor.js";
export const WikiSpace = createComponent({
  tagName: "tobor-wiki-space",
  elementClass: ToborWikiSpace,
  react: React,
  events: {onWikiSpaceSelect: "wiki-space-select" as EventName<CustomEvent<{id: string}>>},
});
export const WikiEntry = createComponent({
  tagName: "tobor-wiki-entry",
  elementClass: ToborWikiEntry,
  react: React,
  events: {onWikiEdit: "wiki-edit" as EventName<CustomEvent<{id: string}>>},
});
export const WikiEntryEditor = createComponent({
  tagName: "tobor-wiki-entry-editor",
  elementClass: ToborWikiEntryEditor,
  react: React,
  events: {onWikiSave: "wiki-save" as EventName<CustomEvent<{id: string; title: string; body: string; spaceId?: string}>>},
});

import {ToborMcpDomain} from "./components/mcp-domain/tobor-mcp-domain.js";
import {ToborMcpConfig} from "./components/mcp-config/tobor-mcp-config.js";
import {ToborMcpClients} from "./components/mcp-clients/tobor-mcp-clients.js";
export const McpDomain = createComponent({
  tagName: "tobor-mcp-domain",
  elementClass: ToborMcpDomain,
  react: React,
  events: {onToolVisibilityChange: "tool-visibility-change" as EventName<CustomEvent<{name: string; visibility: string}>>},
});
export const McpConfig = createComponent({
  tagName: "tobor-mcp-config",
  elementClass: ToborMcpConfig,
  react: React,
  events: {onConfigChange: "config-change" as EventName<CustomEvent<{url: string; transport: string}>>},
});
export const McpClients = createComponent({
  tagName: "tobor-mcp-clients",
  elementClass: ToborMcpClients,
  react: React,
  events: {
    onClientAuthorize: "client-authorize" as EventName<CustomEvent<{id: string}>>,
    onClientRevoke: "client-revoke" as EventName<CustomEvent<{id: string}>>,
  },
});

import {ToborPromptLibrary} from "./components/prompt/tobor-prompt-library.js";
import {ToborPromptHistory} from "./components/prompt/tobor-prompt-history.js";
export const PromptLibrary = createComponent({
  tagName: "tobor-prompt-library",
  elementClass: ToborPromptLibrary,
  react: React,
  events: {
    onPromptSelect: "prompt-select" as EventName<CustomEvent<{id: string}>>,
    onPromptStar: "prompt-star" as EventName<CustomEvent<{id: string; starred: boolean}>>,
  },
});
export const PromptHistory = createComponent({
  tagName: "tobor-prompt-history",
  elementClass: ToborPromptHistory,
  react: React,
  events: {
    onPromptFork: "prompt-fork" as EventName<CustomEvent<{id: string}>>,
    onPromptStar: "prompt-star" as EventName<CustomEvent<{id: string; starred: boolean}>>,
  },
});

import {ToborNplView} from "./components/npl-view/npl-view.js";
export const NplView = createComponent({
  tagName: "tobor-npl-view",
  elementClass: ToborNplView,
  react: React,
  events: {
    onNplCopy: "npl-copy" as EventName<CustomEvent<{text: string}>>,
  },
});

import {NoizuFooterBrand} from "./components/footer-brand/noizu-footer-brand.js";
export const FooterBrand = createComponent({
  tagName: "noizu-footer-brand",
  elementClass: NoizuFooterBrand,
  react: React,
});

import {NoizuSgSelect} from "./components/styleguide/noizu-sg-select.js";
export const SgSelect = createComponent({tagName: "noizu-sg-select", elementClass: NoizuSgSelect, react: React, events: {onSgChange: "sg-change" as EventName<CustomEvent<{value: string}>>}});

import {NoizuPageComments} from "./components/page-comments/page-comments.js";
export const PageComments = createComponent({
  tagName: "noizu-page-comments",
  elementClass: NoizuPageComments,
  react: React,
  events: {
    onToggle: "page-comments-toggle" as EventName<CustomEvent<{enabled: boolean}>>,
    onPageChange: "page-comments-page-change" as EventName<CustomEvent<{pageKey: string}>>,
    onThreadCreate: "page-comments-thread-create" as EventName<CustomEvent<{id: string}>>,
    onThreadOrphan: "page-comments-thread-orphan" as EventName<CustomEvent<{id: string}>>,
    onAuthChange: "page-comments-auth-change" as EventName<CustomEvent<{signedIn: boolean; error: string | null}>>,
  },
});
