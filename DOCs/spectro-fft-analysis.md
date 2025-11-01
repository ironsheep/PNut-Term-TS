# Spectro & FFT Rendering Pipeline Comparison

This document contrasts the Pascal reference implementation (`DebugDisplayUnit.pas`) with the TypeScript port (`src/classes/debugSpectroWin.ts`, `debugFftWin.ts`, and shared helpers). The goal is to identify where the current TypeScript behaviour diverges from Pascal, especially around intensity mapping, so we can match the reference output.

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

## 3. Where the Behaviours Diverge

| Aspect | Pascal | TypeScript | Impact |
|--------|--------|------------|--------|
| **FFT magnitude rounding** | `Round` (banker’s rounding) after integer division; many small magnitudes collapse to 0. | `Math.round` (round half up) on doubles; values that should round to 0 often become 1. | Leads to extra low-intensity columns (1–4) being plotted. |
| **Noise floor / gating** | Practical output shows >200 bins blacked out. Combined with banker’s rounding and integer division, the noise floor stays at 0. | We draw every positive pixel. With the recorded sample (`RANGE 1000`), 230 bins yield `pixel > 0`, 24 bins reach `pixel ≥ 20`. | Waterfall becomes a solid green band. Same issue affects FFT window. |
| **Trace geometry** | Cursor increments in bin/depth space; dot size is applied in `ScrollBitmap`. | We now match this (scaled `scrollX/Y` inside `scrollWaterfall`). Previous versions used canvas-size, causing smearing. | Geometry is now correct—only intensity remains off. |
| **Log scale** | Uses 64-bit ints, banker’s rounding. | Uses floating-point `Math.log2/Math.round`. | Not used in the captured log; log-scale behaviour still needs precise parity when we enable it. |
| **Colour** | LUMA8X tune + white XOR in Pascal. | Identical mapping via `ColorTranslator`. | Hue is correct (green trace as requested). |

The critical divergence is **intensity mapping**: Pascal’s pipeline effectively applies a noise floor (via banker’s rounding and the fixed-point scaling) so low-power bins remain zero, whereas our pipeline paints every non-zero value.

---

## 4. Next Steps

1. **Quantify the difference with recorded data**  
   Use `scripts/analyzeSpectro.ts` (new helper) to replay `tests/recordings/spectro_samples_4096.json` and summarise `{bin, raw power, mapped pixel}`.  
   Extend the script to sample `PNut-target.png` so we can compare our computed intensities to Pascal’s rendered ones column-by-column.

2. **Replicate Pascal’s filtering**  
   Based on the data, implement a noise gate / banker’s rounding equivalent in `performFFTAndDraw` (and the FFT window) so anything below the Pascal threshold is forced to zero.

3. **Lock it down with tests**  
   Update `tests/debugSpectroWin.test.ts` to assert that a recorded Spectro sample only produces non-zero pixels for the bins Pascal lights up (e.g., fundamental at 145, minimal background).

4. **Re-run the external captures**  
   After applying the filter, replay the external test to confirm the waterfall matches the Pascal bitmap (narrow trace on black background).  
   The same fix should clean up the FFT window’s “bar” artefacts.

---

### Quick Command Summary

```bash
# Inspect current FFT intensity mapping
npx ts-node scripts/analyzeSpectro.ts

# Run Spectro unit tests (includes recorded data regression)
npx jest debugSpectroWin.test.ts --runInBand --silent

# External comparison artifacts
test-results/external-results/debug_*.log
test-results/external-results/bitmaps/PNut-target.png
test-results/external-results/bitmaps/pnut-term-ts-current.png
```

With these steps we can isolate the precise intensity threshold Pascal applies and port that behaviour, ensuring both Spectro and FFT windows stop painting the noise floor.

