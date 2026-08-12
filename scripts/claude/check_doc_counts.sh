#!/usr/bin/env bash
# check_doc_counts.sh — documentation-drift instrument, COUNT half.
#
# ADVISORY ONLY. Always exits 0.
#
# Every number asserted in prose is a claim with an authoritative source
# somewhere. This recomputes each one and reports mismatches with file and line.
# A number with NO computable source is itself a finding — the claim cannot be
# maintained, and should be reworded rather than re-checked.
#
# Registry below: one entry per claim family this project actually makes.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 0

EXCLUDE_RE='^(DOCs/plans/|DOCs/investigations/|DOCs/pure-process/|DOCs/project-specific/|DOCs/handoffs-to-|DOCs/history/|tasks/|node_modules/)'
mapfile -t DOCS < <(git ls-files '*.md' | grep -Ev "$EXCLUDE_RE")

fail=0
report() { echo "  MISMATCH  $1"; fail=$((fail + 1)); }

echo "== COUNT — numbers asserted in prose vs their authoritative source =="
echo

# --- 1. Test-suite total -----------------------------------------------------
# Registration drift (a suite on disk that the sequential runner never runs) is
# ALREADY gated by scripts/claude/check_test_coverage.sh, which owns the
# authoritative EXCLUDED_TESTS list with a reason per entry. Do not re-implement
# that here — a second, dumber copy of a gate is exactly the duplication this
# instrument exists to report. What belongs here is the DOC claim: how many
# suites the prose says there are, versus how many the runner actually runs.
listed_tests=$(grep -cE '^[[:space:]]*run_test "tests/' scripts/claude/run_tests_sequentially.sh 2>/dev/null || echo 0)
on_disk=$(ls tests/*.test.ts 2>/dev/null | wc -l | tr -d ' ')
echo "suites run by the sequential runner: $listed_tests (of $on_disk on disk; the"
echo "  difference is the documented HW/env exclusion list — run check_test_coverage.sh)"
for doc in "${DOCS[@]}"; do
  grep -noE '[0-9]+ (test )?(suites|test files)' "$doc" 2>/dev/null | while IFS=: read -r line claim; do
    n=$(printf '%s' "$claim" | grep -oE '^[0-9]+')
    [ "$n" = "$listed_tests" ] || echo "  MISMATCH  $doc:$line claims '$claim', runner runs $listed_tests"
  done
done
echo

# --- 2. Debug window types ---------------------------------------------------
# Authoritative source: the window implementations themselves. debugWindowBase is
# the base class, not a window; loggerWin is a window but is not named debug*.
display_windows=$(ls src/classes/debug*Win.ts 2>/dev/null \
  | grep -vE 'debugWindowBase|debugDebuggerWin' | wc -l | tr -d ' ')
actual_windows=$((display_windows + 2))   # + the single-step debugger + the logger
echo "debug DISPLAY windows: $display_windows   window classes in total: $actual_windows"
for doc in "${DOCS[@]}"; do
  grep -noE '[0-9]+ (debug )?window types' "$doc" 2>/dev/null | while IFS=: read -r line claim; do
    n=$(printf '%s' "$claim" | grep -oE '^[0-9]+')
    [ "$n" = "$actual_windows" ] || echo "  MISMATCH  $doc:$line claims '$claim', actual $actual_windows"
  done
done
echo

# --- 3. Exit codes -----------------------------------------------------------
# Authoritative source: the ExitCode enum. The literal process.exit() sites are
# NOT authoritative — the contract is centralized, and reading the call sites
# instead reports every documented code as an orphan (learned on the first run).
mapfile -t actual_codes < <(grep -oE '=[[:space:]]*[0-9]+' src/utils/exitCodes.ts 2>/dev/null \
  | grep -oE '[0-9]+' | sort -un)
echo "exit codes in source: ${actual_codes[*]:-none}"
for doc in "${DOCS[@]}"; do
  grep -noE 'exit code[s]? [0-9]+' "$doc" 2>/dev/null | while IFS=: read -r line claim; do
    n=$(printf '%s' "$claim" | grep -oE '[0-9]+$')
    printf '%s\n' "${actual_codes[@]}" | grep -qx "$n" \
      || echo "  MISMATCH  $doc:$line documents exit code $n, which no source site sets"
  done
done
echo

# --- 4. Packaged platform/architecture matrix --------------------------------
actual_pkg=$(grep -cE '^\s*"package(Win|Linux|Mac)"' package.json 2>/dev/null || echo 0)
echo "platform package scripts in package.json: $actual_pkg (x2 architectures each)"
for doc in "${DOCS[@]}"; do
  grep -noE '[0-9]+ (architecture )?packages' "$doc" 2>/dev/null | while IFS=: read -r line claim; do
    n=$(printf '%s' "$claim" | grep -oE '^[0-9]+')
    [ "$n" = "$((actual_pkg * 2))" ] || echo "  MISMATCH  $doc:$line claims '$claim', actual $((actual_pkg * 2))"
  done
done
echo

echo "(advisory — exit 0 regardless of findings)"
exit 0
