/**
 * `<tobor-login-flow>` — OIDC Authorization Code + PKCE for a public client.
 *
 * The `auth` block of the guide projection carries issuer, client_id, scopes
 * and redirect_path; this element turns that into a working browser login.
 * Framework-free helpers (`beginLogin`, `completeLogin`, `buildAuthorizeUrl`,
 * `exchangeCode`) are exported so hosts can run the flow without the element.
 *
 * Known portfolio quirk honored here: per-provider Authentik issuers carry a
 * trailing slash that 404s discovery — it is stripped before any URL is built.
 */

import { LitElement, css, html, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { GuideAuth } from "../../types.js";
import {defineElement} from '../../define.js';

/* --------------------------------------------------------------- helpers */

const VERIFIER_KEY = "tobor-kit:pkce:verifier";
const STATE_KEY = "tobor-kit:pkce:state";

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomVerifier(length = 64): string {
  const bytes = new Uint8Array(Math.max(32, Math.ceil((length * 3) / 4)));
  crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, length);
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Authentik per-provider issuers sometimes carry a trailing slash that 404s. */
export function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, "");
}

export function buildAuthorizeUrl(options: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: options.scopes.join(" "),
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${normalizeIssuer(options.issuer)}/authorize?${params.toString()}`;
}

export function parseCallback(search: string): { code: string; state: string } | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = params.get("code");
  const state = params.get("state");
  return code && state ? { code, state } : null;
}

export interface OAuthTokens {
  access_token: string;
  token_type?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function exchangeCode(options: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokens> {
  const res = await (options.fetchImpl ?? globalThis.fetch)(
    `${normalizeIssuer(options.issuer)}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        code: options.code,
        code_verifier: options.verifier,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status})`);
  }
  return (await res.json()) as OAuthTokens;
}

export interface LoginRedirect {
  url: string;
  state: string;
}

/**
 * Build the authorize redirect and stash the PKCE verifier for
 * `completeLogin` (sessionStorage, keyed by state).
 */
export async function beginLogin(
  auth: GuideAuth,
  options: { redirectUri?: string; storage?: Storage } = {},
): Promise<LoginRedirect | null> {
  if (!auth.issuer || !auth.client_id || auth.provider === "none") return null;
  const redirectUri =
    options.redirectUri ??
    new URL(auth.redirect_path ?? "/auth/oidc/callback", globalThis.location.href).toString();
  const state = randomVerifier(24);
  const verifier = randomVerifier(64);
  const storage = options.storage ?? globalThis.sessionStorage;
  try {
    storage.setItem(STATE_KEY, state);
    storage.setItem(VERIFIER_KEY, verifier);
  } catch {
    /* storage denied — the flow still works within this page lifetime */
  }
  const url = buildAuthorizeUrl({
    issuer: auth.issuer,
    clientId: auth.client_id,
    redirectUri,
    scopes: auth.scopes ?? ["openid", "email", "profile"],
    state,
    codeChallenge: await codeChallenge(verifier),
  });
  return { url, state };
}

/** Complete the flow from a callback URL's query string. */
export async function completeLogin(
  auth: GuideAuth,
  search: string,
  options: { redirectUri?: string; storage?: Storage; fetchImpl?: typeof fetch } = {},
): Promise<OAuthTokens> {
  const callback = parseCallback(search);
  if (!callback) throw new Error("no code + state in callback");
  const storage = options.storage ?? globalThis.sessionStorage;
  const storedState = storage.getItem(STATE_KEY);
  if (storedState && storedState !== callback.state) {
    throw new Error("state mismatch — ignoring callback");
  }
  const verifier = storage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("no PKCE verifier for this callback");
  const redirectUri =
    options.redirectUri ??
    new URL(auth.redirect_path ?? "/auth/oidc/callback", globalThis.location.href).toString();
  const tokens = await exchangeCode({
    issuer: auth.issuer ?? "",
    clientId: auth.client_id ?? "",
    redirectUri,
    code: callback.code,
    verifier,
    fetchImpl: options.fetchImpl,
  });
  try {
    storage.removeItem(STATE_KEY);
    storage.removeItem(VERIFIER_KEY);
  } catch {
    /* ignore */
  }
  return tokens;
}

/* --------------------------------------------------------------- element */

@defineElement("tobor-login-flow")
export class ToborLoginFlow extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: inline-block;
      }

      .user {
        font-size: 0.85em;
        color: var(--_muted);
      }
    `,
  ];

  /** The projection's `auth` block. */
  @property({ attribute: false })
  auth?: GuideAuth;

  /**
   * Callback query string. Defaults to `location.search`; set explicitly in
   * hosts that route the callback themselves.
   */
  @property({ type: String })
  callbackSearch: string | null = null;

  @property({ type: Boolean })
  autoRedirect = true;

  @state()
  private _tokens: OAuthTokens | null = null;

  @state()
  private _error = "";

  override connectedCallback(): void {
    super.connectedCallback();
    const search = this.callbackSearch ?? globalThis.location?.search ?? "";
    if (parseCallback(search)) void this.#complete(search);
  }

  override render(): TemplateResult {
    if (this.auth?.provider === "none" || this.auth?.required === false) return html``;
    if (this._error) {
      return html`<div class="notice notice--error" data-testid="login-error">${this._error}</div>`;
    }
    if (this._tokens) {
      return html`<span class="user" data-testid="login-user">Signed in</span>`;
    }
    return html`
      <button part="button" data-testid="login-button" @click=${() => void this.#login()}>
        Sign in
      </button>
    `;
  }

  async #login(): Promise<void> {
    if (!this.auth) return;
    const redirect = await beginLogin(this.auth);
    if (!redirect) return;
    emit(this, "tobor-auth-redirect", { url: redirect.url });
    if (this.autoRedirect) globalThis.location.assign(redirect.url);
  }

  async #complete(search: string): Promise<void> {
    if (!this.auth) return;
    try {
      this._tokens = await completeLogin(this.auth, search);
      emit(this, "tobor-auth-token", { tokens: this._tokens });
      // Clean the code out of the address bar / history.
      globalThis.history?.replaceState?.(null, "", globalThis.location?.pathname);
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      emit(this, "tobor-auth-error", { error: this._error });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-login-flow": ToborLoginFlow;
  }
}
