#!/bin/bash

# Files we fixed or recently added
test_files=(
  "tests/inputForwarder.test.ts"
  "tests/debugPlotWin.test.ts"
  "tests/debugMidiWin.test.ts"
  "tests/debugMidiWin.integration.test.ts"
  "tests/debugScopeWin.test.ts"
  "tests/debugScopeXyWin.test.ts"
  "tests/persistenceManager.test.ts"
  "tests/scopeXyRenderer.test.ts"
)

echo "Checking test status for fixed files..."
echo "======================================="

for file in "${test_files[@]}"; do
  echo -n "Testing $file ... "
  result=$(npx jest "$file" --silent 2>&1 | grep -E "(Test Suites:|Tests:|Time:)" | tail -3 | tr '\n' ' ')
  echo "$result"
done