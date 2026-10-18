# Backend requirements — noizu-phone-input

None required.

`<noizu-phone-input>` is a host-only Shadow DOM island. It does not call a server, set cookies, or verify session. E.164 normalize is in-kit (`+<dial><national-digits>`); there is no libphonenumber-js and no carrier lookup.

The island does **not** redirect, issue `Set-Cookie`, take payment, or perform CSRF. It carries no secrets.

Host-owned (not this element):

- Uniqueness of the phone number
- OTP / SMS verification
- Persistence of `phone-change` / `country-change`
- Server-side E.164 validation if the host needs stricter per-country length than ITU 8–15 digits

Optional: listen for `phone-change` `{value}`, `phone-invalid` `{value}`, and `country-change` `{country, dial}` if the host wants analytics or to POST the E.164 string. That work stays in the host.

No production tree in `elixir/`, `go/`, or `backend/`. The `examples/` snippets only show how to serve a page that mounts the tag (and optionally echo events).
