#!/usr/bin/env bash
set -euo pipefail
revision=$1
hostname=$2
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
[[ "$hostname" =~ ^[a-z0-9.-]+$ ]]
exec 9>/var/lock/lookout-deploy.lock
flock -n 9 || { echo 'Another Lookout deployment is running.' >&2; exit 1; }
cd "/opt/lookout/releases/$revision"
umask 077
export LOOKOUT_RELEASE="$revision" LOOKOUT_API_HOST="$hostname"
# Generated runtime provenance belongs to this release's build, not source Git.
printf '{"sourceCommit":"%s"}\n' "$revision" > supabase/functions/agent-gateway/runtime-version.json
docker compose -f infra/gcp/compose.yaml config --quiet
docker compose -f infra/gcp/compose.yaml build api
docker compose -f infra/gcp/compose.yaml up -d --wait --wait-timeout 180
ln -sfn "/opt/lookout/releases/$revision" /opt/lookout/current
printf 'LOOKOUT_RELEASE=%s\nLOOKOUT_API_HOST=%s\n' "$revision" "$hostname" > /etc/lookout/public.env
docker compose -f infra/gcp/compose.yaml ps
