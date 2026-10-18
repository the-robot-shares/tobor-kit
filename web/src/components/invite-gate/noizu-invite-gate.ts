import {LitElement, html, css, nothing} from 'lit';
import {property, state} from 'lit/decorators.js';
import {defineElement} from '../../define.js';
import {DEFAULT_INVITE_REDEEM_ENDPOINT, sameOriginUrl} from './invite-required.js';

export {
  DEFAULT_INVITE_REDEEM_ENDPOINT, DEFAULT_INVITE_REQUIRED_URL, INVITE_OPTIONAL_HINT, INVITE_REQUIRED_ERROR,
  InviteRequiredError, handleInviteRequired, isInviteRequiredBody, isInviteRequiredChallenge,
  isInviteRequiredResponse, sameOriginUrl, userNeedsInvite, withInviteGate,
} from './invite-required.js';
export type {InviteRedirectOptions} from './invite-required.js';

/** Why a redeem failed. `failure` covers network errors and unrecognised answers. */
export type InviteRedeemErrorCode = 'empty' | 'invalid' | 'expired' | 'used' | 'rate_limited' | 'unauthenticated' | 'failure';

export interface InviteRedeemedDetail {
  /** The redeem endpoint's JSON body (or the `redeemer` hook's result). */
  result: unknown;
  /** Where the element will navigate unless the event is canceled. */
  continueUrl: string;
}
export interface InviteErrorDetail {code: InviteRedeemErrorCode; status?: number; message: string;}
export interface InviteSignOutDetail {url: string;}

/** Host hook that performs the redeem itself (e.g. the app's own API client, which
 * already carries the session). Reject with an `Error`; set `status` on it when the
 * HTTP status is known so the element can pick the right copy. */
export type InviteRedeemer = (token: string) => Promise<unknown>;

/** A failed redeem: the HTTP status (when known) plus the server's `error`/`message`. */
export class InviteRedeemError extends Error {
  constructor(readonly status: number | undefined, message: string, readonly body?: unknown) {
    super(message);
    this.name = 'InviteRedeemError';
  }
}

const copy = {
  title: "you're in — one step left",
  createdPrefix: 'your account',
  createdSuffix: 'was created, but',
  inviteOnly: 'is invite-only right now. enter an invite code from your team to activate it.',
  brandFallback: 'this app',
  label: 'invite code',
  placeholder: 'e.g. AbC123…',
  submit: 'redeem invite',
  working: 'redeeming…',
  success: 'invite accepted — taking you in…',
  profile: 'profile',
  settings: 'settings',
  signOut: 'sign out',
  empty: 'enter your invite code.',
  invalid: 'that invite code is invalid or expired.',
  expired: 'that invite has expired — ask your team for a new one.',
  used: 'that invite has already been used.',
  rateLimited: 'too many attempts — wait a minute and try again.',
  unauthenticated: 'your session has ended — sign in again.',
  failure: 'something went wrong — try again.',
};
export type InviteGateText = Partial<typeof copy>;

const ERROR_COPY_KEY: Record<InviteRedeemErrorCode, keyof typeof copy> = {
  empty: 'empty', invalid: 'invalid', expired: 'expired', used: 'used', rate_limited: 'rateLimited', unauthenticated: 'unauthenticated', failure: 'failure',
};

/**
 * Map a failed redeem to an {@link InviteRedeemErrorCode}. The PATTERN.md backend answers
 * 404 "Invalid or expired invite token" / 409 "This invite has already been used"; the
 * shared rate limiter answers 429. Status wins; the message is the fallback for hooks
 * that only surface text.
 */
export function classifyInviteRedeemError(status: number | undefined, message = ''): InviteRedeemErrorCode {
  const text = message.toLowerCase();
  if (status === 429 || text.includes('too many') || text.includes('rate_limit') || text.includes('rate limit')) return 'rate_limited';
  if (status === 409 || text.includes('already') || text.includes('invite_used') || text.includes('exhausted')) return 'used';
  if (status === 401) return 'unauthenticated';
  if (status === 410 || (text.includes('expired') && !text.includes('invalid'))) return 'expired';
  if (status === 404 || status === 400 || status === 422 || text.includes('invalid') || text.includes('not_found') || text.includes('not found')) return 'invalid';
  return 'failure';
}

function bodyMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const {error, message} = body as {error?: unknown; message?: unknown};
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as {message?: unknown}).message === 'string') return (error as {message: string}).message;
  return typeof message === 'string' ? message : '';
}

/**
 * Invite interstitial card. A signed-in account whose email domain needs an invite is
 * held here: it explains why, takes an invite code, redeems it, and continues into the
 * app. Profile, settings and sign-out stay reachable. The host owns the session, the
 * route guard and the redeem endpoint; the element only calls it and emits events.
 */
@defineElement('noizu-invite-gate')
export class NoizuInviteGate extends LitElement {
  /** Redeem endpoint (POST `{"token": "…"}`). Same-origin only. */
  @property() endpoint = DEFAULT_INVITE_REDEEM_ENDPOINT;
  /** Where to go after a successful redeem. Same-origin only. */
  @property({attribute: 'continue-url'}) continueUrl = '/app';
  /** Profile link. Empty hides it. */
  @property({attribute: 'profile-url'}) profileUrl = '/app/profile';
  /** Settings link. Empty hides it. */
  @property({attribute: 'settings-url'}) settingsUrl = '/app/settings';
  /** Sign-out target, navigated after an uncanceled `noizu-invite-sign-out`. Empty =
   * event only (the host signs out, e.g. clears its Bearer token). */
  @property({attribute: 'sign-out-url'}) signOutUrl = '';
  /** Product name in the explanation ("<brand> is invite-only right now"). */
  @property() brand = '';
  /** The signed-in email, shown in the explanation when set. */
  @property() email = '';
  /** Prefills the code input (e.g. from an invite link's query string). */
  @property() token = '';
  /** Send cookies on the redeem request even cross-subdomain (`credentials: "include"`).
   * The default is `"same-origin"`. */
  @property({type: Boolean, attribute: 'with-credentials'}) withCredentials = false;
  /** `embedded` drops the full-page shell and renders only the card. */
  @property({type: Boolean, reflect: true}) embedded = false;
  /** Bearer token for the redeem request (REST hosts). Property only — never an attribute. */
  @property({attribute: false}) accessToken?: string;
  /** Host-performed redeem. When set the element makes no request of its own. */
  @property({attribute: false}) redeemer?: InviteRedeemer;
  @property({attribute: false}) text: InviteGateText = {};

  @state() private busy = false;
  @state() private done = false;
  @state() private error = '';
  @state() private errorCode?: InviteRedeemErrorCode;
  @state() private status = '';
  private value = '';
  private generation = 0;

  private get t() {return {...copy, ...this.text};}

  override disconnectedCallback() {this.generation++; this.busy = false; super.disconnectedCallback();}
  protected override willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('token')) this.value = this.token;
  }
  protected override firstUpdated() {this.input()?.focus();}

  private input() {return this.renderRoot.querySelector<HTMLInputElement>('#invite-token');}
  private emit(name: string, detail: unknown, cancelable = false) {
    return this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: true, cancelable}));
  }
  /** Navigation seam — `location.assign` is unforgeable in Chrome, so tests override this. */
  protected navigateTo(url: string) {window.location.assign(url);}

  /** Redeem a code programmatically (what the form submit calls). */
  async redeem(raw: string = this.value): Promise<boolean> {
    const token = raw.trim();
    if (this.busy) return false;
    if (!token) {this.fail('empty'); return false;}
    this.busy = true; this.error = ''; this.errorCode = undefined; this.status = '';
    const generation = ++this.generation;
    try {
      const result = this.redeemer ? await this.redeemer(token) : await this.post(token);
      if (generation !== this.generation) return false;
      this.done = true; this.status = this.t.success;
      const continueUrl = sameOriginUrl(this.continueUrl, '/app');
      if (this.emit('noizu-invite-redeemed', {result, continueUrl} satisfies InviteRedeemedDetail, true)) this.navigateTo(continueUrl);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      const status = (error as {status?: unknown}).status;
      const code = classifyInviteRedeemError(typeof status === 'number' ? status : undefined, (error as Error)?.message ?? '');
      this.fail(code, typeof status === 'number' ? status : undefined);
      return false;
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async post(token: string): Promise<unknown> {
    const endpoint = sameOriginUrl(this.endpoint, '');
    // A cross-origin endpoint would hand the code (and any Bearer token) to another host.
    if (!endpoint) throw new InviteRedeemError(undefined, 'Invite redeem endpoint must be a same-origin path.');
    const headers: Record<string, string> = {'content-type': 'application/json', accept: 'application/json'};
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    const response = await fetch(endpoint, {
      method: 'POST', headers, body: JSON.stringify({token}),
      credentials: this.withCredentials ? 'include' : 'same-origin',
    });
    let body: unknown;
    try {body = await response.json();} catch {body = undefined;}
    if (!response.ok) throw new InviteRedeemError(response.status, bodyMessage(body) || `http_${response.status}`, body);
    return body;
  }

  private fail(code: InviteRedeemErrorCode, status?: number) {
    this.errorCode = code; this.error = this.t[ERROR_COPY_KEY[code]];
    this.emit('noizu-invite-error', {code, status, message: this.error} satisfies InviteErrorDetail);
    // Keep the user on the field they need to fix; the alert region announces why.
    this.updateComplete.then(() => {const input = this.input(); input?.focus(); input?.select();});
  }

  private onSubmit(event: SubmitEvent) {event.preventDefault(); void this.redeem();}
  private onSignOut() {
    const url = sameOriginUrl(this.signOutUrl, '');
    if (this.emit('noizu-invite-sign-out', {url} satisfies InviteSignOutDetail, true) && url) this.navigateTo(url);
  }

  private card() {
    const t = this.t;
    const profile = sameOriginUrl(this.profileUrl, ''), settings = sameOriginUrl(this.settingsUrl, '');
    return html`<section class="card" part="card" data-cy="invite-required" aria-labelledby="invite-title" aria-describedby="invite-description">
      <slot name="brand"></slot>
      <h1 class="title" part="title" id="invite-title" data-cy="invite-title">${t.title}</h1>
      <p class="description" part="description" id="invite-description" data-cy="invite-description">
        ${t.createdPrefix}${this.email ? html` (<span class="email" part="email">${this.email}</span>)` : nothing} ${t.createdSuffix}
        ${this.brand || t.brandFallback} ${t.inviteOnly}
      </p>
      <form class="form" part="form" data-cy="invite-redeem-form" novalidate @submit=${this.onSubmit}>
        <fieldset ?disabled=${this.busy || this.done}>
          <label class="label" part="label" for="invite-token">${t.label}</label>
          <input class="input" part="input" id="invite-token" name="token" type="text" data-cy="invite-code-input"
            autocomplete="off" autocapitalize="off" spellcheck="false" placeholder=${t.placeholder}
            aria-invalid=${this.error ? 'true' : 'false'} aria-describedby="invite-error"
            .value=${this.value} @input=${(e: Event) => {this.value = (e.target as HTMLInputElement).value;}} />
          <button class="submit" part="submit button" type="submit" data-cy="invite-redeem-submit">${this.busy ? t.working : t.submit}</button>
        </fieldset>
      </form>
      <p class="error" part="error" id="invite-error" role="alert" aria-live="assertive" data-cy="invite-error" data-code=${this.errorCode ?? nothing} ?hidden=${!this.error}>${this.error}</p>
      <p class="status" part="status" role="status" aria-live="polite" data-cy="invite-status">${this.status}</p>
      ${profile || settings ? html`<nav class="links" part="links" aria-label="account">
        ${profile ? html`<a class="link" part="link profile-link" href=${profile} data-cy="invite-profile-link">${t.profile}</a>` : nothing}
        ${settings ? html`<a class="link" part="link settings-link" href=${settings} data-cy="invite-settings-link">${t.settings}</a>` : nothing}
      </nav>` : nothing}
      <button class="sign-out" part="sign-out button" type="button" data-cy="invite-sign-out" ?disabled=${this.busy} @click=${this.onSignOut}>${t.signOut}</button>
      <slot name="footer"></slot>
    </section>`;
  }

  override render() {
    return this.embedded ? this.card() : html`<div class="shell" part="shell">${this.card()}</div>`;
  }

  /* Same --auth-* tokens as <noizu-auth>, so a host that themed the sign-in card gets
     a matching interstitial without theming it twice. */
  static override styles = css`
    :host{display:block;color:var(--auth-color,#20232c);font-family:var(--auth-font,system-ui,sans-serif)}
    [hidden]{display:none!important}
    .shell{min-height:var(--auth-page-height,100dvh);display:grid;place-items:center;padding:5rem 1.25rem;box-sizing:border-box;background:var(--auth-page-background,#f5f6f8)}
    .card{width:100%;max-width:var(--auth-width,26rem);box-sizing:border-box;padding:var(--auth-padding,2rem);border:1px solid var(--auth-border,#dddfe5);border-radius:var(--auth-radius,1rem);background:var(--auth-background,#fff);box-shadow:var(--auth-shadow,0 12px 40px #0001)}
    .title{font-size:1.5rem;font-weight:700;letter-spacing:-.01em;margin:0 0 .5rem}
    .description{margin:0 0 1.25rem;font-size:.9rem;line-height:1.5;color:var(--auth-muted,#606575)}
    .email{color:var(--auth-color,#20232c)}
    fieldset{border:0;padding:0;margin:0;min-width:0}
    .label{display:block;margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.08em;font-size:.7rem;font-family:var(--auth-label-font,var(--auth-mono,ui-monospace,SFMono-Regular,Menlo,monospace));color:var(--auth-muted,#606575)}
    .input{box-sizing:border-box;width:100%;padding:.7rem .85rem;border:1px solid var(--auth-border,#b8bdc7);border-radius:var(--auth-field-radius,.625rem);background:var(--auth-input-background,#f1f2f5);color:inherit;font:inherit}
    .input[aria-invalid=true]{border-color:var(--auth-error,#a4262c)}
    .submit,.sign-out{box-sizing:border-box;width:100%;min-height:2.75rem;cursor:pointer;padding:.65rem .85rem;border:1px solid var(--auth-border,#b8bdc7);border-radius:var(--auth-control-radius,.75rem);font:inherit;font-weight:600}
    .submit{margin-top:.75rem;background:var(--auth-accent,#3759bb);color:var(--auth-on-accent,#fff)}
    .sign-out{margin-top:1rem;background:var(--auth-button-background,#fff);color:inherit;font-weight:500}
    button:disabled,fieldset:disabled .submit{opacity:.6;cursor:wait}
    .error{margin:.75rem 0 0;font-size:.85rem;color:var(--auth-error,#a4262c)}
    .status{margin:.5rem 0 0;font-size:.85rem;min-height:1px}
    .links{display:flex;justify-content:center;gap:1rem;margin-top:1rem;font-size:.82rem}
    .link{color:var(--auth-link,var(--auth-accent,#3759bb));text-decoration:none}
    .link:hover{text-decoration:underline}
    :focus-visible{outline:3px solid var(--auth-focus,#567ded);outline-offset:3px}
  `;
}

declare global {
  interface HTMLElementTagNameMap {'noizu-invite-gate': NoizuInviteGate;}
  interface HTMLElementEventMap {
    'noizu-invite-redeemed': CustomEvent<InviteRedeemedDetail>;
    'noizu-invite-error': CustomEvent<InviteErrorDetail>;
    'noizu-invite-sign-out': CustomEvent<InviteSignOutDetail>;
  }
}
