#!/usr/bin/env bash
# Guards the user-web Cloud Run deploys against talking to the wrong backend.
#
#   verify-user-web-target.sh config <staging|production> <api_url> [<site_origin>]
#       The NEXT_PUBLIC_API_URL about to be baked into the build must be the
#       backend of the same environment (staging -> tbt-backend-staging,
#       production -> tbt-backend). When <site_origin> is given it must be that
#       environment's user-web origin too.
#
#   verify-user-web-target.sh wake <api_url>
#       Waits until <api_url>/health answers 200. A backend scaled to zero
#       (staging runs min-instances=0) can take ~90 s to cold-start, so this
#       retries connection errors, timeouts and 408/425/429/5xx until
#       WAKE_TIMEOUT_SECONDS (default 180) is spent; any other status fails at
#       once. It proves only that the backend is up — run `cors` afterwards.
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
STAGING_SITE_RE='^https://tbt-user-web-staging-[a-z0-9-]+(\.[a-z0-9-]+)*\.run\.app$'
PRODUCTION_SITE_RE='^https://(app\.tamilbusinesstribe\.com|tbt-user-web-([0-9]+\.[a-z0-9-]+|[a-z0-9]{10}-[a-z]{2}\.a)\.run\.app)$'

case "${1:-}" in
  config)
    env_name="${2:?environment}"; api="${3:?api_url}"; site="${4:-}"
    case "$env_name" in
      staging)
        [[ "$api" =~ $STAGING_RE ]] || fail "staging user-web must use the staging backend, got: $api"
        [ -z "$site" ] || [[ "$site" =~ $STAGING_SITE_RE ]] || fail "staging site origin must be the staging user-web, got: $site" ;;
      production)
        [[ "$api" =~ $PRODUCTION_RE ]] || fail "production user-web must use the production backend, got: $api"
        [ -z "$site" ] || [[ "$site" =~ $PRODUCTION_SITE_RE ]] || fail "production site origin must be the production user-web, got: $site" ;;
      *) fail "unknown environment: $env_name" ;;
    esac
    echo "OK: $env_name user-web${site:+ ($site)} -> $api"
    ;;

  wake)
    api="${2:?api_url}"
    budget="${WAKE_TIMEOUT_SECONDS:-180}"
    per_attempt="${WAKE_ATTEMPT_TIMEOUT_SECONDS:-100}"
    delay="${WAKE_RETRY_DELAY_SECONDS:-5}"
    errf=$(mktemp); trap 'rm -f "$errf"' EXIT
    start=$(date +%s); deadline=$((start + budget)); attempt=0; last=""
    echo "Waiting up to ${budget}s for $api/health (cold start can take ~90s)"
    while :; do
      attempt=$((attempt + 1))
      remaining=$((deadline - $(date +%s)))
      [ "$remaining" -gt 0 ] || fail "$api/health not healthy after ${budget}s ($((attempt - 1)) attempts; last: $last)"
      limit=$(( per_attempt < remaining ? per_attempt : remaining ))
      rc=0
      code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$limit" "$api/health" 2>"$errf") || rc=$?
      elapsed=$(( $(date +%s) - start ))
      if [ "$rc" -eq 0 ] && [ "$code" = "200" ]; then
        echo "OK: $api healthy after ${elapsed}s (attempt $attempt)"
        break
      elif [ "$rc" -ne 0 ]; then
        last="curl exit $rc: $(tr -d '\r\n' < "$errf")"
      else
        case "$code" in
          408|425|429|500|502|503|504) last="HTTP $code" ;;
          *) fail "$api/health returned HTTP $code — not a cold-start status, not retrying" ;;
        esac
      fi
      echo "  attempt $attempt at ${elapsed}s: $last — retrying"
      remaining=$((deadline - $(date +%s)))
      [ "$remaining" -le 0 ] || sleep $(( delay < remaining ? delay : remaining ))
    done
    ;;

  cors)
    api="${2:?api_url}"; origin="${3:?origin}"
    rc=0
    headers=$(curl -sS --max-time "${CORS_TIMEOUT_SECONDS:-20}" -o /dev/null -D - -X OPTIONS \
      -H "Origin: $origin" -H "Access-Control-Request-Method: GET" \
      "$api/api/pub/config/site") || rc=$?
    [ "$rc" -eq 0 ] || fail "could not reach $api for the CORS check (curl exit $rc). If it is scaled to zero, run \`wake\` first."
    allowed=$(printf '%s\n' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')
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
    fail "usage: $0 config|wake|cors|bundle ..."
    ;;
esac
