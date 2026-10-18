# Backend requirements — tobor-mode-toggle

None required.

This island is host-only. It does not call Guide API, auth, or voice routes.
It does not set cookies, redirect, or verify sessions.

Optional: the host may persist `tobor-mode-change` `{mode, previous}` if it
wants to remember the last mode. Persistence is not this element's job.
