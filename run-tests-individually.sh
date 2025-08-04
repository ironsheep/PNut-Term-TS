#!/bin/bash

# Script to run tests individually to avoid system overload

FAILED_TESTS=()
PASSED_TESTS=()
TOTAL_TIME=0

echo "Running tests individually..."
echo "================================"

# Get list of test files
TEST_FILES=$(./node_modules/.bin/jest --listTests | sort)

# Count total tests
TOTAL_TESTS=$(echo "$TEST_FILES" | wc -l)
CURRENT_TEST=0

for TEST_FILE in $TEST_FILES; do
    CURRENT_TEST=$((CURRENT_TEST + 1))
    echo ""
    echo "[$CURRENT_TEST/$TOTAL_TESTS] Running: $(basename $TEST_FILE)"
    echo "-----------------------------------"
    
    # Run the test and capture the result
    START_TIME=$(date +%s)
    
    if ./node_modules/.bin/jest "$TEST_FILE" --no-coverage --silent 2>&1 | grep -E "(PASS|FAIL|✓|✕)" | tail -5; then
        END_TIME=$(date +%s)
        ELAPSED=$((END_TIME - START_TIME))
        TOTAL_TIME=$((TOTAL_TIME + ELAPSED))
        
        # Check if test passed or failed
        if ./node_modules/.bin/jest "$TEST_FILE" --no-coverage --silent 2>&1 | grep -q "FAIL"; then
            echo "❌ FAILED (${ELAPSED}s)"
            FAILED_TESTS+=("$TEST_FILE")
        else
            echo "✅ PASSED (${ELAPSED}s)"
            PASSED_TESTS+=("$TEST_FILE")
        fi
    else
        echo "❌ ERROR running test"
        FAILED_TESTS+=("$TEST_FILE")
    fi
    
    # Small delay to prevent system overload
    sleep 0.5
done

echo ""
echo "================================"
echo "TEST SUMMARY"
echo "================================"
echo "Total tests run: $TOTAL_TESTS"
echo "Passed: ${#PASSED_TESTS[@]}"
echo "Failed: ${#FAILED_TESTS[@]}"
echo "Total time: ${TOTAL_TIME}s"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo "Failed tests:"
    for FAILED in "${FAILED_TESTS[@]}"; do
        echo "  - $(basename $FAILED)"
    done
fi

exit ${#FAILED_TESTS[@]}