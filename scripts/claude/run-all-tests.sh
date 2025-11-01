#!/bin/bash

# Run all tests individually and capture results with timing
echo "Starting test discovery at $(date -u)"
echo ""

TEST_FILES=(
"canvasRenderer.test.ts"
"cogMessageRouting.test.ts"
"colorCommand.test.ts"
"colorTranslator.test.ts"
"context-ide-mode.test.ts"
"debugBitmapWin.commands.test.ts"
"debugBitmapWin.integration.test.ts"
"debugBitmapWin.test.ts"
"debugColor.test.ts"
"debugDebuggerWin.test.ts"
"debugLoggerRouting.test.ts"
"debugLoggerWindow.test.ts"
"debugFftCircularBuffer.test.ts"
"debugFftDataManagement.test.ts"
"debugFftRendering.test.ts"
"debugFftWin.test.ts"
"hanningWindow.test.ts"
"debugLogicWin.test.ts"
"debugMidiWin.integration.test.ts"
"debugMidiWin.test.ts"
"debugPlotWin.commands.test.ts"
"debugPlotWin.integration.test.ts"
"debugPlotWin.test.ts"
"plotCompoundCommands.test.ts"
"plotConfigureCommands.test.ts"
"plotDrawingCommands.test.ts"
"plotHoverCoordinates.test.ts"
"plotHoverIntegration.test.ts"
"plotIntegration.test.ts"
"plotInteractiveCommands.test.ts"
"plotPerformance.test.ts"
"plotRegressionSuite.test.ts"
"plotRenderingCommands.test.ts"
"plotSpriteCommands.test.ts"
"plotTextCommand.test.ts"
"plotTokenizer.test.ts"
"debugScopeWin.test.ts"
"debugScopeXyWin.test.ts"
"debugTermWin.test.ts"
"debugWindowBase.test.ts"
"debuggerDataManager.test.ts"
"debuggerInteraction.test.ts"
"debuggerProtocol.test.ts"
"debuggerRenderer.test.ts"
"disassembler.test.ts"
"displaySpecParser.test.ts"
"fftAccuracyVerification.test.ts"
"fftProcessor.test.ts"
"ide-mode.test.ts"
"inputForwarder.test.ts"
"integrationTests.test.ts"
"layerManager.test.ts"
"logicTrigger.test.ts"
"lutManager.test.ts"
"memoryLeakDetection.test.ts"
"multiCogDebugger.test.ts"
"p2DebugOutput.test.ts"
"packedDataIntegration.test.ts"
"packedDataProcessor.test.ts"
"performanceBenchmark.test.ts"
"persistenceManager.test.ts"
"pianoKeyboardLayout.test.ts"
"recordingCatalog.test.ts"
"recordingManager.test.ts"
"routerLogger.test.ts"
"routerLoggingPerformance.test.ts"
"scopeTrigger.test.ts"
"scopeXyRenderer.test.ts"
"screenManager.test.ts"
"spacingDirective.test.ts"
"spin2NumericParser.test.ts"
"spriteManager.test.ts"
"tracePatternProcessor.test.ts"
"triggerProcessor.test.ts"
"windowFunctions.test.ts"
"windowPlacer.test.ts"
"windowRouter.test.ts"
"windowRouterIntegration.test.ts"
)

FAILED_FILES=()
PASS_COUNT=0
FAIL_COUNT=0
SKIP_FILES=()
TOTAL_RUNTIME=0
RUNTIME_DATA=()

for test_file in "${TEST_FILES[@]}"; do
    echo "Testing: $test_file"
    
    # Start timer
    start_time=$(date +%s.%N)
    
    # Run test and capture output
    output=$(npx jest tests/$test_file --no-coverage 2>&1)
    
    # End timer and calculate runtime
    end_time=$(date +%s.%N)
    runtime=$(awk "BEGIN {print $end_time - $start_time}")
    runtime_formatted=$(printf "%.3f" $runtime)
    
    # Check if test has .skip
    has_skip=false
    if echo "$output" | grep -q "skipped"; then
        has_skip=true
        SKIP_FILES+=("$test_file")
    fi
    
    # Check if test passed or failed
    if echo "$output" | grep -q "FAIL tests/$test_file"; then
        echo "❌ FAIL: $test_file (${runtime_formatted}s)"
        FAILED_FILES+=("$test_file")
        FAIL_COUNT=$((FAIL_COUNT + 1))
        
        # Extract error summary
        echo "$output" | grep -A 20 "FAIL tests/$test_file" | head -30
        echo ""
    else
        echo "✅ PASS: $test_file (${runtime_formatted}s)"
        PASS_COUNT=$((PASS_COUNT + 1))
        
        # Extract test count
        test_info=$(echo "$output" | grep "Tests:" | tail -1)
        echo "$test_info"
        
        # Save runtime data for passing tests without skips
        if [ "$has_skip" = false ]; then
            RUNTIME_DATA+=("$test_file:$runtime_formatted")
            TOTAL_RUNTIME=$(awk "BEGIN {print $TOTAL_RUNTIME + $runtime}")
        fi
        
        # Note if file has skipped tests
        if [ "$has_skip" = true ]; then
            echo "  ⚠️  Has skipped tests"
        fi
    fi
    echo "---"
done

echo ""
echo "Test Discovery Complete at $(date -u)"
echo "Total files tested: ${#TEST_FILES[@]}"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
    echo "Failed test files:"
    for failed in "${FAILED_FILES[@]}"; do
        echo "  - $failed"
    done
    echo ""
fi

if [ ${#SKIP_FILES[@]} -gt 0 ]; then
    echo "Files with skipped tests:"
    for skipped in "${SKIP_FILES[@]}"; do
        echo "  - $skipped"
    done
    echo ""
fi

# Show runtime statistics for passing tests without skips
if [ ${#RUNTIME_DATA[@]} -gt 0 ]; then
    echo "Runtime Statistics (passing tests without skips):"
    echo "Total runtime: $(printf "%.3f" $TOTAL_RUNTIME)s"
    echo ""
    echo "Individual runtimes:"
    for data in "${RUNTIME_DATA[@]}"; do
        file=$(echo "$data" | cut -d: -f1)
        time=$(echo "$data" | cut -d: -f2)
        printf "  %-40s %6ss\n" "$file" "$time"
    done
fi