/** @format */

'use strict';

import { BrowserWindow } from 'electron';

// src/classes/debugSpectroWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { DisplaySpecParser } from './shared/displaySpecParser';
import { ColorTranslator, ColorMode } from './shared/colorTranslator';
import { FFTProcessor } from './shared/fftProcessor';
import { WindowFunctions } from './shared/windowFunctions';
import { TracePatternProcessor } from './shared/tracePatternProcessor';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';

import {
  DebugWindowBase,
  ePackedDataMode,
  ePackedDataWidth,
  PackedDataMode,
  Position,
  Size,
  WindowColor
} from './debugWindowBase';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

/**
 * SPECTRO Display Specification Interface
 * Defines the configuration for the SPECTRO window display
 */
export interface SpectroDisplaySpec {
  displayName: string;
  windowTitle: string;
  title: string;
  position: Position;
  hasExplicitPosition: boolean;
  size: Size;
  nbrSamples: number; // Required by BaseDisplaySpec (same as samples)
  samples: number; // FFT size (4-2048, power of 2)
  firstBin: number; // First frequency bin to display
  lastBin: number; // Last frequency bin to display
  depth: number; // Waterfall history depth (vWidth in Pascal)
  magnitude: number; // FFT magnitude scaling (0-11, shift amount)
  range: number; // Maximum range for color scaling
  rate: number; // Update rate (samples between FFT updates)
  tracePattern: number; // Trace pattern (0-15)
  dotSize: number; // Dot size for pixels
  dotSizeY: number; // Y dot size (can differ from X)
  colorMode: ColorMode; // Color mode for magnitude visualization
  colorTune: number; // Color tuning (Pascal vColorTune)
  logScale: boolean; // Enable log scale for magnitude
  hideXY: boolean; // Hide coordinate display
  window: WindowColor; // Required by BaseDisplaySpec
  packedMode?: PackedDataMode; // Optional packed data configuration
}

/**
 * Debug SPECTRO Window Implementation
 *
 * Displays real-time spectrogram (waterfall) showing frequency content over time.
 * Uses FFT for frequency analysis and scrolling bitmap display.
 *
 * === DECLARATION SYNTAX ===
 * `SPECTRO {display_name} {directives...}`
 *
 * === CONFIGURATION DIRECTIVES ===
 * - `SAMPLES n [first] [last]` - FFT size (4-2048, power of 2) and bin range
 * - `DEPTH n` - Waterfall depth in rows (1-2048, default: calculated from size)
 * - `MAG n` - Magnitude scaling (0-11, acts as right-shift, default: 0)
 * - `RANGE n` - Maximum range for color mapping (1-2147483647, default: 2147483647)
 * - `RATE n` - Update rate in samples (default: samples/8)
 * - `TRACE n` - Trace pattern for scrolling (0-15, default: 15)
 * - `DOTSIZE x [y]` - Pixel size (1-16, default: 1x1)
 * - `LOGSCALE` - Enable logarithmic scale for magnitude
 * - `HIDEXY` - Hide coordinate display
 * - Color modes: `LUMA8`, `LUMA8W`, `LUMA8X`, `HSV16`, `HSV16W`, `HSV16X`
 * - Standard directives: TITLE, POS, SIZE
 * - Packing modes: LONGS_1BIT..BYTES_4BIT with optional SIGNED/ALT
 *
 * === DATA FEEDING SYNTAX ===
 * `{display_name} {samples | commands}`
 *
 * Commands:
 * - `CLEAR` - Clear display and reset buffer
 * - `SAVE [WINDOW] filename` - Save screenshot
 * - `PC_KEY` - Enable keyboard input forwarding
 * - `PC_MOUSE` - Enable mouse input forwarding
 *
 * === EXAMPLE USAGE ===
 * ```spin2
 * ' From DEBUG_SPECTRO.spin2
 * debug(`SPECTRO MySpectro SAMPLES 2048 0 236 RANGE 1000 LUMA8X GREEN)
 * repeat
 *   j += 2850 + qsin(2500, i++, 30_000)
 *   k := qsin(1000, j, 50_000)
 *   debug(`MySpectro `(k))
 * ```
 *
 * === TECHNICAL DETAILS ===
 * - Circular sample buffer stores up to 2048 samples
 * - FFT performed when buffer fills to configured sample count
 * - Each FFT result becomes one row in waterfall display
 * - Scrolling controlled by trace pattern (patterns 8-15 enable scroll)
 * - Color intensity mapped from magnitude using selected color mode
 * - Log scale: Round(Log2(v+1)/Log2(range+1)*range)
 * - Phase coloring available with HSV16 modes
 *
 * === PASCAL REFERENCE ===
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `SPECTRO_Configure` procedure (line 1719)
 * - Update: `SPECTRO_Update` procedure (line 1792)
 * - Drawing: `SPECTRO_Draw` procedure (line 1836)
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_SPECTRO.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugSpectroWindow extends DebugWindowBase {
  private displaySpec: SpectroDisplaySpec;
  private fftProcessor: FFTProcessor;
  private windowFunctions: WindowFunctions;
  private canvasRenderer: CanvasRenderer | undefined;
  private colorTranslator: ColorTranslator;
  private traceProcessor: TracePatternProcessor;
  private traceWidth: number = 0;
  private traceHeight: number = 0;
  private noiseFloor: number = 0;

  // Sample buffer management (circular buffer)
  private readonly BUFFER_SIZE = 2048; // SPECTRO_Samples = DataSets
  private readonly BUFFER_MASK = this.BUFFER_SIZE - 1; // SPECTRO_PtrMask
  private sampleBuffer: Int32Array; // SPECTRO_SampleBuff
  private sampleWritePtr = 0; // SamplePtr in Pascal
  private sampleCount = 0; // SamplePop in Pascal

  // Rate control
  private rateCounter = 0; // vRateCount in Pascal

  // FFT operation guard (prevents overlapping FFT operations)
  private isPerformingFFT = false;

  // FFT properties
  private fftExp = 0; // FFTexp
  private fftSize = 0; // vSamples

  // FFT working arrays
  private fftInput: Int32Array; // FFTsamp[x]
  private fftPower: Int32Array; // FFTpower[x]
  private fftAngle: Int32Array; // FFTangle[x]

  // Canvas management
  private canvasId: string = '';
  private bitmapCanvasId: string = '';
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  constructor(context: Context, displaySpec: SpectroDisplaySpec, windowId: string = `spectro-${Date.now()}`) {
    super(context, windowId, 'spectro');
    this.windowLogPrefix = 'spectroW';

    // Enable logging for SPECTRO window (both console and constructor logging)
    this.isLogging = false;
    console.log(`[SPECTRO CONSTRUCTOR] Creating SPECTRO window with displayName: ${displaySpec.displayName}`);

    // Initialize FFT processor and window functions
    this.fftProcessor = new FFTProcessor();
    this.windowFunctions = new WindowFunctions();
    this.colorTranslator = new ColorTranslator();
    this.traceProcessor = new TracePatternProcessor();

    // Initialize circular sample buffer
    this.sampleBuffer = new Int32Array(this.BUFFER_SIZE);

    // Initialize FFT working arrays (FFT output is half the input size)
    this.fftInput = new Int32Array(this.BUFFER_SIZE);
    this.fftPower = new Int32Array(this.BUFFER_SIZE / 2);
    this.fftAngle = new Int32Array(this.BUFFER_SIZE / 2);

    // Store the display spec
    this.displaySpec = displaySpec;

    // Set up color translator
    this.colorTranslator.setColorMode(this.displaySpec.colorMode);
    this.colorTranslator.setTune(this.displaySpec.colorTune);

    // Prepare FFT lookup tables
    this.fftSize = this.displaySpec.samples;
    this.fftExp = Math.log2(this.fftSize);
    this.fftProcessor.prepareFFT(this.fftSize);

    // Calculate window dimensions based on trace pattern and bins
    this.calculateSpectroWindowDimensions();

    this.noiseFloor = this.computeNoiseFloor();

    // Initialize canvas ID immediately (don't wait for data)
    this.bitmapCanvasId = `spectro-canvas-${this.displaySpec.displayName}`;

    // Initialize canvas renderer
    if (!this.canvasRenderer) {
      this.canvasRenderer = new CanvasRenderer();
    }

    // Set up trace processor for waterfall scrolling
    this.traceProcessor.setPattern(this.displaySpec.tracePattern);
    this.traceProcessor.setBitmapSize(this.traceWidth, this.traceHeight);

    // Note: Set scroll callback AFTER window is created to avoid null reference
    // Will be set in createDebugWindow() after window exists

    // Initialize rate counter
    this.rateCounter = this.displaySpec.rate - 1;

    // CRITICAL FIX: Create window immediately, don't wait for data
    // This matches TERM window pattern and ensures window appears when declared
    this.logMessage('Creating SPECTRO window immediately in constructor');
    this.createDebugWindow();

    // CRITICAL: Mark window as ready to process messages
    // Without this, all messages get queued instead of processed immediately
    this.onWindowReady();
  }

  /**
   * Get window title (public getter for base class abstract requirement)
   */
  get windowTitle(): string {
    return this.displaySpec.windowTitle;
  }

  /**
   * Calculate window dimensions based on configuration
   * Pascal: vHeight := FFTlast - FFTfirst + 1; if vTrace and $4 = 0 then swap(vWidth, vHeight)
   */
  private calculateSpectroWindowDimensions(): void {
    // Height is number of frequency bins to display
    let height = this.displaySpec.lastBin - this.displaySpec.firstBin + 1;
    let width = this.displaySpec.depth;

    // Trace patterns 0-3 (horizontal) swap dimensions
    // Pascal: if vTrace and $4 = 0 then swap width and height
    if ((this.displaySpec.tracePattern & 0x4) === 0) {
      const temp = width;
      width = height;
      height = temp;
    }

    this.traceWidth = width;
    this.traceHeight = height;
    this.canvasWidth = width * this.displaySpec.dotSize;
    this.canvasHeight = height * this.displaySpec.dotSizeY;
  }

  /**
   * Compute an intensity floor in pixel units to suppress noise.
   * Empirically, values below roughly 8% of full scale map to near-black
   * in the Pascal implementation, so we treat them as zero.
   */
  private computeNoiseFloor(): number {
    const noiseFraction = 0.08; // 8% of 255
    const floor = Math.round(255 * noiseFraction);
    return Math.max(2, Math.min(254, floor));
  }

  /**
   * Attempt to parse a color tune token (named color or numeric value)
   */
  private static extractColorTune(lineParts: string[], startIndex: number): [number, number | null] {
    if (startIndex >= lineParts.length) {
      return [0, null];
    }

    const token = lineParts[startIndex];
    const tuneFromName = DebugSpectroWindow.parseColorTuneName(token);
    if (tuneFromName !== null) {
      return [1, tuneFromName];
    }

    const numericValue = Spin2NumericParser.parseValue(token);
    if (numericValue === null || !Number.isFinite(numericValue)) {
      return [0, null];
    }

    const tune = Math.trunc(numericValue);
    return [1, Math.max(0, Math.min(0xff, tune))];
  }

  /**
   * Map Pascal color names to tune indices (0-7)
   */
  private static parseColorTuneName(token: string): number | null {
    const colorMap: Record<string, number> = {
      ORANGE: 0,
      BLUE: 1,
      GREEN: 2,
      CYAN: 3,
      RED: 4,
      MAGENTA: 5,
      YELLOW: 6,
      GRAY: 7
    };

    const upper = token.toUpperCase();
    return Object.prototype.hasOwnProperty.call(colorMap, upper) ? colorMap[upper] : null;
  }

  /**
   * Parse SPECTRO window configuration from debug command
   */
  public static createDisplaySpec(displayName: string, lineParts: string[]): SpectroDisplaySpec {
    const FFT_DEFAULT = 512;
    const FFT_MAX = 2048;

    // Initialize with defaults matching Pascal SPECTRO_Configure
    const spec: SpectroDisplaySpec = {
      displayName: displayName,
      windowTitle: `${displayName} - SPECTRO`,
      title: '',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false,
      size: { width: 400, height: 300 },
      nbrSamples: FFT_DEFAULT, // Required by BaseDisplaySpec
      samples: FFT_DEFAULT,
      firstBin: 0,
      lastBin: FFT_DEFAULT / 2 - 1, // Will be 255 for default 512
      depth: 256, // Default vWidth
      magnitude: 0, // FFTmag
      range: 0x7fffffff, // vRange
      rate: 0, // Will be set to samples/8 if 0
      tracePattern: 0xf, // Default: scrolling mode 7 (vertical scroll)
      dotSize: 1,
      dotSizeY: 1,
      colorMode: ColorMode.LUMA8X, // key_luma8x
      colorTune: 0,
      logScale: false,
      hideXY: false,
      window: { background: 'black', grid: 'gray' } // Required by BaseDisplaySpec
    };

    // Parse configuration directives
    for (let index = 2; index < lineParts.length; index++) {
      const element = lineParts[index].toUpperCase();

      // Handle SAMPLES with optional first and last bins
      if (element === 'SAMPLES') {
        if (index < lineParts.length - 1) {
          const samplesValue = Number(lineParts[++index]);

          // Round to nearest power of 2 between 4 and 2048
          // Pascal: FFTexp := Trunc(Log2(Within(val, 4, FFTmax)))
          const clamped = Math.max(4, Math.min(FFT_MAX, samplesValue));
          const fftExp = Math.round(Math.log2(clamped));
          spec.samples = Math.pow(2, fftExp);

          // Default first and last bins
          spec.firstBin = 0;
          spec.lastBin = spec.samples / 2 - 1;

          // Optional first bin parameter
          if (index < lineParts.length - 1 && !isNaN(Number(lineParts[index + 1]))) {
            const first = Number(lineParts[++index]);
            if (first >= 0 && first < spec.samples / 2 - 2) {
              spec.firstBin = first;

              // Optional last bin parameter
              if (index < lineParts.length - 1 && !isNaN(Number(lineParts[index + 1]))) {
                const last = Number(lineParts[++index]);
                if (last > spec.firstBin && last <= spec.samples / 2 - 1) {
                  spec.lastBin = last;
                }
              }
            }
          }
        }
        continue;
      }

      // Try to parse common keywords (TITLE, POS, SIZE, etc.)
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, spec);
      if (parsed) {
        index = index + consumed - 1;
        continue;
      }

      // Parse SPECTRO-specific keywords
      switch (element) {
        case 'DEPTH':
          if (index < lineParts.length - 1) {
            const depthValue = Number(lineParts[++index]);
            if (depthValue >= 1 && depthValue <= FFT_MAX) {
              spec.depth = depthValue;
            }
          }
          break;

        case 'MAG':
          if (index < lineParts.length - 1) {
            const magValue = Number(lineParts[++index]);
            if (magValue >= 0 && magValue <= 11) {
              spec.magnitude = magValue;
            }
          }
          break;

        case 'RANGE':
          if (index < lineParts.length - 1) {
            const rangeValue = Number(lineParts[++index]);
            if (rangeValue >= 1 && rangeValue <= 0x7fffffff) {
              spec.range = rangeValue;
            }
          }
          break;

        case 'RATE':
          if (index < lineParts.length - 1) {
            const rateValue = Number(lineParts[++index]);
            if (rateValue >= 1 && rateValue <= FFT_MAX) {
              spec.rate = rateValue;
            }
          }
          break;

        case 'TRACE':
          if (index < lineParts.length - 1) {
            const traceValue = Number(lineParts[++index]);
            spec.tracePattern = traceValue & 0xf; // 0-15
          }
          break;

        case 'DOTSIZE':
          if (index < lineParts.length - 1) {
            const dotX = Number(lineParts[++index]);
            if (dotX >= 1 && dotX <= 16) {
              spec.dotSize = dotX;
              spec.dotSizeY = dotX;

              // Optional second parameter for Y
              if (index < lineParts.length - 1 && !isNaN(Number(lineParts[index + 1]))) {
                const dotY = Number(lineParts[++index]);
                if (dotY >= 1 && dotY <= 16) {
                  spec.dotSizeY = dotY;
                }
              }
            }
          }
          break;

        case 'LOGSCALE':
          spec.logScale = true;
          break;

        case 'HIDEXY':
          spec.hideXY = true;
          break;

        // Color modes
        case 'LUMA8':
          spec.colorMode = ColorMode.LUMA8;
          const [consumedLuma8, tuneLuma8] = DebugSpectroWindow.extractColorTune(lineParts, index + 1);
          if (consumedLuma8 > 0 && tuneLuma8 !== null) {
            spec.colorTune = tuneLuma8;
            index += consumedLuma8;
          }
          break;
        case 'LUMA8W':
          spec.colorMode = ColorMode.LUMA8W;
          const [consumedLuma8W, tuneLuma8W] = DebugSpectroWindow.extractColorTune(lineParts, index + 1);
          if (consumedLuma8W > 0 && tuneLuma8W !== null) {
            spec.colorTune = tuneLuma8W;
            index += consumedLuma8W;
          }
          break;
        case 'LUMA8X':
          spec.colorMode = ColorMode.LUMA8X;
          const [consumedLuma8X, tuneLuma8X] = DebugSpectroWindow.extractColorTune(lineParts, index + 1);
          if (consumedLuma8X > 0 && tuneLuma8X !== null) {
            spec.colorTune = tuneLuma8X;
            index += consumedLuma8X;
          }
          break;
        case 'HSV16':
          spec.colorMode = ColorMode.HSV16;
          const [consumedHsv16, tuneHsv16] = DebugSpectroWindow.extractColorTune(lineParts, index + 1);
          if (consumedHsv16 > 0 && tuneHsv16 !== null) {
            spec.colorTune = tuneHsv16;
            index += consumedHsv16;
          }
          break;
        case 'HSV16W':
          spec.colorMode = ColorMode.HSV16W;
          const [consumedHsv16W, tuneHsv16W] = DebugSpectroWindow.extractColorTune(lineParts, index + 1);
          if (consumedHsv16W > 0 && tuneHsv16W !== null) {
            spec.colorTune = tuneHsv16W;
            index += consumedHsv16W;
          }
          break;
        case 'HSV16X':
          spec.colorMode = ColorMode.HSV16X;
          const [consumedHsv16X, tuneHsv16X] = DebugSpectroWindow.extractColorTune(lineParts, index + 1);
          if (consumedHsv16X > 0 && tuneHsv16X !== null) {
            spec.colorTune = tuneHsv16X;
            index += consumedHsv16X;
          }
          break;

        // Packed data modes
        default:
          const [isPackedMode, packedMode] = PackedDataProcessor.validatePackedMode(element);
          if (isPackedMode) {
            spec.packedMode = packedMode;
          }
          break;
      }
    }

    // Apply defaults
    // Pascal: if vRate = 0 then vRate := vSamples div 8
    if (spec.rate === 0) {
      spec.rate = Math.floor(spec.samples / 8);
    }

    return spec;
  }

  /**
   * Parse SPECTRO declaration (wrapper for createDisplaySpec to match window creation pattern)
   * Returns [isValid, spec] tuple matching other debug windows
   */
  public static parseSpectroDeclaration(lineParts: string[]): [boolean, SpectroDisplaySpec] {
    // Extract display name from lineParts[1]
    if (lineParts.length < 2) {
      const emptySpec = {} as SpectroDisplaySpec;
      return [false, emptySpec];
    }

    const displayName = lineParts[1];
    const spec = DebugSpectroWindow.createDisplaySpec(displayName, lineParts);
    return [true, spec];
  }

  /**
   * Clear display and sample buffer (called by base class CLEAR command)
   */
  protected clearDisplayContent(): void {
    this.clearBuffer();
    this.clearCanvas();
  }

  /**
   * Force display update (called by base class UPDATE command)
   */
  protected forceDisplayUpdate(): void {
    // SPECTRO doesn't have explicit UPDATE in Pascal
    // Just trigger a redraw
    this.updateWaterfallDisplay();
  }

  /**
   * Close the debug window
   */
  public closeDebugWindow(): void {
    this.logMessage(`Closing SPECTRO window`);
    this.debugWindow = null;
  }

  /**
   * Get the canvas ID for this window
   */
  protected getCanvasId(): string {
    return this.bitmapCanvasId;
  }

  /**
   * Entry point for message processing from WindowRouter
   * Called by router's updateContent(dataParts)
   */
  public async updateContent(lineParts: string[]): Promise<void> {
    this.processMessageImmediate(lineParts);
  }

  /**
   * Update SPECTRO window content with new data (synchronous wrapper for async operations)
   */
  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  /**
   * Process SPECTRO data and commands (async implementation)
   */
  private async processMessageAsync(lineParts: string[]): Promise<void> {
    if (lineParts.length < 1) {
      return;
    }

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    // Window name was already stripped by mainWindow before routing - pass lineParts directly
    if (await this.handleCommonCommand(lineParts)) {
      return;
    }

    // Process sample data starting from index 0
    for (let i = 0; i < lineParts.length; i++) {
      const part = lineParts[i];

      // Check for string (not allowed in SPECTRO)
      // Pascal: if NextStr then Break
      if (part.startsWith("'") || part.startsWith('"')) {
        this.logMessage(`ERROR: String data not allowed in SPECTRO window`);
        break;
      }

      // Check for backtick-enclosed data
      if (part.startsWith('`')) {
        const dataMatch = part.match(/^`\(([^)]+)\)`?$/);
        if (dataMatch) {
          const dataExpr = dataMatch[1];
          const parsedValue = this.parseSampleValue(dataExpr);
          if (parsedValue !== null) {
            // Window already created in constructor, just add sample
            this.addSample(parsedValue);
          }
        }
        continue;
      }

      // Handle packed data if configured
      if (this.displaySpec.packedMode) {
        const parsedPackedValue = this.parseSampleValue(part);
        if (parsedPackedValue !== null) {
          // Unpack samples
          const samples = PackedDataProcessor.unpackSamples(parsedPackedValue, this.displaySpec.packedMode);

          // Add each unpacked sample
          for (const sample of samples) {
            this.addSample(sample);
          }
        }
      } else {
        // Try to parse as raw numeric value
        const parsedValue = this.parseSampleValue(part);
        if (parsedValue !== null) {
          this.addSample(parsedValue);
        }
      }
    }
  }

  private parseSampleValue(rawValue: string): number | null {
    if (!Spin2NumericParser.isNumeric(rawValue)) {
      return null;
    }

    const parsed = Spin2NumericParser.parseValue(rawValue);
    if (parsed === null || !Number.isFinite(parsed)) {
      return null;
    }

    return Math.trunc(parsed);
  }

  /**
   * Add a sample to the circular buffer
   * Pascal: SPECTRO_SampleBuff[SamplePtr] := UnPack(v)
   */
  private addSample(sample: number): void {
    // Enter sample into buffer
    this.sampleBuffer[this.sampleWritePtr] = sample;

    // Advance write pointer with wraparound
    // Pascal: SamplePtr := (SamplePtr + 1) and SPECTRO_PtrMask
    this.sampleWritePtr = (this.sampleWritePtr + 1) & this.BUFFER_MASK;

    // Increment sample count
    // Pascal: if SamplePop < vSamples then Inc(SamplePop)
    if (this.sampleCount < this.fftSize) {
      this.sampleCount++;
    }

    // Exit if sample buffer not full
    // Pascal: if SamplePop <> vSamples then Continue
    if (this.sampleCount !== this.fftSize) {
      return;
    }

    // Check if we should perform FFT
    // Pascal: if RateCycle then SPECTRO_Draw
    if (this.rateCycle()) {
      // Fire and forget - but guard against overlapping operations
      if (!this.isPerformingFFT) {
        this.isPerformingFFT = true;
        this.performFFTAndDraw()
          .catch((error) => {
            this.logMessage(`FFT operation failed: ${error}`);
          })
          .finally(() => {
            this.isPerformingFFT = false;
          });
      }
    }
  }

  /**
   * Check if rate counter has cycled
   * Pascal: function RateCycle
   */
  private rateCycle(): boolean {
    // Increment rate counter
    this.rateCounter++;

    // Check if we've reached the rate threshold
    if (this.rateCounter >= this.displaySpec.rate) {
      this.rateCounter = 0;
      return true;
    }

    return false;
  }

  /**
   * Perform FFT and draw results to waterfall
   * Pascal: SPECTRO_Draw procedure
   */
  private async performFFTAndDraw(): Promise<void> {
    // Copy samples from circular buffer to FFT input
    // Pascal: for x := 0 to vSamples - 1 do FFTsamp[x] := SPECTRO_SampleBuff[(SamplePtr - vSamples + x) and SPECTRO_PtrMask]
    for (let x = 0; x < this.fftSize; x++) {
      const bufferIndex = (this.sampleWritePtr - this.fftSize + x) & this.BUFFER_MASK;
      this.fftInput[x] = this.sampleBuffer[bufferIndex];
    }

    // Perform FFT - pass only the relevant portion of the input array
    // Pascal: PerformFFT
    const fftInputSlice = this.fftInput.slice(0, this.fftSize);
    const result = this.fftProcessor.performFFT(fftInputSlice, this.displaySpec.magnitude);
    this.fftPower = result.power;
    this.fftAngle = result.angle;

    // Calculate scaling factor
    // Pascal: fScale := 255 / vRange
    const fScale = 255 / this.displaySpec.range;

    // Plot FFT bins as pixels
    // Pascal: for x := FFTfirst to FFTlast do
    for (let x = this.displaySpec.firstBin; x <= this.displaySpec.lastBin; x++) {
      let v = this.fftPower[x];

      // Apply log scale if enabled
      // Pascal: if vLogScale then v := Round(Log2(Int64(v) + 1) / Log2(Int64(vRange) + 1) * vRange)
      if (this.displaySpec.logScale) {
        v = Math.round((Math.log2(v + 1) / Math.log2(this.displaySpec.range + 1)) * this.displaySpec.range);
      }

      // Scale to 0-255 using arithmetic rounding (matches Pascal's Round function)
      let magnitudePixel = Math.round(v * fScale);
      if (magnitudePixel > 0xff) magnitudePixel = 0xff;

      let pixelValue = magnitudePixel;
      if (pixelValue < this.noiseFloor) {
        pixelValue = 0;
      } else if (this.displaySpec.colorMode >= ColorMode.HSV16 && this.displaySpec.colorMode <= ColorMode.HSV16X) {
        pixelValue = pixelValue | ((this.fftAngle[x] >> 16) & 0xff00);
      }

      await this.plotPixel(pixelValue);

      // Capture bitmap just before last pixel triggers scroll
      // Pascal: if x = FFTlast then BitmapToCanvas(0)
      if (x === this.displaySpec.lastBin) {
        await this.updateWaterfallDisplay();
      }

      // Step trace to next position (triggers scroll if at edge)
      // Pascal: StepTrace
      this.traceProcessor.step();
    }
  }

  /**
   * Plot a pixel at the current trace position
   *
   * GEOMETRY FIX: This method retrieves the current position from TracePatternProcessor
   * in LOGICAL bin/depth units (pos.x, pos.y), then converts to PIXEL coordinates by
   * multiplying by dotSize/dotSizeY when rendering to canvas via fillRect.
   *
   * This keeps the coordinate system consistent:
   * - TracePatternProcessor operates in logical space (bin/depth units)
   * - Canvas operations (fillRect, scrolling) operate in pixel space
   * - Conversion happens at the boundary between logical and pixel domains
   *
   * Pascal reference: PlotPixel (line ~3425) - uses vDotSize scaling in Pascal's bitmap
   *
   * @param colorValue Pixel color value (0-255 for LUMA modes, or packed HSV16 value)
   */
  private async plotPixel(colorValue: number): Promise<void> {
    if (!this.debugWindow) return;

    // Translate color value using color translator
    const rgb24 = this.colorTranslator.translateColor(colorValue);
    const color = `#${rgb24.toString(16).padStart(6, '0')}`;

    // Get current pixel position from trace processor (in logical bin/depth units)
    const pos = this.traceProcessor.getPosition();

    // Plot pixel to offscreen bitmap, converting logical coordinates to pixels
    const plotCode = `
      (function() {
        const offscreenKey = 'spectroOffscreen_${this.bitmapCanvasId}';
        const offscreen = window[offscreenKey];
        if (offscreen) {
          const ctx = offscreen.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '${color}';
            // Convert logical coordinates (pos.x, pos.y) to pixel coordinates by multiplying by dotSize
            ctx.fillRect(${pos.x * this.displaySpec.dotSize}, ${pos.y * this.displaySpec.dotSizeY},
                        ${this.displaySpec.dotSize}, ${this.displaySpec.dotSizeY});
          }
        }
      })();
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(plotCode);
    } catch (error) {
      this.logMessage(`Failed to plot pixel: ${error}`);
    }
  }

  /**
   * Scroll the waterfall bitmap by the specified logical units
   *
   * CRITICAL GEOMETRY FIX: This method receives scroll deltas in LOGICAL bin/depth units
   * from TracePatternProcessor.step() and converts them to PIXEL units by multiplying by
   * dotSize/dotSizeY. This matches Pascal's ScrollBitmap behavior exactly.
   *
   * Previous implementations incorrectly operated in pixel space throughout, causing
   * visual artifacts (mirroring/smearing) because the trace cursor advanced in pixels
   * while FFT bins were plotted in logical coordinates.
   *
   * The fix: Keep trace coordinates in logical space (bin/depth units) and apply dotSize
   * scaling ONLY when performing canvas operations (scrolling and plotting).
   *
   * Pascal reference: DebugDisplayUnit.pas, ScrollBitmap procedure (~lines 3077-3110)
   *
   * @param scrollX Horizontal scroll delta in logical bin units (±1)
   * @param scrollY Vertical scroll delta in logical depth units (±1)
   */
  private scrollWaterfall(scrollX: number, scrollY: number): void {
    if (!this.debugWindow) return;

    // Convert logical bin/depth units to pixel units by multiplying by dotSize
    // This is the KEY FIX that resolved the visual mirroring issue
    const scrollXPixels = scrollX * this.displaySpec.dotSize;
    const scrollYPixels = scrollY * this.displaySpec.dotSizeY;

    const scrollCode = `
      (function() {
        const offscreenKey = 'spectroOffscreen_${this.bitmapCanvasId}';
        const offscreen = window[offscreenKey];
        if (!offscreen) return;

        const ctx = offscreen.getContext('2d');
        if (!ctx) return;

        // Create temp canvas to hold current bitmap
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = offscreen.width;
        tempCanvas.height = offscreen.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Copy current bitmap to temp
        tempCtx.drawImage(offscreen, 0, 0);

        // Copy back with scroll offset
        ctx.drawImage(tempCanvas, 0, 0, offscreen.width, offscreen.height,
                     ${scrollXPixels}, ${scrollYPixels}, offscreen.width, offscreen.height);

        // Clear newly exposed region to background color
        ctx.fillStyle = '#000000';
        if (${scrollXPixels} < 0) {
          ctx.fillRect(offscreen.width + ${scrollXPixels}, 0, ${-scrollXPixels}, offscreen.height);
        } else if (${scrollXPixels} > 0) {
          ctx.fillRect(0, 0, ${scrollXPixels}, offscreen.height);
        }
        if (${scrollYPixels} < 0) {
          ctx.fillRect(0, offscreen.height + ${scrollYPixels}, offscreen.width, ${-scrollYPixels});
        } else if (${scrollYPixels} > 0) {
          ctx.fillRect(0, 0, offscreen.width, ${scrollYPixels});
        }
      })();
    `;

    this.debugWindow.webContents.executeJavaScript(scrollCode).catch((error) => {
      this.logMessage(`Failed to scroll waterfall: ${error}`);
    });
  }

  /**
   * Update the waterfall display (copy offscreen to visible canvas)
   * Pascal: BitmapToCanvas(0)
   */
  private async updateWaterfallDisplay(): Promise<void> {
    if (!this.debugWindow) return;

    const updateCode = `
      (function() {
        const canvas = document.getElementById('${this.bitmapCanvasId}');
        if (!canvas) return;

        const offscreenKey = 'spectroOffscreen_${this.bitmapCanvasId}';
        const offscreen = window[offscreenKey];
        if (!offscreen) return;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Disable image smoothing for pixel-perfect display
          ctx.imageSmoothingEnabled = false;
          ctx.webkitImageSmoothingEnabled = false;
          ctx.msImageSmoothingEnabled = false;

          // Draw offscreen bitmap to display canvas
          ctx.drawImage(offscreen, 0, 0);
        }
      })();
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(updateCode);
    } catch (error) {
      this.logMessage(`Failed to update display: ${error}`);
    }
  }

  /**
   * Clear the sample buffer and reset pointers
   */
  private clearBuffer(): void {
    this.sampleBuffer.fill(0);
    this.sampleWritePtr = 0;
    this.sampleCount = 0; // SamplePop = 0
    this.rateCounter = this.displaySpec.rate - 1; // vRateCount := vRate - 1

    // Reset trace pattern
    // Pascal: SetTrace(vTrace, False)
    this.traceProcessor.setPattern(this.displaySpec.tracePattern);

    this.logMessage('Sample buffer cleared');
  }

  /**
   * Clear the canvas with background color
   */
  private clearCanvas(): void {
    if (!this.debugWindow) return;

    const clearCode = `
      (function() {
        const canvas = document.getElementById('${this.bitmapCanvasId}');
        if (!canvas) return;

        const offscreenKey = 'spectroOffscreen_${this.bitmapCanvasId}';
        if (!window[offscreenKey]) {
          window[offscreenKey] = document.createElement('canvas');
          window[offscreenKey].width = ${this.canvasWidth};
          window[offscreenKey].height = ${this.canvasHeight};
        }

        const offscreen = window[offscreenKey];

        // Clear offscreen
        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          offCtx.fillStyle = '#000000';
          offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
        }

        // Clear display
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      })();
    `;

    this.debugWindow.webContents.executeJavaScript(clearCode).catch((error) => {
      this.logMessage(`Failed to clear canvas: ${error}`);
    });
  }

  // Note: initializeCanvas() method removed - initialization now happens in constructor

  /**
   * Create the debug window with canvas
   */
  private createDebugWindow(): void {
    this.logMessage(`Creating SPECTRO debug window: ${this.displaySpec.windowTitle}`);

    let x = this.displaySpec.position.x;
    let y = this.displaySpec.position.y;

    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(this.canvasWidth, this.canvasHeight);

    // If no POS clause was present, use WindowPlacer
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowDimensions.width, height: windowDimensions.height },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`spectro-${this.displaySpec.displayName}`, placementConfig);
      x = position.x;
      y = position.y;

      // Log to debug logger
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${x},${y} ${windowDimensions.width}x${windowDimensions.height} Mon:${monitorId}) SPECTRO '${this.displaySpec.displayName}' POS ${x} ${y} SIZE ${windowDimensions.width} ${windowDimensions.height}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }

    // Create browser window
    this.debugWindow = new BrowserWindow({
      width: windowDimensions.width,
      height: windowDimensions.height,
      x,
      y,
      title: this.displaySpec.windowTitle,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Register window with WindowPlacer
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`spectro-${this.displaySpec.displayName}`, this.debugWindow);
    }

    // Set up window event handlers
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('SPECTRO window ready to show');
      this.debugWindow?.show();
      this.registerWithRouter();
    });

    this.debugWindow.on('closed', () => {
      this.logMessage('SPECTRO window closed');
      this.closeDebugWindow();
    });

    // NOW it's safe to set the scroll callback since window exists
    // This avoids null reference errors when trace processor triggers scroll
    this.traceProcessor.setScrollCallback((scrollX: number, scrollY: number) => {
      this.scrollWaterfall(scrollX, scrollY);
    });

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.displaySpec.windowTitle}</title>
          <style>
            @font-face {
              font-family: 'Parallax';
              src: url('file:///${__dirname.replace(/\\/g, '/')}/../../assets/fonts/Parallax.ttf') format('truetype');
            }
            body {
              margin: 0;
              padding: 10px;
              overflow: hidden;
              background-color: #000;
            }
            canvas {
              display: block;
              image-rendering: pixelated;
              image-rendering: -moz-crisp-edges;
              image-rendering: crisp-edges;
            }
            #coordinate-display {
              position: absolute;
              padding: 8px;
              background: #000;
              color: #ccc;
              border: 1px solid #ccc;
              font-family: 'Parallax', 'Consolas', 'Courier New', monospace;
              font-size: 12px;
              pointer-events: none;
              display: ${this.displaySpec.hideXY ? 'none' : 'block'};
              z-index: 999;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <canvas id="${this.bitmapCanvasId}" width="${this.canvasWidth}" height="${this.canvasHeight}"></canvas>
          <div id="coordinate-display"></div>
          <script>
            // Create offscreen canvas immediately for double buffering
            const offscreenKey = 'spectroOffscreen_${this.bitmapCanvasId}';
            window[offscreenKey] = document.createElement('canvas');
            window[offscreenKey].width = ${this.canvasWidth};
            window[offscreenKey].height = ${this.canvasHeight};
          </script>
        </body>
      </html>
    `;

    // Write HTML to temp file to allow file:// font URLs to work
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pnut-spectro-${this.windowId}-${Date.now()}.html`);
    fs.writeFileSync(tempFile, htmlContent);

    // Load from file system
    this.debugWindow.loadFile(tempFile);

    // Initialize canvas after load and clean up temp file
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.clearCanvas();

      // Clean up temp file after a delay to ensure it's fully loaded
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFile);
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 5000);
    });
  }
}
