#!/usr/bin/env bash
# Guards the user-web Cloud Run deploys against talking to the wrong backend.
#
#   verify-user-web-target.sh config <staging|production> <api_url>
#       The NEXT_PUBLIC_API_URL about to be baked into the build must be the
#       backend of the same environment (staging -> tbt-backend-staging,
#       production -> tbt-backend).
#
#   verify-user-web-target.sh cors <api_url> <origin>
#       The backend must accept the frontend's origin (credentialed CORS),
#       otherwise every API call from the deployed site would fail.
#
#   verify-user-web-target.sh bundle <base_url> <expected_api_url>
#       Fetches the JS the deployed revision actually serves and requires that
#       the only backend it calls is <expected_api_url>. Run against the
#       revision's tag URL before it receives traffic: NEXT_PUBLIC_* values are
#       compiled in, and a build setting that silently fails to reach the build
#       (as --set-build-env-vars did for this Dockerfile) only shows up here.
set -euo pipefail

fail() { echo "::error::$*" >&2; exit 1; }

STAGING_RE='^https://tbt-backend-staging-[a-z0-9-]+(\.[a-z0-9-]+)*\.run\.app$'
PRODUCTION_RE='^https://tbt-backend-([0-9]+\.[a-z0-9-]+|[a-z0-9]{10}-[a-z]{2}\.a)\.run\.app$'

case "${1:-}" in
  config)
    env_name="${2:?environment}"; api="${3:?api_url}"
    case "$env_name" in
      staging)    [[ "$api" =~ $STAGING_RE ]] || fail "staging user-web must use the staging backend, got: $api" ;;
      production) [[ "$api" =~ $PRODUCTION_RE ]] || fail "production user-web must use the production backend, got: $api" ;;
      *) fail "unknown environment: $env_name" ;;
    esac
    echo "OK: $env_name user-web -> $api"
    ;;

  cors)
    api="${2:?api_url}"; origin="${3:?origin}"
    allowed=$(curl -sS --max-time 20 -o /dev/null -D - -X OPTIONS \
      -H "Origin: $origin" -H "Access-Control-Request-Method: GET" \
      "$api/api/pub/config/site" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')
    [ "$allowed" = "$origin" ] || fail "$api does not allow CORS from $origin (got '${allowed}'). Add it to that backend's USER_WEB_URL / CORS_EXTRA_ORIGINS and redeploy the backend first."
    echo "OK: $api allows $origin"
    ;;

  bundle)
    base="${2:?base_url}"; expected="${3:?expected_api_url}"
    work=$(mktemp -d)
    for page in /login /batch-program; do
      curl -sSL --max-time 30 "$base$page" | grep -oE '/_next/static/[^"]+\.js' || true
    done | sort -u > "$work/chunks"
    [ -s "$work/chunks" ] || fail "no JS chunks found at $base"
    while read -r chunk; do curl -sS --max-time 30 "$base$chunk"; echo; done < "$work/chunks" > "$work/all.js"
    grep -oE 'https://tbt-backend[a-z0-9.-]*\.run\.app' "$work/all.js" | sort -u > "$work/backends" || true
    echo "Backends referenced by $base:"; sed 's/^/  /' "$work/backends"
    grep -qxF "$expected" "$work/backends" || fail "built bundle does not call $expected — NEXT_PUBLIC_API_URL did not reach the build"
    others=$(grep -vxF "$expected" "$work/backends" || true)
    [ -z "$others" ] || fail "built bundle also calls another backend: $others"
    echo "OK: bundle at $base calls only $expected"
    ;;

  *)
    fail "usage: $0 config|cors|bundle ..."
    ;;
esac
