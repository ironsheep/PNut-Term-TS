/** @format */

/**
 * Analysis of buffer reading order
 *
 * This script demonstrates the current buffer reading order and verifies
 * it matches the Pascal reference implementation.
 */

// Constants from debugSpectroWin.ts
const BUFFER_SIZE = 2048;
const BUFFER_MASK = BUFFER_SIZE - 1;

console.log('=== Buffer Reading Order Analysis ===\n');

// Test Case 1: Simple sequential write
console.log('Test Case 1: Sequential Write, Full Buffer');
console.log('-------------------------------------------');
const buffer1 = new Int32Array(16); // Small buffer for clarity
for (let i = 0; i < 16; i++) {
  buffer1[i] = i * 10; // [0, 10, 20, 30, ..., 150]
}

let writePtr1 = 0; // Points to where next sample would be written
const fftSize1 = 4;

console.log(`Buffer contents: [${Array.from(buffer1).join(', ')}]`);
console.log(`Write pointer: ${writePtr1}`);
console.log(`FFT size: ${fftSize1}`);

const read1: number[] = [];
for (let x = 0; x < fftSize1; x++) {
  const index = (writePtr1 - fftSize1 + x) & 0xF;
  read1.push(buffer1[index]);
  console.log(`  x=${x}: index = (${writePtr1} - ${fftSize1} + ${x}) & 0xF = ${index}, value = ${buffer1[index]}`);
}
console.log(`Read values (oldest to newest): [${read1.join(', ')}]`);
console.log(`Expected: [120, 130, 140, 150] (last 4 samples written)\n`);

// Test Case 2: Circular buffer wraparound
console.log('Test Case 2: Wraparound Scenario');
console.log('---------------------------------');
const buffer2 = new Int32Array(16);
for (let i = 0; i < 16; i++) {
  buffer2[i] = i;
}

let writePtr2 = 3; // Just wrote samples at indices 0, 1, 2
const fftSize2 = 5;

console.log(`Buffer contents: [${Array.from(buffer2).join(', ')}]`);
console.log(`Write pointer: ${writePtr2}`);
console.log(`FFT size: ${fftSize2}`);

const read2: number[] = [];
for (let x = 0; x < fftSize2; x++) {
  const index = (writePtr2 - fftSize2 + x) & 0xF;
  read2.push(buffer2[index]);
  console.log(`  x=${x}: index = (${writePtr2} - ${fftSize2} + ${x}) & 0xF = ${index}, value = ${buffer2[index]}`);
}
console.log(`Read values: [${read2.join(', ')}]`);
console.log(`Expected: [14, 15, 0, 1, 2] (wraps around from end to beginning)\n`);

// Test Case 3: Time-domain signal verification
console.log('Test Case 3: Time-Domain Signal');
console.log('--------------------------------');
const buffer3 = new Int32Array(16);
let time = 0;
let writePtr3 = 0;

// Simulate writing samples over time
for (let i = 0; i < 16; i++) {
  buffer3[writePtr3] = time;
  writePtr3 = (writePtr3 + 1) & 0xF;
  time++;
}

const fftSize3 = 8;
console.log(`Buffer after writing 16 samples (time 0-15):`);
console.log(`  Buffer contents: [${Array.from(buffer3).join(', ')}]`);
console.log(`  Write pointer: ${writePtr3} (will write next sample here)`);
console.log(`  Latest sample: time=${time-1} at index=${(writePtr3-1) & 0xF}`);
console.log(`  FFT size: ${fftSize3}`);

const read3: number[] = [];
for (let x = 0; x < fftSize3; x++) {
  const index = (writePtr3 - fftSize3 + x) & 0xF;
  read3.push(buffer3[index]);
}
console.log(`Read values: [${read3.join(', ')}]`);
console.log(`Expected: [8, 9, 10, 11, 12, 13, 14, 15] (last 8 time steps)`);
console.log(`Chronologically ordered: ${read3.every((v, i) => i === 0 || v === read3[i-1] + 1)}\n`);

// Test Case 4: What if we read BACKWARDS?
console.log('Test Case 4: Alternative - Reading Backwards (WRONG)');
console.log('-----------------------------------------------------');
const reverseRead3: number[] = [];
for (let x = 0; x < fftSize3; x++) {
  const index = (writePtr3 - 1 - x) & 0xF;
  reverseRead3.push(buffer3[index]);
}
console.log(`Reverse read values: [${reverseRead3.join(', ')}]`);
console.log(`This would be: [15, 14, 13, 12, 11, 10, 9, 8] (NEWEST to OLDEST)`);
console.log(`FFT expects OLDEST to NEWEST, so this would be WRONG\n`);

// Summary
console.log('=== CONCLUSION ===');
console.log('Pascal formula: FFTsamp[x] := SPECTRO_SampleBuff[(SamplePtr - vSamples + x) and SPECTRO_PtrMask]');
console.log('TypeScript formula: bufferIndex = (this.sampleWritePtr - this.fftSize + x) & this.BUFFER_MASK');
console.log('\nThese formulas are IDENTICAL.');
console.log('They read samples from OLDEST (x=0) to NEWEST (x=fftSize-1).');
console.log('This is the CORRECT order for FFT time-domain input.');
console.log('\nThe buffer reading order is NOT the problem.');
