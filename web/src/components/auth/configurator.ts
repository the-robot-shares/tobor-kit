import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-auth',
  group: 'auth',
  importPath: 'components/auth/noizu-auth.js',
  demoHtml:
    '<noizu-auth mode="interstitial" endpoint="/auth/socket"><strong slot="brand">My product</strong></noizu-auth>',
  backend: 'auth',
  fields: [
    {
      attr: 'mode',
      type: 'select',
      options: ['interstitial', 'modal', 'dropdown'],
      default: 'interstitial',
      description:
        'Page card, native <dialog>, or an anchored non-modal popover (dropdown). Per spec: signup uses modal, login uses dropdown — the flow-toggle switches mode automatically when it started as dropdown.',
    },
    {
      attr: 'flow',
      type: 'select',
      options: ['login', 'signup'],
      default: 'login',
    },
    {
      attr: 'layout',
      type: 'select',
      options: ['console', 'tabs'],
      default: 'console',
      description:
        "Arrangement of the surface. 'console' (the default) is the portfolio-standard sign-in console: social providers as icon buttons, an 'or' rule, an email|mobile segmented toggle when both password pipes are enabled, the credential form, then the one-time-code pipes as text links and a footer offering the opposite flow. 'tabs' is the original flat row of pipe buttons, kept as an opt-out for a host built around it. Applies to the pipes surface and to the legacy options flow.",
    },
    {
      attr: 'custom-method',
      type: 'boolean',
      default: false,
      description:
        "Host-provided sign-in. Keeps the card chrome (brand/footer slots, per-flow title, close, dialog/dropdown/interstitial shells, Escape, auth-close) and renders the method-login / method-signup (alias method-register) slot for the current flow, falling back to method, in place of every built-in pipe. Makes no network request and mounts no human-verify element. Finish with complete(detail) / fail(error); slotted content switches flow by dispatching auth-flow-switch {flow}. pipes = ['custom'] is equivalent.",
    },
    {
      attr: 'invite-token-mode',
      type: 'select',
      options: ['optional', 'required', 'hidden'],
      default: 'optional',
      description:
        "Signup invite-token policy. 'optional' (default) renders today's optional field. 'required' marks the field required and blocks empty submits client-side (UX only — the server stays authoritative). 'hidden' removes the field and the invite_token register param. Invalid values resolve to 'optional' (attribute preserved). text.invite overrides the mode-derived label in every rendering mode. Setting 'optional' explicitly (attribute or property) opts into the invite interstitial: a hint under the field (text.inviteHint) and routing of an invite_required signup to invite-required-url.",
    },
    {
      attr: 'invite-required-url',
      type: 'string',
      default: '/auth/invite-required',
      description:
        "Invite interstitial route. With an explicit invite-token-mode=\"optional\", a signup the backend answers with invite_required (the error code, never prose, or user.invite_required on success) emits the cancelable noizu-auth-invite-required and navigates here instead of rendering an error; auth-success fires first so REST hosts can store the session. Same-origin only; empty turns the routing off.",
    },
    {
      attr: 'open',
      type: 'boolean',
      default: false,
      description: 'Opens the modal. Ignored for interstitial.',
    },
    {
      attr: 'endpoint',
      type: 'string',
      default: '/auth/socket',
      description: 'Same-host absolute path. Never a foreign URL.',
    },
    {
      attr: 'transport',
      type: 'select',
      options: ['socket', 'rest'],
      group: 'connection',
      description:
        "Wire protocol. Omitted (the default) = the same-host authentication WebSocket at `endpoint` — unchanged behaviour for every existing consumer. 'rest' = JSON `POST {apiBase}/auth/*` with Bearer-token sessions (the /api/v1 portfolio contract); the component then emits the session on auth-success/noizu-auth-success and stores nothing itself.",
    },
    {
      attr: 'api-base',
      type: 'string',
      default: '/api/v1',
      group: 'connection',
      description:
        'REST transport only. Same-origin absolute path for the JSON auth API; a foreign origin is refused. Ignored when transport is socket.',
    },
    {
      attr: 'with-credentials',
      type: 'boolean',
      default: false,
      group: 'connection',
      description:
        'REST transport only. Off by default so auth calls use credentials: "omit" — a Bearer API needs no ambient cookie, and sending one would make every unauthenticated auth POST a CSRF target. Enable only for a cookie-session REST backend that runs its own CSRF defence.',
    },
    {
      attr: 'development',
      type: 'boolean',
      default: false,
      group: 'connection',
      description: 'Required before a dev-port override.',
    },
    {
      attr: 'dev-port',
      type: 'number',
      group: 'connection',
      description: 'Same host and scheme; only the port changes. Requires development.',
    },
    {
      attr: 'options',
      type: 'json',
      propertyOnly: true,
      default: {password: true, magicLink: false, otp: false, signup: true},
      description: 'UI allowlist. The backend must enforce methods and providers.',
    },
    {
      attr: 'text',
      type: 'json',
      propertyOnly: true,
      default: {},
      description: 'Partial AuthText labels. Not an HTML attribute.',
    },
    {
      attr: 'avatar',
      type: 'json',
      propertyOnly: true,
      description: '{src, alt}. alt is required; empty string is decorative.',
    },
    {
      attr: 'pipes',
      type: 'json',
      propertyOnly: true,
      group: 'pipes',
      description:
        "Data-driven pipe allowlist: an array drawn from the seven pipes ('email_password' | 'mobile_password' | 'email_otp' | 'mobile_otp' | 'google' | 'authentik' | 'github', or {id, label}). Undefined preserves the legacy options-driven password/magic-link/otp flow unchanged; setting it switches to the pipe selector, per-pipe forms, and merge-flow states.",
    },
    {
      attr: 'sms-regions',
      type: 'json',
      propertyOnly: true,
      group: 'pipes',
      description:
        'Optional {supported: string[], message?} SMS-region allowlist for the mobile_password/mobile_otp pipes. `supported` is a list of ISO-3166 alpha-2 country codes (same vocabulary as <noizu-phone-input> `country`). Undefined disables all region gating (additive, backwards compatible). Region is derived from the phone-input\'s own country selection — never a second country table. The server is still authoritative: a `sms_region_unsupported` error on submit renders the server message in the same inline slot regardless of the client-side check.',
    },
  ],
  slots: ['avatar', 'brand', 'footer', 'trigger', 'method', 'method-login', 'method-signup', 'method-register'],
  events: [
    {
      name: 'noizu-auth-invite-required',
      detail: "{url: string, source: 'register' | 'register-error'}",
      description:
        'Explicit invite-token-mode="optional" only. A signup was held for an invite; fires after auth-success (when the account was created) and before navigating to invite-required-url. Cancelable.',
    },
    {
      name: 'auth-success',
      detail: '{session?: AuthSession}',
      description:
        'Socket transport: `{}` — the session is a host cookie and the element never echoes credentials. REST transport: `{session: {tokenType: "Bearer", accessToken, refreshToken, expiresIn, user, organizations}}`, because that backend returns tokens and the host — not this element — decides where they are stored.',
    },
    {
      name: 'auth-error',
      detail: '{message: string}',
      description: 'Public error copy. No credentials.',
    },
    {name: 'auth-close', detail: '{}', description: 'Modal or dropdown dismissed.'},
    {
      name: 'auth-redirect',
      detail: '{url: string}',
      description: 'Same-origin handoff or provider start URL, before location.assign.',
    },
    {
      name: 'noizu-auth-submit',
      detail: '{pipe: string, flow: "login" | "signup"}',
      description: 'A pipe form (or SSO redirect) was submitted. `pipes` mode only.',
    },
    {
      name: 'noizu-auth-success',
      detail: '{session?: AuthSession}',
      description: 'Additive alias of auth-success, fired alongside it with the identical payload. `pipes` mode only.',
    },
    {
      name: 'noizu-auth-error',
      detail: '{message: string}',
      description: 'Additive alias of auth-error, fired alongside it. `pipes` mode only.',
    },
    {
      name: 'noizu-auth-merge-required',
      detail: '{challengeId: string, pipes: Array<{type: string, masked: string}>}',
      description:
        'Backend reported the identifier already belongs to an account. `masked` is always a masked identifier — never render or assume an unmasked one.',
    },
    {
      name: 'noizu-auth-merge-confirmed',
      detail: '{challengeId?: string}',
      description: 'The user authenticated via one of the account\'s existing pipes and the merge was confirmed.',
    },
    {
      name: 'noizu-auth-otp-requested',
      detail: '{pipe: string}',
      description: 'An OTP code was requested for email_otp or mobile_otp; the component now awaits the code.',
    },
    {
      name: 'noizu-auth-flow-change',
      detail: '{flow: "login" | "signup"}',
      description: 'custom-method only. The flow changed via the footer link, an auth-flow-switch event from slotted content, or the flow property.',
    },
    {
      name: 'noizu-auth-sms-region-unsupported',
      detail: '{pipe: string, message: string}',
      description:
        'The server rejected a mobile-pipe submit with error.code "sms_region_unsupported" (this element\'s WebSocket-transport analogue of an HTTP 422). `smsRegions`/`pipes` mode only.',
    },
  ],
  cssVariables: [
    {name: '--auth-color', default: '#20232c'},
    {name: '--auth-font', default: 'system-ui, sans-serif'},
    {name: '--auth-background', default: '#fff'},
    {name: '--auth-page-background', default: '#f5f6f8'},
    {name: '--auth-page-height', default: '100dvh'},
    {name: '--auth-width', default: '26rem'},
    {name: '--auth-padding', default: '2rem'},
    {name: '--auth-border', default: '#dddfe5'},
    {name: '--auth-radius', default: '1rem'},
    {name: '--auth-shadow', default: '0 12px 40px #0001'},
    {name: '--auth-muted', default: '#606575'},
    {name: '--auth-input-background', default: '#fff'},
    {name: '--auth-button-background', default: '#fff'},
    {name: '--auth-accent', default: '#3759bb'},
    {name: '--auth-on-accent', default: '#fff'},
    {name: '--auth-focus', default: '#567ded'},
    {name: '--auth-error', default: '#a4262c'},
    {name: '--auth-backdrop', default: '#12172399'},
    {name: '--auth-avatar-size', default: '7rem'},
    {name: '--auth-avatar-right', default: '-1rem'},
    {name: '--auth-avatar-top', default: '-4rem'},
    {name: '--auth-dropdown-gap', default: '.5rem'},
    {name: '--auth-dropdown-z', default: '20'},
    {name: '--auth-dropdown-shadow', default: '0 12px 32px #0002'},
    {name: '--auth-sms-region-color', default: '#8a5a00'},
  ],
  methods: [
    {
      name: 'complete',
      args: 'detail?: Record<string, unknown>',
      description: 'Fires auth-success and noizu-auth-success with detail unchanged, then closes a modal or dropdown. For custom-method hosts finishing their own sign-in.',
    },
    {
      name: 'fail',
      args: 'error: string | Error | {message?: string; code?: string}',
      description: 'Shows the message in the auth-error region and fires auth-error / noizu-auth-error with {message, code?}. Does not close.',
    },
  ],
};

export const configurators: ConfiguratorSchema[] = [configurator];
