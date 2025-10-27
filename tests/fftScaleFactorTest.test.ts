/** @format */

describe('FFT Scale Factor Investigation', () => {
  it('should analyze the 0x800 constant and scale factor', () => {
    console.log('=== SCALE FACTOR ANALYSIS ===\n');

    // Constants from Pascal
    const FFT_SIZE = 2048;
    const FFT_EXP = 11;  // log2(2048)
    const MAGNITUDE = 0;

    // The mysterious 0x800
    const PASCAL_CONSTANT = 0x800;  // 2048 decimal

    // Window scale
    const WINDOW_SCALE = 0x1000;  // 4096 decimal

    // Calculate scale factor as Pascal does
    const scale_factor = (PASCAL_CONSTANT << FFT_EXP) >> MAGNITUDE;

    console.log('Constants:');
    console.log(`  FFT size: ${FFT_SIZE}`);
    console.log(`  FFT exp: ${FFT_EXP}`);
    console.log(`  Pascal constant (0x800): ${PASCAL_CONSTANT}`);
    console.log(`  Window scale (0x1000): ${WINDOW_SCALE}`);
    console.log(`  Magnitude shift: ${MAGNITUDE}`);
    console.log('');

    console.log('Scale factor calculation:');
    console.log(`  Formula: (0x800 << FFTexp) >> magnitude`);
    console.log(`  = (${PASCAL_CONSTANT} << ${FFT_EXP}) >> ${MAGNITUDE}`);
    console.log(`  = ${PASCAL_CONSTANT << FFT_EXP} >> ${MAGNITUDE}`);
    console.log(`  = ${scale_factor} (0x${scale_factor.toString(16)})`);
    console.log('');

    // Analyze the relationship
    console.log('Relationships:');
    console.log(`  0x800 / FFT_SIZE = ${PASCAL_CONSTANT / FFT_SIZE}`);
    console.log(`  0x800 / 0x1000 = ${PASCAL_CONSTANT / WINDOW_SCALE}`);
    console.log(`  FFT_SIZE / 0x800 = ${FFT_SIZE / PASCAL_CONSTANT}`);
    console.log(`  0x1000 / 0x800 = ${WINDOW_SCALE / PASCAL_CONSTANT}`);
    console.log('');

    // Test with sample calculation
    const sample = 999;
    const window_max = 0x2000;  // Max Hanning value
    const windowed = sample * window_max;

    // After FFT, assume value maintains scale
    const fft_output = windowed;  // Simplified

    const power_current = Math.round(fft_output / scale_factor);
    const power_doubled = Math.round(fft_output / (scale_factor / 2));
    const power_halved = Math.round(fft_output / (scale_factor * 2));

    console.log('Power calculation test:');
    console.log(`  Sample: ${sample}`);
    console.log(`  After windowing: ${windowed}`);
    console.log(`  Scale factor: ${scale_factor}`);
    console.log(`  Power (current): ${power_current}`);
    console.log(`  Power (scale/2): ${power_doubled}`);
    console.log(`  Power (scale*2): ${power_halved}`);
    console.log('');

    console.log('Observed vs Expected:');
    console.log(`  Our FFT test: ~636`);
    console.log(`  Window logs: ~320`);
    console.log(`  Ratio: ~2x`);
    console.log('');

    // What if Pascal intends 0x800 to mean something else?
    console.log('Alternative interpretations:');

    // Theory 1: 0x800 compensates for average window value
    const avg_hanning = WINDOW_SCALE * (3/8);  // Energy of Hanning
    console.log(`  Theory 1: 0x800 relates to Hanning energy`);
    console.log(`    Average Hanning energy: ${avg_hanning.toFixed(0)}`);
    console.log(`    0x800 = ${PASCAL_CONSTANT}`);
    console.log(`    Ratio: ${(avg_hanning / PASCAL_CONSTANT).toFixed(2)}`);

    // Theory 2: Different FFT normalization
    console.log(`  Theory 2: FFT normalization difference`);
    console.log(`    Some FFTs divide by N = ${FFT_SIZE}`);
    console.log(`    Some divide by sqrt(N) = ${Math.sqrt(FFT_SIZE).toFixed(0)}`);
    console.log(`    Some don't normalize`);

    // Theory 3: The scale factor should be different
    const alt_scale = scale_factor * 2;
    console.log(`  Theory 3: Scale factor should be 2x larger`);
    console.log(`    Current: ${scale_factor}`);
    console.log(`    Alternative: ${alt_scale}`);
    console.log(`    This would make power = ${Math.round(windowed / alt_scale)}`);
  });
});