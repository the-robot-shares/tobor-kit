# Backend requirements — tobor-configurator

None required.

`<tobor-configurator>` is a host-only Shadow DOM island. It does not call Guide API, auth, or voice routes. It does not set cookies, redirect, take payment, or perform CSRF. It carries no secrets.

Optional `schema-src` is a JSON GET the host already publishes (static file or existing catalog). The island fetches with `credentials: 'omit'` so session cookies are never attached. Do not put tokens in the schema document.

The island does **not** insert the configured tag into the host page. Listen for `configurator-apply` `{tag, attributes, slots}` if the host wants to mount or persist the result.

No production tree in `elixir/`, `go/`, or `backend/`. The `examples/` snippets only show how to serve a page that mounts the tag.
