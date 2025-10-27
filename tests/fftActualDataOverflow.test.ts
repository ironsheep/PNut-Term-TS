/** @format */

describe('FFT Overflow with Actual P2 Data', () => {
  it('should trace overflow with actual values from logs', () => {
    console.log('=== FFT WITH ACTUAL P2 DATA (32-bit max) ===\n');

    // From our logs: samples are -999 to 999
    const typicalSample = 1000; // Max we see in logs
    console.log(`P2 sample value: ${typicalSample} (fits in 32-bit signed)`);

    // Window max value
    const windowMax = 0x2000; // Max Hanning window value
    console.log(`Window max: 0x${windowMax.toString(16)} = ${windowMax}`);

    // After windowing
    const afterWindow = typicalSample * windowMax;
    console.log(`After windowing: ${typicalSample} * ${windowMax} = ${afterWindow} (0x${afterWindow.toString(16)})`);

    // This value goes through FFT butterflies
    // In worst case, could grow by 2^(stages/2) = 2^5.5 ≈ 45x for 2048-point FFT
    const fftGrowth = 45;
    const afterFFT = afterWindow * fftGrowth;
    console.log(`After FFT (45x growth): ${afterFFT} (0x${afterFFT.toString(16)})`);

    // Now in power calculation, these are our rx, ry values
    // But they're STILL in fixed-point format (scaled by 0x1000)!
    console.log('\n--- Power Calculation ---');
    console.log(`rx, ry are still scaled by 0x1000 from windowing`);
    console.log(`So rx = ${afterFFT} (already includes window scale)`);

    // For hypot, we need rx^2
    const rx = BigInt(afterFFT);
    const rx_squared = rx * rx;
    console.log(`rx^2 = ${rx_squared}`);

    const INT64_MAX = 9223372036854775807n;
    if (rx_squared > INT64_MAX) {
      console.log(`OVERFLOWS int64! (max is ${INT64_MAX})`);
    } else {
      console.log(`Fits in int64`);
    }

    // But wait, let's be more precise about FFT output
    console.log('\n--- More Realistic FFT Output ---');

    // From our actual test: max power was 220 (before we fixed anything)
    // This suggests the FFT real/imag values are around:
    // power = hypot(rx, ry) / scale_factor
    // 220 = hypot(rx, ry) / 0x400000
    // hypot(rx, ry) = 220 * 0x400000 = 922,746,880

    const hypotValue = 220 * 0x400000;
    console.log(`From our logs: hypot(rx,ry) ≈ ${hypotValue}`);

    // If hypot = 922M and values are equal, then rx ≈ ry ≈ 652M
    const rxEstimate = Math.round(hypotValue / Math.sqrt(2));
    console.log(`Estimated rx ≈ ${rxEstimate}`);

    // Square this for hypot calculation
    const rxEstimate_squared = BigInt(rxEstimate) * BigInt(rxEstimate);
    console.log(`rx^2 ≈ ${rxEstimate_squared}`);

    if (rxEstimate_squared > INT64_MAX) {
      console.log('Would overflow int64!');
    } else {
      console.log('Fits in int64');
    }
  });

  it('should check if the issue is NOT overflow but something else', () => {
    console.log('\n=== ALTERNATIVE HYPOTHESIS ===\n');

    // Maybe it's not overflow, but a different handling of the scale

    console.log('What if Pascal\'s scale_factor calculation is different?');
    console.log('Or what if the window scale is handled differently?');

    // Pascal might do integer division differently
    const rx = 1000000000; // 1 billion (reasonable FFT value with window scale)
    const scale_factor = 0x400000;

    // Integer division
    const integerDivision = Math.floor(rx / scale_factor);
    console.log(`Integer division: ${rx} / ${scale_factor} = ${integerDivision}`);

    // What if Pascal's scale_factor already accounts for window?
    const adjusted_scale = scale_factor / 0x1000;
    const withAdjustment = Math.floor(rx / adjusted_scale);
    console.log(`If scale accounts for window: ${rx} / ${adjusted_scale} = ${withAdjustment}`);

    console.log('\nThe 0x800 constant in Pascal might be KEY:');
    console.log('0x800 = 2048 in decimal');
    console.log('Is this related to compensating for the window scale?');
  });

  it('should test if squaring negative values matters', () => {
    console.log('\n=== SIGNED VS UNSIGNED SQUARING ===\n');

    // In Pascal, squaring a negative int64 might behave differently

    const negative = -1000000000n;
    const squared = negative * negative;

    console.log(`(-1000000000)^2 = ${squared}`);
    console.log(`Always positive, so sign shouldn\'t matter`);

    // But what about the intermediate calculations?
    const INT64_MAX = 9223372036854775807n;
    const INT64_MIN = -9223372036854775808n;

    console.log('\nBut if FFT produces values near int64 limits...');
    const nearLimit = INT64_MAX / 2n;
    const nearLimitSquared = nearLimit * nearLimit;

    console.log(`(INT64_MAX/2)^2 would overflow!`);
    console.log(`This could cause wrapping and wrong results`);
  });
});