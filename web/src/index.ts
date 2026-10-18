/**
 * `@noizu/tobor-kit` — the whole kit in one import. Each element is also
 * available standalone via its subpath export (`@noizu/tobor-kit/robot-avatar.js`
 * etc.); importing this entry registers every tag and exports the framework
 * free client, voice adapters, and transcript stores alongside them.
 *
 * Portfolio islands (`<noizu-waitlist>`, cookie consent, FAQ) ship from the
 * same package under `./waitlist`, `./cookie`, `./cookie-settings`, `./faq`.
 */

export { ToborKitClient, ToborKitError, DEFAULT_BASE_URL } from "./client.js";
export type {
  VoiceTokenResult,
  TelemetryUpdateResult,
  TranscriptResult,
  TokenProvider,
  ToborKitClientOptions,
} from "./client.js";

export * from "./types.js";
export * from "./components/transcript-view/transcript-store.js";
export * from "./components/voice-session/index.js";
export { applyThemeVars } from "./components/mode-toggle/theme.js";

export { ToborGuidePanel } from "./components/guide-panel/guide-panel.js";
export { ToborRobotAvatar, ROBOT_STATES } from "./components/robot-avatar/robot-avatar.js";
export { ToborModeToggle, MODE_LABELS } from "./components/mode-toggle/mode-toggle.js";
export { ToborVoiceSession } from "./components/voice-session/voice-session.js";
export { ToborTranscriptView } from "./components/transcript-view/transcript-view.js";
export { ToborTaskMenu } from "./components/task-menu/task-menu.js";
export { ToborToolList } from "./components/tool-list/tool-list.js";
export { ToborLoginFlow } from "./components/login-flow/login-flow.js";
export { ToborTelemetryToggle } from "./components/telemetry-toggle/telemetry-toggle.js";

export type { SseFrame } from "./sse.js";
export { SseParser, readSseStream } from "./sse.js";

export { NoizuWaitlist } from "./components/waitlist/noizu-waitlist.js";
export { NoizuCookieConsent } from "./components/cookie/noizu-cookie-consent.js";
export { NoizuCookieSettings } from "./components/cookie/noizu-cookie-settings.js";
export { NoizuFaq } from "./components/faq/noizu-faq.js";
export { NoizuFooterBrand } from "./components/footer-brand/noizu-footer-brand.js";

export {NoizuAuth} from './components/auth/noizu-auth.js';
export type {AuthOptions, AuthConfig, AuthProvider, AuthAvatar, AuthText} from './components/auth/noizu-auth.js';
export {AuthSocket, authSocketUrl} from './components/auth/transport.js';

export * from "./components/voice-agent/voice-agent.js";
export {NoizuBillingStatus} from "./components/billing-status/noizu-billing-status.js";
export type {BillingSubscription, BillingStatusKind} from "./components/billing-status/noizu-billing-status.js";
export {NoizuPlanCompare} from "./components/plan-compare/noizu-plan-compare.js";
export type {Plan, PlanSelectDetail} from "./components/plan-compare/plans.js";
export {NoizuPhoneInput} from "./components/phone-input/noizu-phone-input.js";
export {NoizuHumanVerify} from "./components/human-verify/noizu-human-verify.js";
export {ToborChatThread} from "./components/chat-thread/chat-thread.js";
export {ToborConfigurator} from "./components/configurator/tobor-configurator.js";
export type {
  ConfiguratorApplyDetail,
  ConfiguratorChangeDetail,
  ConfiguratorSnapshot,
} from "./components/configurator/tobor-configurator.js";
export {NoizuModelConfig} from "./components/model-config/noizu-model-config.js";
export {ToborLLMInference, LLMInferenceClient} from "./components/llm-inference/llm-inference.js";
export type {LLMTransport, LLMTestResult} from "./components/llm-inference/llm-inference.js";
export {
  LLM_PROVIDER_CATALOG,
  providerByID,
  effectiveAPIShape,
  effectiveBaseURL,
  showsBaseURL,
  resolveKey,
  envHint,
} from "./components/llm-inference/catalog.js";
export type {LLMApiShape, LLMKeySpec, LLMInferenceConfigData, LLMProviderData} from "./components/llm-inference/catalog.js";
export {NoizuSubscriptionGate} from "./components/subscription-gate/noizu-subscription-gate.js";
export type {GateBlockedDetail} from "./components/subscription-gate/noizu-subscription-gate.js";
export {NoizuInviteGate, InviteRedeemError, classifyInviteRedeemError} from "./components/invite-gate/noizu-invite-gate.js";
export type {InviteRedeemErrorCode, InviteRedeemedDetail, InviteErrorDetail, InviteSignOutDetail, InviteRedeemer, InviteGateText} from "./components/invite-gate/noizu-invite-gate.js";
export {
  DEFAULT_INVITE_REDEEM_ENDPOINT, DEFAULT_INVITE_REQUIRED_URL, INVITE_OPTIONAL_HINT, INVITE_REQUIRED_ERROR,
  InviteRequiredError, handleInviteRequired, isInviteRequiredBody, isInviteRequiredChallenge,
  isInviteRequiredResponse, sameOriginUrl, userNeedsInvite, withInviteGate,
} from "./components/invite-gate/invite-required.js";
export type {InviteRedirectOptions} from "./components/invite-gate/invite-required.js";
export {ToborPersonaCard} from "./components/persona/persona-card.js";
export {ToborPersonaPicker} from "./components/persona/persona-picker.js";
export type {PersonaEntry, PersonaSelectDetail} from "./components/persona/types.js";
export {ToborPartyCard} from "./components/party-card/party-card.js";
export {ToborAgentCard} from "./components/party-card/agent-card.js";
export {ToborUserCard} from "./components/party-card/user-card.js";
export {NoizuSgBtn} from "./components/styleguide/noizu-sg-btn.js";
export {NoizuSgCard} from "./components/styleguide/noizu-sg-card.js";
export {NoizuSgCardGrid} from "./components/styleguide/noizu-sg-card-grid.js";
export {NoizuSgStatus} from "./components/styleguide/noizu-sg-status.js";
export {NoizuSgInput} from "./components/styleguide/noizu-sg-input.js";
export {NoizuSgSpecTable} from "./components/styleguide/noizu-sg-spec-table.js";
export {NoizuSgSteps} from "./components/styleguide/noizu-sg-steps.js";
export {ToborAssetView} from "./components/asset/asset-view.js";
export {ToborAssetEditor} from "./components/asset/asset-editor.js";
export {ToborArtifactView} from "./components/artifact/tobor-artifact-view.js";
export {ToborArtifactEditor} from "./components/artifact/tobor-artifact-editor.js";
export {ToborReviewPanel} from "./components/review-panel/review-panel.js";
export {ToborWikiSpace} from "./components/wiki/tobor-wiki-space.js";
export {ToborWikiEntry} from "./components/wiki/tobor-wiki-entry.js";
export {ToborWikiEntryEditor} from "./components/wiki/tobor-wiki-entry-editor.js";
export {ToborNplView} from "./components/npl-view/npl-view.js";
export {ToborMcpDomain} from "./components/mcp-domain/tobor-mcp-domain.js";
export {ToborMcpConfig} from "./components/mcp-config/tobor-mcp-config.js";
export {ToborMcpClients} from "./components/mcp-clients/tobor-mcp-clients.js";
export {ToborPromptLibrary} from "./components/prompt/tobor-prompt-library.js";
export {ToborPromptHistory} from "./components/prompt/tobor-prompt-history.js";

export {NoizuSgSelect} from "./components/styleguide/noizu-sg-select.js";
export type {SgSelectOption, SgSelectDetail} from "./components/styleguide/noizu-sg-select.js";

export {NoizuPageComments, NoizuPageCommentsLightbox, NoizuPageCommentsSnip} from "./components/page-comments/page-comments.js";
export type {
  RailMode,
  ThreadCardView,
  ThreadFilter,
  RingView,
} from "./components/page-comments/page-comments.js";
export {MemoryDataSource, HttpDataSource} from "./components/page-comments/data-source.js";
export type {
  CommentThread,
  CommentReply,
  CreateThreadInput,
  DataSource,
  Attachment,
  AttachmentKind,
} from "./components/page-comments/data-source.js";
export {
  OwnWriteRegistry,
  RealtimeSource,
  mergeRealtimeEvent,
  pageTopic,
  parseRealtimeEvent,
  reconnectAfterMs,
  sha256Hex,
} from "./components/page-comments/realtime.js";
export type {
  MergeResult,
  RealtimeCapableDataSource,
  RealtimeConnection,
  RealtimeEvent,
  RealtimeEventName,
  RealtimeSourceOptions,
  RealtimeStatus,
} from "./components/page-comments/realtime.js";
export type {AnnotationDocument, AnnotateOp, Rect as AnnotateRect} from "./components/page-comments/annotation.js";
export type {LightboxTarget} from "./components/page-comments/lightbox.js";
export {AnnotateAuth} from "./components/page-comments/auth.js";
export type {AnnotateAuthState, AnnotateAuthTokens} from "./components/page-comments/auth.js";
export {pageKey, type PageAnchor} from "./components/page-comments/anchor.js";
export {computeRailLayout} from "./components/page-comments/layout.js";
export {renderMarkdown} from "./components/page-comments/markdown.js";
