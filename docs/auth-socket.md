# Standard authentication websocket

`<noizu-auth>` connects to `/auth/socket` on its page's host **when `transport` is unset (the default)**. Hosts whose auth API is REST + Bearer tokens can instead set `transport="rest"` and skip this socket entirely — see `web/src/components/auth/docs/backend-requirements.md`. This document describes the socket transport. Existing portfolio
REST auth and Phoenix `/socket` do **not** implement this protocol. Mount the
included `ToborKit.Auth.SocketPlug` in the product's Bandit/Plug application before
its authenticated pipeline, after the product has fetched its pre-login session:

The HTTP login page/bootstrap must first issue a cryptographically random browser
nonce (at least 128 bits of entropy) in a secure, HttpOnly pre-login session.
This must happen before **any** socket connection, including `config` requests.
Do not accept a binding value from browser query parameters or submitted JSON.
A trusted host plug reads the existing session and passes only its opaque binding:

```elixir
# After the product's configured Plug.Session and fetch_session:
plug :bind_auth_browser
plug ToborKit.Auth.SocketPlug,
  handler: MyApp.Auth.ComponentHandler,
  path: "/auth/socket"

defp bind_auth_browser(conn, _) do
  # The preceding HTTP login/bootstrap request created this random nonce.
  binding = Plug.Conn.get_session(conn, :auth_browser_binding)
  Plug.Conn.put_private(conn, :tobor_auth_context, %{browser_binding: binding})
end
```

The adapter does not add an account database or replace the product's auth logic.
A handler module implements `handle_auth(method, params, context)` and returns
`{:ok, result_map}` or `{:error, code, public_message}`. Context contains the validated browser origin, peer IP, and server-resolved
`browser_binding`. The private context must contain exactly that single binary
binding key (16–256 bytes); absent or malformed context rejects upgrade with 403.
The length check does not establish entropy: nonce generation belongs to the host.
Never pass an entire conn, cookie header, account record, or session into this seam. Map existing account operations to this
callback, including the product's cross-connection/IP/account rate limiter and
provider policy. Return safe public errors, never exceptions or credentials.

Each text frame is `{ "version": 1, "id": "request-id", "method": "login",
"params": { "email": "...", "password": "..." } }`. Replies are
`{ "id": "request-id", "result": {...} }` or
`{ "id": "request-id", "error": { "code": "...", "message": "..." } }`.
Supported methods are `config`, `login`, `register`, `magic-link`, `otp-request`,
`otp-verify`, and `sso`. `config` returns `providers: [{id,label?,href?}]`,
`domain_policies` (or `domains`), and optional `methods`. Provider URLs and redirect results must be root-relative paths (no protocol-relative
URLs, backslashes or whitespace). Provider URLs start the
product's server-owned OIDC, OAuth or SAML flow; provider redirects and protocol
credentials never run inside the component.

For therobotplans compatibility, login takes `{email,password}`; registration
uses `{user:{email,password,user_name,first_name,last_name,mobile_phone},invite_token}`;
magic-link and otp-request take `{email}`; otp-verify takes `{email,code}`.
Use the existing product service functions behind `/api/v1/auth/*` with identical
validation, invite redemption, domain policies, pending approval and profile logic.

A websocket cannot set an HttpOnly cookie after upgrade. On successful login or
registration issue a short-lived, single-use handoff code **bound to
`context.browser_binding`** and return
`{redirect:"/auth/session/finish?code=...",user:{...publicFields}}`. The product's
HTTP finish route reads the initiating browser's pre-login session, verifies the
code is bound to its nonce, and only then atomically redeems the code. It rotates
the session identifier, clears the pre-login binding, sets its secure session cookie,
and redirects to profile completion, pending approval, or the intended safe
path. A short expiry and single use alone are insufficient: binding prevents an
attacker from sending their own account's finish URL to another browser (login
CSRF). Apply the product's normal CSRF/session checks to bootstrap and handoff.
The handler and finish route are product integrations, not supplied account
services. Never put access/refresh tokens into the result or browser events;
the adapter rejects known credential keys recursively. Magic links continue
through the product's HTTP verification flow. Do not log frames or handoff codes.

Origins must exactly match the request scheme, host and port. Missing, opaque,
malformed and foreign origins fail closed. For development only, explicitly pass
`development: true, allowed_origins: ["http://localhost:5173"]` when the frontend uses that port and
the backend another on the same scheme and hostname. Foreign hosts and scheme
changes are rejected even if listed. Configure the component's dev port accordingly. Behind a
trusted reverse proxy, normalize scheme/host before this plug using the host's
existing trusted proxy setup; do not trust arbitrary forwarded headers here.

The adapter caps a decoded frame at 16 KiB and 60 requests per connection, closes
idle sockets after 60 seconds, never retains request credentials, and masks
handler exceptions. Configure Bandit's websocket `max_frame_size: 16_384` at
server startup to also bound frame allocation before dispatch. The connection
limit complements, and does not replace, product-level rate limiting.

## Email-first provider discovery

On Continue, the component sends `config` with `{email: "person@example.com"}`.
The handler resolves that address against the host's provider policy and returns
an authoritative `providers`, `domain_policies` and `methods` snapshot. A config
request without an email may return empty provider/method collections until the
visitor submits an address. Discovery chooses a login route, not whether an
account exists; avoid account-existence responses and apply host rate limits.

Example host callback policy (the three provider IDs and routes below must map
to integrations implemented by the consuming application):

```elixir
@routes %{
  "noizu.com" => %{id: "authentik", label: "Continue with Authentik", href: "/auth/authentik/start"},
  "therobotlives.com" => %{id: "google", label: "Continue with Google", href: "/auth/google/start"},
  "therobot.is" => %{id: "github", label: "Continue with GitHub", href: "/auth/github/start"}
}

def handle_auth("config", %{"email" => email}, _context) when is_binary(email) do
  # Use the host's normal email validator before policy lookup. Split the full
  # normalized address; substring/suffix checks must not match lookalike domains.
  case String.split(String.downcase(String.trim(email)), "@") do
    [local, domain] when local != "" and domain != "" ->
      case Map.get(@routes, domain) do
        nil ->
          {:ok, %{providers: [], domain_policies: %{}, methods: ["password"]}}

        provider ->
          {:ok, %{
            providers: [provider],
            domain_policies: %{domain => %{providers: [provider.id]}},
            methods: []
          }}
      end

    _ ->
      {:error, "invalid_email", "Enter a valid email address."}
  end
end

def handle_auth("config", _params, _context),
  do: {:ok, %{providers: [], domain_policies: %{}, methods: []}}
```

These mappings match **exact domains**: `noizu.com.attacker.test`,
`notnoizu.com`, and `sub.noizu.com` do not inherit the `noizu.com` route.
Canonicalization and full email validation belong to the host. Email-code login
can be exposed deliberately by adding `"otp"` to the response's `methods` and
enabling the component option; magic links remain a separate opt-in method.

A domain-mandated provider response must not expose password as a fallback.
The host must enforce the same policy again for `login`, `register`, OTP/magic
link requests, and provider-start routes; browser options are presentation,
not authorization. If the component's provider allowlist hides the required
provider, show unavailable instead of falling back to password.

`href` is always a root-relative route on the host application. That HTTP route
starts the configured OAuth/OIDC or SAML exchange, including its normal CSRF,
state/nonce or SAML request-correlation protections. A provider email hint is
not proof of domain membership; validate the authenticated provider identity
and required organization/domain policy before creating the final session.
This example adds neither live Google/GitHub/Authentik connections nor a SAML
implementation. Those integrations remain host responsibilities.

Email discovery retains the same pre-login `browser_binding` requirement as
all other socket requests. Never accept a binding from `config` params and never
return it in provider metadata. Password session handoff and federated login
must preserve the host's initiating-browser correlation throughout the flow.
