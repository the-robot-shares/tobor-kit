#!/usr/bin/env bash
#
# publish-cdn.sh — publish web/dist to the cdn.derobot.is bucket (MinIO
# `cdn-derobot-is`), idempotent.
#
# Uploads every file to `tobor-kit/v<version>/` (immutable-cache upload) and
# then bucket-mirrors that prefix to `tobor-kit/latest/` (proxy-default 1d
# caching so `latest` can repoint). Runbook: trl-infra
# docs/cdn-derobot-is-runbook.md.
#
# No local `mc` required: a temporary `minio/mc` pod is created in the
# cluster and files are streamed through `kubectl exec -i` via `mc pipe`.
# (minio/mc has NO tar and NO awk — no tar-pipes; and `mc cp --pipe` errors —
# `mc pipe` is the only stdin upload path.) Never prints secret values.
#
# Usage:
#   scripts/publish-cdn.sh [version]        # default: web/package.json version
#
# Env:
#   MINIO_ROOT_USER / MINIO_ROOT_PASSWORD  optional — when both are set they
#     are used as-is. Otherwise they are read from the k8s Secret
#     MC_SECRET_NAME (default minio-secrets, ns $MC_POD_NS), probing common
#     key pairs (rootUser/rootPassword, root-user/root-password,
#     accessKey/secretKey); first non-empty pair wins.
#   MC_IMAGE      (default minio/mc:latest)
#   MC_POD_NS     (default infra)          namespace for the temp pod + secret
#   MC_ALIAS_URL  (default http://minio-service.infra:9000 — internal svc is
#                  HTTP, NOT https)
#   DIST          (default web/dist)       must exist; run `npm run build` first

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' web/package.json | head -1)}"
[ -n "$VERSION" ] || { echo "error: could not resolve version (pass one as argv[1])" >&2; exit 1; }

MC_IMAGE="${MC_IMAGE:-minio/mc:latest}"
MC_POD_NS="${MC_POD_NS:-infra}"
MC_SECRET_NAME="${MC_SECRET_NAME:-minio-secrets}"
MC_ALIAS_URL="${MC_ALIAS_URL:-http://minio-service.infra:9000}"
DIST="${DIST:-web/dist}"
POD="tobor-kit-publish-$$"
ALIAS="cdn"
BUCKET="cdn-derobot-is"
BUCKET_VER="$ALIAS/$BUCKET/tobor-kit/v${VERSION}"
BUCKET_LATEST="$ALIAS/$BUCKET/tobor-kit/latest"

[ -d "$DIST" ] && [ -n "$(ls -A "$DIST")" ] || { echo "error: $DIST missing/empty — run (cd web && npm run build) first" >&2; exit 1; }

# Resolve creds: env override, else the in-cluster secret (values never printed).
if [ -z "${MINIO_ROOT_USER:-}" ] || [ -z "${MINIO_ROOT_PASSWORD:-}" ]; then
  secret_json="$(kubectl -n "$MC_POD_NS" get secret "$MC_SECRET_NAME" -o json)"
  MINIO_ROOT_USER="$(node -e 'const s=JSON.parse(process.argv[1]).data;const ks=["MINIO_ROOT_USER","rootUser","root-user","accessKey","accesskey","user"];for(const k of ks)if(s[k]){console.log(Buffer.from(s[k],"base64").toString());break}' "$secret_json")"
  MINIO_ROOT_PASSWORD="$(node -e 'const s=JSON.parse(process.argv[1]).data;const ks=["MINIO_ROOT_PASSWORD","rootPassword","root-password","secretKey","secretkey","password"];for(const k of ks)if(s[k]){console.log(Buffer.from(s[k],"base64").toString());break}' "$secret_json")"
fi
[ -n "${MINIO_ROOT_USER:-}" ] && [ -n "${MINIO_ROOT_PASSWORD:-}" ] || {
  echo "error: no creds — set MINIO_ROOT_USER/MINIO_ROOT_PASSWORD or check secret $MC_POD_NS/$MC_SECRET_NAME" >&2; exit 1;
}

cleanup() { kubectl -n "$MC_POD_NS" delete pod "$POD" --ignore-not-found --wait=false >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting temp mc pod $POD ($MC_IMAGE, ns=$MC_POD_NS)"
kubectl -n "$MC_POD_NS" run "$POD" --image="$MC_IMAGE" --restart=Never \
  --command -- sh -c 'sleep 3600' >/dev/null
kubectl -n "$MC_POD_NS" wait --for=condition=Ready "pod/$POD" --timeout=120s >/dev/null

MC() { kubectl -n "$MC_POD_NS" exec -i "$POD" -- mc "$@"; }

echo "==> aliasing $MC_ALIAS_URL (creds via stdin, not printed)"
printf '%s\n%s\n' "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
  | kubectl -n "$MC_POD_NS" exec -i "$POD" -- sh -c \
    'read -r u; read -r p; exec mc alias set cdn "$0" "$u" "$p"' "$MC_ALIAS_URL" >/dev/null

echo "==> uploading $DIST -> $BUCKET_VER/ (mc pipe per file; idempotent)"
DIST="$(cd "$DIST" && pwd)"
count=0
while IFS= read -r -d '' f; do
  rel="${f#$DIST/}"
  kubectl -n "$MC_POD_NS" exec -i "$POD" -- mc pipe "$BUCKET_VER/$rel" < "$f"
  count=$((count + 1))
done < <(find "$DIST" -type f -print0)
echo "    uploaded $count object(s)"

echo "==> mirror $BUCKET_VER/ -> $BUCKET_LATEST/ (server-side; idempotent)"
MC mirror --overwrite "$BUCKET_VER/" "$BUCKET_LATEST/" >/dev/null

echo "==> published tobor-kit v$VERSION"
echo "    verify: curl -sI https://cdn.derobot.is/tobor-kit/v${VERSION}/index.js | egrep -i 'HTTP|cache-status|cache-control|access-control'"
echo "            curl -sI https://cdn.derobot.is/tobor-kit/latest/index.js  | egrep -i 'HTTP|cache-status|cache-control|access-control'"
