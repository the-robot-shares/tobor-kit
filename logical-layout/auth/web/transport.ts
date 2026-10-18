/** A rejected `AuthSocket.request()` carries the server's public `error.code` (when present)
 * alongside the human-readable `message`, so callers can branch on specific codes (e.g.
 * `sms_region_unsupported`) without parsing message text. */
export class AuthRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthRequestError';
    this.code = code;
  }
}

/** Same-host, request-correlated authentication WebSocket protocol v1. */
export function authSocketUrl(endpoint = '/auth/socket', development = false, devPort?: number, location = globalThis.location): string {
  if (!location || !/^https?:$/.test(location.protocol)) throw new Error('Authentication requires an HTTP(S) page.');
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || endpoint.includes('\\')) throw new Error('Authentication endpoint must be a same-host absolute path.');
  const url = new URL(endpoint, location.href);
  if (url.origin !== location.origin || url.username || url.password || url.hash) throw new Error('Invalid authentication endpoint.');
  if (devPort !== undefined) {
    if (!development || !Number.isInteger(devPort) || devPort < 1 || devPort > 65535) throw new Error('A valid port override requires development mode.');
    url.port = String(devPort);
  }
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

export class AuthSocket {
  private socket?: WebSocket;
  private sequence = 0;
  private pending = new Map<string, {resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  constructor(private url: string, private timeout = 15000) {}
  request<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.socket) this.connect();
    const socket = this.socket!;
    const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(new Error('Authentication request timed out.'));}, this.timeout);
      this.pending.set(id, {resolve, reject, timer});
      const send = () => {
        if (!this.pending.has(id)) return;
        try {socket.send(JSON.stringify({version: 1, id, method, params}));}
        catch {this.fail(id, new Error('Authentication connection failed.'));}
      };
      if (socket.readyState === WebSocket.OPEN) send();
      else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener('open', send, {once: true});
      else this.fail(id, new Error('Authentication connection is closed.'));
    });
  }
  close() {
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
    for (const id of this.pending.keys()) this.fail(id, new Error('Authentication connection closed.'));
  }
  private fail(id: string, error: Error) {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(id); pending.reject(error);
  }
  private connect() {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      let message;
      try {message = JSON.parse(event.data);} catch {return;}
      if (!message || typeof message.id !== 'string') return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.error) {
        const code = typeof message.error.code === 'string' ? message.error.code : undefined;
        this.fail(message.id, new AuthRequestError(typeof message.error.message === 'string' ? message.error.message : 'Authentication failed.', code));
        return;
      }
      clearTimeout(pending.timer); this.pending.delete(message.id); pending.resolve(message.result);
    });
    const disconnected = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      for (const id of this.pending.keys()) this.fail(id, new Error('Authentication connection lost.'));
    };
    socket.addEventListener('close', disconnected);
    socket.addEventListener('error', disconnected);
  }
}

/* ============================================================================
 * Transport contract
 * ==========================================================================*/

/** The only surface `<noizu-auth>` uses. Both transports implement it, so the
 * element's state machine never learns which wire protocol is underneath.
 *
 * `request` resolves with a *normalized result object* (never an HTTP envelope)
 * and rejects with an {@link AuthRequestError} carrying a public `code`. Every
 * transport must normalize to the same result vocabulary:
 *
 * | result | meaning |
 * |---|---|
 * | `{merge_required: true, challenge_id, pipes: [{type, masked}]}` | identifier already belongs to an account |
 * | `{authenticated: true, session?}` | session established (`session` only when the transport owns tokens) |
 * | `{merge_confirmed: true, ...}` | merge confirmed |
 * | `{redirect: "/…"}` | same-origin HTTP handoff |
 * | `{status: "pending" \| "sent"}` | nothing more to render yet |
 */
export interface AuthTransport {
  request<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
}

/** Selects which implementation `<noizu-auth>` builds. `"socket"` is the default
 * and is what every pre-existing consumer gets without changing anything. */
export type AuthTransportKind = 'socket' | 'rest';

/** Bearer-token session, produced only by {@link RestTransport}. The component
 * hands this straight to the host on `noizu-auth-success` / `auth-success` and
 * **never** persists it — storage is the host's decision. */
export interface AuthSession {
  tokenType: 'Bearer';
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: unknown;
  organizations?: unknown;
}

/** Named alias for the WebSocket transport. Identical to {@link AuthSocket} —
 * exported so hosts and docs can name the two implementations symmetrically
 * without changing a single line of the socket's behaviour. */
export class SocketTransport extends AuthSocket {}

/* ============================================================================
 * REST transport
 * ==========================================================================*/

export interface RestTransportOptions {
  /** Same-origin base for the JSON auth API, e.g. `/api/v1`. */
  apiBase?: string;
  /** Send cookies with auth calls. Default `false` → `credentials: "omit"`. */
  withCredentials?: boolean;
  /** Per-request timeout, ms. Matches the socket transport's default. */
  timeout?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  location?: Location;
}

/** Validates and normalizes the REST base the same way {@link authSocketUrl}
 * validates the socket endpoint: same-host absolute path (or a same-origin
 * absolute URL). A foreign origin is refused — this element never posts
 * credentials off-host. Returns a base with no trailing slash. */
export function authRestBase(apiBase = '/api/v1', location = globalThis.location): string {
  if (!location || !/^https?:$/.test(location.protocol)) throw new Error('Authentication requires an HTTP(S) page.');
  if (apiBase.includes('\\') || apiBase.startsWith('//')) throw new Error('Authentication API base must be a same-host absolute path.');
  if (!apiBase.startsWith('/') && !/^https?:\/\//.test(apiBase)) throw new Error('Authentication API base must be a same-host absolute path.');
  const url = new URL(apiBase, location.href);
  if (url.origin !== location.origin || url.username || url.password || url.hash || url.search) throw new Error('Invalid authentication API base.');
  return url.href.replace(/\/+$/, '');
}

/** Backend pipe vocabulary (`password_email`) → this element's (`email_password`). */
const REST_PIPE_TO_COMPONENT: Record<string, string> = {
  password_email: 'email_password', password_mobile: 'mobile_password',
  otp_email: 'email_otp', otp_mobile: 'mobile_otp',
};
/** The inverse, for `POST /auth/merge/confirm`'s `proof.pipe`. */
const COMPONENT_PIPE_TO_REST: Record<string, string> = {
  email_password: 'password_email', mobile_password: 'password_mobile',
  email_otp: 'otp_email', mobile_otp: 'otp_mobile',
};

/** Public copy for the backend's bare `{"error": "<code>"}` bodies. The REST API
 * returns a code and no prose; the socket API returns both. Rendering the same
 * sentence for the same condition is what makes the two transports
 * indistinguishable in the UI. */
const REST_ERROR_COPY: Record<string, string> = {
  invalid_identifier: 'Enter a valid email address or mobile number.',
  invalid_credentials: 'That email or password is not correct.',
  invalid_password: 'Choose a password of at least 8 characters.',
  invalid_code: 'That verification code is not correct.',
  expired_code: 'That verification code has expired. Request a new one.',
  too_many_attempts: 'Too many attempts. Try again later.',
  rate_limited: 'Too many requests. Try again in a few minutes.',
  pipe_not_permitted: 'That sign-in method is not available for this account.',
  merge_not_authorized: 'We could not confirm that account. Try another way to sign in.',
  not_found: 'That request is no longer valid. Start again.',
  sms_region_unsupported: 'SMS is not currently available for this region.',
  invalid_request: 'Authentication could not be completed.',
  network_error: 'Authentication connection failed.',
  unsupported_method: 'That sign-in method is not available over this transport.',
};
const GENERIC_REST_ERROR = 'Authentication could not be completed.';

/** JSON/REST authentication transport for hosts whose auth API is
 * `POST /api/v1/auth/*` with Bearer-token sessions (the therobotplans-family
 * contract). Speaks the same {@link AuthTransport} vocabulary as
 * {@link SocketTransport}, so `<noizu-auth>`'s state machine is unchanged.
 *
 * Cookies are **omitted** by default (`credentials: "omit"`): a Bearer API needs
 * no ambient session, and sending one would make every unauthenticated auth POST
 * a cross-site-request-forgery target that the API cannot distinguish from a
 * first-party call. Hosts running a cookie-session REST backend opt back in with
 * `withCredentials` and must then supply their own CSRF defence. */
export class RestTransport implements AuthTransport {
  private readonly base: string;
  private readonly credentials: RequestCredentials;
  private readonly timeout: number;
  private readonly fetchImpl: typeof fetch;
  private controllers = new Set<AbortController>();
  private closed = false;

  constructor(options: RestTransportOptions = {}) {
    this.base = authRestBase(options.apiBase ?? '/api/v1', options.location ?? globalThis.location);
    this.credentials = options.withCredentials ? 'include' : 'omit';
    this.timeout = options.timeout ?? 15000;
    this.fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  }

  close() {
    this.closed = true;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async request<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    switch (method) {
      case 'config': return (await this.config()) as T;
      case 'login': return (await this.login(params)) as T;
      case 'register': return (await this.register(params)) as T;
      case 'otp-request': return (await this.otpStart(params)) as T;
      case 'otp-verify': return (await this.otpVerify(params)) as T;
      case 'merge-describe': return (await this.describeMerge(String(params.challenge_id ?? ''))) as T;
      case 'merge-confirm': return (await this.mergeConfirm(params, params.code ? 'otp' : 'password')) as T;
      case 'magic-link':
        throw new AuthRequestError(REST_ERROR_COPY.unsupported_method, 'unsupported_method');
      default:
        throw new AuthRequestError(REST_ERROR_COPY.unsupported_method, 'unsupported_method');
    }
  }

  // ---- endpoint methods -----------------------------------------------------

  /** The REST contract defines no discovery endpoint; a host may still publish
   * one at `{apiBase}/auth/config`. Any failure degrades to `{}` (no providers,
   * no domain policy) rather than blocking the form — discovery is advisory and
   * the server re-enforces policy on every submit anyway. */
  private async config(): Promise<Record<string, unknown>> {
    try {return await this.send('GET', '/auth/config');} catch {return {};}
  }

  private async login(params: Record<string, unknown>) {
    if (params.merge_challenge_id) return this.mergeConfirm(params, 'password');
    const mobile = this.mobileOf(params);
    return mobile
      ? this.send('POST', '/auth/mobile/login', {mobile, password: params.password})
      : this.send('POST', '/auth/login', {email: params.email, password: params.password});
  }

  private async register(params: Record<string, unknown>) {
    const user = (params.user as Record<string, unknown>) ?? params;
    const mobile = this.mobileOf(user) ?? this.mobileOf(params);
    if (mobile && !user.email) {
      return this.send('POST', '/auth/mobile/register', {
        mobile, password: user.password, code: user.code ?? params.code,
        user_name: user.user_name,
      });
    }
    // Mirrors the socket register params 1:1: nested `user` (with `mobile_phone`), invite_token top-level.
    return this.send('POST', '/auth/register', {
      user: {
        email: user.email, password: user.password, user_name: user.user_name,
        first_name: user.first_name, last_name: user.last_name,
        mobile_phone: mobile ?? undefined,
      },
      invite_token: params.invite_token,
    });
  }

  private async otpStart(params: Record<string, unknown>) {
    const mobile = this.mobileOf(params);
    return mobile
      ? this.send('POST', '/auth/otp/mobile/start', {mobile})
      : this.send('POST', '/auth/otp/email/start', {email: params.email});
  }

  private async otpVerify(params: Record<string, unknown>) {
    if (params.merge_challenge_id) return this.mergeConfirm(params, 'otp');
    const mobile = this.mobileOf(params);
    return mobile
      ? this.send('POST', '/auth/otp/mobile/verify', {mobile, code: params.code})
      : this.send('POST', '/auth/otp/email/verify', {email: params.email, code: params.code});
  }

  private async describeMerge(challengeId: string) {
    return this.send('GET', `/auth/merge/${encodeURIComponent(challengeId)}`);
  }

  private async mergeConfirm(params: Record<string, unknown>, kind: 'password' | 'otp') {
    const mobile = this.mobileOf(params);
    const componentPipe = `${mobile ? 'mobile' : 'email'}_${kind === 'otp' ? 'otp' : 'password'}`;
    const proof: Record<string, unknown> = {
      pipe: COMPONENT_PIPE_TO_REST[componentPipe] ?? componentPipe,
      identifier: mobile ?? params.email,
    };
    if (kind === 'otp') proof.code = params.code; else proof.password = params.password;
    const result = await this.send('POST', '/auth/merge/confirm', {challenge_id: params.merge_challenge_id, proof});
    return result.merge_required ? result : {...result, merge_confirmed: true};
  }

  // ---- wire -----------------------------------------------------------------

  private mobileOf(source: Record<string, unknown>): string | undefined {
    const value = source.mobile_phone ?? source.mobile;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private async send(httpMethod: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<any> {
    if (this.closed) throw new AuthRequestError('Authentication connection is closed.', 'closed');
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), this.timeout);
    let response: Response;
    try {
      response = await this.fetchImpl(this.base + path, {
        method: httpMethod,
        credentials: this.credentials,
        signal: controller.signal,
        headers: httpMethod === 'POST'
          ? {'content-type': 'application/json', accept: 'application/json'}
          : {accept: 'application/json'},
        body: httpMethod === 'POST' ? JSON.stringify(prune(body ?? {})) : undefined,
      });
    } catch (error) {
      const aborted = (error as Error)?.name === 'AbortError';
      throw new AuthRequestError(
        aborted ? 'Authentication request timed out.' : REST_ERROR_COPY.network_error,
        aborted ? 'timeout' : 'network_error',
      );
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
    return this.interpret(response, await readJson(response));
  }

  private interpret(response: Response, body: any): any {
    if (response.status === 409 || body?.status === 'merge_required') return mergeResult(body);
    if (!response.ok) {
      const code = typeof body?.error === 'string' ? body.error
        : typeof body?.error?.code === 'string' ? body.error.code
        : `http_${response.status}`;
      const message = typeof body?.message === 'string' ? body.message
        : typeof body?.error?.message === 'string' ? body.error.message
        : REST_ERROR_COPY[code] ?? GENERIC_REST_ERROR;
      throw new AuthRequestError(message, code);
    }
    return sessionResult(body ?? {});
  }
}

/** `{"error": "..."}` bodies that are not JSON at all (an HTML 502 page, an
 * empty 500) still have to produce the same `AuthRequestError` shape, so a parse
 * failure resolves to `undefined` and the status code carries the meaning. */
async function readJson(response: Response): Promise<any> {
  let text: string;
  try {text = await response.text();} catch {return undefined;}
  if (!text) return undefined;
  try {return JSON.parse(text);} catch {return undefined;}
}

/** HTTP 409 `{"status": "merge_required", …}` → the exact object the socket
 * transport produces for the same condition, so the element's state machine and
 * `noizu-auth-merge-required` payload are transport-agnostic. Identifiers stay
 * masked: they are copied verbatim from the server. */
function mergeResult(body: any) {
  const pipes = Array.isArray(body?.available_pipes) ? body.available_pipes : [];
  return {
    merge_required: true,
    challenge_id: body?.merge_challenge_id ?? body?.challenge_id,
    expires_at: body?.expires_at,
    pipes: pipes.map((entry: any) => ({
      type: REST_PIPE_TO_COMPONENT[entry?.pipe] ?? entry?.pipe,
      masked: entry?.identifier,
    })),
  };
}

/** A §7.2 session body → `{authenticated: true, session}`. The session is carried
 * in its own key (not spread over the result) so the element can emit it without
 * ever guessing which top-level field of an arbitrary result is a token. */
function sessionResult(body: any) {
  if (body?.redirect) return body;
  if (body?.status && !body?.access_token) return body;
  if (!body?.access_token) return body;
  const session: AuthSession = {
    tokenType: 'Bearer',
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    user: body.user,
    organizations: body.organizations,
  };
  return {...body, authenticated: true, session};
}

function prune(body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}
