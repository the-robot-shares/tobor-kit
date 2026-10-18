/**
 * Invite-interstitial contract helpers ("register open, app gated").
 *
 * Framework-free and side-effect-free: no element is registered by importing
 * this module, so a React/Next/Hologram host can use the 403 handling without
 * loading Lit. The wire contract mirrors `docs/invite-interstitial/PATTERN.md`
 * in the monorepo (the therobotplans pilot):
 *
 *   403 {"error":"invite_required","account_status":"pending","message":"…"}
 *
 * and, for MCP transports that cannot return a JSON body,
 *
 *   403 + WWW-Authenticate: Bearer …, scope="invite_required", error="insufficient_scope"
 */

/** Machine error code a gated account gets from every non-exempt API route. */
export const INVITE_REQUIRED_ERROR = 'invite_required';
/** Default interstitial route (PATTERN.md §7 `INVITE_REQUIRED_PATH`). */
export const DEFAULT_INVITE_REQUIRED_URL = '/auth/invite-required';
/** Default redeem endpoint (PATTERN.md §6). */
export const DEFAULT_INVITE_REDEEM_ENDPOINT = '/api/v1/invites/redeem';
/** Helper copy under the optional invite field on signup forms. */
export const INVITE_OPTIONAL_HINT = 'have an invite? enter it now — otherwise you can add it after signing up.';

/** Thrown by {@link withInviteGate} after it has started the redirect, so callers
 * stop processing the response instead of rendering a generic error. */
export class InviteRequiredError extends Error {
  readonly code = INVITE_REQUIRED_ERROR;
  constructor(readonly url: string, readonly body?: unknown) {
    super('An invite code is required to continue.');
    this.name = 'InviteRequiredError';
  }
}

/** True for the `{"error":"invite_required"}` body (also `{error: {code: "invite_required"}}`). */
export function isInviteRequiredBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const error = (body as {error?: unknown}).error;
  if (error === INVITE_REQUIRED_ERROR) return true;
  return !!error && typeof error === 'object' && (error as {code?: unknown}).code === INVITE_REQUIRED_ERROR;
}

/** True for the MCP-style refusal: `WWW-Authenticate: … scope="invite_required"` (or the
 * same code as `error_description`). */
export function isInviteRequiredChallenge(header: string | null | undefined): boolean {
  if (!header) return false;
  return /(?:scope|error_description)\s*=\s*"?invite_required"?/i.test(header);
}

/** The single API contract for a gated account: a 403 carrying the code in the body or
 * the `WWW-Authenticate` challenge. Any other status is never treated as the gate. */
export function isInviteRequiredResponse(status: number, body?: unknown, wwwAuthenticate?: string | null): boolean {
  return status === 403 && (isInviteRequiredBody(body) || isInviteRequiredChallenge(wwwAuthenticate));
}

/** Signed in but held at the interstitial. The server's `invite_required` flag is
 * authoritative (it already folds in admin and general-release exemptions); a payload
 * without the flag falls back to the pending/waitlist status. */
export function userNeedsInvite(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const flag = (user as {invite_required?: unknown}).invite_required;
  if (typeof flag === 'boolean') return flag;
  const status = (user as {status?: unknown}).status;
  return status === 'pending' || status === 'waitlist';
}

/** Resolve `url` against the page and keep it only when it stays on this origin over
 * http(s) with no embedded credentials; otherwise return `fallback`. */
export function sameOriginUrl(url: string | null | undefined, fallback: string, location: Location | URL = globalThis.location): string {
  const value = (url ?? '').trim();
  if (!value || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const target = new URL(value, location.href);
    if (target.origin !== new URL(location.href).origin || target.username || target.password || !/^https?:$/.test(target.protocol)) return fallback;
    return target.pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}

export interface InviteRedirectOptions {
  /** Interstitial URL. Same-origin only; defaults to {@link DEFAULT_INVITE_REQUIRED_URL}. */
  url?: string;
  /** Navigation seam (tests, SPA routers). Defaults to `location.assign`. */
  navigate?: (url: string) => void;
}

function redirectToInterstitial(options: InviteRedirectOptions = {}): string {
  const url = sameOriginUrl(options.url, DEFAULT_INVITE_REQUIRED_URL);
  // Already on the interstitial: never loop (its own calls may legitimately 403).
  if (globalThis.location && globalThis.location.pathname === new URL(url, globalThis.location.href).pathname) return url;
  (options.navigate ?? ((target: string) => globalThis.location.assign(target)))(url);
  return url;
}

/**
 * Inspect a `fetch` Response and, when it is the invite gate, redirect to the
 * interstitial. Returns `true` when it redirected (the caller should stop), `false`
 * otherwise. Reads a clone, so the caller can still consume the original body.
 *
 * ```ts
 * const res = await fetch('/api/v1/projects', {headers});
 * if (await handleInviteRequired(res)) return;
 * ```
 */
export async function handleInviteRequired(response: Response, options: InviteRedirectOptions = {}): Promise<boolean> {
  if (response.status !== 403) return false;
  const challenge = response.headers.get('www-authenticate');
  let body: unknown;
  try {body = await response.clone().json();} catch {body = undefined;}
  if (!isInviteRequiredResponse(response.status, body, challenge)) return false;
  redirectToInterstitial(options);
  return true;
}

/**
 * Wrap a `fetch` implementation so every invite-gate 403 redirects to the interstitial
 * and rejects with {@link InviteRequiredError}. Every other response passes through
 * untouched.
 *
 * ```ts
 * const apiFetch = withInviteGate(fetch, {url: '/auth/invite-required'});
 * ```
 */
export function withInviteGate(fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args), options: InviteRedirectOptions = {}): typeof fetch {
  return async (...args: Parameters<typeof fetch>) => {
    const response = await fetchImpl(...args);
    if (response.status !== 403) return response;
    let body: unknown;
    try {body = await response.clone().json();} catch {body = undefined;}
    if (!isInviteRequiredResponse(response.status, body, response.headers.get('www-authenticate'))) return response;
    throw new InviteRequiredError(redirectToInterstitial(options), body);
  };
}
