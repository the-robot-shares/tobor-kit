# Publish `@noizu/tobor-kit` to Verdaccio

Registry: **Verdaccio** at `https://npm.noizu.com`. Push with `npm publish`. Pull with `npm install @noizu/tobor-kit`. Do **not** publish to registry.npmjs.org.

This package is the tobor-kit web surface (guide panel, voice, transcript, MCP) plus portfolio islands (`./waitlist`, `./cookie`, `./faq`). `@noizu/lit@0.1.1` on the same registry is the earlier islands-only tarball; new work publishes here.

`package.json` already points npm at Verdaccio:

```json
"publishConfig": {
  "registry": "https://npm.noizu.com",
  "access": "public"
}
```

`access: public` only stops npm treating a scoped name as “restricted on npmjs”. The registry itself is private.

---

## Auth (never print the token)

| Env | dc path |
|---|---|
| `NPM_TOKEN` | `secrets npm.verdaccio_token` |

```bash
export NPM_TOKEN="$(dc get secrets npm.verdaccio_token --reveal --raw 2>/dev/null)"
```

Do not `echo` / `printenv` / paste the value. `unset NPM_TOKEN` when finished.

User `.npmrc` (npm expands `${NPM_TOKEN}` at request time):

```ini
@noizu:registry=https://npm.noizu.com/
//npm.noizu.com/:_authToken=${NPM_TOKEN}
```

Same two lines for apps that install `@noizu/tobor-kit`. If Verdaccio 401s on GET, add `always-auth=true`.

---

## Push

From `web/` in this repo:

```bash
npm test
npm run lint

# Verdaccio rejects a version that already exists — bump if you are republishing.
npm version patch --no-git-tag-version   # or minor / major

export NPM_TOKEN="$(dc get secrets npm.verdaccio_token --reveal --raw 2>/dev/null)"
npm publish
unset NPM_TOKEN
```

`prepublishOnly` runs `npm run build` so `dist/` is what consumers import.

---

## Pull

```bash
npm view @noizu/tobor-kit --registry https://npm.noizu.com version
npm install @noizu/tobor-kit lit
```

```js
import '@noizu/tobor-kit';
// registers guide tags and portfolio islands
import '@noizu/tobor-kit/waitlist';
```

CI/Docker already inject `NPM_TOKEN` from `dc: secrets npm.verdaccio_token`. Do not commit a filled `_authToken`.

---

## Do not

- Publish to `registry.npmjs.org`
- Re-publish the same semver (bump instead)
- Print `NPM_TOKEN` or `dc get … --reveal` output
- Set `"private": true`

Verdaccio UI admin passwords (`platform verdaccio.admin_*`) are not used for `npm publish`.

## Automatic Lit CDN releases

`.github/workflows/publish-lit.yml` tests and builds the Lit library on PRs and `develop`,
then publishes **main commits only** to the existing MinIO-backed
`https://cdn.derobot.is`. This workflow does not publish the Elixir server or
npm package. The release route is feature PR → `develop`, followed by a
**manually merged release PR from `develop` to `main` using a regular merge
commit, never squash**. Workflows do not promote branches. After the manual
release merge, CI publishes the Lit artifacts and backend images and updates
chart tags; ArgoCD syncs the chart changes. Fast-forward local `develop` after
PRs merge. Manual workflow reruns/dispatch on `main` are supported.

Each commit is published at `https://cdn.derobot.is/tobor-kit/sha-<full-sha>/`.
All files receive one-year immutable caching. After upload and a CDN probe,
`https://cdn.derobot.is/tobor-kit/latest.json` is updated atomically with the
commit, package version, entry URLs and SHA-384 integrity hashes. This pointer
requires revalidation. Historical reruns cannot move it behind newer component
changes on main. Completed SHA releases reject changed contents on retry. Resolve it once and pin its URLs in production; existing
`v*/` and `latest/` assets are retained, but this pipeline does not rewrite them.

```js
const release = await fetch('https://cdn.derobot.is/tobor-kit/latest.json', {
  cache: 'no-cache',
}).then(response => {
  if (!response.ok) throw new Error('Cannot resolve toolkit release');
  return response.json();
});
await import(release.auth); // registers <noizu-auth>; release.entry loads all elements
```

The CDN artifact rewrites Lit imports to shared relative `vendor/` modules;
no import map or bundler is required. npm artifacts retain normal external peer
dependencies. React wrappers remain npm-only. Source maps are omitted from the
rewritten CDN artifact. If a future component adds another external dependency,
CDN preparation fails until its browser resolution is explicitly supported.

Repository Actions secrets `CDN_ACCESS_KEY_ID` and `CDN_SECRET_ACCESS_KEY` must
hold a dedicated MinIO writer restricted to `cdn-derobot-is/tobor-kit/*` with
`s3:PutObject` and `s3:GetObject`. The fixed S3 endpoint is
`https://minio.noizu.com`, region `us-east-1`. No Kubernetes access, bucket admin,
object deletion, npm token, or MinIO root credentials are needed. PR jobs have
read-only GitHub permissions and never receive publishing credentials.

To validate without publishing: run `npm ci && npm run lint && npm test` in
`web/`, then `node scripts/prepare-cdn.mjs "$(git rev-parse HEAD)"` from the repo
root, followed by `node scripts/smoke-cdn.mjs` to verify native browser loading. CI retains this exact `web/cdn-dist/` artifact for seven days and publishes
it without rebuilding. CDN copy metadata follows the
[AWS S3 CLI reference](https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html).

Cloudflare Access also protects the MinIO API. CI supplies a dedicated MinIO-only
service token through `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, in
addition to the prefix-scoped S3 writer. `scripts/cdn-s3.py` adds Access headers
after S3 signing and refuses to forward them to another hostname. Anonymous
storage probes cannot distinguish an absent object from an Access login redirect.
