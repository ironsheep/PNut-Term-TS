/** @format */

describe('Pascal int64 Overflow Analysis with P2 32-bit Data', () => {
  it('should understand Pascal int64 limits and overflow behavior', () => {
    console.log('=== PASCAL INT64 VS BIGINT ===\n');

    // Pascal int64 limits
    const INT64_MAX = 9223372036854775807n;  // 2^63 - 1
    const INT64_MIN = -9223372036854775808n; // -2^63

    console.log('Pascal int64 limits:');
    console.log(`  Max: ${INT64_MAX} (0x${INT64_MAX.toString(16)})`);
    console.log(`  Min: ${INT64_MIN} (0x${INT64_MIN.toString(16)})`);

    // In our FFT, after windowing:
    // sample * window = up to 1000 * 0x2000 = 0x1F4000 (about 2 million)
    const maxSample = 1000n;
    const maxWindow = 0x2000n; // Max Hanning window value
    const afterWindow = maxSample * maxWindow;
    console.log(`\nAfter windowing:`);
    console.log(`  Max value: ${afterWindow} (0x${afterWindow.toString(16)})`);
    console.log(`  Fits in int64: ${afterWindow < INT64_MAX}`);

    // After FFT butterflies with 2048 samples:
    // Values can accumulate through log2(2048) = 11 stages
    // Each stage can potentially double the magnitude
    const fftStages = 11;
    const maxAccumulation = afterWindow * (2n ** BigInt(fftStages));
    console.log(`\nAfter FFT (worst case accumulation):`);
    console.log(`  Max theoretical: ${maxAccumulation} (0x${maxAccumulation.toString(16)})`);
    console.log(`  Fits in int64: ${maxAccumulation < INT64_MAX}`);

    // This is still well within int64 range!

    // But what about the intermediate butterfly calculations?
    // rx = (bx * FFTcos[th] - by * FFTsin[th]) / $1000
    const bx = afterWindow; // Already scaled by window
    const cosValue = 0x1000n; // Max cos/sin value (fixed-point)
    const beforeDivide = bx * cosValue;
    console.log(`\nButterfly multiplication (before divide):`);
    console.log(`  bx * cos: ${beforeDivide} (0x${beforeDivide.toString(16)})`);
    console.log(`  Fits in int64: ${beforeDivide < INT64_MAX}`);

    // After many accumulations in the butterflies:
    const maxButterfly = beforeDivide * 100n; // Assume 100x accumulation
    console.log(`\nWith heavy accumulation:`);
    console.log(`  Value: ${maxButterfly} (0x${maxButterfly.toString(16)})`);
    console.log(`  Fits in int64: ${maxButterfly < INT64_MAX}`);

    // Still fits! So where's the issue?
  });

  it('should check if the issue is in the final power calculation', () => {
    console.log('\n=== POWER CALCULATION OVERFLOW CHECK ===\n');

    // In power calculation:
    // hypot(rx, ry) where rx, ry are scaled by 0x1000

    const rx = 1000000n * 0x1000n; // Large FFT value scaled by window
    const ry = 1000000n * 0x1000n;

    console.log(`rx: ${rx} (0x${rx.toString(16)})`);
    console.log(`ry: ${ry} (0x${ry.toString(16)})`);

    // In Pascal, these are int64 values
    // hypot would calculate sqrt(rx^2 + ry^2)

    const rx_squared = rx * rx;
    const ry_squared = ry * ry;
    const sum_squared = rx_squared + ry_squared;

    console.log(`\nSquaring for hypot:`);
    console.log(`  rx^2: ${rx_squared}`);
    console.log(`  In int64 range: ${rx_squared < 9223372036854775807n}`);

    if (rx_squared > 9223372036854775807n) {
      console.log('  OVERFLOW IN PASCAL!');

      // What happens in Pascal with overflow?
      // int64 wraps around!
      const INT64_MAX = 9223372036854775807n;
      const INT64_RANGE = 18446744073709551616n; // 2^64

      const wrapped = ((rx_squared % INT64_RANGE) + INT64_RANGE) % INT64_RANGE;
      const asSignedInt64 = wrapped > INT64_MAX ? wrapped - INT64_RANGE : wrapped;

      console.log(`  Pascal wrapped value: ${asSignedInt64}`);
      console.log(`  This would produce WRONG hypot result!`);
    }
  });

  it('should test realistic FFT values for overflow', () => {
    console.log('\n=== REALISTIC FFT VALUES ===\n');

    // From our actual logs:
    // After windowing and FFT, rx and ry values are around:
    // Several million (samples * window * accumulation)

    const typicalRx = 10000000n; // 10 million (reasonable FFT output)
    const withWindowScale = typicalRx * 0x1000n;

    console.log(`Typical rx (with window scale): ${withWindowScale}`);
    console.log(`Squared: ${withWindowScale * withWindowScale}`);

    const INT64_MAX = 9223372036854775807n;
    if (withWindowScale * withWindowScale > INT64_MAX) {
      console.log('OVERFLOW when squaring for hypot!');

      // This is the bug!
      console.log('\nTHE BUG:');
      console.log('1. Pascal int64 overflows when calculating hypot');
      console.log('2. Overflow causes wrapping, giving smaller result');
      console.log('3. Our BigInt does NOT overflow, gives correct (larger) result');
      console.log('4. Our larger values get divided down to small power values');
      console.log('5. Small power values + log scale = noise amplification!');
    }
  });

  it('should simulate Pascal int64 overflow in hypot', () => {
    console.log('\n=== PASCAL INT64 OVERFLOW SIMULATION ===\n');

    function simulatePascalInt64(value: bigint): bigint {
      const INT64_MAX = 9223372036854775807n;
      const INT64_MIN = -9223372036854775808n;
      const INT64_RANGE = 18446744073709551616n; // 2^64

      // Simulate wrapping
      let result = value % INT64_RANGE;
      if (result > INT64_MAX) {
        result = result - INT64_RANGE;
      } else if (result < INT64_MIN) {
        result = result + INT64_RANGE;
      }
      return result;
    }

    // Test values from FFT
    const rx = 5000000n * 0x1000n; // 5 million * window scale
    const ry = 3000000n * 0x1000n;

    console.log(`Input values:`);
    console.log(`  rx: ${rx}`);
    console.log(`  ry: ${ry}`);

    // What BigInt does (no overflow):
    const rx2_bigint = rx * rx;
    const ry2_bigint = ry * ry;
    const sum_bigint = rx2_bigint + ry2_bigint;
    const hypot_bigint = Math.sqrt(Number(sum_bigint));

    console.log(`\nBigInt (no overflow):`);
    console.log(`  rx^2: ${rx2_bigint}`);
    console.log(`  hypot: ${hypot_bigint.toFixed(0)}`);

    // What Pascal does (with overflow):
    const rx2_pascal = simulatePascalInt64(rx * rx);
    const ry2_pascal = simulatePascalInt64(ry * ry);
    const sum_pascal = simulatePascalInt64(rx2_pascal + ry2_pascal);
    const hypot_pascal = Math.sqrt(Math.abs(Number(sum_pascal)));

    console.log(`\nPascal int64 (with overflow):`);
    console.log(`  rx^2 (wrapped): ${rx2_pascal}`);
    console.log(`  hypot: ${hypot_pascal.toFixed(0)}`);

    const ratio = hypot_bigint / hypot_pascal;
    console.log(`\nRatio (BigInt/Pascal): ${ratio.toFixed(2)}x`);
    console.log('If Pascal gets smaller values due to overflow, it explains our issue!');
  });
});