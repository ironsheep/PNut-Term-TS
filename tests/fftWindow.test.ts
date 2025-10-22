/** @format */

import { DebugFFTWindow, FFTDisplaySpec } from '../src/classes/debugFftWin';

/**
 * FFT Window Diagnostic Test Suite
 *
 * PURPOSE: Diagnose why FFT window displays noise instead of clean sine wave peak
 *
 * SYMPTOMS FROM EXTERNAL TEST (test-results/external-results/):
 * 1. Bitmap shows: Yellow FFT spectrum with noise across all frequencies
 * 2. Expected: Single peak at sine wave frequency
 * 3. Scope window (same data) shows: Clean sine wave in cyan
 * 4. Data format: `MyFFT MyScope <value>` - multi-window update
 *
 * TEST DATA SOURCE:
 * - Creation: debug_251017-165231.log line 8
 * - Channel: debug_251017-165231.log line 9
 * - Sine wave: debug_251017-165231.log lines 13-100
 *
 * INVESTIGATION FINDINGS:
 * See test output for detailed analysis of multi-window format and data processing
 */

describe('FFT Window Diagnostic Tests', () => {
  describe('Configuration Parsing', () => {
    test('should correctly parse FFT creation command from DEBUG_FFT.spin2', () => {
      // Real creation command from external test log line 8:
      // `FFT MyFFT POS 0 0 SIZE 250 200 SAMPLES 2048 0 127 RATE 256 LOGSCALE COLOR YELLOW 4 YELLOW 5
      const lineParts = [
        'FFT', 'MyFFT', 'POS', '0', '0', 'SIZE', '250', '200',
        'SAMPLES', '2048', '0', '127', 'RATE', '256', 'LOGSCALE',
        'COLOR', 'YELLOW', '4', 'YELLOW', '5'
      ];

      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', lineParts);

      // Validate critical FFT parameters
      expect(spec.displayName).toBe('MyFFT');
      expect(spec.samples).toBe(2048); // FFT size
      expect(spec.firstBin).toBe(0);   // Display range start
      expect(spec.lastBin).toBe(127);  // Display range end
      expect(spec.rate).toBe(256);     // Samples between FFT updates
      expect(spec.logScale).toBe(true); // Log scale enabled

      console.log('\n✓ FFT Configuration parsed correctly:');
      console.log(`  - FFT Size: ${spec.samples} samples`);
      console.log(`  - Display Range: bin ${spec.firstBin} to ${spec.lastBin}`);
      console.log(`  - Update Rate: Every ${spec.rate} samples`);
      console.log(`  - Log Scale: ${spec.logScale ? 'ENABLED' : 'disabled'}`);
    });
  });

  describe('Data Format Analysis', () => {
    test('SYMPTOM: Multi-window update format analysis', () => {
      console.log('\n=== MULTI-WINDOW DATA FORMAT ===');
      console.log('\nFrom DEBUG_FFT.spin2 line 18:');
      console.log('  debug(`MyFFT MyScope `(k))');
      console.log('\nThis sends value k to BOTH windows simultaneously!');

      console.log('\n📊 Data Flow:');
      console.log('  1. Propeller P2 sends: `MyFFT MyScope 194');
      console.log('  2. Router parses: ["MyFFT", "MyScope", "194"]');
      console.log('  3. Router strips first window, sends to MyFFT: ["MyScope", "194"]');
      console.log('  4. FFT window receives: ["MyScope", "194"]');

      console.log('\n🔍 FFT Window Processing (debugFftWin.ts:1055-1146):');
      console.log('  for each part in ["MyScope", "194"]:');
      console.log('    - "MyScope": Not a number -> IGNORED ❌');
      console.log('    - "194": Is a number -> PROCESSED as sample ✓');

      console.log('\n📌 FINDING:');
      console.log('  - "MyScope" string is silently dropped');
      console.log('  - Only numeric value "194" is processed');
      console.log('  - This is CORRECT behavior - second window name should be ignored');
      console.log('  - Router should send value to BOTH windows separately');

      expect(true).toBe(true);
    });

    test('SYMPTOM: Actual sine wave data from external test', () => {
      // First 50 samples from debug log (one complete sine wave cycle)
      const actualData = [
        194, 380, 552, 703, 827, 920, 979, 1000, 983, 929,
        840, 719, 570, 400, 215, 21, -173, -361, -535, -689,
        -817, -913, -975, -1000, -986, -935, -848, -729, -582, -413,
        -228, -34, 161, 350, 526, 681, 811, 909, 973, 999,
        987, 938, 852, 733, 587, 417, 232, 38, -158, -347
      ];

      console.log('\n=== SINE WAVE DATA ANALYSIS ===');
      console.log(`\n📈 Sample count: ${actualData.length} values`);
      console.log(`   Range: ${Math.min(...actualData)} to ${Math.max(...actualData)}`);
      console.log(`   Amplitude: ~1000 (±1000 range)`);

      // Estimate frequency by counting zero crossings
      let zeroCrossings = 0;
      for (let i = 1; i < actualData.length; i++) {
        if ((actualData[i-1] < 0 && actualData[i] >= 0) ||
            (actualData[i-1] >= 0 && actualData[i] < 0)) {
          zeroCrossings++;
        }
      }
      const cycles = zeroCrossings / 2;

      console.log(`\n🌊 Wave Characteristics:`);
      console.log(`   Zero crossings: ${zeroCrossings}`);
      console.log(`   Complete cycles in ${actualData.length} samples: ~${cycles.toFixed(1)}`);
      console.log(`   Estimated period: ~${(actualData.length / cycles).toFixed(1)} samples`);

      console.log('\n✅ EXPECTED FFT OUTPUT:');
      console.log(`   Single peak at bin ${Math.round(cycles * 2048 / actualData.length)}`);
      console.log(`   (frequency = ${cycles} cycles per ${actualData.length} samples)`);

      console.log('\n❌ ACTUAL FFT OUTPUT (from bitmap):');
      console.log('   Noisy spectrum across ALL frequency bins');
      console.log('   No clear single peak visible');

      expect(actualData.length).toBe(50);
    });
  });

  describe('Root Cause Hypotheses', () => {
    test('HYPOTHESIS #1: Data routing is correct, issue is in FFT processing', () => {
      console.log('\n=== HYPOTHESIS #1 ===');
      console.log('\n📋 Evidence:');
      console.log('  ✓ Multi-window format is handled (MyScope ignored, value processed)');
      console.log('  ✓ Scope window shows clean sine wave (same data source)');
      console.log('  ✓ FFT window is receiving numeric values');

      console.log('\n🔍 Suspect Areas (debugFftWin.ts):');
      console.log('  1. addSample() (line 270): Buffer management');
      console.log('     - Is channelMask set correctly? (line 278)');
      console.log('     - Is sampleWritePtr advancing? (line 302)');
      console.log('     - Is samplePop counting correctly? (line 305-307)');

      console.log('  2. rateCycle() (line 395): FFT triggering');
      console.log('     - Is rateCounter initialized correctly? (line 224)');
      console.log('     - Is rate being reached? (line 397)');

      console.log('  3. extractSamplesForFFT() (line 411): Sample extraction');
      console.log('     - Is startPtr calculated correctly? (line 499, 543)');
      console.log('     - Are samples extracted in correct order?');

      console.log('  4. FFTProcessor.performFFT() (line 523, 549): FFT calculation');
      console.log('     - Is window function applied correctly?');
      console.log('     - Is magnitude calculation correct?');

      console.log('\n💡 NEXT STEPS:');
      console.log('  1. Enable console logging in debugFftWin.ts (line 31: ENABLE_CONSOLE_LOG = true)');
      console.log('  2. Run external test with logging enabled');
      console.log('  3. Check log output for:');
      console.log('     - samplePop reaching 2048');
      console.log('     - rateCycle returning true');
      console.log('     - FFT being triggered');
      console.log('     - Sample extraction values');

      expect(true).toBe(true);
    });

    test('HYPOTHESIS #2: Channel mask not initialized', () => {
      console.log('\n=== HYPOTHESIS #2 ===');
      console.log('\nChannel configuration from debug log line 9:');
      console.log('  `MyFFT \'FFT\' 0 1000 180 10 15 YELLOW 12');

      console.log('\n🔍 Expected Behavior:');
      console.log('  1. FFT window receives channel config');
      console.log('  2. Adds channel to this.channels array (line 1065)');
      console.log('  3. Sets channelMask |= (1 << channelIndex) (line 1068)');
      console.log('  4. Channel 0 should be enabled');

      console.log('\n❓ Potential Issue:');
      console.log('  - Is channel config being processed before data?');
      console.log('  - Is channelMask remaining at default 0x01? (line 164)');
      console.log('  - Are samples being added to correct channel?');

      console.log('\n💡 CHECK:');
      console.log('  Add logging in parseChannelConfiguration() (line 1165)');
      console.log('  Add logging in addSample() to show channelMask state');

      expect(true).toBe(true);
    });

    test('HYPOTHESIS #3: Wrong data being fed to FFT', () => {
      console.log('\n=== HYPOTHESIS #3 ===');
      console.log('\n🤔 Question:');
      console.log('  Is the FFT receiving SCOPE data instead of its own data?');

      console.log('\n📊 Data Source Analysis:');
      console.log('  Command: debug(`MyFFT MyScope `(k))');
      console.log('  This sends SAME value to BOTH windows');
      console.log('  Both MyFFT and MyScope receive identical sine wave');

      console.log('\n✓ CONCLUSION:');
      console.log('  Data source is CORRECT');
      console.log('  FFT should be receiving sine wave values');
      console.log('  Issue must be in FFT processing, not data routing');

      expect(true).toBe(true);
    });
  });

  describe('Action Items', () => {
    test('TODO: Enable diagnostic logging and re-run external test', () => {
      console.log('\n=== IMMEDIATE ACTIONS ===');
      console.log('\n1. Enable FFT window logging:');
      console.log('   File: src/classes/debugFftWin.ts');
      console.log('   Line 31: Change ENABLE_CONSOLE_LOG to true');
      console.log('   Line 198: Already set isLogging = true');

      console.log('\n2. Re-run external hardware test:');
      console.log('   - Upload DEBUG_FFT.bin to Propeller P2');
      console.log('   - Capture new console log');
      console.log('   - Look for FFT-specific log messages');

      console.log('\n3. Analyze new logs for:');
      console.log('   ✓ samplePop increments');
      console.log('   ✓ rateCycle triggers');
      console.log('   ✓ FFT processing calls');
      console.log('   ✓ Channel configuration parsing');
      console.log('   ✓ Sample buffer state');

      console.log('\n4. Compare with SCOPE window:');
      console.log('   - SCOPE shows correct sine wave');
      console.log('   - SCOPE uses similar buffer management');
      console.log('   - What is SCOPE doing differently?');

      expect(true).toBe(true);
    });
  });
});
