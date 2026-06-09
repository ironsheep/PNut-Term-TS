#!/bin/bash
# Parallel (bounded) check-in test runner.
#
# Runs the SAME curated set as run_tests_sequentially.sh — which stays the single
# source of truth for "which tests are green" — but lets jest schedule them in
# parallel instead of one file at a time. Bounded on purpose so it stays safe
# inside the Docker dev container (full unbounded `jest`/`npm test` saturates the
# container and can lock it up — see CLAUDE.md).
#
# Tunables (env):
#   JEST_WORKERS   number or "%"  worker count (default 2; CI sets e.g. 50%)
#   NODE_HEAP_MB   integer        V8 old-space heap in MB (default 4096)
#
# Determinism: --workerIdleMemoryLimit recycles a worker that grows past the
# limit, so a heavy suite (e.g. SPECTRO's 62 windows of FFT buffers) can't pile
# heap across files and tip a later test over under load.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SEQ_SCRIPT="$SCRIPT_DIR/run_tests_sequentially.sh"

cd "$REPO_ROOT" || exit 1

# Curated list = the run_test "tests/..." entries in the sequential script.
mapfile -t FILES < <(grep -oE 'run_test "tests/[^"]+"' "$SEQ_SCRIPT" | sed 's/run_test "//; s/"$//')

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "ERROR: no curated test files found in $SEQ_SCRIPT" >&2
  exit 1
fi

WORKERS="${JEST_WORKERS:-2}"
HEAP_MB="${NODE_HEAP_MB:-4096}"

echo "==================================================================="
echo "Parallel check-in runner — ${#FILES[@]} curated tests"
echo "  workers: ${WORKERS}   node heap: ${HEAP_MB}MB   idle worker limit: 512MB"
echo "==================================================================="

node --max-old-space-size="${HEAP_MB}" node_modules/.bin/jest \
  --maxWorkers="${WORKERS}" \
  --workerIdleMemoryLimit=512MB \
  --colors \
  "${FILES[@]}"
