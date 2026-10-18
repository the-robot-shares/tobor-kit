/** Minimal JSON-RPC v1 `/auth/socket` stub for <noizu-auth>. Not production auth.
 * Six-pipe / merge-flow: this stub does not implement `merge_required` — see
 * docs/backend-requirements.md for the `{merge_required, challenge_id, pipes:[{type,masked}]}`
 * contract a real host must add to `login`/`register`/`otp-verify` when the identifier already
 * belongs to an account under a different pipe. */
import http from 'node:http';
import {WebSocketServer} from 'ws';

const METHODS = new Set(['config', 'login', 'register', 'magic-link', 'otp-request', 'otp-verify']);

function domainOf(email) {
  const parts = String(email ?? '').trim().toLowerCase().split('@');
  return parts.length === 2 && parts[0] && parts[1] ? parts[1] : '';
}

/** Toy region check for the demo — real hosts key this off carrier registration status, not a
 * dial-code prefix. */
const SMS_SUPPORTED_DIAL_PREFIXES = ['+1', '+44'];
function smsRegionSupported(mobilePhone) {
  const value = String(mobilePhone ?? '');
  return !value || SMS_SUPPORTED_DIAL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function handleAuthRpc(id, method, params = {}) {
  if (!METHODS.has(method)) return {id, error: {code: 'invalid_request', message: 'Invalid authentication request.'}};
  // Server-side gate — authoritative regardless of the element's client-side `smsRegions`
  // allowlist. See docs/backend-requirements.md's `sms_region_unsupported` contract.
  const mobilePhone = params.user?.mobile_phone ?? params.mobile_phone;
  if ((method === 'login' || method === 'register' || method === 'otp-request') && mobilePhone && !smsRegionSupported(mobilePhone)) {
    return {id, error: {code: 'sms_region_unsupported', message: 'SMS is not currently available for this region.'}};
  }
  if (method === 'config') {
    const domain = domainOf(params.email);
    if (domain === 'noizu.com') {
      return {id, result: {
        providers: [{id: 'authentik', label: 'Continue with Authentik', href: '/auth/authentik/start'}],
        domain_policies: {'noizu.com': {providers: ['authentik']}},
        methods: [],
      }};
    }
    return {id, result: {providers: [], domain_policies: {}, methods: domain ? ['password'] : []}};
  }
  if (method === 'magic-link') return {id, result: {status: 'pending'}};
  if (method === 'otp-request') return {id, result: {}};
  return {id, result: {redirect: '/auth/session/finish?code=one-time-host-code'}};
}

const page = `<!doctype html><meta charset="utf-8">
<noizu-auth endpoint="/auth/socket"></noizu-auth>
<script type="module">
  const release = await fetch('https://cdn.derobot.is/tobor-kit/latest.json', {cache:'no-cache'}).then(r => r.json());
  await import(release.auth);
  const auth = document.querySelector('noizu-auth');
  auth.options = {password: true, signup: true};
</script>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/auth/sms-regions') {
    // Host-owned public config, not part of the /auth/socket RPC surface. Kept in sync with
    // SMS_SUPPORTED_DIAL_PREFIXES above.
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({supported: ['US', 'CA', 'GB'], message: 'SMS is not currently available for this region.'}));
    return;
  }
  if (url.pathname === '/auth/session/finish') {
    // HTTP handoff — the only place a session cookie is set. Never on the websocket.
    res.writeHead(303, {'Set-Cookie': 'host_session=stub; HttpOnly; Path=/; SameSite=Lax', Location: '/app'});
    res.end();
    return;
  }
  if (url.pathname === '/auth/socket') {
    res.writeHead(405).end();
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/html'}).end(page);
});

const wss = new WebSocketServer({server, path: '/auth/socket'});
wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let frame;
    try {frame = JSON.parse(String(raw));} catch {return;}
    if (frame?.version !== 1 || typeof frame.id !== 'string' || typeof frame.method !== 'string') {
      socket.send(JSON.stringify({id: frame?.id ?? null, error: {code: 'invalid_request', message: 'Invalid authentication request.'}}));
      return;
    }
    socket.send(JSON.stringify(handleAuthRpc(frame.id, frame.method, frame.params ?? {})));
  });
});

server.listen(8080);

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
