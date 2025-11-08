# FFT Noise Floor Diagnostic Investigation

**Date**: 2025-11-07
**Status**: 🔍 INVESTIGATING WITH DIAGNOSTICS

---

## Current Situation

### What We Know

1. **FFT Algorithm is CORRECT**: Tests prove TypeScript FFT produces identical output to Pascal/Python
   - Test file: `tests/fftRealHardwareComparison.test.ts`
   - Result: Both produce peak=427 at bin 74, noise floor=0.064
   - First 20 bins: ALL ZEROS in both implementations
   - Identical noise distribution: 989 zero bins, 14 non-zero bins (max value 17)

2. **Visual Output is DIFFERENT**: Despite identical FFT output
   - Pascal bitmap: Clean smooth bell curve, flat baseline
   - TypeScript bitmap: Noisy rough edges, jagged baseline
   - **This confirms the problem is in RENDERING, not FFT algorithm**

3. **Previous Fix Failed**: Changed `drawCombinedSpectrum()` to use `high = 0x7FFFFFFF`
   - This fix only affects combined mode (no channels configured)
   - Test uses channel mode (`MyFFT 'FFT' 0 1000...`), so fix had no effect
   - Need to investigate channel rendering path

### Test Configuration

From log `debug_251106-170319.log`:
```
Line 8: FFT MyFFT POS 0 0 SIZE 250 200 SAMPLES 2048 0 127 RATE 256 LOGSCALE COLOR YELLOW 4 YELLOW 5
Line 9: MyFFT 'FFT' 0 1000 180 10 15 YELLOW 12
```

Channel parameters:
- Channel name: 'FFT'
- low = 0
- high = 1000
- tall = 180
- base = 10
- grid = 15
- color = YELLOW
- magnitude = 12

Display parameters:
- LOGSCALE enabled
- SAMPLES 2048
- RATE 256 (new FFT every 256 samples)
- firstBin = 0, lastBin = 127

---

## Diagnostic Plan

### Phase 1: Enable Diagnostic Logging (COMPLETE)

**File**: `src/classes/debugFftWin.ts:31`
**Change**: `const ENABLE_CONSOLE_LOG: boolean = true;`

**Build**: ✅ Successful

### Phase 2: Capture Diagnostic Data (PENDING USER TEST)

The diagnostic logs will capture:

1. **Channel Detection** (line ~1382):
   ```
   -> Drawing ${this.channels.length} channel spectrums
   ```
   OR
   ```
   -> Drawing combined spectrum
   ```
   - **Critical**: Verify which mode is being used

2. **Sample Extraction** (lines 554-561):
   ```
   [FFT EXTRACT] Ch0 first 20 samples: [194, 380, 552, ...]
   [FFT EXTRACT] Ch0 stats: min=-1000, max=1000, mean=...
   ```
   - **Check**: Do extracted samples match log data?

3. **FFT Output** (lines 567-575):
   ```
   [FFT OUTPUT] Ch0 first 20 power bins: [0, 0, 0, ...]
   [FFT OUTPUT] Ch0 max power=... at bin=...
   ```
   - **Critical**: Do we see zeros in first 20 bins (like test)?
   - **Critical**: Or do we see noise (8, 5, 3, 7...) like old behavior?

4. **Bin Extraction** (lines 1670-1673):
   ```
   [FFT DRAW] Extracting bins 0 to 127 from power array length 1024
   [FFT DRAW] Raw power array first 10: [0, 0, 0, ...]
   ```
   - **Check**: Is raw FFT output clean?

5. **Log Scale Transformation** (lines 1686-1688):
   ```
   [FFT LOG SCALE] Bin 0: 0 -> 0
   [FFT LOG SCALE] Bin 1: 0 -> 0
   [FFT LOG SCALE] Bin 2: 5 -> 215
   ```
   - **Critical**: Are zeros staying zero after log scale?
   - **Critical**: Are small non-zero values (1-17) becoming large (100-400)?

6. **Drawing Parameters** (lines 1700-1716):
   ```
   [FFT DRAW] lineSize=..., dotSize=...
   [FFT DRAW] Channel: high=1000, tall=180, base=10
   [FFT DRAW] Power data: 128 bins, firstBin=0, lastBin=127
   [FFT DRAW] Max power=... at bin ...
   [FFT DRAW] First 10 bins: [0, 0, 0, ...]
   ```
   - **Check**: Is high=1000 (from channel config)?
   - **Check**: Are power values after log scale clean or noisy?

7. **Coordinate Calculation** (lines 1930-1935):
   ```
   [FFT DRAW COORDS] Point 0: powerData[0]=0, normalized=0.0000, x=..., y=...
   [FFT DRAW COORDS] Point 1: powerData[1]=0, normalized=0.0000, x=..., y=...
   ```
   - **Critical**: Are normalized values staying 0.0000 for zero-power bins?
   - **Critical**: Or are we seeing non-zero normalized values causing visual noise?

---

## Hypotheses to Test

### Hypothesis 1: Log Scale Amplification
**Theory**: Log scale with high=1000 amplifies small noise values
- Input: power=17 (max noise value from tests)
- Log scale: `Round((log2(18) / log2(1001)) * 1000)` = 418
- Normalized: 418 / 1000 = 0.418 → **42% of display height**
- **But**: Pascal uses SAME formula and stays clean!

**Diagnostic Check**:
- Look at `[FFT LOG SCALE]` output
- If we see zeros becoming non-zero → Log scale bug
- If we see non-zero becoming huge → Expected behavior

### Hypothesis 2: Buffer Management Issue
**Theory**: Sample extraction is getting stale or incorrect data
- **But**: Tests use SAME data from log and produce clean output

**Diagnostic Check**:
- Compare `[FFT EXTRACT]` samples with log file data
- Should see exact match: [194, 380, 552, 703, 827, ...]

### Hypothesis 3: FFT Algorithm Has Runtime Bug
**Theory**: FFT works in tests but fails in live app due to state/timing
- **But**: Multiple execution test (144 FFTs) showed algorithm stays clean

**Diagnostic Check**:
- Look at `[FFT OUTPUT]` first 20 bins
- Should be: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
- If not all zeros → Algorithm has runtime issue tests missed

### Hypothesis 4: Rendering/Anti-Aliasing Artifacts
**Theory**: Canvas rendering introduces visual noise on clean data
- **Most likely if** FFT output is clean but display is noisy

**Diagnostic Check**:
- If `[FFT OUTPUT]` and `[FFT LOG SCALE]` show clean data (zeros)
- But bitmap shows noise → Problem is in canvas rendering
- Check coordinate calculations in `[FFT DRAW COORDS]`

---

## Next Steps

1. **User tests with P2 hardware** using diagnostic build
2. **Analyze diagnostic logs** to identify exact point where noise appears
3. **Apply surgical fix** based on findings
4. **Disable diagnostic logging** when complete
5. **Update tests** to prevent regression

---

## Key Files

- **FFT Window**: `src/classes/debugFftWin.ts`
- **FFT Algorithm**: `src/classes/shared/fftProcessor.ts` (proven correct)
- **Test**: `tests/fftRealHardwareComparison.test.ts` (proves algorithm works)
- **Logs**: `test-results/external-results/debug_*.log`
- **Bitmaps**: `test-results/external-results/bitmaps/*.png`

---

## Expected Outcome

**Clean FFT Display Matching Pascal**:
- Smooth bell curve with no rough edges
- Flat baseline at zero with no jagged noise
- Only significant signal peaks visible
- Noise floor suppressed below display resolution
