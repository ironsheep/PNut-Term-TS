#!/bin/bash

# Test runner script for individual test files
TEST_FILES=(
"canvasRenderer.test.ts"
"colorCommand.test.ts"
"colorTranslator.test.ts"
"debugBitmapWin.commands.test.ts"
"debugBitmapWin.integration.test.ts"
"debugBitmapWin.test.ts"
"debugColor.test.ts"
"debugLogicWin.test.ts"
"debugMidiWin.integration.test.ts"
"debugMidiWin.test.ts"
"debugPlotWin.commands.test.ts"
"debugPlotWin.integration.test.ts"
"debugPlotWin.test.ts"
"debugScopeWin.test.ts"
"debugTermWin.test.ts"
"debugWindowBase.test.ts"
"displaySpecParser.test.ts"
"inputForwarder.test.ts"
"integrationTests.test.ts"
"layerManager.test.ts"
"logicTrigger.test.ts"
"lutManager.test.ts"
"packedDataIntegration.test.ts"
"packedDataProcessor.test.ts"
"pianoKeyboardLayout.test.ts"
"scopeTrigger.test.ts"
"spacingDirective.test.ts"
"spin2NumericParser.test.ts"
"spriteManager.test.ts"
"tracePatternProcessor.test.ts"
"triggerProcessor.test.ts"
)

echo "Testing file: $1"
npx jest tests/$1 --no-coverage 2>&1 | grep -E "(PASS|FAIL|Test Suites:|Tests:|✓|✗)" | tail -20