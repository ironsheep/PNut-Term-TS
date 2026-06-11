#!/bin/bash
# Test-suite coverage & no-skip gate.  [sprint 0.9.47 §7]
#
# Stephen's standard: no test is ever silently skipped — enforced by this gate,
# not by vigilance. The gate FAILS (exit 1) if:
#
#   (a) any tests/*.test.ts is neither registered in run_tests_sequentially.sh
#       (the single registration source of truth — run_tests_parallel.sh and CI
#       derive their list from it) NOR listed in EXCLUDED_TESTS below; or
#   (b) any non-excluded test source carries a skip/focus marker
#       (it/test/describe/context .skip|.only, or xit/xtest/xdescribe,
#       or fit/fdescribe).
#
# It also flags stale state: an EXCLUDED entry whose file is gone, a registered
# run_test line whose file is gone, or a file that is BOTH registered and
# excluded.
#
# EXCLUDED_TESTS is the AUTHORITATIVE record of tests that genuinely cannot run
# in this environment — each entry MUST carry a reason. Drift (a new/renamed
# test nobody registered) or a casual .skip then turns the build red instead of
# hiding. Removing a run_test line, or adding a stray .skip, must make this exit
# non-zero — that is the contract verified at sprint close.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 2

RUNNER="scripts/claude/run_tests_sequentially.sh"

# --- EXCLUDED_TESTS: relative path -> reason it cannot run here ---------------
# Keep each reason specific enough that a future reader never has to re-triage.
declare -A EXCLUDED_TESTS=(
  ["tests/fftMultipleExecutions.test.ts"]="HW-only: needs external P2 capture under test-results/external-results/* (gitignored, never committed; exists only post-run on a hardware-connected machine)."
  ["tests/fftRealHardwareComparison.test.ts"]="HW-only: needs the debug_251106-164458.log hardware capture (gitignored)."
  ["tests/spritedefRealUSB.test.ts"]="HW-only: needs an absent USB capture log (hardware-connected machine only)."
  ["tests/workerExtraction.test.ts"]="Env-only: the worker_threads SAB round-trip does not deliver messages under Jest in-container (the extraction tests 30s-timeout); the worker serial path itself is HW-validated (#31)."
  ["tests/memoryLeakDetection.test.ts"]="Env-only: its memory-profiler tests assert on real GC / wall-clock heap growth (growthRate<0.01, 1.5s real timers) and hit DebugLogicWindow-mock timer pollution — non-deterministic under Jest."
)

fail=0

# Registered set = the run_test "tests/..." lines in the sequential runner.
registered="$(grep -oE '^[[:space:]]*run_test "tests/[A-Za-z0-9._-]+\.test\.ts"' "$RUNNER" \
  | grep -oE 'tests/[A-Za-z0-9._-]+\.test\.ts' | sort -u)"

# (a) coverage — every present test file is registered XOR excluded.
for f in tests/*.test.ts; do
  is_registered=0; grep -qxF "$f" <<<"$registered" && is_registered=1
  is_excluded=0; [[ -n "${EXCLUDED_TESTS[$f]+x}" ]] && is_excluded=1
  if (( is_registered && is_excluded )); then
    echo "❌ GATE: $f is BOTH registered and in EXCLUDED_TESTS — pick exactly one."
    fail=1
  elif (( ! is_registered && ! is_excluded )); then
    echo "❌ GATE: $f is neither registered in $RUNNER nor in EXCLUDED_TESTS."
    echo "        → add a 'run_test \"$f\"' line, or add it to EXCLUDED_TESTS with a reason."
    fail=1
  fi
done

# Stale EXCLUDED entry — listed but the file is gone.
for f in "${!EXCLUDED_TESTS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ GATE: EXCLUDED_TESTS lists $f but it does not exist — remove the stale entry."
    fail=1
  fi
done

# Stale registration — run_test line for a file that is gone.
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ ! -f "$f" ]]; then
    echo "❌ GATE: $RUNNER registers $f but the file does not exist — remove the stale run_test line."
    fail=1
  fi
done <<<"$registered"

# (b) no-skip — no skip/focus marker outside an EXCLUDED_TESTS file.
# The leading (^|[^A-Za-z0-9_$.]) guards against member-access false positives
# (e.g. observable.skip(, foo.it.skip) by requiring the jest fn at a word edge.
SKIP_RE='(^|[^A-Za-z0-9_$.])(it|test|describe|context)\.(skip|only)[[:space:]]*\(|(^|[^A-Za-z0-9_$.])(xit|xtest|xdescribe|fit|fdescribe)[[:space:]]*\('
for f in tests/*.test.ts; do
  [[ -n "${EXCLUDED_TESTS[$f]+x}" ]] && continue
  if grep -qE "$SKIP_RE" "$f"; then
    echo "❌ GATE: $f carries a skip/focus marker (not allowed outside EXCLUDED_TESTS):"
    grep -nE "$SKIP_RE" "$f" | sed 's/^/        /'
    fail=1
  fi
done

if (( fail )); then
  echo ""
  echo "Test-coverage gate FAILED — see above. [sprint 0.9.47 §7]"
  exit 1
fi

present_count="$(ls tests/*.test.ts | wc -l | tr -d ' ')"
excluded_count="${#EXCLUDED_TESTS[@]}"
registered_count="$(grep -c . <<<"$registered")"
echo "✅ Test-coverage gate: ${present_count} test files = ${registered_count} registered + ${excluded_count} excluded-with-reason; 0 stray skips."
exit 0
