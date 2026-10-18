#!/usr/bin/env bash
# Regression: mc must address the remote alias, never the temporary pod disk.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/bin" "$TEST_DIR/dist"
printf 'export const fixture = true;\n' > "$TEST_DIR/dist/index.js"
cat > "$TEST_DIR/bin/kubectl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"get secret"* ]]; then
  printf '{"data":{"MINIO_ROOT_USER":"dGVzdC11c2Vy","MINIO_ROOT_PASSWORD":"dGVzdC1wYXNzd29yZA=="}}\n'
elif [[ "$*" == *"-- mc pipe "* ]]; then
  [[ "${!#}" == "cdn/cdn-derobot-is/tobor-kit/vtest-version/index.js" ]] || exit 21
  cat >/dev/null
  echo pipe >> "$TEST_LOG"
elif [[ "$*" == *"-- mc mirror "* ]]; then
  [[ "$*" == *"cdn/cdn-derobot-is/tobor-kit/vtest-version/ cdn/cdn-derobot-is/tobor-kit/latest/" ]] || exit 22
  echo mirror >> "$TEST_LOG"
elif [[ "$*" == *"exec -i "* && "$*" == *"-- sh -c "* ]]; then
  # Consume but never log credentials passed over stdin.
  read -r test_user
  read -r test_password
  [[ "$test_user" == "test-user" && "$test_password" == "test-password" ]] || exit 23
  echo alias >> "$TEST_LOG"
fi
MOCK
chmod +x "$TEST_DIR/bin/kubectl"
export TEST_LOG="$TEST_DIR/operations"
env -u MINIO_ROOT_USER -u MINIO_ROOT_PASSWORD PATH="$TEST_DIR/bin:$PATH" \
  DIST="$TEST_DIR/dist" bash "$ROOT/scripts/publish-cdn.sh" test-version > "$TEST_DIR/output"
[[ "$(cat "$TEST_LOG")" == $'alias\npipe\nmirror' ]]
if grep -Eq 'test-user|test-password' "$TEST_DIR/output"; then
  echo 'FAIL: credential printed' >&2
  exit 1
fi
echo 'publish-cdn regression: remote upload, remote latest mirror, uppercase secret keys, no credential output passed'
