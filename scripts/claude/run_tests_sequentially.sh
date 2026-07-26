#!/bin/bash
# Sequential test runner for Docker environment
# Runs all tests one at a time to avoid resource exhaustion

# Derive the total from the run_test call sites below so the counter never
# goes stale as tests are added/removed (previously hard-coded to 70).
EXPECTED_TOTAL=$(grep -c '^[[:space:]]*run_test "' "${BASH_SOURCE[0]}")

echo "==================================================================="
echo "Sequential Test Runner - Running all ${EXPECTED_TOTAL} tests individually"
echo "==================================================================="
echo ""

# No-skip / coverage gate FIRST — abort before spending time on tests if any
# present test file is unregistered/unexcluded, or any non-excluded test carries
# a .skip/.only marker. [sprint 0.9.47 §7]
GATE="$(dirname "${BASH_SOURCE[0]}")/check_test_coverage.sh"
if ! bash "$GATE"; then
    echo ""
    echo "❌ Aborting: test-coverage gate failed (see above). Fix registration/skips first."
    exit 1
fi
echo ""

# Build the worker_threads bundles BEFORE running. Several suites spawn the
# extraction / serial-IO workers from dist/workers/*.bundled.js; without this a
# fresh container fails them with 30s "worker ready/extract" timeouts (the bundle
# is gitignored, so it must be regenerated). See workaround memory note.
echo "Building worker bundles (dist/workers) ..."
if ! node esbuild.config.js > /dev/null 2>&1; then
    echo "❌ Aborting: failed to build dist/workers bundles (node esbuild.config.js)."
    exit 1
fi
echo "  ✅ worker bundles built"
echo ""

# Expose GC so heap-profiling tests can force collection and measure accurately
# (their global.gc() is otherwise a no-op → non-deterministic heap thresholds).
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--expose-gc"

# Counter for test results
TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

# Function to run a single test
run_test() {
    local test_file="$1"
    TOTAL=$((TOTAL + 1))

    echo "[$TOTAL/${EXPECTED_TOTAL}] Running: $test_file"

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
run_test "tests/commandDispatchMatrix.test.ts"
run_test "tests/colorTranslator.test.ts"
run_test "tests/colorTranslatorEdgeCases.test.ts"
run_test "tests/debugColor.test.ts"
run_test "tests/rateCycle.test.ts"
run_test "tests/midiConfigParse.test.ts"
run_test "tests/debugMidiWin.test.ts"
run_test "tests/midiResidualsParity.test.ts"
run_test "tests/context-ide-mode.test.ts"
run_test "tests/debugBitmapWin.encoding.test.ts"
run_test "tests/debugBitmapWin.test.ts"
run_test "tests/debugBitmapWin.commands.test.ts"
run_test "tests/debugBitmapWin.integration.test.ts"
run_test "tests/bitmapResidualsParity.test.ts"
# 9win-parity follow-on (#24): done-§ window suites finalized to current behavior
run_test "tests/debugScopeWin.test.ts"
run_test "tests/debugLogicWin.test.ts"
run_test "tests/debugWindowBase.test.ts"
run_test "tests/debugFftWin.test.ts"
run_test "tests/debugFftRendering.test.ts"
run_test "tests/debugFftCircularBuffer.test.ts"
run_test "tests/debugFftDataManagement.test.ts"
run_test "tests/debugSpectroWin.test.ts"
run_test "tests/spectroBinRangeBoundary.test.ts"
run_test "tests/debugScopeXyWin.test.ts"
run_test "tests/debuggerFixture.test.ts"
run_test "tests/debuggerInteraction.test.ts"
run_test "tests/debuggerDisplay.test.ts"
run_test "tests/debuggerReplay.test.ts"
run_test "tests/debuggerWorkerSingleFramer.test.ts"
run_test "tests/debuggerPhase3SizeRelay.test.ts"
run_test "tests/debuggerPhase2Isolation.test.ts"
run_test "tests/debuggerConstructorRegistration.test.ts"
run_test "tests/debuggerMultiCogReplay.test.ts"
run_test "tests/debuggerFirstContact.test.ts"
run_test "tests/debuggerDesyncRepro.test.ts"
run_test "tests/debuggerDesyncMechanismProof.test.ts"
run_test "tests/debuggerStreamingGuardrail.test.ts"
run_test "tests/cliExitCodes.test.ts"
run_test "tests/p2DebugHeader.test.ts"
run_test "tests/exitCodes.test.ts"
run_test "tests/headedExitDrain.test.ts"
run_test "tests/endSessionSentinel.test.ts"
# §5a sweep (2026-06-01): of 110 unregistered tests/*.test.ts, only these 7 still
# pass — the other 103 fail at suite-load (import refactored-away/renamed modules,
# e.g. shared/serialReceiver, shared/circularBuffer). Those are stale-test debt,
# tracked separately (NOT added here so the runner stays a true green baseline).
run_test "tests/cogMessageRouting.test.ts"
run_test "tests/dynamicQueue.test.ts"
run_test "tests/messageRouter.test.ts"
run_test "tests/sharedCircularBuffer.test.ts"
run_test "tests/spin2NumericParser.test.ts"
run_test "tests/winSyncPort.test.ts"
run_test "tests/usbTrafficLoggerCounts.test.ts"
run_test "tests/verifyStreamLog.test.ts"
run_test "tests/loggerLineAccumulation.test.ts"
run_test "tests/headlessLoggerLineAccumulation.test.ts"
run_test "tests/streamShapes.test.ts"
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
run_test "tests/fftConfigParity.test.ts"
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
run_test "tests/rxBackpressure.test.ts"
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
# 9win-parity follow-on (#24): PLOT window suites finalized to current behavior
run_test "tests/debugPlotWin.test.ts"
run_test "tests/debugPlotWin.integration.test.ts"
run_test "tests/debugPlotWin.commands.test.ts"
run_test "tests/plotHoverCoordinates.test.ts"
run_test "tests/plotHoverIntegration.test.ts"
run_test "tests/plotLutSystem.test.ts"
run_test "tests/plotMemoryManagement.test.ts"
run_test "tests/plotPascalIntegration.test.ts"
run_test "tests/plotCoordinateModelParity.test.ts"
run_test "tests/plotShapesSpritesParity.test.ts"
run_test "tests/plotUpdatePhaseDirectivesParity.test.ts"
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
run_test "tests/spectroConfigParity.test.ts"
run_test "tests/spectroFrequencyDiagnostic.test.ts"
run_test "tests/termResidualsParity.test.ts"
run_test "tests/debugTermWin.test.ts"
run_test "tests/tracePattern15Position.test.ts"
run_test "tests/tracePatternProcessor.test.ts"
run_test "tests/windowFunctions.test.ts"
run_test "tests/workerExtractor.simple.test.ts"
run_test "tests/workerExtraction.test.ts"
run_test "tests/workerSpritedefBug.test.ts"
# 9win-parity follow-on (#24) — FFT / shared-component / routing suites finalized to current behavior.
# NOTE: every present tests/*.test.ts is either registered below or listed (with a reason) in the
# EXCLUDED_TESTS block of scripts/claude/check_test_coverage.sh — the single authoritative record of
# what cannot run here. The guard (run at the top of this script) fails the build if that invariant
# breaks or if any non-excluded test carries a .skip/.only/xit marker. [sprint 0.9.47 §7]
run_test "tests/fftProcessor.detailed.test.ts"
run_test "tests/fftAccuracyVerification.test.ts"
run_test "tests/fftDeepDive.test.ts"
run_test "tests/fftExecutionTrace.test.ts"
run_test "tests/fftPowerScaleBug.test.ts"
run_test "tests/fftSpectralAnalysis.test.ts"
run_test "tests/fftWindowBugs.test.ts"
run_test "tests/fftDCSignalTest.test.ts"
run_test "tests/fftExactReplication.test.ts"
run_test "tests/fftScalingTrace.test.ts"
run_test "tests/fftTwiddleFactors.test.ts"
run_test "tests/fixedPointArithmetic.test.ts"
run_test "tests/hanningWindow.test.ts"
run_test "tests/hanningWindowComparison.test.ts"
run_test "tests/inputForwarder.test.ts"
run_test "tests/screenManager.test.ts"
run_test "tests/layerManager.test.ts"
run_test "tests/spriteManager.test.ts"
run_test "tests/triggerProcessor.test.ts"
run_test "tests/windowPlacer.test.ts"
run_test "tests/routerLogger.test.ts"
run_test "tests/routerLoggingPerformance.test.ts"
run_test "tests/recordingManager.test.ts"
run_test "tests/binaryRecording.test.ts"
run_test "tests/windowRouterIntegration.test.ts"
run_test "tests/serialMessageProcessorIntegration.test.ts"
run_test "tests/debugLoggerRouting.test.ts"
run_test "tests/debugLoggerWindow.test.ts"
# 9win-parity follow-on (#24) — final batch.
run_test "tests/baseClassCommonCommands.test.ts"
run_test "tests/debugMidiWin.integration.test.ts"
run_test "tests/tLongTransmission.test.ts"
run_test "tests/spectroEndToEnd.test.ts"

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
