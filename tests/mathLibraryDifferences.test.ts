/** @format */

describe('Math Library Differences: Pascal vs JavaScript', () => {
  it('should compare hypot implementations', () => {
    console.log('=== HYPOT IMPLEMENTATION DIFFERENCES ===\n');

    // Pascal's hypot might be implemented differently
    // Pascal: Hypot(rx, ry) - might use integer math or different algorithm
    // JavaScript: Math.hypot(rx, ry) - IEEE 754 double precision

    const testCases = [
      { rx: 1000000, ry: 1000000 },
      { rx: 922746880, ry: 0 },  // From our logs
      { rx: 652480576, ry: 652480576 }  // Estimated from FFT
    ];

    for (const { rx, ry } of testCases) {
      // JavaScript hypot (floating-point)
      const jsHypot = Math.hypot(rx, ry);

      // Manual calculation (what Pascal might do)
      const manualHypot = Math.sqrt(rx * rx + ry * ry);

      // Integer-only approximation (if Pascal uses integer math)
      // Using the alpha max + beta min algorithm
      const max = Math.max(Math.abs(rx), Math.abs(ry));
      const min = Math.min(Math.abs(rx), Math.abs(ry));
      const integerApprox = max + Math.floor(min / 2);  // Simple approximation

      console.log(`rx=${rx}, ry=${ry}:`);
      console.log(`  JS Math.hypot: ${jsHypot.toFixed(0)}`);
      console.log(`  Manual sqrt: ${manualHypot.toFixed(0)}`);
      console.log(`  Integer approx: ${integerApprox}`);
      console.log(`  Difference: ${((jsHypot - integerApprox) / jsHypot * 100).toFixed(1)}%\n`);
    }

    console.log('If Pascal uses integer approximation, this could explain smaller values!');
  });

  it('should compare division and rounding', () => {
    console.log('\n=== DIVISION & ROUNDING DIFFERENCES ===\n');

    // Pascal: div operator (integer division, truncates)
    // JavaScript: / operator (floating-point) then Math.round()

    const testCases = [
      { dividend: 922746880, divisor: 0x400000 },  // Our FFT power calculation
      { dividend: 922746879, divisor: 0x400000 },  // One less (edge case)
      { dividend: -922746880, divisor: 0x400000 }, // Negative
    ];

    for (const { dividend, divisor } of testCases) {
      // JavaScript approach (our current implementation)
      const jsResult = Math.round(dividend / divisor);

      // Pascal div (truncates toward zero)
      const pascalDiv = Math.trunc(dividend / divisor);

      // Floor division (always rounds down)
      const floorDiv = Math.floor(dividend / divisor);

      console.log(`${dividend} / ${divisor}:`);
      console.log(`  JS Math.round: ${jsResult}`);
      console.log(`  Pascal div (trunc): ${pascalDiv}`);
      console.log(`  Floor: ${floorDiv}`);
      console.log(`  Difference: ${jsResult - pascalDiv}\n`);
    }

    console.log('Division differences accumulate across many FFT bins!');
  });

  it('should compare log2 implementations', () => {
    console.log('\n=== LOG2 PRECISION DIFFERENCES ===\n');

    // For log scale: Round(Log2(v + 1) / Log2(high + 1) * high)
    // Small differences in log2 get amplified

    const testValues = [8, 17, 19, 40, 220];  // From our FFT output
    const high = 1000;

    console.log(`Log scale with high=${high}:\n`);

    for (const v of testValues) {
      // JavaScript Math.log2 (double precision)
      const jsLog2 = Math.log2(v + 1);
      const jsLogHigh = Math.log2(high + 1);
      const jsResult = Math.round((jsLog2 / jsLogHigh) * high);

      // Using natural log (might have different precision)
      const lnLog2 = Math.log(v + 1) / Math.log(2);
      const lnLogHigh = Math.log(high + 1) / Math.log(2);
      const lnResult = Math.round((lnLog2 / lnLogHigh) * high);

      // If Pascal uses lookup tables or approximation
      // Small errors here get multiplied by 'high'
      const error = jsResult - lnResult;

      console.log(`v=${v}:`);
      console.log(`  JS Math.log2: ${jsResult}`);
      console.log(`  Via Math.log: ${lnResult}`);
      console.log(`  Difference: ${error}`);
      console.log(`  Log2(${v}+1) = ${jsLog2.toFixed(6)}\n`);
    }

    console.log('Even tiny log2 differences get amplified by high=1000!');
  });

  it('should compare trigonometric functions for FFT', () => {
    console.log('\n=== TRIGONOMETRIC FUNCTION DIFFERENCES ===\n');

    // FFT twiddle factors use sin/cos
    // Window function uses cos

    const angles = [0, Math.PI/4, Math.PI/2, Math.PI];
    const FIXED_SCALE = 0x1000;

    console.log('Twiddle factors (scaled to 0x1000):\n');

    for (const angle of angles) {
      // JavaScript (double precision)
      const jsSin = Math.sin(angle);
      const jsCos = Math.cos(angle);
      const jsScaledSin = Math.round(jsSin * FIXED_SCALE);
      const jsScaledCos = Math.round(jsCos * FIXED_SCALE);

      // Small differences in trig functions affect FFT butterflies
      // These accumulate through log2(N) stages

      console.log(`angle=${(angle * 180 / Math.PI).toFixed(0)}°:`);
      console.log(`  sin: ${jsSin.toFixed(6)} -> scaled: 0x${jsScaledSin.toString(16)}`);
      console.log(`  cos: ${jsCos.toFixed(6)} -> scaled: 0x${jsScaledCos.toString(16)}\n`);
    }

    // Hanning window
    console.log('Hanning window values:\n');
    for (let i = 0; i < 4; i++) {
      const n = i;
      const N = 2048;
      const windowValue = 1 - Math.cos((n / N) * Math.PI * 2);
      const scaled = Math.round(windowValue * FIXED_SCALE);

      console.log(`window[${i}] = ${windowValue.toFixed(6)} -> 0x${scaled.toString(16)}`);
    }

    console.log('\nSmall trig differences accumulate through FFT stages!');
  });

  it('should check cumulative error through FFT', () => {
    console.log('\n=== CUMULATIVE ERROR ANALYSIS ===\n');

    // Small differences compound through:
    // 1. Window multiplication (N samples)
    // 2. FFT butterflies (N * log2(N) operations)
    // 3. Power calculation (N/2 hypot operations)
    // 4. Log scale (if enabled)

    const N = 2048;
    const stages = Math.log2(N);
    const operations = N * stages;

    console.log(`FFT size: ${N}`);
    console.log(`Butterfly stages: ${stages}`);
    console.log(`Total butterfly operations: ${operations.toLocaleString()}\n`);

    // If each operation has 0.01% error
    const errorPerOp = 0.0001;  // 0.01%
    const compoundError = Math.pow(1 + errorPerOp, operations) - 1;

    console.log(`If each operation has ${errorPerOp * 100}% error:`);
    console.log(`After ${operations} operations: ${(compoundError * 100).toFixed(1)}% total error\n`);

    // More realistic: errors might partially cancel
    const sqrtOperations = Math.sqrt(operations);
    const statisticalError = errorPerOp * sqrtOperations;

    console.log(`With statistical cancellation (sqrt(N) growth):`);
    console.log(`Expected error: ${(statisticalError * 100).toFixed(2)}%\n`);

    console.log('Our 4-5x error suggests ~75-80% cumulative difference!');
    console.log('This points to a systematic difference, not just rounding errors.');
  });
});