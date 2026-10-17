#!/usr/bin/env bash
# Tests for verify-user-web-target.sh `config`, `wake` and `cors` against a
# local mock backend (testdata/mock-backend.mjs). Needs bash, curl and node.
#   bash .github/scripts/verify-user-web-target.test.sh
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
script="$here/verify-user-web-target.sh"
work="$(mktemp -d)"
pass=0; failed=0; mock_pid=""

cleanup() { [ -n "$mock_pid" ] && kill "$mock_pid" 2>/dev/null; rm -rf "$work"; }
trap cleanup EXIT

# start_mock VAR=value ... — starts the mock with those env vars, sets $BASE.
start_mock() {
  [ -n "$mock_pid" ] && kill "$mock_pid" 2>/dev/null; mock_pid=""
  rm -f "$work/port"
  env PORT_FILE="$work/port" "$@" node "$here/testdata/mock-backend.mjs" &
  mock_pid=$!
  for _ in $(seq 1 50); do [ -s "$work/port" ] && break; sleep 0.1; done
  [ -s "$work/port" ] || { echo "mock backend did not start"; exit 1; }
  BASE="http://127.0.0.1:$(cat "$work/port")"
}

# check <name> <pass|fail> <regex expected in output> -- <command...>
check() {
  local name="$1" want="$2" pattern="$3"; shift 4
  local out rc=0
  out=$("$@" 2>&1) || rc=$?
  local got=pass; [ "$rc" -eq 0 ] || got=fail
  # -z: match the whole output as one string, so patterns can span lines.
  if [ "$got" = "$want" ] && grep -qzE "$pattern" <<<"$out"; then
    pass=$((pass + 1)); echo "ok   - $name"
  else
    failed=$((failed + 1)); echo "FAIL - $name (wanted $want /$pattern/, got $got)"; sed 's/^/       /' <<<"$out"
  fi
}

# Short budgets so the suite runs in seconds; the logic is the same as the
# CI defaults (180 s budget, 100 s per attempt, 5 s between attempts).
fast=(env WAKE_TIMEOUT_SECONDS=6 WAKE_ATTEMPT_TIMEOUT_SECONDS=2 WAKE_RETRY_DELAY_SECONDS=1)
STG_API=https://tbt-backend-staging-464464507912.asia-south1.run.app
PROD_API=https://tbt-backend-464464507912.asia-south1.run.app
STG_SITE=https://tbt-user-web-staging-464464507912.asia-south1.run.app
ORIGIN=$STG_SITE

echo "# config"
check "staging api + staging origin" pass "OK: staging user-web" -- bash "$script" config staging "$STG_API" "$STG_SITE"
check "staging api, no origin (unchanged 3-arg form)" pass "OK: staging" -- bash "$script" config staging "$STG_API"
check "staging job with production api" fail "must use the staging backend" -- bash "$script" config staging "$PROD_API" "$STG_SITE"
check "staging job with production site origin" fail "staging site origin" -- bash "$script" config staging "$STG_API" https://app.tamilbusinesstribe.com
check "staging job with production run.app origin" fail "staging site origin" -- bash "$script" config staging "$STG_API" https://tbt-user-web-464464507912.asia-south1.run.app
check "production api, no origin (production job form)" pass "OK: production" -- bash "$script" config production "$PROD_API"
check "production job with staging api" fail "must use the production backend" -- bash "$script" config production "$STG_API"
check "production job with staging origin" fail "production site origin" -- bash "$script" config production "$PROD_API" "$STG_SITE"

echo "# wake"
start_mock HEALTH_STATUSES=200
check "already warm" pass "healthy after [0-9]+s \(attempt 1\)" -- "${fast[@]}" bash "$script" wake "$BASE"

start_mock LISTEN_DELAY_MS=2500 HEALTH_STATUSES=200
# Linux refuses at once (curl exit 7); Windows times the SYN out (exit 28).
check "cold start: connection refused, then healthy" pass "curl exit (7|28).*retrying[[:space:]]+(.*[[:space:]]+)*OK: .* healthy" -- "${fast[@]}" bash "$script" wake "$BASE"

start_mock HEALTH_STATUSES=503,503,200
check "cold start: 503 twice, then healthy" pass "attempt 2 at .*HTTP 503.*[[:space:]]+OK: .* healthy after .*attempt 3" -- "${fast[@]}" bash "$script" wake "$BASE"

start_mock HEALTH_FIRST_DELAY_MS=4000 HEALTH_STATUSES=200
check "cold start: first request held past the attempt timeout" pass "curl exit 28.*retrying[[:space:]]+OK: .* healthy" -- "${fast[@]}" bash "$script" wake "$BASE"

start_mock HEALTH_STATUSES=503
check "timeout exhaustion: never healthy" fail "not healthy after 6s .*last: HTTP 503" -- "${fast[@]}" bash "$script" wake "$BASE"

start_mock HEALTH_STATUSES=404
started=$(date +%s)
check "genuine failure: 404 is not retried" fail "returned HTTP 404 .*not retrying" -- "${fast[@]}" bash "$script" wake "$BASE"
[ $(( $(date +%s) - started )) -lt 3 ] && { pass=$((pass + 1)); echo "ok   - 404 failed fast"; } || { failed=$((failed + 1)); echo "FAIL - 404 was retried until the budget ran out"; }

echo "# cors"
start_mock CORS_ALLOW_ORIGIN=echo
check "origin allowed" pass "OK: .* allows $ORIGIN" -- bash "$script" cors "$BASE" "$ORIGIN"

start_mock CORS_ALLOW_ORIGIN=
check "origin denied (no header)" fail "does not allow CORS from .*got ''" -- bash "$script" cors "$BASE" "$ORIGIN"

start_mock CORS_ALLOW_ORIGIN=https://app.tamilbusinesstribe.com
check "a different origin is allowed, not ours" fail "does not allow CORS from .*got 'https://app.tamilbusinesstribe.com'" -- bash "$script" cors "$BASE" "$ORIGIN"

start_mock HEALTH_STATUSES=200 CORS_ALLOW_ORIGIN=
check "healthy backend but CORS denied: wake passes" pass "healthy" -- "${fast[@]}" bash "$script" wake "$BASE"
check "healthy backend but CORS denied: cors still fails" fail "does not allow CORS" -- bash "$script" cors "$BASE" "$ORIGIN"

dead="$BASE"; kill "$mock_pid" 2>/dev/null; wait "$mock_pid" 2>/dev/null; mock_pid=""
check "backend unreachable: clear error, no CORS verdict" fail "could not reach .*curl exit" -- env CORS_TIMEOUT_SECONDS=2 bash "$script" cors "$dead" "$ORIGIN"

echo "# $pass passed, $failed failed"
[ "$failed" -eq 0 ]
