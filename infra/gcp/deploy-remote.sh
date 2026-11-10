#!/usr/bin/env bash
set -euo pipefail
revision=$1
hostname=$2
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
[[ "$hostname" =~ ^[a-z0-9.-]+$ ]]
exec 9>/var/lock/lookout-deploy.lock
flock -n 9 || { echo 'Another Lookout deployment is running.' >&2; exit 1; }
# Stage uploads are content-addressed and verified; install only under this lock.
runtime_digest=${3:-}
oauth_digest=${4:--}
check_staged() {
  local kind=$1 digest=$2
  [[ "$digest" =~ ^[a-f0-9]{64}$ ]]
  printf '%s  %s\n' "$digest" "/etc/lookout/staged/$kind-$digest" | sha256sum --check --status
}
install_staged() (
  local source=$1 target=$2 owner=$3 staged_install
  staged_install=$(mktemp "${target}.XXXXXX")
  trap 'rm -f "$staged_install"' EXIT
  install -m 600 -o "$owner" -g "$owner" "$source" "$staged_install"
  mv "$staged_install" "$target"
  trap - EXIT
)
if [[ -n "$runtime_digest" ]]; then
  check_staged runtime "$runtime_digest"
  if [[ "$oauth_digest" != '-' ]]; then
    check_staged oauth "$oauth_digest"
    grep -qx 'LOOKOUT_OAUTH_ENABLED=true' "/etc/lookout/staged/runtime-$runtime_digest"
    install -d -m 700 -o 1000 -g 1000 /etc/lookout/oauth
    install_staged "/etc/lookout/staged/oauth-$oauth_digest" /etc/lookout/oauth/config.json 1000
  fi
  install_staged "/etc/lookout/staged/runtime-$runtime_digest" /etc/lookout/runtime.env 0
elif [[ "$oauth_digest" != '-' ]]; then
  echo 'OAuth installation requires a matched staged runtime configuration.' >&2
  exit 1
fi
cd "/opt/lookout/releases/$revision"
umask 077
export LOOKOUT_RELEASE="$revision" LOOKOUT_API_HOST="$hostname"
# Generated runtime provenance belongs to this release's build, not source Git.
printf '{"sourceCommit":"%s"}\n' "$revision" > supabase/functions/agent-gateway/runtime-version.json
compose=(docker compose -f infra/gcp/compose.yaml)
if grep -qx 'LOOKOUT_OAUTH_ENABLED=true' /etc/lookout/runtime.env; then
  test -f /etc/lookout/oauth/config.json
  test "$(stat -c '%a' /etc/lookout/oauth/config.json)" = 600
  test "$(stat -c '%u' /etc/lookout/oauth/config.json)" = 1000
  compose+=(-f infra/gcp/compose.oauth.yaml)
fi
"${compose[@]}" config --quiet
"${compose[@]}" build api
"${compose[@]}" up -d --wait --wait-timeout 180
ln -sfn "/opt/lookout/releases/$revision" /opt/lookout/current
printf 'LOOKOUT_RELEASE=%s\nLOOKOUT_API_HOST=%s\n' "$revision" "$hostname" > /etc/lookout/public.env
"${compose[@]}" ps

if [[ -n "$runtime_digest" ]]; then rm -f "/etc/lookout/staged/runtime-$runtime_digest";fi
if [[ "$oauth_digest" != '-' ]]; then rm -f "/etc/lookout/staged/oauth-$oauth_digest";fi
