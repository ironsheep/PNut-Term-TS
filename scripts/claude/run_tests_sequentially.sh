#!/bin/bash
# Sequential test runner for Docker environment
# Runs all tests one at a time to avoid resource exhaustion

echo "==================================================================="
echo "Sequential Test Runner - Running all 70 tests individually"
echo "==================================================================="
echo ""

# Counter for test results
TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

# Function to run a single test
run_test() {
    local test_file="$1"
    TOTAL=$((TOTAL + 1))

    echo "[$TOTAL/70] Running: $test_file"

    if npm test -s -- "$test_file" > /dev/null 2>&1; then
        PASSED=$((PASSED + 1))
        echo "  ✅ PASSED"
    else
        FAILED=$((FAILED + 1))
        FAILED_TESTS+=("$test_file")
        echo "  ❌ FAILED"
    fi
    echo ""
}

# Run all tests
run_test "tests/agent20PackedDataDemo.test.ts"
run_test "tests/buffer-read-order.test.ts"
run_test "tests/canvasRenderer.test.ts"
run_test "tests/cog2DebugLoggerRouting.test.ts"
run_test "tests/colorCommand.test.ts"
run_test "tests/colorTranslator.test.ts"
run_test "tests/colorTranslatorEdgeCases.test.ts"
run_test "tests/debugColor.test.ts"
run_test "tests/rateCycle.test.ts"
run_test "tests/midiConfigParse.test.ts"
run_test "tests/context-ide-mode.test.ts"
run_test "tests/debugBitmapWin.encoding.test.ts"
run_test "tests/debugScopeXyWin.test.ts"
run_test "tests/debuggerFixture.test.ts"
run_test "tests/debuggerInteraction.test.ts"
run_test "tests/debuggerDisplay.test.ts"
run_test "tests/exitCodes.test.ts"
run_test "tests/headedExitDrain.test.ts"
# §5a sweep (2026-06-01): of 110 unregistered tests/*.test.ts, only these 7 still
# pass — the other 103 fail at suite-load (import refactored-away/renamed modules,
# e.g. shared/serialReceiver, shared/circularBuffer). Those are stale-test debt,
# tracked separately (NOT added here so the runner stays a true green baseline).
run_test "tests/cogMessageRouting.test.ts"
run_test "tests/debuggerPacketTest.test.ts"
run_test "tests/dynamicQueue.test.ts"
run_test "tests/messageRouter.test.ts"
run_test "tests/sharedCircularBuffer.test.ts"
run_test "tests/spin2NumericParser.test.ts"
run_test "tests/windowRouter.test.ts"
run_test "tests/pasm2Disassembler.test.ts"
run_test "tests/disassemblerGolden.test.ts"
run_test "tests/disassemblerCorpus.test.ts"
run_test "tests/displaySpecParser.test.ts"
run_test "tests/fft2048.test.ts"
run_test "tests/fftActualDataOverflow.test.ts"
run_test "tests/fftBitReversalAnalysis.test.ts"
run_test "tests/fftBitReversalTrace.test.ts"
run_test "tests/fftBufferExtraction.test.ts"
run_test "tests/fftButterflyDiag.test.ts"
run_test "tests/fftDefinitiveBug.test.ts"
run_test "tests/fftExtractionComparison.test.ts"
run_test "tests/fftInputBitReverse.test.ts"
run_test "tests/fftNoWindow.test.ts"
run_test "tests/fftNoiseFloorComparison.test.ts"
run_test "tests/fftOutputOrderTest.test.ts"
run_test "tests/fftProcessor.test.ts"
run_test "tests/fftRev32.test.ts"
run_test "tests/fftRev32Analysis.test.ts"
run_test "tests/fftScaleFactorTest.test.ts"
run_test "tests/fftSineWavePeak.test.ts"
run_test "tests/fftSmoothSpectrumTest.test.ts"
run_test "tests/fftWindow.test.ts"
run_test "tests/fftWindowLogic.test.ts"
run_test "tests/fixedPointDetailedDemo.test.ts"
run_test "tests/hanningWindowEnergy.test.ts"
run_test "tests/hsv16Worker.test.ts"
run_test "tests/ide-mode.test.ts"
run_test "tests/integrationTests.test.ts"
run_test "tests/logicConfigParity.test.ts"
run_test "tests/logicTrigger.test.ts"
run_test "tests/lutManager.test.ts"
run_test "tests/mathLibraryDifferences.test.ts"
run_test "tests/messageClassificationRouting.test.ts"
run_test "tests/p2DebugOutput.test.ts"
run_test "tests/packedDataIntegration.test.ts"
run_test "tests/packedDataProcessor.test.ts"
run_test "tests/pascalInt64Overflow.test.ts"
run_test "tests/pcInputCaptureWiring.test.ts"
run_test "tests/pcMouseLong2Color.test.ts"
run_test "tests/pcMouseWireTransform.test.ts"
run_test "tests/persistenceManager.test.ts"
run_test "tests/pianoKeyboardLayout.test.ts"
run_test "tests/plotPascalHarness.test.ts"
run_test "tests/plotPascalInteractive.test.ts"
run_test "tests/recordingCatalog.test.ts"
run_test "tests/rgbi8xDirectiveColor.test.ts"
run_test "tests/scopeConfigParity.test.ts"
run_test "tests/scopeTrigger.test.ts"
run_test "tests/scopeTriggerReal.test.ts"
run_test "tests/scopeTriggerRefactor.test.ts"
run_test "tests/scopeXy3xBug.test.ts"
run_test "tests/scopeXyConfigParity.test.ts"
run_test "tests/scopeXyRender3x.test.ts"
run_test "tests/scopeXyRenderer.test.ts"
run_test "tests/serialProcessorIntegration.test.ts"
run_test "tests/sharedMessagePool.test.ts"
run_test "tests/spacingDirective.test.ts"
run_test "tests/spectroAsyncTiming.test.ts"
run_test "tests/spectroCircularBufferWrap.test.ts"
run_test "tests/spectroFrequencyDiagnostic.test.ts"
run_test "tests/tracePattern15Position.test.ts"
run_test "tests/tracePatternProcessor.test.ts"
run_test "tests/windowFunctions.test.ts"
run_test "tests/workerExtractor.simple.test.ts"
run_test "tests/workerSpritedefBug.test.ts"

# Print summary
echo "==================================================================="
echo "TEST SUMMARY"
echo "==================================================================="
echo "Total Tests:  $TOTAL"
echo "Passed:       $PASSED"
echo "Failed:       $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "Failed Tests:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  ❌ $test"
    done
    echo ""
    exit 1
else
    echo "✅ All tests passed!"
    exit 0
fi
