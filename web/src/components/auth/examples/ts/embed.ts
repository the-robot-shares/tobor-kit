/** Typed <noizu-auth> mount plus JSON-RPC v1 handler. Not production auth. */
// Host apps: import {NoizuAuth, type AuthOptions, type AuthText, type AuthPipeConfig} from '@noizu/tobor-kit/auth.js';
import type {AuthMergeChallenge, AuthOptions, AuthPipeConfig, AuthSession, AuthSmsRegions, AuthText, NoizuAuth} from '../../noizu-auth.js';

export interface AuthRpcFrame {
  version: 1;
  id: string;
  method: 'config' | 'login' | 'register' | 'magic-link' | 'otp-request' | 'otp-verify';
  params: Record<string, unknown>;
}

export function mountAuth(el: NoizuAuth): void {
  el.endpoint = '/auth/socket';
  const options: AuthOptions = {password: true, magicLink: false, otp: false, signup: true};
  const text: AuthText = {loginTitle: 'Welcome aboard'};
  el.options = options;
  el.text = text;
  // Client-side UX only — the host handler must reject token-less register too.
  el.inviteTokenMode = 'required';
  el.addEventListener('auth-redirect', (event) => {
    void (event as CustomEvent<{url: string}>).detail.url;
  });
  el.addEventListener('auth-error', (event) => {
    void (event as CustomEvent<{message: string}>).detail.message;
  });
  el.addEventListener('auth-success', () => {});
  el.addEventListener('auth-close', () => {});
}

/** Alternative mount: REST transport. Same element, same events, same markup — the only
 * difference is the wire and the session model. `transport` unset would keep the WebSocket. */
export function mountRestAuth(el: NoizuAuth, adopt: (session: AuthSession) => void): void {
  el.transport = 'rest';
  el.apiBase = '/api/v1';              // same-origin only; foreign origins are refused
  // el.withCredentials = true;        // ONLY for a cookie-session REST backend with its own CSRF token
  el.pipes = ['email_password', 'mobile_otp', 'google', 'github'] satisfies AuthPipeConfig[];
  el.addEventListener('noizu-auth-success', (event) => {
    const {session} = (event as CustomEvent<{session?: AuthSession}>).detail;
    // The component holds no copy and writes nothing to localStorage/sessionStorage.
    // Where this lives (memory, worker, BFF cookie) is the HOST's security decision.
    if (session) adopt(session);
  });
  el.addEventListener('noizu-auth-merge-required', (event) => {
    // Fired for an HTTP 409 {status:"merge_required"} exactly as for the socket reply.
    void (event as CustomEvent<AuthMergeChallenge>).detail.pipes;
  });
  el.addEventListener('noizu-auth-sms-region-unsupported', (event) => {
    // Fired for an HTTP 422 {"error":"sms_region_unsupported"} — same handling as the socket code.
    void (event as CustomEvent<{pipe: string; message: string}>).detail.message;
  });
}

/** Alternative mount: six-pipe dropdown login. Host declares which pipes are enabled — data-driven,
 * never a fixed list baked into the component. */
export function mountDropdownAuth(el: NoizuAuth): void {
  el.endpoint = '/auth/socket';
  el.mode = 'dropdown';
  const pipes: AuthPipeConfig[] = ['email_password', 'mobile_otp', 'google', 'authentik'];
  el.pipes = pipes;
  // Optional: gate mobile_password/mobile_otp to SMS-capable regions. Host-owned public config,
  // not part of the /auth/socket RPC surface — see docs/backend-requirements.md.
  const smsRegions: AuthSmsRegions = {supported: ['US', 'CA', 'GB']};
  el.smsRegions = smsRegions;
  el.addEventListener('noizu-auth-sms-region-unsupported', (event) => {
    void (event as CustomEvent<{pipe: string; message: string}>).detail.message;
  });
  el.addEventListener('noizu-auth-merge-required', (event) => {
    const detail = (event as CustomEvent<AuthMergeChallenge>).detail;
    // detail.pipes[].masked is always masked — never render or store an unmasked identifier.
    void detail.challengeId;
  });
  el.addEventListener('noizu-auth-merge-confirmed', () => {});
  el.addEventListener('noizu-auth-otp-requested', () => {});
}

function domainOf(email: unknown): string {
  const parts = String(email ?? '').trim().toLowerCase().split('@');
  return parts.length === 2 && parts[0] && parts[1] ? parts[1] : '';
}

/** Toy region check for the demo — real hosts key this off carrier registration status, not a
 * dial-code prefix. Matches `smsRegions.supported` above: US/CA share dial code +1, GB is +44. */
const SMS_SUPPORTED_DIAL_PREFIXES = ['+1', '+44'];
function smsRegionSupported(mobilePhone: unknown): boolean {
  const value = String(mobilePhone ?? '');
  return !value || SMS_SUPPORTED_DIAL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function handleAuthRpc(
  frame: AuthRpcFrame,
): {id: string; result?: unknown; error?: {code: string; message: string}} {
  const {id, method, params} = frame;
  // Server-side gate — authoritative regardless of what the element's client-side `smsRegions`
  // allowlist decided. See docs/backend-requirements.md's `sms_region_unsupported` contract.
  // `register` nests the identifier under `user`; login/otp-request/otp-verify keep it top-level.
  const mobilePhone = (params.user as Record<string, unknown> | undefined)?.mobile_phone ?? params.mobile_phone;
  if ((method === 'login' || method === 'register' || method === 'otp-request') && mobilePhone && !smsRegionSupported(mobilePhone)) {
    return {id, error: {code: 'sms_region_unsupported', message: 'SMS is not currently available for this region.'}};
  }
  if (method === 'config') {
    const domain = domainOf(params.email);
    if (domain === 'noizu.com') {
      return {
        id,
        result: {
          providers: [{id: 'authentik', label: 'Continue with Authentik', href: '/auth/authentik/start'}],
          domain_policies: {'noizu.com': {providers: ['authentik']}},
          methods: [],
        },
      };
    }
    return {id, result: {providers: [], domain_policies: {}, methods: domain ? ['password'] : []}};
  }
  if (method === 'magic-link') return {id, result: {status: 'pending'}};
  if (method === 'otp-request') return {id, result: {}};
  return {id, result: {redirect: '/auth/session/finish?code=one-time-host-code'}};
}

/* ---------------------------------------------------------------------------
 * REST transport option (`transport="rest"`) — the same element, a different wire.
 * Most portfolio apps already expose a JSON auth API with Bearer-token sessions instead of
 * this WebSocket. Mount the element with transport="rest" api-base="/api/v1" and implement:
 *
 *   POST {apiBase}/auth/login                  {email, password}
 *   POST {apiBase}/auth/register               {user: {email, password, user_name, first_name, last_name, mobile_phone?}, invite_token?}
 *   POST {apiBase}/auth/mobile/login           {mobile, password}
 *   POST {apiBase}/auth/mobile/register        {mobile, password, code, user_name?}
 *   POST {apiBase}/auth/otp/email/start        {email}                      -> 202 {status:'sent'}
 *   POST {apiBase}/auth/otp/mobile/start       {mobile}                     -> 202 {status:'sent'}
 *   POST {apiBase}/auth/otp/email/verify       {email, code}
 *   POST {apiBase}/auth/otp/mobile/verify      {mobile, code}
 *   GET  {apiBase}/auth/merge/:challenge_id    -> masked description
 *   POST {apiBase}/auth/merge/confirm          {challenge_id, proof:{pipe, identifier, password|code}}
 *   GET  {apiBase}/auth/config                 optional; any failure degrades to no providers
 *
 * Success (200 existing / 201 created):
 *   {user, organizations, access_token, refresh_token, expires_in}
 * Merge challenge: HTTP 409
 *   {status:'merge_required', merge_challenge_id, expires_at,
 *    available_pipes:[{pipe:'password_email', identifier:'g******@gmail.com'}]}
 *   Backend pipe names (password_email / otp_mobile) map to the element's
 *   email_password / mobile_otp. `identifier` MUST already be masked.
 * Region not SMS-deliverable: HTTP 422 {"error":"sms_region_unsupported"}
 *   (the 422 analogue of this socket's error.code of the same name).
 * Other errors: {"error":"<code>"} + status — invalid_credentials, invalid_code,
 *   expired_code, too_many_attempts, rate_limited, pipe_not_permitted,
 *   merge_not_authorized, not_found, invalid_identifier, invalid_password.
 *
 * The element sends NO cookies in REST mode (credentials: "omit") unless
 * with-credentials is set, and it NEVER stores the returned tokens — they arrive
 * on auth-success / noizu-auth-success as event.detail.session and the host decides
 * where they live. See docs/backend-requirements.md.
 */
