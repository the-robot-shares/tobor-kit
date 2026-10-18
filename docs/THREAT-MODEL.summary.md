# THREAT-MODEL (summary)

Library threat model — hosts own the perimeter. Detail: [`THREAT-MODEL.md`](THREAT-MODEL.md).

- **Crown jewels**: OIDC/PKCE auth handling, LLM provider creds (egress),
  voice-token endpoint, CDN lit bundle (supply chain).
- **Boundaries**: internet ↔ host site ↔ kit components ↔ Guide API ↔
  LLM/OIDC egress.
- **Register** (9 items): T-001 OIDC token+nonce verify (mitigated);
  T-002 socket origin fail-closed (mitigated); T-003 handoff nonce/CSRF
  (partial — host obligation); T-004 no tokens in browser events
  (mitigated); T-005 volatile ETS sessions (accepted); T-006 endpoint rate
  limiting (open — host); T-007 CDN publish supply chain (partial);
  T-008 account-existence oracle (open — host); T-009 telemetry consent
  (partial).
- **Coverage**: 4 mitigated · 3 partial · 2 open; open/partial items are
  documented host obligations (auth-socket.md) — kit fails closed where it
  acts.
- **Detail docs**: threats/attack-surface.md, threats/authn-authz.md.
