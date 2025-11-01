/** @format */

/**
 * Spectro analysis helper.
 *
 * Replays the recorded Spectro data (tests/recordings/spectro_samples_4096.json)
 * through the FFT pipeline and prints per-bin intensity statistics so we can
 * compare against the Pascal reference bitmap.
 *
 * Run with:
 *   npx ts-node scripts/analyzeSpectro.ts
 */

import * as fs from 'fs';
import path from 'path';
import { FFTProcessor } from '../src/classes/shared/fftProcessor';
import { Jimp } from 'jimp';

const DISPLAY_SPEC = {
  samples: 2048,
  firstBin: 0,
  lastBin: 236,
  depth: 256,
  range: 1000
};

function loadSamples(): number[] {
  const recordingPath = path.join(__dirname, '..', 'tests', 'recordings', 'spectro_samples_4096.json');
  const raw = fs.readFileSync(recordingPath, 'utf8');
  return JSON.parse(raw);
}

function analyseSpectrum(samples: number[]): { pixels: Array<{ bin: number; value: number; pixel: number }> } {
  const fft = new FFTProcessor();
  fft.prepareFFT(DISPLAY_SPEC.samples);

  const block = new Int32Array(samples.slice(0, DISPLAY_SPEC.samples));
  const result = fft.performFFT(block, 0);
  const powerValues = Array.from(result.power.slice(DISPLAY_SPEC.firstBin, DISPLAY_SPEC.lastBin + 1));

  const scale = 255 / DISPLAY_SPEC.range;
  const pixelValues = powerValues.map((value, index) => ({
    bin: DISPLAY_SPEC.firstBin + index,
    value,
    pixel: Math.round(value * scale)
  }));

  const nonZero = pixelValues.filter((entry) => entry.pixel > 0);
  const above20 = pixelValues.filter((entry) => entry.pixel >= 20);
  const above40 = pixelValues.filter((entry) => entry.pixel >= 40);

  console.log('=== Spectro FFT Intensity Summary ===');
  console.log(`Total bins analysed : ${pixelValues.length}`);
  console.log(`Non-zero bins (>0)  : ${nonZero.length}`);
  console.log(`Bins >= 20          : ${above20.length}`);
  console.log(`Bins >= 40          : ${above40.length}`);

  const topBins = [...pixelValues]
    .sort((a, b) => b.pixel - a.pixel)
    .slice(0, 10);

  console.log('\nTop 10 bins by pixel value (bin, raw power, mapped pixel):');
  topBins.forEach((entry) => {
    console.log(`  bin ${entry.bin.toString().padStart(3, '0')} -> power ${entry.value.toString().padStart(4, ' ')}, pixel ${entry.pixel}`);
  });

  const histogram = new Map<number, number>();
  pixelValues.forEach((entry) => {
    const bucket = Math.floor(entry.pixel / 5) * 5;
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  });

  const sortedBuckets = Array.from(histogram.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket - b.bucket);

  console.log('\nPixel histogram (bucket -> count):');
  sortedBuckets.forEach(({ bucket, count }) => {
    const label = `${bucket}`.padStart(3, ' ');
    console.log(`  ${label} - ${count}`);
  });

  const avgBackground = pixelValues
    .filter((entry) => entry.bin !== 145)
    .reduce((sum, entry) => sum + entry.value, 0) / (pixelValues.length - 1);

  console.log(`\nPeak bin (expected fundamental) : ${pixelValues.find((entry) => entry.bin === 145)?.pixel ?? 'n/a'}`);
  console.log(`Average background power (excl fundamental): ${avgBackground.toFixed(2)}`);

  return { pixels: pixelValues };
}

async function analyseBitmap(imagePath: string, label: string): Promise<Array<{ bin: number; average: number; max: number }>> {
  const image = await Jimp.read(imagePath);
  const halfWidth = Math.floor(image.bitmap.width / 2);

  // Determine bounding box of non-zero green pixels within the left half (Spectro window).
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < image.bitmap.height; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const green = image.getPixelColor(x, y) >> 8 & 0xff;
      if (green > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!Number.isFinite(minX)) {
    console.log(`No active pixels detected in ${label}.`);
    return [];
  }

  const binCount = DISPLAY_SPEC.lastBin - DISPLAY_SPEC.firstBin + 1;
  const dotSize = 1; // Spectro defaults to dotSize 1 in the captured scenario
  const regionWidth = binCount * dotSize;
  const regionHeight = DISPLAY_SPEC.depth * dotSize;

  const adjustedMaxX = Math.min(maxX, minX + regionWidth - 1);
  const adjustedMaxY = Math.min(maxY, minY + regionHeight - 1);

  maxX = adjustedMaxX;
  maxY = adjustedMaxY;

  const startX = minX;
  const startY = minY;

  const totals = new Array(binCount).fill(0);
  const counts = new Array(binCount).fill(0);
  const maxima = new Array(binCount).fill(0);

  for (let y = startY; y <= maxY && y < image.bitmap.height; y++) {
    for (let x = startX; x <= maxX && x < halfWidth; x++) {
      const green = image.getPixelColor(x, y) >> 8 & 0xff;
      if (green === 0) continue;

      const ratio = (x - startX) / Math.max(1, maxX - startX);
      const bin = Math.min(binCount - 1, Math.max(0, Math.round(ratio * (binCount - 1))));

      totals[bin] += green;
      counts[bin] += 1;
      if (green > maxima[bin]) maxima[bin] = green;
    }
  }

  const stats = totals.map((sum, bin) => ({
    bin: DISPLAY_SPEC.firstBin + bin,
    average: counts[bin] ? sum / counts[bin] : 0,
    max: maxima[bin]
  }));

  const nonZero = stats.filter((entry) => entry.max > 0);
  console.log(`\n=== Bitmap Analysis (${label}) ===`);
  console.log(`Active bins (max>0): ${nonZero.length}`);
  const topBins = [...nonZero]
    .sort((a, b) => b.max - a.max)
    .slice(0, 10);
  topBins.forEach((entry) => {
    console.log(`  bin ${entry.bin.toString().padStart(3, '0')} -> max ${entry.max}, avg ${entry.average.toFixed(2)}`);
  });

  return stats;
}

async function main(): Promise<void> {
  const samples = loadSamples();
  if (samples.length < DISPLAY_SPEC.samples) {
    throw new Error(`Not enough samples loaded (expected ${DISPLAY_SPEC.samples}, got ${samples.length})`);
  }

  const { pixels } = analyseSpectrum(samples);

  const basePath = path.join(__dirname, '..', 'test-results', 'external-results', 'bitmaps');
  const targets = [
    { label: 'Pascal reference', file: 'PNut-target.png' },
    { label: 'TypeScript current', file: 'pnut-term-ts-current.png' }
  ];

  for (const target of targets) {
    const imagePath = path.join(basePath, target.file);
    const stats = await analyseBitmap(imagePath, target.label);
    if (!stats.length) continue;

    const activeBins = stats.filter((entry) => entry.max > 0).map((entry) => entry.bin);
    const ourPixels = pixels.filter((entry) => entry.pixel > 0).map((entry) => entry.bin);

    const intersection = activeBins.filter((bin) => ourPixels.includes(bin));
    console.log(`Shared active bins (FFT vs ${target.label}): ${intersection.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
