import {LitElement, html, svg, css, nothing, type PropertyValues} from 'lit';
import {property, state} from 'lit/decorators.js';
import {AuthRequestError, AuthSocket, RestTransport, authSocketUrl, type AuthSession, type AuthTransport, type AuthTransportKind} from './transport.js';
import {DEFAULT_COUNTRY} from '../phone-input/dial-codes.js';
import '../phone-input/noizu-phone-input.js';
import {defineElement} from '../../define.js';
import {DEFAULT_INVITE_REQUIRED_URL, INVITE_OPTIONAL_HINT, INVITE_REQUIRED_ERROR, sameOriginUrl, userNeedsInvite} from '../invite-gate/invite-required.js';

export interface AuthOptions {password?: boolean; magicLink?: boolean; otp?: boolean; signup?: boolean; providers?: string[];}
export interface AuthProvider {id: string; label?: string; href: string;}
export interface AuthConfig {methods?: string[]; providers?: AuthProvider[]; domains?: Record<string, string[] | {providers: string[]}>; domain_policies?: Record<string, string[] | {providers: string[]}>;}
export interface AuthAvatar {src: string; alt: string;}
export type {AuthSession, AuthTransport, AuthTransportKind} from './transport.js';

/** The seven pipes the component can render. Data-driven: host declares which are enabled via `pipes`. */
export type AuthPipeId = 'email_password' | 'mobile_password' | 'email_otp' | 'mobile_otp' | 'google' | 'authentik' | 'github';
export interface AuthPipeDescriptor {id: AuthPipeId; label?: string;}
/** `'custom'` in `pipes` is the same switch as the `custom-method` attribute: the card
 * renders host-slotted method content instead of any built-in pipe. */
export type AuthPipeConfig = AuthPipeId | AuthPipeDescriptor | 'custom';

/** What the host passes to `complete()`. Re-emitted verbatim as the `auth-success` detail. */
export type AuthCustomSuccessDetail = Record<string, unknown>;
/** What the host passes to `fail()`: a message, an `Error`, or `{message, code}`. */
export type AuthCustomFailure = string | Error | {message?: string; code?: string};
/** Flow names accepted by the `auth-flow-switch` event. `register` is an alias of `signup`. */
export type AuthFlowSwitch = 'login' | 'signup' | 'register';

/** One of the account's existing pipes, returned by the backend during a merge challenge. Identifiers are always masked. */
export interface AuthMergePipe {type: string; masked: string;}
export interface AuthMergeChallenge {challengeId: string; pipes: AuthMergePipe[];}

/** Extended state machine driven when `pipes` is configured. */
export type AuthPipeState = 'idle' | 'collecting' | 'otp_sent' | 'merge_required' | 'merge_confirming' | 'success' | 'error';

/** Optional SMS-region allowlist. Absent = no gating (legacy behavior, unchanged).
 * `supported` is a list of ISO-3166 alpha-2 country codes — the same vocabulary as
 * `<noizu-phone-input>`'s `country` / `country-change` detail — where the host's SMS
 * provider is registered to deliver (e.g. carrier registration such as US A2P 10DLC).
 * `message` overrides the default inline copy shown for an unsupported region. */
export interface AuthSmsRegions {supported: string[]; message?: string;}
/** Public error code the backend returns (mirrors an HTTP 422 on this element's WebSocket
 * transport: `{error: {code: "sms_region_unsupported", message: "..."}}`) when a mobile pipe
 * submits an identifier in a region the host cannot deliver SMS to. */
const SMS_REGION_UNSUPPORTED_CODE = 'sms_region_unsupported';

/** Machine error code the backend returns on `register` when the invite token is
 * missing/invalid/expired. Matched case-insensitively against `AuthRequestError.code`
 * or `.message` — never against HTTP status codes (socket envelope vs REST 4xx differ). */
const INVALID_INVITE_TOKEN_CODE = 'invalid_invite_token';

/** Signup invite-token field policy. `optional` (default) is today's behaviour; `required`
 * marks the field required and blocks empty submits client-side (UX only — the server stays
 * authoritative); `hidden` removes the field and omits the `invite_token` register param.
 * Setting `optional` *explicitly* also opts into the invite interstitial ("register open,
 * app gated"): a hint under the field, and an `invite_required` signup answer routes to
 * `invite-required-url` instead of rendering an error. Leaving the mode unset keeps the
 * pre-0.2 behaviour byte-for-byte. */
export const AUTH_INVITE_TOKEN_MODES = ['optional', 'required', 'hidden'] as const;
export type AuthInviteTokenMode = (typeof AUTH_INVITE_TOKEN_MODES)[number];
export function isAuthInviteTokenMode(value: string): value is AuthInviteTokenMode {
  return (AUTH_INVITE_TOKEN_MODES as readonly string[]).includes(value);
}

const copy = {
  loginTitle: 'log in', signupTitle: 'sign up', description: 'Sign in to continue.',
  email: 'Email', password: 'Password', username: 'Username', firstName: 'First name', lastName: 'Last name', mobile: 'Mobile phone', invite: 'Invite token (optional)', code: 'Verification code',
  login: 'log in', signup: 'sign up', continue: 'continue', passwordMethod: 'Password', magicLinkMethod: 'Email link', otpMethod: 'Email me a sign-in code',
  sendLink: 'Send sign-in link', sendCode: 'send code', verifyCode: 'verify', usePassword: 'Continue with password', back: 'back', close: 'Close sign in',
  linkSent: 'Check your email for a sign-in link.', codeSent: 'Check your email for your verification code.', pending: 'Check your email to finish creating your account.', failure: 'Authentication could not be completed.', working: 'working…', unavailable: 'No sign-in methods are available.',
  haveAccount: 'already have an account?', needAccount: 'new here?', providerPrefix: 'Continue with',
  // `layout="console"` only. The tab layout never reads these.
  chooseMethod: "choose how you'd like to continue", or: 'or',
  identifierType: 'identifier type', segmentEmail: 'email', segmentMobile: 'mobile',
  emailCodeLink: 'email me a code', mobileCodeLink: 'text me a code',
  getStarted: 'get started', logInLink: 'log in',
  providersUnavailable: 'Not available yet:', consoleBack: 'back',
  trigger: 'log in',
  pipeEmailPassword: 'Email + password', pipeMobilePassword: 'Mobile + password', pipeEmailOtp: 'Email code', pipeMobileOtp: 'Text me a code', pipeGoogle: 'Continue with Google', pipeAuthentik: 'Continue with SSO', pipeGithub: 'Continue with GitHub',
  mergeRequiredTitle: 'This account already exists',
  mergeRequiredDescription: 'This email is already linked to an account — sign in with one of these to link them.',
  mergeConfirmBack: 'Choose a different way to confirm',
  mergeConfirmSubmit: 'Confirm and link',
  smsRegionUnsupported: 'SMS is not currently available for this region.',
  inviteRequired: 'Invite token is required',
  inviteFallbackNotice: 'This invite could not be verified — taking you to the signup page…',
  // Explicit `invite-token-mode="optional"` only (the invite interstitial contract).
  inviteHint: INVITE_OPTIONAL_HINT,
  inviteRedirectNotice: 'one more step — taking you to the invite page…',
};
export type AuthText = Partial<typeof copy>;

const PIPE_ORDER: AuthPipeId[] = ['email_password', 'mobile_password', 'email_otp', 'mobile_otp', 'google', 'authentik', 'github'];
const PIPE_LABEL_KEY: Record<AuthPipeId, keyof typeof copy> = {
  email_password: 'pipeEmailPassword', mobile_password: 'pipeMobilePassword', email_otp: 'pipeEmailOtp', mobile_otp: 'pipeMobileOtp', google: 'pipeGoogle', authentik: 'pipeAuthentik', github: 'pipeGithub',
};
/** Provider ids a pipe will match in `config.providers`, in preference order.
 * `authentik` also answers to `oidc`: a host whose discovery endpoint calls the
 * same Authentik deployment by its protocol name is describing the same button,
 * and refusing to match it would render a dead control for a provider that is
 * configured and working. */
/** Provider marks for `layout="console"`. Google's is its official multicolour
 * "G" — a brand asset that must not be recoloured, so it carries its own fills
 * and ignores the theme. The other two are single-stroke glyphs drawn in
 * `currentColor`, so they take the host's palette like any other button text.
 * GitHub's is the Octocat silhouette, filled rather than stroked. */
const GOOGLE_ICON = svg`<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" part="provider-icon"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/></svg>`;
const KEY_ICON = svg`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" part="provider-icon"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.8-8.8"/><path d="m15 8 3 3"/><path d="m18 5 2 2"/></svg>`;
const GITHUB_ICON = svg`<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true" part="provider-icon"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
const PROVIDER_ICON: Partial<Record<AuthPipeId, unknown>> = {google: GOOGLE_ICON, authentik: KEY_ICON, github: GITHUB_ICON};

const PIPE_PROVIDER_IDS: Partial<Record<AuthPipeId, readonly string[]>> = {
  google: ['google'], authentik: ['authentik', 'oidc'], github: ['github'],
};
const PIPE_PROVIDER_ID: Partial<Record<AuthPipeId, string>> = {google: 'google', authentik: 'authentik', github: 'github'};

/** Portfolio sign-in/sign-up surface. Credentials stay inside the transport. */
@defineElement('noizu-auth')
export class NoizuAuth extends LitElement {
  @property({reflect: true}) mode: 'interstitial' | 'modal' | 'dropdown' = 'interstitial';
  @property({reflect: true}) flow: 'login' | 'signup' = 'login';
  @property({type: Boolean, reflect: true}) open = false;
  @property() endpoint = '/auth/socket';
  /** Wire protocol. Omitted (the default) selects the WebSocket transport — the
   * behaviour every pre-existing consumer already has. `"rest"` selects the JSON
   * `POST {apiBase}/auth/*` + Bearer-token transport. Additive: nothing about the
   * socket path changes when this is unset. */
  @property({reflect: true}) transport?: AuthTransportKind;
  /** Same-origin base for the REST auth API. Ignored by the socket transport. */
  @property({attribute: 'api-base'}) apiBase = '/api/v1';
  /** REST transport only. Off by default, so auth calls are sent with
   * `credentials: "omit"` — a Bearer API needs no ambient cookie, and sending one
   * would make every unauthenticated auth POST a CSRF target. Turn it on only for
   * a cookie-session REST backend that runs its own CSRF defence. */
  @property({type: Boolean, attribute: 'with-credentials'}) withCredentials = false;
  @property({type: Boolean}) development = false;
  @property({type: Number, attribute: 'dev-port'}) devPort?: number;
  @property({attribute: false}) options: AuthOptions = {password: true, magicLink: false, otp: false, signup: true};
  @property({attribute: false}) text: AuthText = {};
  @property({attribute: false}) avatar?: AuthAvatar;
  /** Data-driven pipe allowlist. Undefined preserves the legacy `options`-driven password/magic-link/otp flow. */
  @property({attribute: false}) pipes?: AuthPipeConfig[];
  /** Optional SMS-region allowlist for the mobile pipes. Absent (the default) disables all
   * region gating — additive, backwards compatible. See `AuthSmsRegions`. */
  @property({attribute: false}) smsRegions?: AuthSmsRegions;
  /** Signup invite-token policy. Unknown values clamp to `'optional'` (today's behaviour).
   * An explicit `optional` (attribute or property) is what turns on the invite-interstitial
   * hint and routing, so the setter records that it ran. Lit still reflects the default on
   * first render (as before) without going through the setter. */
  @property({reflect: true, attribute: 'invite-token-mode'})
  get inviteTokenMode(): AuthInviteTokenMode | string {return this.inviteTokenModeValue;}
  set inviteTokenMode(value: AuthInviteTokenMode | string) {this.inviteTokenModeValue = value; this.inviteTokenModeSet = true;}
  private inviteTokenModeValue: AuthInviteTokenMode | string = 'optional';
  private inviteTokenModeSet = false;
  /** Invite interstitial route. With an explicit `invite-token-mode="optional"`, a signup the
   * backend answers with `invite_required` (the account was created but is held) navigates
   * here after `auth-success`, unless `noizu-auth-invite-required` is canceled. Same-origin
   * only; `""` turns the routing off. */
  @property({attribute: 'invite-required-url'}) inviteRequiredUrl = DEFAULT_INVITE_REQUIRED_URL;
  /** Invite-gated signup fallback. When set AND the resolved invite mode is `'required'`,
   * a server invite rejection (`invalid_invite_token`) on register navigates the browser to
   * this URL (after surfacing the error/state). Unset = legacy behaviour, unchanged. */
  @property({attribute: 'invite-fallback-url'}) inviteFallbackUrl = '';
  /** Arrangement of the surface. `'console'` (the default) is the portfolio-standard
   * sign-in console: social providers first as icon buttons, an `or` rule, a segmented
   * identifier toggle when both password pipes are enabled, the credential form, then
   * the one-time-code pipes as text links and a footer rule. `'tabs'` is the original
   * flat row of pipe buttons, kept as an explicit opt-in for a host that had built
   * around it. Applies to the `pipes` surface and to the legacy `options` flow. */
  @property({reflect: true}) layout: 'tabs' | 'console' = 'console';
  /** Custom-method mode. The card chrome (brand slot, title, footer slot, close ×, and
   * the dialog / dropdown / interstitial shells) stays; every built-in pipe, the email
   * field and the tabs are replaced by host content slotted as `method-login`,
   * `method-signup` (alias `method-register`) or `method` (the fallback for both flows).
   * The element makes NO network request in this mode — no `/auth/config`, no
   * transport — and the host finishes the flow with `complete()` or `fail()`.
   * `pipes = ['custom']` turns on the same mode. */
  @property({type: Boolean, reflect: true, attribute: 'custom-method'}) customMethod = false;
  @state() private config: AuthConfig = {};
  @state() private method = 'password';
  @state() private step = 'email';
  @state() private busy = false;
  @state() private error = '';
  @state() private status = '';
  @state() private otpSent = false;
  private email = '';
  private connection?: AuthTransport;
  private generation = 0;
  private restoreFocus?: HTMLElement;

  // --- pipe (six-pipe) state, active only when `pipes` is set ---
  @state() private pipeState: AuthPipeState = 'idle';
  @state() private activePipe: AuthPipeId = 'email_password';
  @state() private mergeChallenge?: AuthMergeChallenge;
  @state() private mergeConfirmPipe?: string;
  private phone = '';
  private mergePhone = '';
  // ISO-3166 alpha-2, driven by <noizu-phone-input>'s `country-change`. Whichever mobile form is
  // showing (primary collecting vs. merge-confirming) is exclusive of the other, so one pair of
  // server-block flags below is safely shared between both.
  @state() private phoneRegion: string = DEFAULT_COUNTRY;
  @state() private mergePhoneRegion: string = DEFAULT_COUNTRY;
  /** Set once the server (not just the client-side `smsRegions` allowlist) has rejected a
   * mobile-pipe submit with `sms_region_unsupported` — the server is authoritative even if the
   * client-side check thought the region was fine (e.g. a stale `smsRegions` list). */
  @state() private smsRegionBlocked = false;
  @state() private smsRegionServerMessage = '';
  // --- console layout state ---
  /** Which identifier the console's credential form is collecting. Only ever
   * reaches `'mobile'` when the mobile password pipe is enabled. */
  @state() private credMode: 'email' | 'mobile' = 'email';
  /** `'root'` is the console itself; `'pipe'` is a single pipe (a one-time-code
   * flow) opened from it, with a way back. */
  @state() private consoleStep: 'root' | 'pipe' = 'root';

  // --- dropdown mode state ---
  private dropdownOpenPrev = false;
  private dropdownRestoreFocus?: HTMLElement;
  private returnToDropdown = false;
  private readonly onDocKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.mode === 'dropdown' && this.open) {this.open = false; this.emit('auth-close');}
  };
  private readonly onDocClick = (event: MouseEvent) => {
    if (this.mode !== 'dropdown' || !this.open) return;
    if (event.composedPath().includes(this)) return;
    this.open = false; this.emit('auth-close');
  };

  private get t() {return {...copy, ...this.text};}
  constructor() {
    super();
    // Slotted method content lives in light DOM, so its bubbling events reach the host.
    this.addEventListener('auth-flow-switch', this.onFlowSwitch as EventListener);
  }
  private emit(name: string, detail: unknown = {}) {this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: true}));}
  override connectedCallback() {super.connectedCallback(); if (this.hasUpdated) this.loadConfig();}
  override disconnectedCallback() {
    this.busy = false; this.restoreFocus?.focus(); this.generation++; this.connection?.close(); this.connection = undefined;
    this.renderRoot.querySelector('dialog')?.close();
    document.removeEventListener('keydown', this.onDocKeydown); document.removeEventListener('click', this.onDocClick, true);
    super.disconnectedCallback();
  }
  protected override willUpdate(changed: PropertyValues) {
    if (changed.has('mode') && this.mode !== 'modal') {this.renderRoot.querySelector('dialog')?.close(); this.restoreFocus?.focus();}
    if (Array.isArray(this.pipes) && changed.has('pipes') && !this.enabledPipes().includes(this.activePipe)) {
      this.activePipe = this.enabledPipes()[0] ?? 'email_password';
    }
    if (this.usesPipes() && this.pipeState === 'idle') this.pipeState = 'collecting';
  }
  protected override updated(changed: PropertyValues) {
    if (changed.has('open') && changed.get('open') === true && !this.open) this.cancelPending();
    if (changed.has('endpoint') || changed.has('development') || changed.has('devPort') || changed.has('transport') || changed.has('apiBase') || changed.has('withCredentials')) {this.generation++; this.connection?.close(); this.connection = undefined; this.busy = false; this.status = ''; this.loadConfig();}
    if (changed.has('options') && !this.enabled(this.method)) this.method = this.methods()[0] ?? '';
    if (changed.has('flow')) {
      this.step = 'email'; this.error = ''; this.status = ''; this.otpSent = false; if (this.usesPipes()) this.resetPipeState();
      if (this.usesCustomMethod() && changed.get('flow') !== undefined) this.emit('noizu-auth-flow-change', {flow: this.flow});
    }
    // Leaving custom-method mode (by `custom-method` or by `pipes`) hands the surface back to the
    // built-in pipes, which need discovery.
    const custom = this.usesCustomMethod();
    if (this.wasCustomMethod && !custom) this.loadConfig();
    this.wasCustomMethod = custom;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && this.mode === 'modal' && this.open && !dialog.open) {
      this.restoreFocus = document.activeElement as HTMLElement; dialog.showModal();
      // `showModal()` focuses the first focusable node. The close × renders last so that
      // is already not the ×, but pin the intended target explicitly rather than rely on it.
      this.focusInitial();
    }
    if (dialog?.open && (this.mode !== 'modal' || !this.open)) {dialog.close(); this.restoreFocus?.focus();}
    this.syncDropdown();
    if (this.pendingFocus) this.applyInitialFocus();
  }

  // ---------- legacy email flow (options-driven; unchanged) ----------
  private enabled(method: string) {if (this.config.methods && !this.config.methods.includes(method)) return false; return method === 'password' ? this.options.password !== false : method === 'magic-link' ? this.options.magicLink === true : this.options.otp === true;}
  private methods() {return ['password', 'magic-link', 'otp'].filter(m => this.enabled(m));}
  /** Builds the selected transport once. Default (`transport` unset) is the
   * WebSocket path, byte-for-byte what it always was. */
  private client(): AuthTransport {
    return this.connection ??= this.transport === 'rest'
      ? new RestTransport({apiBase: this.apiBase, withCredentials: this.withCredentials})
      : new AuthSocket(authSocketUrl(this.endpoint, this.development, this.devPort));
  }
  /** Success payload. Empty on the socket transport (cookie session — the host
   * already has it, and the element must never echo credentials it saw). On the
   * REST transport it carries the Bearer session so the host can store it; the
   * element itself writes nothing to localStorage/sessionStorage. */
  private successDetail(result: any): {session?: AuthSession} {
    return result?.session ? {session: result.session as AuthSession} : {};
  }
  private async loadConfig() {
    // Custom-method mode is backend-free by contract: no discovery, no transport.
    if (this.usesCustomMethod()) return;
    const generation = this.generation;
    try {const config = await this.client().request<AuthConfig>('config'); if (generation === this.generation) {this.config = config ?? {}; if (!this.enabled(this.method)) this.method = this.methods()[0] ?? '';}}
    catch (error) {if (generation === this.generation) this.error = (error as Error).message;}
  }
  private providers() {return (this.config.providers ?? []).filter(p => !this.options.providers || this.options.providers.includes(p.id));}
  private domainProviderIds() {
    const domain = this.email.trim().toLowerCase().split('@')[1];
    const policy = Object.entries(this.config.domain_policies ?? this.config.domains ?? {}).find(([key]) => key.toLowerCase() === domain)?.[1];
    const ids = Array.isArray(policy) ? policy : policy?.providers ?? [];
    return ids;
  }
  private matchedProviders() {return this.providers().filter(p => this.domainProviderIds().includes(p.id));}
  private cancelPending() {this.generation++; this.connection?.close(); this.connection = undefined; this.busy = false; this.renderRoot.querySelectorAll<HTMLInputElement>('input[type=password]').forEach(input => {input.value = '';}); }
  private close() {this.cancelPending(); this.open = false; this.emit('auth-close');}
  private safeRedirect(href: string) {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || url.username || url.password || !/^https?:$/.test(url.protocol)) throw new Error('Authentication redirect must stay on this server.');
    this.emit('auth-redirect', {url: url.href}); location.assign(url.href);
  }
  private providerClick(provider: AuthProvider) {try {this.safeRedirect(provider.href);} catch (error) {this.error = (error as Error).message;}}
  /** Resolved mode: an invalid `inviteTokenMode` reads as `'optional'` — the attribute/property
   * itself is never rewritten (same non-mutating pattern as party-card's `resolvedPresence`). */
  private get resolvedInviteTokenMode(): AuthInviteTokenMode {
    return isAuthInviteTokenMode(this.inviteTokenMode) ? this.inviteTokenMode : 'optional';
  }
  /** Resolved fallback target: trimmed `inviteFallbackUrl`; `''` is the feature-off sentinel. */
  private get resolvedInviteFallbackUrl(): string {
    return this.inviteFallbackUrl.trim();
  }
  /** True when a register failure is the server's invite rejection: `invalid_invite_token`
   * appears in the machine `code` or the human `message` (case-insensitive). Deliberately
   * not keyed on status codes — the two transports surface rejection differently. */
  private isInviteRejection(error: unknown): boolean {
    const code = (error as AuthRequestError).code, message = (error as Error).message;
    return (typeof code === 'string' && code.toLowerCase().includes(INVALID_INVITE_TOKEN_CODE))
      || (typeof message === 'string' && message.toLowerCase().includes(INVALID_INVITE_TOKEN_CODE));
  }
  /** Invite-gated signup fallback: with `invite-token-mode="required"` and `invite-fallback-url`
   * set, redirect the browser to the host's waitlist/fallback page instead of leaving a dead
   * error. Runs after the error state and events are surfaced; a no-op (byte-identical legacy
   * behaviour) when the attribute is unset or the resolved mode is not `'required'`. */
  private inviteFallbackNavigate() {
    if (this.resolvedInviteTokenMode !== 'required') return;
    const url = this.resolvedInviteFallbackUrl;
    if (!url) return;
    this.status = this.t.inviteFallbackNotice;
    this.navigateTo(url);
  }
  /** Navigation seam — `location.assign` is unforgeable in Chrome, so tests override this. */
  protected navigateTo(url: string) {window.location.assign(url);}
  /** True when the host explicitly chose `optional`: the invite-interstitial contract
   * (hint + `invite_required` routing). The unset default stays legacy. */
  private inviteGateActive(): boolean {return this.inviteTokenModeSet && this.inviteTokenMode === 'optional';}
  /** A register failure carrying the `invite_required` machine code (both transports put the
   * backend code on `AuthRequestError.code`). Message prose is deliberately not matched: an
   * unrelated validation error must never navigate the user away. */
  private isInviteRequiredError(error: unknown): boolean {
    const code = (error as AuthRequestError).code;
    return typeof code === 'string' && code.toLowerCase() === INVITE_REQUIRED_ERROR;
  }
  /** A register success whose account is held at the interstitial: a top-level
   * `invite_required: true`, or a `user` (socket) / `session.user` (REST) that needs one. */
  private resultNeedsInvite(result: any): boolean {
    return result?.invite_required === true || userNeedsInvite(result?.user) || userNeedsInvite(result?.session?.user);
  }
  /** Route a held signup to the interstitial. Returns false (caller keeps legacy handling)
   * when routing is off: mode not explicitly optional, or `invite-required-url` empty/off-origin. */
  private routeToInviteGate(source: 'register' | 'register-error'): boolean {
    if (!this.inviteGateActive()) return false;
    const url = sameOriginUrl(this.inviteRequiredUrl, '');
    if (!url) return false;
    this.error = ''; this.status = this.t.inviteRedirectNotice;
    if (this.usesPipes()) this.pipeState = 'success';
    const event = new CustomEvent('noizu-auth-invite-required', {detail: {url, source}, bubbles: true, composed: true, cancelable: true});
    if (this.dispatchEvent(event)) this.navigateTo(url);
    return true;
  }
  /** Register succeeded but the account is held: hand the session over (`auth-success`, so a
   * REST host stores its Bearer token first), then route. */
  private inviteRequiredAfterSignup(result: any, pipes: boolean): boolean {
    if (!this.inviteGateActive() || !this.resultNeedsInvite(result) || !sameOriginUrl(this.inviteRequiredUrl, '')) return false;
    if (result?.authenticated === true) {
      this.emit('auth-success', this.successDetail(result));
      if (pipes) this.emit('noizu-auth-success', this.successDetail(result));
    }
    return this.routeToInviteGate('register');
  }
  /** The signup invite-token field, gated by `inviteTokenMode`. `hidden` renders nothing
   * (submit omits the param); `required` marks the input required (UX only — the server stays
   * authoritative). `text.invite` overrides the mode-derived label in every rendering mode.
   * An explicit `optional` adds the "add it after signing up" hint. */
  private inviteField() {
    const mode = this.resolvedInviteTokenMode;
    if (mode === 'hidden') return nothing;
    const hint = this.inviteGateActive() && !!this.t.inviteHint;
    const field = this.field('invite_token', this.text.invite ?? (mode === 'required' ? 'Invite token (required)' : 'Invite token (optional)'), 'text', mode === 'required', '', hint ? 'invite_token-hint' : '');
    if (!hint) return field;
    return html`${field}<p class="field-hint" part="field-hint invite-hint" id="invite_token-hint" data-cy="invite-token-hint">${this.t.inviteHint}</p>`;
  }
  private field(name: string, label: string, type = 'text', required = true, autocomplete = '', describedBy = '') {
    return html`<div class="field-group" part="field-group"><label class="field-label" part="field-label" for=${name}>${label}</label><input class="field-input" part="field-input" id=${name} data-cy=${name === 'email' ? 'email-input' : name === 'password' ? 'password-input' : name === 'code' ? 'otp-code-input' : name + '-input'} name=${name} type=${type} ?required=${required} ?readonly=${name === 'email' && this.step !== 'email'} autocomplete=${autocomplete || 'off'} minlength=${name === 'password' && this.flow === 'signup' ? '8' : nothing} aria-describedby=${describedBy || nothing} .value=${name === 'email' ? this.email : ''} @input=${name === 'email' ? (e: Event) => {this.email = (e.target as HTMLInputElement).value;} : nothing} /></div>`;
  }
  private async submit(event: SubmitEvent) {
    event.preventDefault(); if (this.busy) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form)) as Record<string,string>;
    if (!form.reportValidity()) return;
    // Client-side required gate: UX only, the server stays authoritative for token validity.
    // Runs after native validity so the browser's own messages surface first.
    if (this.flow === 'signup' && this.step === 'password' && this.inviteRequiredBlocked(data)) return;
    this.email = (data.email ?? this.email).trim();
        this.busy = true; this.error = ''; this.status = '';
    const generation = ++this.generation;
    // Declared before the try so the catch can tell an invite rejection on `register` from other failures.
    const method = this.flow === 'signup' ? 'register' : this.method === 'password' ? 'login' : this.method === 'magic-link' ? 'magic-link' : this.otpSent ? 'otp-verify' : 'otp-request';
    try {
      if (this.step === 'email') {
        const config = await this.client().request<AuthConfig>('config', {email: this.email});
        if (generation !== this.generation) return;
        this.config = config ?? {};
        this.method = this.methods()[0] ?? '';
        this.step = this.domainProviderIds().length ? 'sso' : 'password';
        return;
      }
      const params = method === 'register' ? {user: {...data, email: this.email, invite_token: undefined}, invite_token: data.invite_token} : {...data,email:this.email};
      const result = await this.client().request(method, params);
      if (generation !== this.generation) return;
      if (method === 'register' && this.inviteRequiredAfterSignup(result, false)) return;
      if (method === 'magic-link') this.status = this.t.linkSent;
      else if (method === 'otp-request') {this.otpSent = true; this.status = this.t.codeSent;}
      else if (result?.redirect) this.safeRedirect(result.redirect);
      else if (result?.authenticated === true) {this.emit('auth-success', this.successDetail(result)); if (this.mode === 'modal') this.close();}
      else if (result?.status === 'pending') this.status = this.t.pending;
      else throw new Error(this.t.failure);
    } catch (error) {if (generation === this.generation) {
      // Explicit optional mode never shows the "invite required" error: the account is held, so route.
      if (method === 'register' && this.isInviteRequiredError(error) && this.routeToInviteGate('register-error')) return;
      this.error = (error as Error).message; this.emit('auth-error', {message:this.error}); if (method === 'register' && this.isInviteRejection(error)) this.inviteFallbackNavigate();}}
    finally {form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => {input.value = '';}); if (generation === this.generation) this.busy = false;}
  }
  /** True when a signup submit must be blocked client-side: `required` mode with an
   * empty/whitespace invite token. Sets the inline error copy before returning true. */
  private inviteRequiredBlocked(data: Record<string, string>): boolean {
    if (this.resolvedInviteTokenMode !== 'required' || String(data.invite_token ?? '').trim()) return false;
    this.error = this.t.inviteRequired;
    this.emit('auth-error', {message: this.error}); this.emit('noizu-auth-error', {message: this.error});
    return true;
  }
  private providerButtons(providers = this.providers()) {return html`<div class="auth-methods" part="providers" data-cy="sso-provider-list">${providers.map(p => html`<button class="btn auth-provider" part="provider" type="button" ?disabled=${this.busy} data-cy="sso-provider-link" data-provider=${p.id} @click=${() => this.providerClick(p)}>${p.label ?? `${this.t.providerPrefix} ${p.id}`}</button>`)}</div>`;}

  // ---------- six-pipe flow (data-driven; used only when `pipes` is set) ----------
  private usesPipes(): boolean {return Array.isArray(this.pipes);}
  private enabledPipes(): AuthPipeId[] {
    const ids = (this.pipes ?? []).map(p => typeof p === 'string' ? p : p.id);
    return PIPE_ORDER.filter(id => ids.includes(id));
  }
  private pipeLabel(id: AuthPipeId): string {
    const entry = (this.pipes ?? []).find(p => (typeof p === 'string' ? p : p.id) === id);
    const custom = entry && typeof entry !== 'string' ? entry.label : undefined;
    return custom ?? this.t[PIPE_LABEL_KEY[id]];
  }
  private resetPipeState() {
    this.pipeState = 'collecting'; this.error = ''; this.status = ''; this.otpSent = false;
    this.mergeChallenge = undefined; this.mergeConfirmPipe = undefined; this.email = ''; this.phone = ''; this.mergePhone = '';
    this.phoneRegion = DEFAULT_COUNTRY; this.mergePhoneRegion = DEFAULT_COUNTRY; this.smsRegionBlocked = false; this.smsRegionServerMessage = '';
    this.activePipe = this.enabledPipes()[0] ?? 'email_password';
    // The console has its own root; a flow change (login ⇄ signup) or a pipe
    // change must not leave it parked inside a one-time-code form.
    this.consoleStep = 'root';
    if (!this.passwordPipes().includes('mobile_password')) this.credMode = 'email';
    const credPipe = this.credModePipe();
    if (this.usesConsole() && credPipe) this.activePipe = credPipe;
  }
  private selectPipe(id: AuthPipeId) {
    if (this.busy) return;
    this.activePipe = id; this.pipeState = 'collecting'; this.error = ''; this.status = ''; this.otpSent = false;
    this.smsRegionBlocked = false; this.smsRegionServerMessage = '';
  }
  // ---------- SMS-region gating (`smsRegions`; additive, no-op when unset) ----------
  /** True when `smsRegions` is set and `region` is not in the supported list. */
  private smsRegionUnsupported(region: string): boolean {
    return Boolean(this.smsRegions) && !this.smsRegions!.supported.includes(region);
  }
  private currentMobileRegion(forMerge: boolean): string {
    return forMerge ? this.mergePhoneRegion : this.phoneRegion;
  }
  /** True when the mobile pipe currently showing (primary or merge-confirm) must not submit:
   * either the client-side allowlist excludes the region, or the server already rejected it. */
  private smsRegionActive(forMerge: boolean): boolean {
    if (!this.smsRegions) return false;
    return this.smsRegionBlocked || this.smsRegionUnsupported(this.currentMobileRegion(forMerge));
  }
  private smsRegionText(): string {
    return this.smsRegionServerMessage || this.smsRegions?.message || this.t.smsRegionUnsupported;
  }
  private onMobileCountryChange(forMerge: boolean, event: CustomEvent<{country: string}>) {
    if (forMerge) this.mergePhoneRegion = event.detail.country; else this.phoneRegion = event.detail.country;
    // A country change invalidates any stale server-side block from a previous region.
    this.smsRegionBlocked = false; this.smsRegionServerMessage = '';
  }
  private isMobilePipe(id: AuthPipeId) {return id === 'mobile_password' || id === 'mobile_otp';}
  private isOtpPipe(id: AuthPipeId) {return id === 'email_otp' || id === 'mobile_otp';}
  private isSsoPipe(id: AuthPipeId) {return id === 'google' || id === 'authentik' || id === 'github';}
  private ssoProviderFor(id: AuthPipeId): AuthProvider | undefined {
    const candidates = PIPE_PROVIDER_IDS[id] ?? (PIPE_PROVIDER_ID[id] ? [PIPE_PROVIDER_ID[id]!] : []);
    const providers = this.config.providers ?? [];
    for (const candidate of candidates) {
      const match = providers.find(p => p.id === candidate);
      if (match) return match;
    }
    return undefined;
  }
  private pipeIdentifierParams(pipe: AuthPipeId): Record<string, string> {
    return this.isMobilePipe(pipe) ? {mobile_phone: this.phone} : {email: this.email};
  }
  private async ssoRedirect(id: AuthPipeId, mergeChallengeId?: string) {
    const provider = this.ssoProviderFor(id);
    if (!provider) {this.error = this.t.unavailable; return;}
    try {
      const url = new URL(provider.href, location.href);
      if (mergeChallengeId) url.searchParams.set('merge_challenge_id', mergeChallengeId);
      this.emit('noizu-auth-submit', {pipe: id, flow: this.flow});
      this.safeRedirect(url.pathname + url.search);
    } catch (error) {this.error = (error as Error).message;}
  }
  private handlePipeResult(result: any, confirming: boolean) {
    if (result?.merge_required) {
      const challenge: AuthMergeChallenge = {challengeId: result.challenge_id, pipes: result.pipes ?? []};
      this.mergeChallenge = challenge; this.pipeState = 'merge_required';
      this.emit('noizu-auth-merge-required', challenge);
      return;
    }
    if (confirming && (result?.merge_confirmed === true || result?.authenticated === true)) {
      this.pipeState = 'success';
      this.emit('noizu-auth-merge-confirmed', {challengeId: this.mergeChallenge?.challengeId});
      this.emit('auth-success', this.successDetail(result)); this.emit('noizu-auth-success', this.successDetail(result));
      if (this.mode === 'modal' || this.mode === 'dropdown') this.close();
      return;
    }
    if (result?.redirect) {this.safeRedirect(result.redirect); return;}
    if (result?.authenticated === true) {
      this.pipeState = 'success';
      this.emit('auth-success', this.successDetail(result)); this.emit('noizu-auth-success', this.successDetail(result));
      if (this.mode === 'modal' || this.mode === 'dropdown') this.close();
      return;
    }
    if (result?.status === 'pending') {this.pipeState = 'success'; this.status = this.t.pending; return;}
    throw new Error(this.t.failure);
  }
  private async submitPipe(event: SubmitEvent) {
    event.preventDefault(); if (this.busy) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const confirming = this.pipeState === 'merge_confirming';
    if (!form.reportValidity()) return;
    // Client-side required gate: UX only, the server stays authoritative for token validity.
    // Runs after native validity so the browser's own messages surface first.
    if (!confirming && this.flow === 'signup' && this.inviteRequiredBlocked(data)) return;
    const pipe = confirming ? (this.mergeConfirmPipe as AuthPipeId) : this.activePipe;
    if (!confirming) {
      if (this.isMobilePipe(pipe)) this.phone = data.mobile_phone ?? this.phone; else this.email = (data.email ?? this.email).trim();
    } else {
      if (this.isMobilePipe(pipe)) this.mergePhone = data.mobile_phone ?? this.mergePhone; else this.email = (data.email ?? this.email).trim();
    }
    if (this.isMobilePipe(pipe) && this.smsRegionActive(confirming)) {
      // Client-side gate: UX only, never authoritative — do not call the server. The inline
      // notice near the phone input already renders `smsRegionText()`; just make sure it's
      // visible (e.g. reached via keyboard on an aria-disabled submit) and move focus there.
      this.smsRegionBlocked = true;
      this.renderRoot.querySelector<HTMLElement>('#mobile_phone')?.focus();
      return;
    }
    this.busy = true; this.error = ''; this.status = '';
    const generation = ++this.generation;
    const identifier = confirming
      ? (this.isMobilePipe(pipe) ? {mobile_phone: this.mergePhone} : {email: this.email})
      : this.pipeIdentifierParams(pipe);
    // Hoisted so the catch can tell an invite rejection on `register` from other failures.
    let method = ''; let params: Record<string, unknown> = {};
    try {
      if (this.flow === 'signup' && !confirming) {
        method = 'register';
        params = {user: {...data, ...identifier, invite_token: undefined}, invite_token: data.invite_token};
      } else if (this.isOtpPipe(pipe) && !this.otpSent) {
        method = 'otp-request'; params = {...identifier};
      } else if (this.isOtpPipe(pipe)) {
        method = 'otp-verify'; params = {...identifier, code: data.code};
      } else {
        method = 'login'; params = {...identifier, password: data.password};
      }
      if (confirming && this.mergeChallenge) params = {...params, merge_challenge_id: this.mergeChallenge.challengeId};
      this.emit('noizu-auth-submit', {pipe, flow: this.flow});
      const result = await this.client().request(method, params);
      if (generation !== this.generation) return;
      if (method === 'otp-request') {this.otpSent = true; this.pipeState = 'otp_sent'; this.status = this.t.codeSent; this.emit('noizu-auth-otp-requested', {pipe}); return;}
      if (!confirming && method === 'register' && this.inviteRequiredAfterSignup(result, true)) return;
      this.handlePipeResult(result, confirming);
    } catch (error) {
      if (generation === this.generation) {
        if (this.isMobilePipe(pipe) && (error as AuthRequestError).code === SMS_REGION_UNSUPPORTED_CODE) {
          // The server is authoritative — even if the client-side `smsRegions` allowlist thought
          // this region was fine (stale list, or the element was used without `smsRegions` at
          // all), render the server's own message in the same inline slot near the phone input,
          // not the generic error banner.
          this.smsRegionBlocked = true;
          this.smsRegionServerMessage = (error as Error).message || this.t.smsRegionUnsupported;
          this.emit('noizu-auth-sms-region-unsupported', {pipe, message: this.smsRegionServerMessage});
        } else if (!confirming && method === 'register' && this.isInviteRequiredError(error) && this.routeToInviteGate('register-error')) {
          // Explicit optional mode: the account is held for an invite — routed, no error block.
        } else {
          this.pipeState = 'error'; this.error = (error as Error).message;
          this.emit('auth-error', {message: this.error}); this.emit('noizu-auth-error', {message: this.error});
          if (!confirming && method === 'register' && this.isInviteRejection(error)) this.inviteFallbackNavigate();
        }
      }
    } finally {
      form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => {input.value = '';});
      if (generation === this.generation) this.busy = false;
    }
  }
  private beginMergeConfirm(type: string) {
    this.mergeConfirmPipe = type; this.pipeState = 'merge_confirming'; this.error = ''; this.status = ''; this.otpSent = false; this.mergePhone = '';
    this.mergePhoneRegion = DEFAULT_COUNTRY; this.smsRegionBlocked = false; this.smsRegionServerMessage = '';
  }
  private renderPipeSelector() {
    const enabled = this.enabledPipes();
    if (enabled.length < 2) return nothing;
    return html`<div class="auth-methods" part="pipes" data-cy="pipe-list">${enabled.map(id => html`<button class="btn" part="pipe" type="button" aria-pressed=${id === this.activePipe} ?disabled=${this.busy} data-cy="pipe-${id.replace(/_/g, '-')}" @click=${() => this.selectPipe(id)}>${this.pipeLabel(id)}</button>`)}</div>`;
  }
  /** Notice associated with `<noizu-phone-input>` via its `described-by` prop, which forwards
   * `aria-describedby` onto its own inner `<input>` — the id set here lives in this component's
   * shadow root, the same tree scope as that prop expects. Rendered `hidden` (removed from the
   * accessibility tree) unless a region is actually blocked, so it never gets read when it has
   * nothing relevant to say. */
  private renderSmsRegionNotice(id: string, blocked: boolean) {
    if (!this.smsRegions) return nothing;
    return html`<p id=${id} part="sms-region-notice" class="sms-region-notice" role="status" aria-live="polite" data-cy="sms-region-notice" ?hidden=${!blocked}>${this.smsRegionText()}</p>`;
  }
  private renderIdentifierField(pipe: AuthPipeId, forMerge: boolean) {
    if (this.isMobilePipe(pipe)) {
      const value = forMerge ? this.mergePhone : this.phone;
      const noticeId = 'sms-region-notice';
      const blocked = this.smsRegionActive(forMerge);
      return html`<div class="field-group" part="field-group"><label class="field-label" part="field-label" for="mobile_phone">${this.t.mobile}</label>
        <noizu-phone-input id="mobile_phone" data-cy="mobile-phone-input" name="mobile_phone" .value=${value}
          described-by=${this.smsRegions ? noticeId : nothing}
          @country-change=${(e: CustomEvent<{country: string}>) => this.onMobileCountryChange(forMerge, e)}
          @phone-change=${(e: CustomEvent) => {if (forMerge) this.mergePhone = e.detail.value; else this.phone = e.detail.value;}}></noizu-phone-input>
        ${this.renderSmsRegionNotice(noticeId, blocked)}</div>`;
    }
    return this.field('email', this.t.email, 'email', true, 'email');
  }
  private renderPipeForm() {
    const pipe = this.activePipe, t = this.t;
    if (this.isSsoPipe(pipe)) {
      const provider = this.ssoProviderFor(pipe);
      return html`<div class="auth-methods" part="providers" data-cy="sso-provider-list"><button class="btn auth-provider" part="provider" type="button" data-cy="sso-provider-link" data-provider=${PIPE_PROVIDER_ID[pipe]!} ?disabled=${this.busy || !provider} @click=${() => this.ssoRedirect(pipe)}>${this.pipeLabel(pipe)}</button>${!provider ? html`<p part="status">${t.unavailable}</p>` : nothing}</div>`;
    }
    const signup = this.flow === 'signup';
    // Native `disabled` would drop the submit control out of the tab order, which fails the
    // "keyboard users must be able to reach and understand it" requirement — `aria-disabled` plus
    // a guard in submitPipe() keeps it focusable and announced as disabled instead.
    const smsBlocked = this.isMobilePipe(pipe) && this.smsRegionActive(false);
    return html`<form class="auth-form" part="form" data-cy="pipe-form" @submit=${this.submitPipe}>
      <fieldset ?disabled=${this.busy}>
        ${this.renderIdentifierField(pipe, false)}
        ${signup ? html`${this.field('user_name', t.username, 'text', true, 'username')}${this.field('first_name', t.firstName, 'text', true, 'given-name')}${this.field('last_name', t.lastName, 'text', true, 'family-name')}${this.inviteField()}` : nothing}
        ${!this.isOtpPipe(pipe) || signup ? this.field('password', t.password, 'password', true, signup ? 'new-password' : 'current-password') : nothing}
        ${this.isOtpPipe(pipe) && !signup && this.otpSent ? this.field('code', t.code, 'text', true, 'one-time-code') : nothing}
        <button class="btn" part="submit button" type="submit" data-cy="pipe-submit" aria-disabled=${smsBlocked ? 'true' : nothing}>${this.busy ? t.working : signup ? t.signup : this.isOtpPipe(pipe) ? (this.otpSent ? t.verifyCode : t.sendCode) : t.login}</button>
      </fieldset>
    </form>`;
  }
  private renderMergeRequired() {
    const t = this.t, challenge = this.mergeChallenge;
    return html`<div class="merge-required" part="merge-required" data-cy="merge-required">
      <p part="merge-description">${t.mergeRequiredDescription}</p>
      <div class="auth-methods" part="merge-pipes" data-cy="merge-pipe-list">${(challenge?.pipes ?? []).map(p => html`<button class="btn" part="merge-pipe" type="button" data-cy="merge-pipe-option" data-pipe-type=${p.type} @click=${() => this.beginMergeConfirm(p.type)}>${p.type} — ${p.masked}</button>`)}</div>
    </div>`;
  }
  private renderMergeConfirming() {
    const type = this.mergeConfirmPipe ?? '', t = this.t;
    const mobile = type === 'mobile_password' || type === 'mobile_otp';
    const sso = this.isSsoPipe(type as AuthPipeId);
    if (sso) {
      const provider = this.ssoProviderFor(type as AuthPipeId);
      return html`<div part="merge-confirm" data-cy="merge-confirm">
        <button class="btn auth-provider" part="provider" type="button" data-cy="sso-provider-link" ?disabled=${!provider} @click=${() => this.ssoRedirect(type as AuthPipeId, this.mergeChallenge?.challengeId)}>${t.providerPrefix} ${type}</button>
        <button class="btn" part="back button" @click=${() => {this.pipeState = 'merge_required'; this.mergeConfirmPipe = undefined; this.smsRegionBlocked = false; this.smsRegionServerMessage = '';}}>${t.mergeConfirmBack}</button>
      </div>`;
    }
    const mergeNoticeId = 'sms-region-notice';
    const mergeSmsBlocked = mobile && this.smsRegionActive(true);
    return html`<form class="auth-form" part="form" data-cy="merge-confirm-form" @submit=${this.submitPipe}>
      <fieldset ?disabled=${this.busy}>
        ${mobile ? html`<div class="field-group" part="field-group"><label class="field-label" part="field-label" for="mobile_phone">${t.mobile}</label>
          <noizu-phone-input id="mobile_phone" data-cy="mobile-phone-input" name="mobile_phone" .value=${this.mergePhone}
            described-by=${this.smsRegions ? mergeNoticeId : nothing}
            @country-change=${(e: CustomEvent<{country: string}>) => this.onMobileCountryChange(true, e)}
            @phone-change=${(e: CustomEvent) => {this.mergePhone = e.detail.value;}}></noizu-phone-input>
          ${this.renderSmsRegionNotice(mergeNoticeId, mergeSmsBlocked)}</div>` : this.field('email', t.email, 'email', true, 'email')}
        ${type.endsWith('otp') ? (this.otpSent ? this.field('code', t.code, 'text', true, 'one-time-code') : nothing) : this.field('password', t.password, 'password', true, 'current-password')}
        <button class="btn" part="submit button" type="submit" data-cy="merge-confirm-submit" aria-disabled=${mergeSmsBlocked ? 'true' : nothing}>${this.busy ? t.working : type.endsWith('otp') ? (this.otpSent ? t.verifyCode : t.sendCode) : t.mergeConfirmSubmit}</button>
      </fieldset>
      <button class="btn" part="back button" type="button" ?disabled=${this.busy} @click=${() => {this.pipeState = 'merge_required'; this.mergeConfirmPipe = undefined; this.smsRegionBlocked = false; this.smsRegionServerMessage = '';}}>${t.mergeConfirmBack}</button>
    </form>`;
  }
  private renderPipes() {
    if (this.pipeState === 'merge_required') return html`${this.renderMergeRequired()}<div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div>`;
    if (this.pipeState === 'merge_confirming') return html`${this.renderMergeConfirming()}<div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div><div class="auth-status" part="status" role="status">${this.status}</div>`;
    return html`
      ${this.renderPipeSelector()}
      ${this.renderPipeForm()}
      <div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div>
      <div class="auth-status" part="status" role="status">${this.status}</div>
    `;
  }

  // ---------- console layout (`layout="console"`; pipes mode only) ----------
  /** True when the console should be drawn instead of the flat pipe tabs. The console
   * is the default; `layout="tabs"` is the opt-out. It covers the legacy `options` flow
   * as well as the `pipes` surface. */
  private usesConsole(): boolean {return this.layout !== 'tabs';}
  private ssoPipes(): AuthPipeId[] {return this.enabledPipes().filter(id => this.isSsoPipe(id));}
  private passwordPipes(): AuthPipeId[] {
    return this.enabledPipes().filter(id => id === 'email_password' || id === 'mobile_password');
  }
  private otpPipes(): AuthPipeId[] {return this.enabledPipes().filter(id => this.isOtpPipe(id));}
  /** The password pipe the segmented toggle currently points at. Falls back to
   * whichever password pipe is enabled when only one is. */
  private credModePipe(): AuthPipeId | undefined {
    const available = this.passwordPipes();
    const wanted: AuthPipeId = this.credMode === 'mobile' ? 'mobile_password' : 'email_password';
    // No password pipe at all: an OTP-only host gets its first code pipe inline rather
    // than a console whose only control is a link to the thing it should already show.
    return available.includes(wanted) ? wanted : available[0] ?? this.otpPipes()[0];
  }
  private setCredMode(mode: 'email' | 'mobile') {
    if (this.busy || this.credMode === mode) return;
    this.credMode = mode;
    this.error = ''; this.status = '';
    this.smsRegionBlocked = false; this.smsRegionServerMessage = '';
    const pipe = this.credModePipe();
    if (pipe) this.activePipe = pipe;
  }
  /** Open a single pipe (a one-time-code flow) from the console root. */
  private openConsolePipe(id: AuthPipeId) {
    if (this.busy) return;
    this.selectPipe(id);
    this.consoleStep = 'pipe';
  }
  private returnToConsole() {
    if (this.busy) return;
    this.consoleStep = 'root';
    this.error = ''; this.status = ''; this.otpSent = false;
    const pipe = this.credModePipe();
    if (pipe) this.activePipe = pipe;
  }
  private consoleProviderButton(id: AuthPipeId) {
    const provider = this.ssoProviderFor(id);
    const providerId = PIPE_PROVIDER_ID[id]!;
    return html`<button class="btn sso-btn" part="provider sso-button" type="button"
      data-cy=${id === 'authentik' ? 'sso-provider-link' : `pipe-${id}`}
      data-cy-id=${id === 'authentik' ? 'oidc' : nothing}
      data-provider=${providerId}
      ?disabled=${this.busy || !provider}
      @click=${() => this.ssoRedirect(id)}>${PROVIDER_ICON[id] ?? nothing}<span>${this.pipeLabel(id)}</span></button>`;
  }
  /** One line naming the social providers the server did not publish, instead of
   * leaving a disabled button to explain itself. */
  private consoleUnavailableNote(sso: AuthPipeId[]) {
    const missing = sso.filter(id => !this.ssoProviderFor(id));
    if (!missing.length) return nothing;
    return html`<p class="sso-unavailable" part="status providers-unavailable" data-cy="sso-unavailable">${this.t.providersUnavailable} ${missing.map(id => this.providerShortName(id)).join(', ')}</p>`;
  }
  /** "Continue with GitHub" → "GitHub". The note lists providers, and repeating
   * each button's whole sentence back makes a one-line aside read like a
   * paragraph. Falls back to the full label for a custom one that does not
   * start with the prefix. */
  private providerShortName(id: AuthPipeId): string {
    const label = this.pipeLabel(id), prefix = this.t.providerPrefix ?? '';
    return prefix && label.toLowerCase().startsWith(`${prefix.toLowerCase()} `)
      ? label.slice(prefix.length + 1)
      : label;
  }
  private renderConsoleSegments() {
    const t = this.t;
    if (this.passwordPipes().length < 2) return nothing;
    return html`<div class="segments" part="segments" role="tablist" aria-label=${t.identifierType}>
      ${(['email', 'mobile'] as const).map(m => html`<button class="segment" part="segment" type="button" role="tab"
        aria-selected=${this.credMode === m} ?disabled=${this.busy} data-cy=${`cred-mode-${m}`}
        @click=${() => this.setCredMode(m)}>${m === 'email' ? t.segmentEmail : t.segmentMobile}</button>`)}
    </div>`;
  }
  private renderConsoleCredentialForm() {
    const pipe = this.credModePipe();
    if (!pipe) return nothing;
    const t = this.t, signup = this.flow === 'signup';
    const smsBlocked = this.isMobilePipe(pipe) && this.smsRegionActive(false);
    const otp = this.isOtpPipe(pipe);
    return html`<form class="auth-form" part="form" data-cy=${`pipe-form-${pipe}`} @submit=${this.submitPipe}>
      <fieldset ?disabled=${this.busy}>
        ${this.renderIdentifierField(pipe, false)}
        ${signup ? html`${this.field('user_name', t.username, 'text', true, 'username')}${this.field('first_name', t.firstName, 'text', true, 'given-name')}${this.field('last_name', t.lastName, 'text', true, 'family-name')}${this.inviteField()}` : nothing}
        ${!otp || signup ? this.field('password', t.password, 'password', true, signup ? 'new-password' : 'current-password') : nothing}
        ${otp && !signup && this.otpSent ? this.field('code', t.code, 'text', true, 'one-time-code') : nothing}
        <button class="btn" part="submit button" type="submit" data-cy="pipe-submit" aria-disabled=${smsBlocked ? 'true' : nothing}>${this.busy ? t.working : signup ? t.signup : otp ? (this.otpSent ? t.verifyCode : t.sendCode) : t.login}</button>
      </fieldset>
    </form>`;
  }
  private renderConsoleOtpLinks() {
    const inline = this.credModePipe();
    const otp = this.otpPipes().filter(id => id !== inline);
    if (!otp.length) return nothing;
    const t = this.t;
    return html`<div class="otp-links" part="otp-links" data-cy="otp-links">${otp.map((id, index) => html`${index ? html`<span class="otp-sep" aria-hidden="true">·</span>` : nothing}<button class="link" part="otp-link" type="button" data-cy=${`pipe-${id.replace(/_/g, '-')}`}
      ?disabled=${this.busy || (this.isMobilePipe(id) && this.smsRegionActive(false))}
      @click=${() => this.openConsolePipe(id)}>${id === 'email_otp' ? t.emailCodeLink : t.mobileCodeLink}</button>`)}</div>`;
  }
  private renderConsoleFooter() {
    const t = this.t, signup = this.flow === 'signup';
    if (this.options.signup === false) return nothing;
    return html`<div class="console-foot" part="console-foot">${signup ? t.haveAccount : t.needAccount}
      <button class="link" part="flow-toggle" type="button" ?disabled=${this.busy}
        data-cy=${signup ? 'login-link' : 'signup-link'}
        @click=${() => this.setFlow(!signup)}>${signup ? t.logInLink : t.getStarted}</button></div>`;
  }
  private renderConsole() {
    const t = this.t, sso = this.ssoPipes();
    // The rule separates the social row from whatever follows it — a credential form,
    // an inline code pipe, or just the code links. Gating it on password pipes alone
    // left an OTP-only host's social row butted straight against its form.
    const below = Boolean(this.credModePipe()) || this.otpPipes().length > 0;
    // Account merging is a state of the pipe machine, not of the console arrangement:
    // when the backend answers `merge_required`, the merge screens are what must render.
    if (this.pipeState === 'merge_required' || this.pipeState === 'merge_confirming') return this.renderPipes();
    if (this.consoleStep === 'pipe') {
      return html`
        ${this.renderPipeForm()}
        <button class="link console-back" part="back button" type="button" ?disabled=${this.busy} data-cy="pipe-back" @click=${this.returnToConsole}>${t.consoleBack}</button>
        <div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div>
        <div class="auth-status" part="status" role="status">${this.status}</div>`;
    }
    return html`
      ${sso.length ? html`<div class="sso-grid" part="providers" data-cy="sso-provider-list">${sso.map(id => this.consoleProviderButton(id))}</div>${this.consoleUnavailableNote(sso)}` : nothing}
      ${sso.length && below ? html`<div class="rule" part="divider" aria-hidden="true"><span></span><em>${t.or}</em><span></span></div>` : nothing}
      ${this.renderConsoleSegments()}
      ${this.renderConsoleCredentialForm()}
      ${this.renderConsoleOtpLinks()}
      <div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div>
      <div class="auth-status" part="status" role="status">${this.status}</div>
      ${this.renderConsoleFooter()}
    `;
  }

  /** Icon for a legacy `config.providers` entry, matched by the same ids the pipes use. */
  private providerIconFor(id: string): unknown {
    const pipe = (Object.keys(PIPE_PROVIDER_IDS) as AuthPipeId[]).find(p => (PIPE_PROVIDER_IDS[p] ?? []).includes(id));
    return pipe ? PROVIDER_ICON[pipe] ?? KEY_ICON : KEY_ICON;
  }
  /** The legacy `options` flow in the console arrangement: the configured providers as
   * the social grid, the `or` rule, the email/password form, and the alternate sign-in
   * methods as text links. The state machine underneath is untouched — only the
   * arrangement changes. Domain routing still wins: at the `sso` step only the matched
   * providers render and there is no credential form. */
  private renderLegacyConsole() {
    const t = this.t, signup = this.flow === 'signup';
    const ssoStep = this.step === 'sso';
    const providers = ssoStep ? this.matchedProviders() : this.providers();
    const unavailable = ssoStep
      ? !providers.length
      : this.step === 'password' && ((!signup && !this.methods().length) || (signup && this.options.password === false));
    const showForm = !ssoStep && !unavailable;
    const altMethods = !signup && this.step === 'password' ? this.methods().filter(m => m !== this.method) : [];
    return html`
      ${providers.length ? html`<div class="sso-grid" part="providers" data-cy="sso-provider-list">${providers.map(p => html`<button
        class="btn sso-btn" part="provider sso-button" type="button" ?disabled=${this.busy}
        data-cy="sso-provider-link" data-cy-id=${p.id === 'authentik' || p.id === 'oidc' ? 'oidc' : nothing}
        data-provider=${p.id} @click=${() => this.providerClick(p)}>${this.providerIconFor(p.id)}<span>${p.label ?? `${t.providerPrefix} ${p.id}`}</span></button>`)}</div>` : nothing}
      ${providers.length && showForm ? html`<div class="rule" part="divider" aria-hidden="true"><span></span><em>${t.or}</em><span></span></div>` : nothing}
      ${unavailable ? html`<p part="status">${t.unavailable}</p>` : nothing}
      ${showForm ? html`<form class="auth-form" part="form" @submit=${this.submit}>
        <fieldset ?disabled=${this.busy}>
        ${this.field('email',t.email,'email',true,'email')}
        ${signup && this.step === 'password' ? html`${this.field('user_name',t.username,'text',true,'username')}${this.field('first_name',t.firstName,'text',true,'given-name')}${this.field('last_name',t.lastName,'text',true,'family-name')}${this.field('mobile_phone',t.mobile,'tel',true,'tel')}${this.inviteField()}` : nothing}
        ${(signup && this.step === 'password') || (!signup && this.step === 'password' && this.method === 'password') ? this.field('password',t.password,'password',true,signup ? 'new-password' : 'current-password') : nothing}
        ${!signup && this.step === 'password' && this.method === 'otp' && this.otpSent ? this.field('code',t.code,'text',true,'one-time-code') : nothing}
        <button class="btn" part="submit button" type="submit" data-cy=${signup ? "submit-signup" : this.method === "password" ? "submit-login" : this.method === "magic-link" ? "submit-magic-link" : this.otpSent ? "submit-otp-verify" : "submit-otp-request"}>${this.busy ? t.working : this.step === 'email' ? t.continue : signup ? t.signup : this.method === 'password' ? t.login : this.method === 'magic-link' ? t.sendLink : this.otpSent ? t.verifyCode : t.sendCode}</button>
        </fieldset>
      </form>` : nothing}
      ${altMethods.length || this.step !== 'email' ? html`<div class="otp-links" part="otp-links" data-cy="otp-links">
        ${altMethods.map((m, i) => html`${i ? html`<span class="otp-sep" aria-hidden="true">·</span>` : nothing}<button class="link" part="method" type="button" data-method=${m} ?disabled=${this.busy}
          @click=${() => {this.method = m; this.otpSent = false; this.error = ''; this.status = '';}}>${m === 'password' ? t.usePassword : m === 'magic-link' ? t.magicLinkMethod : t.otpMethod}</button>`)}
        ${this.step !== 'email' ? html`${altMethods.length ? html`<span class="otp-sep" aria-hidden="true">·</span>` : nothing}<button class="link" part="back button" type="button" ?disabled=${this.busy}
          @click=${() => {this.step = 'email'; this.method = 'password'; this.error = ''; this.status = ''; this.otpSent = false;}}>${t.back}</button>` : nothing}
      </div>` : nothing}
      <div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div>
      <div class="auth-status" part="status" role="status">${this.status}</div>
      ${this.renderConsoleFooter()}
    `;
  }

  // ---------- custom-method mode (`custom-method` / `pipes = ['custom']`) ----------
  private wasCustomMethod = false;
  private usesCustomMethod(): boolean {
    // `'custom'` anywhere in `pipes` wins over any built-in pipe listed beside it.
    return this.customMethod || (this.pipes ?? []).some(p => p === 'custom');
  }
  /** One pane per flow, each falling back to the shared `method` slot. Unassigned panes
   * are not rendered, so the host can keep both in the DOM and let `flow` pick. */
  private renderCustomMethod() {
    const pane = this.flow === 'signup'
      ? html`<slot name="method-signup"><slot name="method-register"><slot name="method"></slot></slot></slot>`
      : html`<slot name="method-login"><slot name="method"></slot></slot>`;
    return html`<div class="custom-method" part="method" data-cy="custom-method" data-flow=${this.flow}>${pane}</div>
      <div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div>
      <div class="auth-status" part="status" role="status">${this.status}</div>
      ${this.renderConsoleFooter()}`;
  }
  private readonly onFlowSwitch = (event: CustomEvent<{flow?: AuthFlowSwitch}>) => {
    if (!this.usesCustomMethod()) return;
    const flow = event.detail?.flow;
    if (flow !== 'login' && flow !== 'signup' && flow !== 'register') return;
    event.stopPropagation();
    this.setFlow(flow !== 'login');
  };
  /** First focusable control inside the slotted pane for the current flow. */
  private customFocusTarget(): HTMLElement | undefined {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('[part~="method"] slot');
    const focusable = 'input:not([disabled]):not([type=hidden]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    for (const el of slot?.assignedElements({flatten: true}) ?? []) {
      if (el.matches(focusable)) return el as HTMLElement;
      const inner = el.querySelector<HTMLElement>(focusable);
      if (inner) return inner;
    }
    return undefined;
  }
  /** Finishes a host-driven sign-in: fires `auth-success` (and `noizu-auth-success`) with
   * `detail` as given, then closes a modal or dropdown exactly as a built-in pipe would. */
  complete(detail: AuthCustomSuccessDetail = {}) {
    this.error = ''; this.status = ''; this.busy = false;
    this.emit('auth-success', detail); this.emit('noizu-auth-success', detail);
    if (this.mode === 'modal' || this.mode === 'dropdown') this.close();
  }
  /** Reports a host-driven failure: renders the message in the card's alert region and
   * fires `auth-error` (and `noizu-auth-error`) with `{message, code?}`. The surface stays open. */
  fail(error: AuthCustomFailure = this.t.failure) {
    const message = typeof error === 'string' ? error : error?.message || this.t.failure;
    const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    this.error = message; this.busy = false;
    const detail = code ? {message, code} : {message};
    this.emit('auth-error', detail); this.emit('noizu-auth-error', detail);
  }

  // ---------- dropdown mode ----------
  /** The actual trigger control (host default button, or a slotted host trigger). Never `document.activeElement`
   * directly — an open shadow root retargets that to the host element, which has no tabindex and is not
   * focusable, so restoring focus to it silently no-ops and focus falls back to <body>. */
  private getTriggerElement(): HTMLElement | undefined {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="trigger"]');
    const assigned = slot?.assignedElements() as HTMLElement[] | undefined;
    return assigned?.[0] ?? this.renderRoot.querySelector<HTMLElement>('[part~="trigger"]') ?? undefined;
  }
  private syncDropdown() {
    if (this.mode === 'dropdown') this.syncSlottedTrigger();
    if (this.mode === 'dropdown') {
      if (this.open && !this.dropdownOpenPrev) {
        this.dropdownRestoreFocus = this.getTriggerElement();
        document.addEventListener('keydown', this.onDocKeydown);
        document.addEventListener('click', this.onDocClick, true);
        this.focusInitial();
      } else if (!this.open && this.dropdownOpenPrev) {
        document.removeEventListener('keydown', this.onDocKeydown);
        document.removeEventListener('click', this.onDocClick, true);
        this.dropdownRestoreFocus?.focus();
      }
    } else if (this.dropdownOpenPrev) {
      document.removeEventListener('keydown', this.onDocKeydown);
      document.removeEventListener('click', this.onDocClick, true);
    }
    this.dropdownOpenPrev = this.mode === 'dropdown' && this.open;
  }
  /** Initial focus when the surface opens: the first social button, else the first
   * field. Never the close × — it is last in DOM order and explicitly skipped here, so
   * opening a modal does not park a focus ring on "dismiss". */
  private focusInitial() {this.pendingFocus = true; queueMicrotask(() => this.applyInitialFocus());}
  /** Places the opening focus, and stays armed while the social buttons are still
   * disabled because provider discovery has not answered yet — otherwise the first
   * field would win a race the user never sees. Disarms as soon as focus lands on a
   * social button, or the moment focus is anywhere the element did not put it. */
  private applyInitialFocus() {
    if (!this.pendingFocus) return;
    const root = this.renderRoot.querySelector('[part~="card"]') ?? this.renderRoot;
    const social = root.querySelector<HTMLElement>('[part~="provider"]:not([disabled])');
    // Custom-method mode: the host's slotted controls live in light DOM, out of reach of
    // the shadow query below, so look through the active pane's assigned elements first.
    const field = (this.usesCustomMethod() ? this.customFocusTarget() : undefined) ?? root.querySelector<HTMLElement>('input, noizu-phone-input, select');
    const fallback = Array.from(root.querySelectorAll<HTMLElement>('button, [tabindex]')).find(el => !el.matches('[part~="close"]'));
    const target = social ?? field ?? fallback;
    if (!target) return;
    // `showModal()` parks focus on the scrollable content container before this runs, so
    // "focus is elsewhere" only counts when it is on an actual control the element did not
    // place — a container is the browser's default, not the user's choice.
    const current = (this.renderRoot as Partial<ShadowRoot>).activeElement ?? null;
    const userMoved = current instanceof HTMLElement
      && current.matches('input, button, select, textarea, a[href], noizu-phone-input')
      && current !== field && current !== social;
    if (userMoved) {this.pendingFocus = false; return;}
    target.focus();
    this.pendingFocus = !social && this.ssoPipes().length > 0;
  }
  private pendingFocus = false;
  private toggleDropdown() {this.open = !this.open;}
  /** Per spec: signup uses modal, login uses dropdown — both modes of the same component. */
  private setFlow(signup: boolean) {
    this.flow = signup ? 'signup' : 'login';
    if (signup && this.mode === 'dropdown') {this.returnToDropdown = true; this.mode = 'modal'; this.open = true;}
    else if (!signup && this.returnToDropdown) {this.returnToDropdown = false; this.mode = 'dropdown';}
  }
  private renderDropdownTrigger() {
    const t = this.t;
    return html`<button class="btn auth-trigger" part="trigger" type="button" aria-haspopup="true" aria-expanded=${this.open ? 'true' : 'false'} aria-controls="dropdown-panel" data-cy="auth-dropdown-trigger" @click=${this.toggleDropdown}>${t.trigger}</button>`;
  }
  private wiredTrigger = new WeakSet<Element>();
  /** A host-slotted `slot="trigger"` element becomes the anchor: wire its click once, keep its ARIA in sync. */
  private onTriggerSlotChange(event: Event) {
    const slot = event.target as HTMLSlotElement;
    const el = slot.assignedElements()[0] as HTMLElement | undefined;
    if (!el) return;
    el.setAttribute('aria-haspopup', 'true');
    el.setAttribute('aria-controls', 'dropdown-panel');
    el.setAttribute('aria-expanded', this.open ? 'true' : 'false');
    if (!this.wiredTrigger.has(el)) {
      this.wiredTrigger.add(el);
      el.addEventListener('click', () => this.toggleDropdown());
    }
  }
  private syncSlottedTrigger() {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="trigger"]');
    const el = slot?.assignedElements()[0] as HTMLElement | undefined;
    el?.setAttribute('aria-expanded', this.open ? 'true' : 'false');
  }

  // ---------- render ----------
  private card() {
    const t = this.t, signup = this.flow === 'signup';
    return html`<section class="auth-card" part="card" data-cy="auth-card" id=${signup ? 'signup' : 'login'} aria-labelledby="auth-title" aria-busy=${this.busy}>
      <div class="auth-avatar" part="avatar"><slot name="avatar">${this.avatar ? html`<img src=${this.avatar.src} alt=${this.avatar.alt} />` : nothing}</slot></div>
      <div class="auth-content" part="content">
      <div class="auth-brand" part="brand"><slot name="brand"></slot></div>
      <h1 class="auth-title" part="title" id="auth-title" data-cy="auth-title">${signup ? t.signupTitle : t.loginTitle}</h1>
      ${this.usesCustomMethod()
        ? (this.text.description ? html`<p class="auth-description" part="description">${this.text.description}</p>` : nothing)
        : html`<p class="auth-description" part="description">${this.usesConsole() ? t.chooseMethod : t.description}</p>`}
      ${this.usesCustomMethod() ? this.renderCustomMethod() : this.usesConsole() && this.usesPipes() ? this.renderConsole() : this.usesConsole() ? this.renderLegacyConsole() : this.usesPipes() ? this.renderPipes() : html`
      ${!signup && this.step === 'password' && this.methods().length > 1 ? html`<div class="auth-methods" part="methods">${this.methods().map(m => html`<button class="btn" part="method" type="button" aria-pressed=${m === this.method} ?disabled=${this.busy} @click=${() => {this.method = m; this.otpSent = false; this.error = ''; this.status = '';}}>${m === 'password' ? t.passwordMethod : m === 'magic-link' ? t.magicLinkMethod : t.otpMethod}</button>`)}</div>` : nothing}
      ${this.step === 'sso' ? this.matchedProviders().length ? this.providerButtons(this.matchedProviders()) : html`<p>${t.unavailable}</p>` : (this.step === 'password' && ((!signup && !this.methods().length) || (signup && this.options.password === false))) ? html`<p>${t.unavailable}</p>` : html`
      <form class="auth-form" part="form" @submit=${this.submit}>
        <fieldset ?disabled=${this.busy}>
        ${this.field('email',t.email,'email',true,'email')}
        ${signup && this.step === 'password' ? html`${this.field('user_name',t.username,'text',true,'username')}${this.field('first_name',t.firstName,'text',true,'given-name')}${this.field('last_name',t.lastName,'text',true,'family-name')}${this.field('mobile_phone',t.mobile,'tel',true,'tel')}${this.inviteField()}` : nothing}
        ${(signup && this.step === 'password') || (!signup && this.step === 'password' && this.method === 'password') ? this.field('password',t.password,'password',true,signup ? 'new-password' : 'current-password') : nothing}
        ${!signup && this.step === 'password' && this.method === 'otp' && this.otpSent ? this.field('code',t.code,'text',true,'one-time-code') : nothing}
        <button class="btn" part="submit button" type="submit" data-cy=${signup ? "submit-signup" : this.method === "password" ? "submit-login" : this.method === "magic-link" ? "submit-magic-link" : this.otpSent ? "submit-otp-verify" : "submit-otp-request"}>${this.busy ? t.working : this.step === 'email' ? t.continue : signup ? t.signup : this.method === 'password' ? t.login : this.method === 'magic-link' ? t.sendLink : this.otpSent ? t.verifyCode : t.sendCode}</button>
        </fieldset>
      </form>`}
      ${this.step !== 'email' ? html`<button class="btn" part="back button" ?disabled=${this.busy} @click=${() => {this.step = 'email'; this.method = 'password'; this.error = ''; this.status = ''; this.otpSent = false;}}>${t.back}</button>` : nothing}
      <div class="auth-status" part="error" role="alert" data-cy="auth-error">${this.error}</div><div class="auth-status" part="status" role="status">${this.status}</div>
      `}
      <footer class="auth-footer" part="footer">${!this.usesConsole() && !this.usesCustomMethod() && this.options.signup !== false ? html`<span>${signup ? t.haveAccount : t.needAccount}</span> <button class="btn" part="flow-toggle button" ?disabled=${this.busy} @click=${() => this.setFlow(!signup)}>${signup ? t.login : t.signup}</button>` : nothing}<slot name="footer"></slot></footer></div>
      ${this.mode === 'modal' ? html`<button class="btn auth-close" part="close" type="button" aria-label=${t.close} @click=${this.close}>×</button>` : nothing}
    </section>`;
  }
  override render() {
    if (this.mode === 'modal') return html`<dialog class="auth-dialog" part="dialog" aria-labelledby="auth-title" @cancel=${(event: Event) => {event.preventDefault(); this.close();}} @close=${() => {this.restoreFocus?.focus(); if(this.open) this.close();}}>${this.card()}</dialog>`;
    if (this.mode === 'dropdown') return html`<div class="dropdown-wrap" part="dropdown-wrap"><slot name="trigger" @slotchange=${this.onTriggerSlotChange}>${this.renderDropdownTrigger()}</slot>${this.open ? html`<div class="dropdown-panel" part="dropdown-panel" id="dropdown-panel" data-cy="auth-dropdown-panel">${this.card()}</div>` : nothing}</div>`;
    return html`<div class="auth-shell" part="shell" data-cy="auth-card-wrap">${this.card()}</div>`;
  }
  static override styles = css`
    :host{display:block;color:var(--auth-color,#20232c);font-family:var(--auth-font,system-ui,sans-serif)}
    :host([mode=dropdown]){display:inline-block}
    .auth-shell{min-height:var(--auth-page-height,100dvh);display:grid;place-items:center;padding:5rem 1.25rem;box-sizing:border-box;background:var(--auth-page-background,#f5f6f8)}
    .dropdown-wrap{position:relative;display:inline-block}
    .dropdown-panel{position:absolute;top:calc(100% + var(--auth-dropdown-gap,.5rem));left:0;z-index:var(--auth-dropdown-z,20);width:max-content;max-width:min(24rem,95vw)}
    .dropdown-panel .auth-card{box-shadow:var(--auth-dropdown-shadow,0 12px 32px #0002)}
    .auth-trigger{cursor:pointer}
    .auth-card{position:relative;width:100%;max-width:var(--auth-width,26rem);box-sizing:border-box;padding:var(--auth-padding,2rem);border:1px solid var(--auth-border,#dddfe5);border-radius:var(--auth-radius,1rem);background:var(--auth-background,#fff);box-shadow:var(--auth-shadow,0 12px 40px #0001)}
    .auth-dialog{overflow:visible;border:0;padding:0;background:transparent;color:inherit;width:calc(100% - 2.5rem);max-width:var(--auth-width,26rem);max-height:calc(100dvh - 8rem)}
    .auth-dialog::backdrop{background:var(--auth-backdrop,#12172399)}
    .auth-dialog .auth-card{max-height:calc(100dvh - 8rem);overflow:visible}.auth-dialog .auth-content{max-height:calc(100dvh - 12rem);overflow:auto;padding:.2rem;scrollbar-gutter:stable}
    .auth-avatar{position:absolute;right:var(--auth-avatar-right,-1rem);top:var(--auth-avatar-top,-4rem);width:var(--auth-avatar-size,7rem);pointer-events:none}
    .auth-avatar img,::slotted([slot=avatar]){width:100%;height:auto;object-fit:contain}
    .auth-title{font-size:1.65rem;margin:1rem 0 .5rem}.auth-description{color:var(--auth-muted,#606575);font-size:.95rem}
    .auth-methods{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.auth-provider{flex:1 1 100%}
    .merge-required p[part=merge-description]{margin:0 0 .75rem}
    .field-group{margin:.8rem 0}.field-label{display:block;font-size:.85rem;margin-bottom:.3rem}.field-input{box-sizing:border-box;width:100%;padding:.7rem;border:1px solid var(--auth-border,#b8bdc7);border-radius:.4rem;background:var(--auth-input-background,#fff);color:inherit;font:inherit}
    .btn{cursor:pointer;padding:.65rem .85rem;border:1px solid var(--auth-border,#b8bdc7);border-radius:.4rem;background:var(--auth-button-background,#fff);color:inherit;font:inherit}
    .btn[aria-pressed=true],button[type=submit]{background:var(--auth-accent,#3759bb);color:var(--auth-on-accent,#fff)}
    button[type=submit]{width:100%;margin-top:1rem}.btn:disabled{opacity:.6;cursor:wait}
    button[aria-disabled=true]{opacity:.6;cursor:not-allowed}
    .sms-region-notice{margin:.4rem 0 0;font-size:.85rem;color:var(--auth-sms-region-color,#8a5a00)}
    .field-hint{margin:-.4rem 0 .8rem;font-size:.8rem;color:var(--auth-muted,#606575)}
    :focus-visible{outline:3px solid var(--auth-focus,#567ded);outline-offset:3px}
    fieldset{border:0;padding:0;margin:0;min-width:0}.auth-status{margin-top:.75rem;font-size:.9rem}[role=alert]{color:var(--auth-error,#a4262c)}.auth-footer{font-size:.85rem;margin-top:1rem}.auth-close{position:absolute;right:.6rem;top:.6rem;width:2rem;height:2rem;display:grid;place-items:center;padding:0;border:0;border-radius:999px;background:transparent;color:var(--auth-muted,#606575);font-size:1.15rem;line-height:1;opacity:.55}
    .auth-close:hover,.auth-close:focus-visible{opacity:1;color:var(--auth-color,#20232c);background:var(--auth-input-background,#f1f2f5)}
    @media(max-height:700px){.auth-dialog{overflow:auto}.auth-dialog .auth-card{max-height:none}.auth-avatar{position:relative;top:auto;right:auto;margin-top:-3rem}}

    /* ---------------- layout="console" ----------------
       Structure and spacing only: every colour is one of the --auth-* tokens
       the tab layout already uses, so a host that has themed the element does
       not have to theme it a second time to switch layouts. */
    :host(:not([layout=tabs])) .auth-title{font-size:1.5rem;font-weight:700;letter-spacing:-.01em;margin:0}
    :host(:not([layout=tabs])) .auth-description{margin:.25rem 0 1rem;font-size:.85rem}
    :host(:not([layout=tabs])) .sso-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.5rem}
    :host(:not([layout=tabs])) .sso-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.75rem;padding:.5rem .75rem;border-radius:var(--auth-control-radius,.75rem);font-size:.9rem;font-weight:500;text-align:center;line-height:1.25}
    :host(:not([layout=tabs])) .sso-btn svg{flex:0 0 auto}
    /* A lone button on the last row spans it, so three providers read as 2 + 1
       full-width rather than 2 + a half-width orphan. */
    :host(:not([layout=tabs])) .sso-grid > :last-child:nth-child(odd){grid-column:1/-1}
    :host(:not([layout=tabs])) .sso-unavailable{margin:.6rem 0 0;font-size:.8rem;color:var(--auth-muted,#606575)}
    :host(:not([layout=tabs])) .rule{display:flex;align-items:center;gap:.75rem;margin:1rem 0}
    :host(:not([layout=tabs])) .rule span{flex:1 1 auto;height:1px;background:var(--auth-border,#dddfe5)}
    :host(:not([layout=tabs])) .rule em{font-style:normal;font-size:.8rem;color:var(--auth-muted,#606575)}
    :host(:not([layout=tabs])) .segments{display:flex;gap:.125rem;padding:.125rem;margin:0 0 1rem;border:1px solid var(--auth-border,#dddfe5);border-radius:var(--auth-control-radius,.75rem);background:var(--auth-input-background,#f1f2f5)}
    :host(:not([layout=tabs])) .segment{flex:1 1 0;min-height:2rem;border:0;border-radius:calc(var(--auth-control-radius,.75rem) - .125rem);background:transparent;color:var(--auth-muted,#606575);font:inherit;font-size:.85rem;font-weight:500;cursor:pointer}
    :host(:not([layout=tabs])) .segment[aria-selected=true]{background:var(--auth-background,#fff);color:var(--auth-color,#20232c);border:1px solid var(--auth-border,#dddfe5)}
    :host(:not([layout=tabs])) .field-label{text-transform:uppercase;letter-spacing:.08em;font-size:.7rem;font-family:var(--auth-label-font,var(--auth-mono,ui-monospace,SFMono-Regular,Menlo,monospace));color:var(--auth-muted,#606575)}
    :host(:not([layout=tabs])) .field-input{border-radius:var(--auth-field-radius,.625rem);padding:.7rem .85rem;background:var(--auth-input-background,#f1f2f5)}
    :host(:not([layout=tabs])) button[type=submit]{min-height:2.75rem;border-radius:var(--auth-control-radius,.75rem);font-weight:600;margin-top:.5rem}
    :host(:not([layout=tabs])) .otp-links{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.4rem;margin-top:1rem;font-size:.82rem}
    :host(:not([layout=tabs])) .otp-sep{color:var(--auth-muted,#606575)}
    :host(:not([layout=tabs])) .link{border:0;background:none;padding:0;font:inherit;font-size:inherit;color:var(--auth-link,var(--auth-accent,#3759bb));cursor:pointer;text-decoration:none}
    :host(:not([layout=tabs])) .link:hover:not(:disabled){text-decoration:underline}
    :host(:not([layout=tabs])) .link:disabled{opacity:.5;cursor:not-allowed}
    :host(:not([layout=tabs])) .console-back{display:block;margin:.85rem auto 0}
    :host(:not([layout=tabs])) .console-foot{margin-top:1.15rem;padding-top:1rem;border-top:1px solid var(--auth-border,#dddfe5);text-align:center;font-size:.82rem;color:var(--auth-muted,#606575)}
    :host(:not([layout=tabs])) .console-foot .link{font-weight:600}
    :host(:not([layout=tabs])) .auth-footer{margin-top:0}
    .custom-method{margin-top:1rem}
  `;
}
declare global {interface HTMLElementTagNameMap {'noizu-auth': NoizuAuth;}}
