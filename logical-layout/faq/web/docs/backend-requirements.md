# Backend requirements — noizu-faq

None required.

`<noizu-faq>` is a host-only Light DOM island. It does not call a server, set cookies, or verify session. The host supplies `<details>` / `<summary>` children.

The island does **not** redirect, issue `Set-Cookie`, take payment, or perform CSRF. It carries no secrets.

Optional: listen for `faq-toggle` (`{open, index}`) if the host wants analytics or persistence. That work stays in the host.

No production tree in `elixir/`, `go/`, or `backend/`. The `examples/` snippets only show how to serve a page that mounts the tag.
