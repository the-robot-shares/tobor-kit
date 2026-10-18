# Backend requirements — noizu-footer-brand

None. Host-only presentational island.

No endpoints, no auth, no storage, no events. The element does not call any
API, set cookies, redirect, or verify sessions. The brand link navigates via
the browser's normal anchor handling; the host owns the destination
(`href`) and any analytics around it.

Host-owned (optional): nothing. There is no state to persist and no event to
forward. If a host wants click tracking, it can add its own listener on the
anchor inside `::part(link)` shadow DOM or wrap the island — that is host
code, not a component contract.
