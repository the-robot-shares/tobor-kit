#!/usr/bin/env bash
# GitHub Actions only: scoped S3 credentials; no cluster or MinIO admin access.
set -euo pipefail
cd "$(dirname "$0")/.."
SHA="${1:-}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected full commit SHA' >&2; exit 1; }
: "${AWS_ACCESS_KEY_ID:?Configure GitHub secret CDN_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Configure GitHub secret CDN_SECRET_ACCESS_KEY}"
DIST=web/cdn-dist
PREFIX="tobor-kit/sha-$SHA"
BASE="https://cdn.derobot.is/$PREFIX"
test -s "$DIST/manifest.json"
node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1])); if(m.sha!==process.argv[2] || m.baseUrl!==process.argv[3]+"/") throw Error("Artifact identity mismatch")' "$DIST/manifest.json" "$SHA" "$BASE"
S3=(python3 scripts/cdn-s3.py --endpoint-url https://minio.noizu.com s3)
# Publish immutable files first. Never delete old chunks: pinned consumers keep working.
REMOTE_MANIFEST=$(mktemp)
PROBE_ERROR=$(mktemp)
trap 'rm -f "$REMOTE_MANIFEST" "$PROBE_ERROR"' EXIT
# Probe through the authenticated S3 API. Anonymous HTTP requests can be routed
# to the storage console by the edge, which is not evidence of object presence.
if python3 scripts/cdn-s3.py --endpoint-url https://minio.noizu.com s3api get-object \
  --bucket cdn-derobot-is --key "$PREFIX/manifest.json" \
  "$REMOTE_MANIFEST" >/dev/null 2>"$PROBE_ERROR"; then
  cmp --silent "$DIST/manifest.json" "$REMOTE_MANIFEST" || {
    echo 'Immutable release already exists with different contents; refusing overwrite.' >&2
    exit 1
  }
  echo 'Identical immutable release already exists; skipping upload.'
elif grep -Eq '\(NoSuchKey\)|\(404\)' "$PROBE_ERROR"; then
  "${S3[@]}" cp "$DIST/" "s3://cdn-derobot-is/$PREFIX/" --recursive \
    --exclude manifest.json --cache-control 'public,max-age=31536000,immutable' --only-show-errors
  # Manifest marks a fully uploaded release, so retries can recover interrupted uploads.
  "${S3[@]}" cp "$DIST/manifest.json" "s3://cdn-derobot-is/$PREFIX/manifest.json" \
    --content-type application/json --cache-control 'public,max-age=31536000,immutable' --only-show-errors
else
  echo 'Unable to inspect existing release through authenticated S3 API.' >&2
  cat "$PROBE_ERROR" >&2
  exit 1
fi
# Probe the new module through the actual CDN before advertising this release.
curl --fail --silent --show-error --retry 5 --retry-all-errors \
  "$BASE/components/auth/noizu-auth.js" --output /dev/null
# Historical workflow retries may publish their pinned release, but cannot roll latest back.
CURRENT=$(gh api "repos/${GH_REPO:?}/git/ref/heads/main" --jq .object.sha)
if [[ "$CURRENT" != "$SHA" ]]; then
  # Backend CI may have committed only its automatic chart tag while this build ran.
  CHANGED=$(gh api "repos/$GH_REPO/compare/$SHA...$CURRENT" --jq '[.files[].filename | select(. != "helm/tobor-kit/values.yaml")] | length')
  if [[ "$CHANGED" != 0 ]]; then
    echo "Published pinned release $BASE; main has advanced, leaving latest unchanged."
    exit 0
  fi
fi
# Single-object pointer update avoids mixed release graphs in mutable directories.
"${S3[@]}" cp "$DIST/manifest.json" s3://cdn-derobot-is/tobor-kit/latest.json \
  --content-type application/json --cache-control 'no-cache,max-age=0,must-revalidate' --only-show-errors
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf 'Published Lit components: %s/index.js\n\nAuth component: %s/components/auth/noizu-auth.js\n\nLatest release: https://cdn.derobot.is/tobor-kit/latest.json\n' "$BASE" "$BASE" >> "$GITHUB_STEP_SUMMARY"
fi
