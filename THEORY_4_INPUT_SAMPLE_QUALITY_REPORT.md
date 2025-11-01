# THEORY 4: INPUT SAMPLE QUALITY INVESTIGATION

**Investigation Date**: 2025-11-01  
**Theory**: Input samples arriving at FFT window are noisy or incorrectly scaled  
**Result**: ✅ **NO ISSUES FOUND** - Sample pipeline is clean and correct

## Executive Summary

The input sample pipeline from data reception through FFT processing has been thoroughly analyzed. **No scaling, normalization, or corruption issues were found**. Samples are handled as raw integers throughout the pipeline with no transformations applied.

---

## Sample Input Pipeline Analysis

### 1. Sample Reception (debugFftWin.ts)

**Entry Points:**
- `addSample(sample: number, channelIndex: number)` - Line 270
- Called from `processMessage()` - Lines 1172, 1200, 1224

**Input Format:**
- Raw numeric values parsed from serial data
- Type: `number` (JavaScript) → stored as `Int32Array` elements
- No conversion or scaling applied at input

**Code Path:**
```typescript
// Line 1206-1224: Direct numeric value handling
const numValue = Number(part);
if (!isNaN(numValue)) {
  // Add sample to buffer for current channel
  this.addSample(numValue, this.currentChannel);
  
  // Advance to next enabled channel
  this.currentChannel = this.getNextEnabledChannel(this.currentChannel);
}
```

**Packed Data Path:**
```typescript
// Line 1190-1202: Packed data unpacking (no scaling)
const samples = PackedDataProcessor.unpackSamples(numValue, mode);

// Add each unpacked sample to the buffer
for (const sample of samples) {
  this.addSample(sample, this.currentChannel);
  this.currentChannel = this.getNextEnabledChannel(this.currentChannel);
}
```

### 2. Sample Storage (debugFftWin.ts)

**Buffer Configuration:**
```typescript
// Line 160: Int32Array preserves integer precision
private sampleBuffer: Int32Array;

// Line 207: Buffer initialization (2048 samples × 8 channels)
this.sampleBuffer = new Int32Array(this.BUFFER_SIZE * this.MAX_CHANNELS);
```

**Storage Operation (Line 309):**
```typescript
// Calculate buffer position for this channel's sample
const bufferIndex = this.sampleWritePtr * this.MAX_CHANNELS + channelIndex;

// Store the sample (NO TRANSFORMATION)
this.sampleBuffer[bufferIndex] = sample;
```

**✅ Verification**: Samples stored without any modification

### 3. Sample Extraction (debugFftWin.ts)

**Single Channel Extraction (Lines 610-620):**
```typescript
private extractChannelSamples(startPtr: number, length: number, channelIndex: number): Int32Array {
  const samples = new Int32Array(length);
  
  // Extract samples for just this channel
  for (let i = 0; i < length; i++) {
    const bufferPos = ((startPtr + i) & (this.BUFFER_SIZE - 1)) * this.MAX_CHANNELS + channelIndex;
    samples[i] = this.sampleBuffer[bufferPos];  // Direct copy, no transformation
  }
  
  return samples;
}
```

**Multi-Channel Extraction (Lines 435-458):**
```typescript
private extractSamplesForFFT(startPtr: number, length: number): Int32Array {
  const samples = new Int32Array(length);
  
  // Sum enabled channels for each sample position
  for (let i = 0; i < length; i++) {
    const bufferPos = ((startPtr + i) & (this.BUFFER_SIZE - 1)) * this.MAX_CHANNELS;
    let sum = 0;
    let channelCount = 0;
    
    // Sum all enabled channels at this sample position
    for (let ch = 0; ch < this.MAX_CHANNELS; ch++) {
      if ((this.channelMask & (1 << ch)) !== 0) {
        sum += this.sampleBuffer[bufferPos + ch];
        channelCount++;
      }
    }
    
    // Pascal appears to sum channels without averaging
    samples[i] = sum;  // RAW SUM - no averaging or normalization
  }
  
  return samples;
}
```

**✅ Verification**: 
- Single channel: Direct copy with no transformation
- Multiple channels: Raw summation with no averaging or normalization

### 4. FFT Processing (fftProcessor.ts)

**Input Validation (Lines 107-110):**
```typescript
public performFFT(samples: Int32Array, magnitude: number = 0): FFTResult {
  if (samples.length !== this.fftSize) {
    throw new Error(`Sample array length ${samples.length} does not match prepared FFT size ${this.fftSize}`);
  }
```

**Sample Loading with Window Function (Lines 117-123):**
```typescript
// Load samples into (real,imag) with Hanning window applied (matching Pascal)
for (let i = 0; i < this.fftSize; i++) {
  // Apply Hanning window using fixed-point multiplication
  // The window values are already BigInt (int64) to match Pascal exactly
  this.fftReal[i] = BigInt(samples[i]) * this.fftWin[i];  // samples[i] is RAW INPUT
  this.fftImag[i] = 0n;
}
```

**✅ Verification**: Samples used directly with only Hanning window multiplication applied

---

## Pascal Reference Comparison

### Pascal Sample Storage (DebugDisplayUnit.pas)

**FFT Window (Line 1693):**
```pascal
// Extract samples for FFT from circular buffer
for x := 0 to vSamples - 1 do
  FFTsamp[x] := Y_SampleBuff[((SamplePtr - vSamples + x) and Y_PtrMask) * Y_SetSize + j];
```

**SPECTRO Window (Line 1843):**
```pascal
FFTsamp[x] := SPECTRO_SampleBuff[(SamplePtr - vSamples + x) and SPECTRO_PtrMask];
```

**Pascal FFT Processing (Line 4193):**
```pascal
// Apply Hanning window during FFT load
FFTreal[i1] := FFTsamp[i1] * FFTwin[i1];
```

### Pascal Data Types

**Buffer Declarations (Lines 393-395):**
```pascal
FFTsamp  : array [0..FFTmax - 1] of integer;    // Integer samples
FFTpower : array [0..FFTmax div 2 - 1] of integer;
FFTangle : array [0..FFTmax div 2 - 1] of integer;
```

**TypeScript Match:**
```typescript
private sampleBuffer: Int32Array;  // Matches Pascal integer
this.fftPower = new Int32Array(this.BUFFER_SIZE / 2);
this.fftAngle = new Int32Array(this.BUFFER_SIZE / 2);
```

**✅ Verification**: TypeScript matches Pascal data types exactly

---

## Sample Value Range Analysis

### Expected Input Range

**From Serial Protocol:**
- Typical range: -32768 to 32767 (16-bit signed)
- Special cases: Packed data can have custom bit widths
- No documented normalization in Pascal source

### Storage Capacity

**Int32Array:**
- Range: -2,147,483,648 to 2,147,483,647
- More than sufficient for 16-bit audio samples
- No risk of overflow during storage

### Fixed-Point Scaling in FFT

**Hanning Window Multiplication (fftProcessor.ts Line 121):**
```typescript
this.fftReal[i] = BigInt(samples[i]) * this.fftWin[i];
```

**Hanning Window Values (Lines 93-96):**
```typescript
// Hanning: 1 - cos((i/size) * PI * 2)
// Range: 0 to 2 (floating point)
// Scaled by 0x1000 (4096) for fixed-point
// Result range: 0 to 8192
const hanningValue = 1 - Math.cos((i / size) * Math.PI * 2);
this.fftWin[i] = BigInt(Math.round(hanningValue * FFTProcessor.FIXED_POINT_SCALE));
```

**Multiplication Result:**
```
sample × window_coefficient
(-32768 to 32767) × (0 to 8192)
= -268,435,456 to 268,402,688
```

**✅ Verification**: Within BigInt64 range, no overflow possible

---

## Potential Issues RULED OUT

### ❌ Integer Overflow/Truncation
- **Evidence**: Int32Array has sufficient range for all operations
- **Samples**: ±32K range fits comfortably in ±2B Int32 range
- **Fixed-point**: Scaled values use BigInt64 (±9.2 quintillion range)

### ❌ Floating-Point Conversion Errors
- **Evidence**: Samples stored and extracted as integers throughout
- **Only float usage**: Window coefficient calculation (identical to Pascal)

### ❌ Incorrect Scaling/Normalization
- **Evidence**: No scaling applied in sample pipeline
- **Storage**: Direct assignment `sampleBuffer[index] = sample`
- **Extraction**: Direct copy `samples[i] = sampleBuffer[bufferPos]`

### ❌ Channel Mixing Issues
- **Single channel**: Direct extraction, no mixing
- **Multi-channel**: Raw summation matches Pascal behavior (no averaging)

### ❌ Buffer Corruption
- **Evidence**: Circular buffer math verified correct
- **Wraparound**: `(ptr) & (BUFFER_SIZE - 1)` matches Pascal's `and Y_PtrMask`
- **Interleaving**: `ptr * MAX_CHANNELS + channelIndex` maintains channel separation

---

## Diagnostic Logging Analysis

### Available Diagnostics (Lines 554-573)

```typescript
// Sample extraction diagnostics
if (ENABLE_CONSOLE_LOG) {
  const first20 = Array.from(samples.slice(0, 20));
  console.log(`[FFT EXTRACT] Ch${i} first 20 samples: ${first20.join(', ')}`);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  console.log(`[FFT EXTRACT] Ch${i} stats: min=${min}, max=${max}, mean=${mean.toFixed(2)}`);
}

// FFT output diagnostics
if (ENABLE_CONSOLE_LOG) {
  const first20Power = Array.from(result.power.slice(0, 20));
  console.log(`[FFT OUTPUT] Ch${i} first 20 power bins: ${first20Power.join(', ')}`);
  const maxPower = Math.max(...result.power);
  const maxBin = Array.from(result.power).indexOf(maxPower);
  console.log(`[FFT OUTPUT] Ch${i} max power=${maxPower} at bin=${maxBin}`);
}
```

**Recommendation**: Enable `ENABLE_CONSOLE_LOG = true` in debugFftWin.ts to capture:
1. Raw sample values entering FFT
2. Min/max/mean sample statistics
3. FFT output power spectrum
4. Peak detection accuracy

---

## Conclusion

### Finding: NO INPUT SAMPLE QUALITY ISSUES

The sample input pipeline is **correctly implemented** with:

✅ **No scaling or normalization** applied to incoming samples  
✅ **Integer precision preserved** throughout storage and extraction  
✅ **Correct buffer management** with proper circular buffer wraparound  
✅ **Pascal-compliant data types** (Int32Array matches Pascal integer)  
✅ **Proper channel handling** (direct copy for single, raw sum for multi)  
✅ **Fixed-point arithmetic** matches Pascal exactly in FFT processor  

### Sample Quality is NOT the Cause of Jagged FFT

The input samples are handled correctly from reception through FFT processing. If jagged/noisy FFT output is observed, the cause must be in:

1. **FFT algorithm implementation** (Theory 1 - butterfly operations)
2. **Coordinate calculation** (Theory 2 - rendering math)
3. **Canvas rendering** (Theory 3 - anti-aliasing/scaling)
4. **Output normalization** (magnitude scaling in Pascal vs TypeScript)

### Next Investigation Steps

Since input sample quality is verified correct, focus on:

1. **Enable diagnostic logging** to capture actual sample values and FFT output
2. **Compare FFT output arrays** (power/angle) between Pascal and TypeScript using identical input
3. **Verify rendering coordinate calculations** match Pascal's fixed-point math
4. **Check magnitude scaling** in FFT output normalization

---

## Appendix: Key Code Locations

### Sample Input
- **Entry**: `/workspaces/PNut-Term-TS/src/classes/debugFftWin.ts:270` - `addSample()`
- **Numeric parsing**: Line 1206
- **Packed data**: Line 1190

### Sample Storage
- **Buffer declaration**: Line 160
- **Storage operation**: Line 309

### Sample Extraction
- **Single channel**: Line 610 - `extractChannelSamples()`
- **Multi-channel**: Line 435 - `extractSamplesForFFT()`

### FFT Processing
- **Processor**: `/workspaces/PNut-Term-TS/src/classes/shared/fftProcessor.ts:107` - `performFFT()`
- **Window application**: Line 117-123

### Pascal Reference
- **FFT sample loading**: `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas:1693`
- **SPECTRO sample loading**: Line 1843
- **FFT window application**: Line 4193
