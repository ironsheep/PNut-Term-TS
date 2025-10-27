/** @format */

describe('Hanning Window Energy Compensation', () => {
  it('should calculate Hanning window energy loss', () => {
    console.log('=== HANNING WINDOW ENERGY ANALYSIS ===\n');

    // The Hanning window reduces signal energy
    // Total energy = sum of window^2 / N

    const N = 2048;
    const SCALE = 0x1000;

    let windowEnergyScaled = 0;
    let windowEnergyNorm = 0;

    for (let i = 0; i < N; i++) {
      // Our actual Hanning window formula (matching Pascal): (1 - cos(2πn/N))
      // This ranges from 0 to 2, not 0 to 1
      const windowValue = 1 - Math.cos((i / N) * Math.PI * 2);
      const scaled = Math.round(windowValue * SCALE);

      // For energy, we need the sum of squares
      windowEnergyNorm += (windowValue * windowValue) / 4; // Normalize to 0-1 range
      windowEnergyScaled += scaled * scaled;
    }

    const avgEnergyNorm = windowEnergyNorm / N;
    const avgEnergyScaled = windowEnergyScaled / N;

    console.log(`Window size: ${N}`);
    console.log(`Average window energy (normalized): ${avgEnergyNorm.toFixed(4)}`);
    console.log(`Average window energy (scaled): ${avgEnergyScaled} (0x${avgEnergyScaled.toString(16)})`);

    // For Hanning window, average energy is 0.375 (3/8)
    // This means the signal loses 62.5% of its energy!

    const energyRatio = avgEnergyNorm;
    const compensationFactor = 1 / Math.sqrt(energyRatio);

    console.log(`\nEnergy ratio: ${energyRatio.toFixed(4)} (3/8 = 0.375 for Hanning)`);
    console.log(`Compensation factor: ${compensationFactor.toFixed(4)}`);
    console.log(`Sqrt(8/3) = ${Math.sqrt(8/3).toFixed(4)}`);

    console.log('\nIf Pascal compensates for window energy:');
    console.log(`Power values would be ${compensationFactor.toFixed(2)}x larger`);

    // Check if this matches our observed difference
    const observedRatio = 3.5; // Our values are 3-4x too small
    const sqrtRatio = Math.sqrt(observedRatio);

    console.log(`\nOur observed ratio: ${observedRatio}x`);
    console.log(`Sqrt of ratio: ${sqrtRatio.toFixed(2)}x`);
    console.log(`Close to window compensation? ${Math.abs(sqrtRatio - compensationFactor) < 0.2}`);
  });

  it('should check if 0x800 relates to window compensation', () => {
    console.log('\n=== 0x800 CONSTANT ANALYSIS ===\n');

    const WINDOW_SCALE = 0x1000;
    const PASCAL_CONSTANT = 0x800;

    console.log(`Window scale: 0x${WINDOW_SCALE.toString(16)} = ${WINDOW_SCALE}`);
    console.log(`Pascal constant: 0x${PASCAL_CONSTANT.toString(16)} = ${PASCAL_CONSTANT}`);
    console.log(`Ratio: ${WINDOW_SCALE / PASCAL_CONSTANT} = 2\n`);

    // Maybe 0x800 is chosen because:
    // - It's half of the window scale (0x1000 / 2)
    // - Compensates for average window value (~0.5 for Hanning)

    const avgHanning = 2 / Math.PI; // Average of Hanning window
    console.log(`Average Hanning window value: ${avgHanning.toFixed(4)}`);
    console.log(`2/π ≈ 0.6366`);

    // Or it could be related to RMS vs peak
    const rmsTopeak = Math.sqrt(2);
    console.log(`\nRMS to peak ratio: √2 = ${rmsTopeak.toFixed(4)}`);

    // Check various combinations
    console.log('\nPossible relationships:');
    console.log(`0x1000 / 0x800 = 2`);
    console.log(`0x800 * √2 = 0x${Math.round(PASCAL_CONSTANT * Math.sqrt(2)).toString(16)}`);
    console.log(`0x800 * 3/8 (Hanning energy) = 0x${Math.round(PASCAL_CONSTANT * 3/8).toString(16)}`);
    console.log(`0x800 * 8/3 (compensation) = 0x${Math.round(PASCAL_CONSTANT * 8/3).toString(16)}`);
  });

  it('should test if we need to compensate for window energy', () => {
    console.log('\n=== WINDOW COMPENSATION TEST ===\n');

    // Current calculation
    const rx = 300000000; // Typical FFT output (scaled)
    const scale_factor = 0x400000;
    const currentPower = Math.round(rx / scale_factor);

    console.log(`Current calculation:`);
    console.log(`  rx: ${rx}`);
    console.log(`  scale_factor: 0x${scale_factor.toString(16)}`);
    console.log(`  power: ${currentPower}\n`);

    // With window compensation (multiply by sqrt(8/3))
    const windowComp = Math.sqrt(8/3);
    const compensatedPower = Math.round(rx * windowComp / scale_factor);

    console.log(`With window compensation (×√(8/3)):`);
    console.log(`  power: ${compensatedPower}`);
    console.log(`  Ratio: ${compensatedPower / currentPower}x\n`);

    // Or divide scale_factor by compensation
    const adjustedScale = scale_factor / windowComp;
    const altPower = Math.round(rx / adjustedScale);

    console.log(`Or adjust scale_factor (÷√(8/3)):`);
    console.log(`  adjusted scale: 0x${Math.round(adjustedScale).toString(16)}`);
    console.log(`  power: ${altPower}`);
    console.log(`  Same result: ${altPower === compensatedPower}`);
  });
});