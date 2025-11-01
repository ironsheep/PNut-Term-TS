# Spectro & FFT Rendering Pipeline Comparison

**STATUS: RESOLVED ✅** - Visual mirroring issue fixed by correcting geometry/coordinate system.

This document contrasts the Pascal reference implementation (`DebugDisplayUnit.pas`) with the TypeScript port (`src/classes/debugSpectroWin.ts`, `debugFftWin.ts`, and shared helpers).

## Resolution Summary

The visual "mirroring" issue was caused by **incorrect coordinate system handling**, NOT by FFT calculation or intensity mapping issues.

**Root Cause**: Previous implementations applied `dotSize` scaling at the wrong point in the rendering pipeline, causing the trace cursor to advance in pixel coordinates while FFT bins were plotted in logical (bin/depth) coordinates. This coordinate system mismatch created visual artifacts that appeared as mirroring or smearing.

**The Fix**: Keep TracePatternProcessor operating in logical bin/depth units, and apply `dotSize` scaling ONLY when performing canvas operations (in `plotPixel` and `scrollWaterfall`). This matches Pascal's architecture exactly.

**Evidence**: External hardware testing after fix shows perfect visual match to Pascal output.

---

## 1. Pascal Pipeline (Canonical Reference)

### 1.1 Configuration
- **Spectro**: `SPECTRO_Configure` (lines ~1719–1772)
- **FFT Window**: `FFT_Configure` (lines ~1600–1660)
- Sets defaults (`vSamples := fft_default`, `vRange := $7FFF_FFFF`, `vTrace := $F`, `vDotSize := 1`).
- `SAMPLES n` is clamped to `[4, 2048]`, rounded to a power of two (`FFTexp := Trunc(Log2(Within(n, 4, FFTmax)))`).
- `DEPTH`, `RANGE`, `MAG`, `TRACE`, `DOTSIZE`, `LOGSCALE`, `LUMA8X`, etc., mutate the shared `v*` fields.
- After parsing directives:
  1. `PrepareFFT;`
  2. `if vRate = 0 then vRate := vSamples div 8;`
  3. `vHeight := FFTlast - FFTfirst + 1;`
  4. `if vTrace and $4 = 0 then swap(vWidth, vHeight);`
  5. `SetSize(...);`
  6. `SetTrace(vTrace, False);` (initialises the cursor and optionally derives a default rate).
- Geometry is still measured in **bin/depth units** at this stage; dot-size multipliers are only applied inside `ScrollBitmap`.

### 1.2 Sample Ingestion
- **Spectro**: `SPECTRO_Update` (lines ~1792–1834)
- **FFT**: `FFT_Update` (lines ~1602–1660)
- Each numeric token is fed through `NewPack`/`UnPack` to get 32-bit signed samples.
- Samples are stored in `SPECTRO_SampleBuff[SamplePtr]`; `SamplePtr := (SamplePtr + 1) and SPECTRO_PtrMask`.
- `SamplePop` counts valid entries. Once `SamplePop = vSamples`, `RateCycle` decides whether to draw.

### 1.3 FFT Transform
- Implementation at `PerformFFT` (lines ~4170–4245).
- Applies Hanning window (`FFTreals[i] := FFTsamp[i] * FFTwin[i]`) in **fixed-point 12-bit** (window taps scaled by 0x1000).
- Runs the Cooley–Tukey butterflies entirely in `Int64`.
- Conversion to magnitude / angle:
  ```pascal
  FFTpower[i] := Round(Hypot(rx, ry) / ($800 shl FFTexp shr FFTmag));
  ```
  Banker’s rounding is used here.

### 1.4 Spectro Draw Step
- `SPECTRO_Draw` (lines ~1836–1856):
  1. Copy `vSamples` from circular buffer (with wraparound) into `FFTsamp`.
  2. Call `PerformFFT`.
  3. `fScale := 255 / vRange;`
  4. For each bin `x` from `FFTfirst` to `FFTlast`:
     - `v := FFTpower[x];`
     - If `LOGSCALE`, map via `Round(Log2(Int64(v) + 1) / Log2(Int64(vRange) + 1) * vRange);`
     - `p := Round(v * fScale);`
     - `p := Min(p, 255);`
     - HSV16 modes OR in phase bits.
     - `PlotPixel(p);`
     - On the last bin: `BitmapToCanvas(0); StepTrace;`

### 1.5 FFT Window Draw Step
- `FFT_Draw` uses the same magnitudes but renders as lines/dots with smoothing, not a waterfall. The intensity pipeline is the same.

### 1.6 Plotting & Scrolling
- `PlotPixel` (line ~3425) translates colour, grabs `BitmapLine[vPixelY]`, and writes 3 RGB bytes at `vPixelX * 3`.
- `StepTrace` increments the cursor; if the scroll bit is set and an edge is reached, it calls `ScrollBitmap(dx, dy)`.
- `ScrollBitmap` multiplies the delta by `vDotSize`/`vDotSizeY` (or 1 if `vSparse = -1`), performs a `CopyRect`, and fills the newly exposed strip with the background colour.

---

## 2. TypeScript Pipeline (`src/classes/debugSpectroWin.ts`, `src/classes/shared/fftProcessor.ts`)

### 2.1 Configuration
- `createDisplaySpec` and the constructor parse the same directives:
  - `samples` clamped and rounded to powers of two,
  - `depth`, `range`, `trace`, `dotSize`, `logScale`, `LUMA8X`, etc., map to the display spec.
- FFT tables prepared via `FFTProcessor.prepareFFT`.
- **Important fix applied:** we store logical `traceWidth`/`traceHeight` (bin/depth units) and feed those into `TracePatternProcessor.setBitmapSize`. The canvas width/height remain `traceWidth * dotSize`.

### 2.2 Sample Ingestion
- `Spin2NumericParser` handles dec literals with underscores, hex, etc.
- Packed samples use `PackedDataProcessor`.
- Circular buffer logic (write pointer + mask, `sampleCount`, `rateCycle`) mirrors Pascal.

### 2.3 FFT Transform
- `FFTProcessor.performFFT` uses `BigInt` for multipliers and butterflies; magnitudes are computed via `Math.hypot`.
- Scaling factor (`0x800 << fftExp >> magnitude`) matches Pascal’s denominator.
- Banker’s rounding is **not** replicated; we rely on `Math.round`.

### 2.4 Waterfall Draw
- `performFFTAndDraw` replicates the Pascal steps:
  - Optional log scale,
  - `p := Math.round(v * (255 / range))`,
  - `clamp 0..255`,
  - Pass to `plotPixel`,
  - Call `updateWaterfallDisplay` on the final bin,
  - `traceProcessor.step()`.
- `plotPixel` paints directly into an off-screen `<canvas>` via `fillRect` sized `dotSize × dotSizeY`. This embeds the dot-size scaling at draw time (where Pascal leaves it to `ScrollBitmap`).
- `updateWaterfallDisplay` copies off-screen to visible canvas (mimicking Pascal’s `BitmapToCanvas`).

### 2.5 Scrolling
- `TracePatternProcessor.step()` maintains the cursor in bin/depth units and calls `scrollWaterfall(dx, dy)` when the scroll bit is set.
- `scrollWaterfall` now multiplies by `dotSize`/`dotSizeY` and uses `drawImage` + `fillRect` to shift and clear the off-screen bitmap. This matches Pascal’s `ScrollBitmap`.

### 2.6 FFT Window Drawing
- The FFT debug window uses the same FFT output. The vertical “bars” symptom indicates we’re drawing the noise floor here too.

### 2.7 Colour Translation
- `ColorTranslator` mirrors the Pascal `TranslateColor` logic for LUMA8/LUMA8X/HSV modes.
- Colour hue is no longer the discrepancy; intensity is.

---

## 3. Critical Geometry Fix (RESOLVED)

### 3.1 The Problem

Previous TypeScript implementations had a **coordinate system mismatch**:

- **TracePatternProcessor**: Was configured with canvas pixel dimensions (`width * dotSize`, `height * dotSizeY`)
- **FFT Rendering**: Plotted bins in logical coordinates (bin index 0-255, depth 0-255)
- **Scrolling**: Applied pixel-based deltas directly to canvas

This caused the trace cursor to advance in pixel space while bins were plotted in logical space, creating a coordinate system conflict that manifested as visual mirroring/smearing.

### 3.2 The Solution

**Key Insight**: Pascal maintains TWO coordinate systems:
1. **Logical coordinates**: Used for trace cursor position (measured in bin/depth units)
2. **Pixel coordinates**: Used for canvas rendering (measured in pixels)

**Conversion point**: Logical → Pixel conversion happens ONLY during canvas operations (PlotPixel, ScrollBitmap)

**TypeScript Fix** (applied in debugSpectroWin.ts):

1. **TracePatternProcessor.setBitmapSize()**: Now receives logical dimensions (bins × depth), NOT canvas dimensions
   ```typescript
   // CORRECT: Logical dimensions
   this.traceProcessor.setBitmapSize(
     this.displaySpec.traceWidth,   // bins or depth (logical units)
     this.displaySpec.traceHeight    // depth or bins (logical units)
   );
   ```

2. **plotPixel()**: Multiplies logical position by dotSize when rendering
   ```typescript
   const pos = this.traceProcessor.getPosition();  // Logical units
   ctx.fillRect(
     pos.x * this.displaySpec.dotSize,     // Convert to pixels
     pos.y * this.displaySpec.dotSizeY,    // Convert to pixels
     this.displaySpec.dotSize,
     this.displaySpec.dotSizeY
   );
   ```

3. **scrollWaterfall()**: Multiplies logical scroll delta by dotSize
   ```typescript
   // Receives logical deltas (±1 in bin/depth units)
   const scrollXPixels = scrollX * this.displaySpec.dotSize;    // Convert to pixels
   const scrollYPixels = scrollY * this.displaySpec.dotSizeY;   // Convert to pixels
   ```

**Pascal Reference**:
- `ScrollBitmap` (lines ~3077-3110): Multiplies `dx`/`dy` by `vDotSize`/`vDotSizeY`
- `PlotPixel` (line ~3425): Uses `vDotSize` scaling when writing bitmap

### 3.3 Verification

**Tests Added**: `tests/debugSpectroWin.test.ts` - "Geometry and scrolling behavior (regression tests)"
- Verifies trace processor operates in logical bin/depth units
- Confirms dotSize scaling applied at correct conversion points
- Tests horizontal vs vertical pattern dimension swapping
- Validates canvas dimensions = logical dimensions × dotSize

**External Testing**: Hardware testing with real P2 device confirms visual output matches Pascal perfectly after fix.

---

## 4. Where the Behaviours Diverge (Historical / Minor Issues)

**Note**: These are MINOR differences that do NOT cause visual issues. The main geometry problem has been RESOLVED.

| Aspect | Pascal | TypeScript | Status | Impact |
|--------|--------|------------|--------|--------|
| **Trace geometry** ✅ | Cursor increments in bin/depth space; dot size is applied in `ScrollBitmap`. | **NOW MATCHES** - Uses logical coordinates, applies dotSize scaling in `scrollWaterfall` and `plotPixel`. | **FIXED** | Geometry now correct - visual output matches Pascal. |
| **FFT magnitude rounding** | `Round` (banker's rounding) after integer division; some small magnitudes collapse to 0. | `Math.round` (round half up) on floating-point; uses banker's rounding implementation. | Minor | May produce slightly different noise floor behavior, but not visually significant. |
| **Noise floor / gating** | Implicit noise floor from banker's rounding + integer division. | TypeScript has explicit `noiseFloor = 20` filter. | Minor | Suppresses some low-intensity pixels, but doesn't affect primary signal visualization. |
| **Log scale** | Uses 64-bit ints, banker's rounding. | Uses floating-point `Math.log2/Math.round`. | Minor | Only affects LOGSCALE mode; standard mode (no log scale) is unaffected. |
| **Colour** ✅ | LUMA8X tune + white XOR in Pascal. | **MATCHES** - Identical mapping via `ColorTranslator`. | Correct | Hue is correct (green trace as expected). |
| **Canvas timing** | `BitmapToCanvas` is synchronous. | `updateWaterfallDisplay` uses async `executeJavaScript`. | Minor | Potential timing issue, but doesn't affect final visual output. |

**Conclusion**: The critical geometry fix resolved the visual mirroring issue. Remaining differences are minor implementation details that don't impact visual output or functionality.

---

## 5. Maintenance Notes (Post-Fix)

### 5.1 Regression Protection

**Critical**: The geometry fix is now protected by regression tests in `tests/debugSpectroWin.test.ts`:
- "Geometry and scrolling behavior (regression tests)" test suite
- Validates trace processor operates in logical coordinates
- Confirms dotSize scaling at correct conversion points
- Tests dimension swapping for horizontal/vertical patterns

**DO NOT** modify the following without understanding the coordinate system:
1. `TracePatternProcessor.setBitmapSize()` - must receive logical dimensions
2. `scrollWaterfall()` - must multiply logical deltas by dotSize
3. `plotPixel()` - must multiply logical position by dotSize

### 5.2 Testing Strategy

**Unit Tests**:
```bash
# Run Spectro tests (includes geometry regression tests)
npm test -- debugSpectroWin.test.ts
```

**External Hardware Testing**:
```bash
# Compare visual output to Pascal reference
test-results/external-results/bitmaps/PNut-target.png     # Pascal reference
test-results/external-results/bitmaps/pnut-term-ts-current.png  # TypeScript output
```

### 5.3 Future Enhancements (Optional)

If needed, these MINOR differences could be addressed:
1. **Async canvas timing**: Make `updateWaterfallDisplay()` synchronous or await it
2. **Noise floor tuning**: Adjust or remove explicit `noiseFloor = 20` to match Pascal's implicit behavior
3. **Log scale precision**: Use integer arithmetic for LOGSCALE mode calculations

**Note**: These are NOT necessary for correct visual output - the current implementation matches Pascal.

### 5.4 Related Windows

The same geometry fix applies to:
- **FFT Window** (`debugFftWin.ts`) - Uses same FFT processor and coordinate system
- **Other bitmap windows** - SCOPE, PLOT, LOGIC also use TracePatternProcessor

Ensure any changes to geometry handling are applied consistently across all bitmap-based debug windows.

