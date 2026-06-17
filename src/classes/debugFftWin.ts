/** @format */

'use strict';

import { BrowserWindow } from 'electron';

// src/classes/debugFftWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { DisplaySpecParser } from './shared/displaySpecParser';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { ColorTranslator } from './shared/colorTranslator';
import { InputForwarder } from './shared/inputForwarder';
import { FFTProcessor } from './shared/fftProcessor';
import { WindowFunctions } from './shared/windowFunctions';
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
 * FFT Display Specification Interface
 * Defines the configuration for the FFT window display
 */
export interface FFTDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  title: string; // for BaseDisplaySpec compatibility
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was in original message
  size: Size;
  nbrSamples: number; // Required by BaseDisplaySpec
  samples: number; // FFT size (4-2048, power of 2)
  firstBin: number; // First frequency bin to display
  lastBin: number; // Last frequency bin to display
  rate: number; // Update rate (samples between updates)
  dotSize: number; // Dot size (0-32)
  lineSize: number; // Line size (-32 to 32, negative for bars)
  textSize: number; // Text size for labels
  window: WindowColor; // Window background/grid colors
  windowWidth: number; // Window width in pixels
  windowHeight: number; // Window height in pixels
  isPackedData: boolean;
  packedMode?: ePackedDataMode; // Packed data mode if applicable
  packedWidth?: ePackedDataWidth; // Packed data width if applicable
  packedSigned?: boolean; // Signed flag for packed data
  packedAlt?: boolean; // Alt flag for packed data
  logScale: boolean; // Enable log scale for magnitude
  showLabels: boolean; // Show frequency labels
  spectrumColor?: string; // Default spectrum color
  hideXY: boolean; // Hide coordinate display
}

/**
 * FFT Channel Specification Interface
 * Defines configuration for each FFT channel
 */
export interface FFTChannelSpec {
  label: string; // Channel label
  magnitude: number; // Magnitude scaling (0-11, shift amount)
  high: number; // Maximum expected magnitude
  tall: number; // Display height in pixels
  base: number; // Baseline offset
  grid: number; // Grid positioning
  color: string; // Channel color
}

/**
 * Debug FFT Window Implementation
 *
 * Displays real-time frequency spectrum analysis using Fast Fourier Transform.
 * Supports multi-channel overlaid spectrums with various display modes.
 *
 * === DECLARATION SYNTAX ===
 * `FFT {display_name} {directives...}`
 *
 * === CONFIGURATION DIRECTIVES ===
 * - `SAMPLES n [first] [last]` - FFT size (4-2048, power of 2) and display range
 * - `RATE n` - Update rate in samples between FFT calculations (default: samples value)
 * - `DOTSIZE n` - Dot size for plot points (0-32 pixels, 0=off)
 * - `LINESIZE n` - Line width (-32 to 32, negative for vertical bars)
 * - `LOGSCALE` - Enable logarithmic scale for magnitude display
 * - `HIDEXY` - Hide frequency/magnitude coordinate display
 * - Standard window directives: TITLE, POS, SIZE, COLOR
 * - Packing modes: LONGS_1BIT..BYTES_4BIT with optional SIGNED/ALT modifiers
 *
 * === DATA FEEDING SYNTAX ===
 * `{display_name} {channel_config | samples | commands}`
 *
 * Channel Configuration:
 * `'label' mag high tall base grid color`
 * - label: Channel name string
 * - mag: Magnitude scaling (0-11, acts as right-shift)
 * - high: Maximum expected value
 * - tall: Display height
 * - base: Baseline offset
 * - grid: Grid line positioning
 * - color: Channel color
 *
 * Commands:
 * - `CLEAR` - Clear display and reset buffers
 * - `SAVE` - Save screenshot
 * - `PC_KEY keycode` - Forward keyboard input
 * - `PC_MOUSE x y buttons` - Forward mouse input
 *
 * === EXAMPLE USAGE ===
 * ```spin2
 * ' From DEBUG_FFT.spin2
 * debug(`FFT MyFFT SIZE 250 200 SAMPLES 2048 0 127 RATE 256 LOGSCALE COLOR YELLOW 4 YELLOW 5)
 * debug(`MyFFT 'FFT' 0 1000 180 10 15 YELLOW 12)
 *
 * repeat
 *   j += 1550 + qsin(1300, i++, 31_000)
 *   k := qsin(1000, j, 50_000)
 *   debug(`MyFFT `(k))
 * ```
 *
 * === TECHNICAL DETAILS ===
 * - Uses Cooley-Tukey FFT algorithm with 12-bit fixed-point arithmetic
 * - Applies Hanning window to reduce spectral leakage
 * - Supports up to 8 channels with independent configurations
 * - Circular buffer stores 2048 samples × 8 channels
 * - Renders channels in reverse order for proper overlay
 *
 * === PASCAL REFERENCE ===
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `FFT_Configure` procedure (line 1552)
 * - Update: `FFT_Update` procedure (line 1620)
 * - FFT processing: `FFT_Process` and `FFT_Calculate` procedures
 * - Channel management: `FFT_Channel_Config` procedures
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_FFT.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugFFTWindow extends DebugWindowBase {
  private displaySpec: FFTDisplaySpec;
  private channels: FFTChannelSpec[] = [];
  private fftProcessor: FFTProcessor;
  private windowFunctions: WindowFunctions;
  private canvasRenderer: CanvasRenderer | undefined;
  private colorTranslator: ColorTranslator;
  private packedDataProcessor: PackedDataProcessor | undefined;

  // Sample buffer management
  private readonly BUFFER_SIZE = 2048;
  private readonly MAX_CHANNELS = 8;
  private sampleBuffer: Int32Array; // Changed to Int32Array to match Pascal's integer samples
  private sampleWritePtr = 0; // Write pointer for new samples
  private sampleReadPtr = 0; // Read pointer for FFT processing
  private samplePop = 0; // Number of samples in buffer (Pascal: SamplePop) - must reach vSamples before FFT
  private channelMask = 0x01; // Bitmask for enabled channels (default: channel 0 enabled)

  // Rate control and timing (Pascal: vRateCount, RateCycle)
  private rateCounter = 0; // Counts up to vRate to trigger FFT (Pascal: vRateCount)
  private currentChannel = 0; // Current channel index for sequential filling
  private lastSampleTime = 0; // Timestamp of last sample received
  private sampleTimestamps: number[] = []; // Rolling buffer of sample timestamps for rate detection
  private detectedSampleRate = 0; // Detected samples per second
  private droppedSamples = 0; // Count of dropped samples due to overflow

  // FFT properties
  private fftExp = 0; // Log2 of FFT size
  private fftSize = 0; // Current FFT size

  // FFT working arrays
  private fftInput: Int32Array; // Input to FFT (after channel summing)
  private fftPower: Int32Array; // FFT power output (combined)
  private fftAngle: Int32Array; // FFT phase output (combined)

  // Per-channel FFT results
  private channelFFTResults: Array<{
    power: Int32Array;
    angle: Int32Array;
    magnitude: number;
  }> = [];

  // Drawing lock to prevent concurrent draws (matches Pascal's synchronous FFT_Draw)
  private isDrawing = false;

  // Draws (performDraw → drawFFT) are SERIALIZED through the inherited renderChain (DebugWindowBase)
  // via scheduleRender() so a SAVE awaits the in-flight/queued draw before capturing. drawFFT issues
  // several awaited executeJavaScript steps and only copies offscreen→visible partway through, so a
  // fire-and-forget draw would let SAVE's capturePage race a stale/blank spectrum. The base SAVE
  // methods await renderChain via flushBeforeCapture(), so FFT no longer overrides them. [#49]

  constructor(context: Context, displaySpec: FFTDisplaySpec, windowId?: string) {
    // Use the user-provided display name as the window ID (the unique routing key), matching
    // TERM/LOGIC. The old `fft-${Date.now()}` default collided when two same-type windows were
    // created in the same millisecond → "Window … is already registered". [windowid-datenow-collision]
    const actualWindowId = windowId || displaySpec.displayName;
    super(context, actualWindowId, 'fft');
    this.windowLogPrefix = 'fftW';

    // Enable logging for FFT window debugging
    this.isLogging = false;

    // Initialize FFT processor and window functions
    this.fftProcessor = new FFTProcessor();
    this.windowFunctions = new WindowFunctions();
    this.colorTranslator = new ColorTranslator();

    // Initialize circular sample buffer for all channels
    // Layout: interleaved channels [ch0_s0, ch1_s0, ..., ch7_s0, ch0_s1, ch1_s1, ...]
    this.sampleBuffer = new Int32Array(this.BUFFER_SIZE * this.MAX_CHANNELS);

    // Initialize FFT working arrays (FFT output is half the input size)
    this.fftInput = new Int32Array(this.BUFFER_SIZE);
    this.fftPower = new Int32Array(this.BUFFER_SIZE / 2);
    this.fftAngle = new Int32Array(this.BUFFER_SIZE / 2);

    // Store the display spec
    this.displaySpec = displaySpec;

    // Prepare FFT lookup tables
    this.fftSize = this.displaySpec.samples;
    this.fftExp = Math.log2(this.fftSize);
    this.fftProcessor.prepareFFT(this.fftSize);

    // Initialize rate counter (Pascal: vRateCount := vRate - 1)
    // This makes RateCycle trigger on FIRST sample after buffer fills
    this.rateCounter = this.displaySpec.rate - 1;

    // Initialize packed data processor if needed
    if (this.displaySpec.isPackedData) {
      this.initializePackedDataProcessor();
    }

    // Window creation deferred until first data arrives and all channels are known
    // This allows proper sizing based on actual channel specifications
    // But we mark the window as "ready" to process messages for channel specs and first data
    this.onWindowReady();
  }

  /**
   * Get window title (public getter for base class abstract requirement)
   */
  get windowTitle(): string {
    return this.displaySpec.windowTitle;
  }

  /**
   * Initialize the packed data processor based on configuration
   */
  private initializePackedDataProcessor(): void {
    if (this.displaySpec.packedMode !== undefined && this.displaySpec.packedWidth !== undefined) {
      // PackedDataProcessor is a static utility class, we just need to track the mode
      this.packedDataProcessor = {
        mode: this.displaySpec.packedMode,
        width: this.displaySpec.packedWidth,
        isSigned: this.displaySpec.packedSigned || false,
        isAlt: this.displaySpec.packedAlt || false
      } as any;

      this.logMessage(
        `Initialized packed data processor: mode=${this.displaySpec.packedMode} ` +
          `width=${this.displaySpec.packedWidth} signed=${this.displaySpec.packedSigned} alt=${this.displaySpec.packedAlt}`
      );
    }
  }

  /**
   * Add a sample to the circular buffer for the current channel
   *
   * @param sample The sample value to add
   * @param channelIndex The channel index (0-7)
   */
  private addSample(sample: number, channelIndex: number): void {
    if (ENABLE_CONSOLE_LOG)
      console.log(`[FFT] addSample(${sample}, ch${channelIndex}): mask=0x${this.channelMask.toString(16)}`);

    // Validate channel index
    if (channelIndex < 0 || channelIndex >= this.MAX_CHANNELS) {
      if (ENABLE_CONSOLE_LOG) console.log(`[FFT] REJECTED: Invalid channel index: ${channelIndex}`);
      this.logMessage(`Invalid channel index: ${channelIndex}`);
      return;
    }

    // Check if this channel is enabled
    const channelEnabled = (this.channelMask & (1 << channelIndex)) !== 0;
    if (ENABLE_CONSOLE_LOG)
      console.log(
        `[FFT] Channel ${channelIndex} enabled check: mask & (1<<${channelIndex}) = 0x${this.channelMask.toString(
          16
        )} & 0x${(1 << channelIndex).toString(16)} = ${channelEnabled}`
      );

    if (!channelEnabled) {
      if (ENABLE_CONSOLE_LOG) console.log(`[FFT] REJECTED: Channel ${channelIndex} is disabled`);
      return; // Channel is disabled, ignore sample
    }

    // Update sample rate detection
    this.updateSampleRateDetection();

    // Check for buffer overflow - buffer is in continuous mode after first FFT
    // We only check if we've wrapped around and are overwriting unprocessed data
    // samplePop resets after each FFT trigger, so we can't use it for overflow detection
    // in continuous mode. Instead, just ensure we don't wrap past buffer size.
    // Note: This simple approach works because FFT processing is synchronous

    // Calculate buffer position for this channel's sample
    // Buffer layout: interleaved channels at each sample position
    const bufferIndex = this.sampleWritePtr * this.MAX_CHANNELS + channelIndex;

    // Store the sample
    this.sampleBuffer[bufferIndex] = sample;

    // Only advance write pointer and count when we've filled all enabled channels
    // This ensures samples stay synchronized across channels
    const lastChannel = this.getLastEnabledChannel();
    if (ENABLE_CONSOLE_LOG)
      console.log(
        `[FFT] Channel check: current=${channelIndex}, last=${lastChannel}, match=${channelIndex === lastChannel}`
      );

    if (channelIndex === lastChannel) {
      // Advance write pointer with wraparound
      this.sampleWritePtr = (this.sampleWritePtr + 1) & (this.BUFFER_SIZE - 1);

      // Increment samplePop until buffer is filled (Pascal: lines 1672)
      if (this.samplePop < this.displaySpec.samples) {
        this.samplePop++;
        if (ENABLE_CONSOLE_LOG)
          console.log(`[FFT] samplePop incremented to ${this.samplePop} (target: ${this.displaySpec.samples})`);
      }

      // Pascal logic (lines 1673-1674):
      // if SamplePop <> vSamples then Continue;  // Don't FFT until buffer initially full
      // if RateCycle then FFT_Draw;              // Only draw when rate cycle triggers
      if (this.samplePop >= this.displaySpec.samples) {
        // Buffer is full, check if rate cycle triggers
        const shouldTrigger = this.rateCycle();
        this.logMessage(
          `samplePop reached ${this.samplePop}, rateCycle returned ${shouldTrigger}, rateCounter=${this.rateCounter}`
        );
        if (shouldTrigger) {
          this.logMessage('*** TRIGGERING FFT ***');
          this.triggerFFT();
          // CRITICAL: Do NOT reset samplePop! Pascal keeps it at vSamples forever
          // This creates a SLIDING WINDOW: FFT recalculates every vRate (256) samples
          // NOT every vSamples (2048) samples
          // Resetting would create non-overlapping windows → unstable peak location
        }
      }
    }
  }

  /**
   * Update sample rate detection based on incoming data timing
   */
  private updateSampleRateDetection(): void {
    const now = Date.now();

    // Add timestamp to rolling buffer
    this.sampleTimestamps.push(now);

    // Keep only last 100 timestamps (sliding window)
    if (this.sampleTimestamps.length > 100) {
      this.sampleTimestamps.shift();
    }

    // Calculate rate if we have enough samples
    if (this.sampleTimestamps.length >= 10) {
      const timeDiff = now - this.sampleTimestamps[0];
      if (timeDiff > 0) {
        // Calculate samples per second
        this.detectedSampleRate = Math.round((this.sampleTimestamps.length * 1000) / timeDiff);

        // Adjust FFT rate if auto-detecting (rate = 0 in spec)
        if (this.displaySpec.rate === 0 && this.detectedSampleRate > 0) {
          // Set rate to achieve ~10 FFTs per second (good update rate)
          const targetFFTRate = 10; // Hz
          const optimalRate = Math.round(this.detectedSampleRate / targetFFTRate);

          // Clamp to reasonable range matching FFT size
          this.displaySpec.rate = Math.max(
            this.displaySpec.samples / 2,
            Math.min(this.displaySpec.samples * 4, optimalRate)
          );
        }
      }
    }

    this.lastSampleTime = now;
  }

  /**
   * Get the index of the last enabled channel
   */
  private getLastEnabledChannel(): number {
    for (let i = this.MAX_CHANNELS - 1; i >= 0; i--) {
      if ((this.channelMask & (1 << i)) !== 0) {
        return i;
      }
    }
    return 0; // Default to channel 0 if none enabled
  }

  /**
   * Rate cycle check - matches Pascal's RateCycle function
   * Increments rate counter and returns true when it reaches vRate
   * Resets to 0 after triggering
   *
   * Pascal implementation (lines 3071-3080):
   * function TDebugDisplayForm.RateCycle: boolean;
   * begin
   *   Inc(vRateCount);
   *   if vRateCount = vRate then
   *   begin
   *     vRateCount := 0;
   *     Result := True;
   *   end
   *   else Result := False;
   * end;
   */
  private rateCycle(): boolean {
    this.rateCounter++;
    if (this.rateCounter === this.displaySpec.rate) {
      this.rateCounter = 0;
      return true;
    }
    return false;
  }

  /**
   * Trigger FFT processing when enough samples are collected
   *
   * CRITICAL: This must match Pascal's synchronous blocking behavior (line 1674)
   * Pascal: if RateCycle then FFT_Draw;  // Blocks until draw completes
   */
  private triggerFFT(): void {
    this.logMessage(
      `triggerFFT called: windowCreated=${this.windowCreated}, debugWindow=${this.debugWindow !== null}, channels=${
        this.channels.length
      }`
    );

    // CRITICAL FIX (Bug #2): FFT calculations should work WITHOUT a window
    // This enables headless testing and prevents data loss if window creation fails
    // Only skip DRAWING if window doesn't exist, not the calculations

    // Process FFT calculations - Pascal: only if channels are configured (vIndex > 0)
    // Pascal: for j := vIndex - 1 downto 0 - if vIndex = 0, loop never executes
    if (this.channels.length > 0) {
      this.logMessage(`  -> Processing ${this.channels.length} channel FFTs`);
      this.processChannelFFTs();
    } else {
      this.logMessage('  -> No channels configured, skipping FFT (Pascal parity)');
      return; // Nothing to process or draw
    }

    // Update read pointer to match where we just processed
    this.sampleReadPtr = this.sampleWritePtr;
    this.logMessage(`  -> Updated readPtr to ${this.sampleReadPtr}`);

    // DRAWING is optional (only if window exists)
    if (!this.windowCreated || !this.debugWindow) {
      this.logMessage('  -> Skipping draw: window not available (headless mode)');
      return;
    }

    // Check drawing lock - skip draw if previous draw still in progress
    if (this.isDrawing) {
      this.logMessage('  -> Skipping draw: previous draw still in progress');
      return;
    }

    // Trigger display update (serialized through renderChain so a following SAVE can await it)
    this.logMessage('  -> Calling drawFFT()');
    void this.flushDraw();
  }

  /**
   * Perform the draw operation with lock protection
   * Ensures only one draw happens at a time, matching Pascal's synchronous behavior
   */
  /**
   * Serialize an FFT draw through renderChain so SAVE can await the in-flight/queued draw before
   * capturing. Call this instead of performDraw()/drawFFT() fire-and-forget.
   */
  private flushDraw(): Promise<void> {
    // Serialize through the inherited renderChain; the base SAVE awaits it via flushBeforeCapture().
    return this.scheduleRender(() => this.performDraw());
  }

  private async performDraw(): Promise<void> {
    // Set lock
    this.isDrawing = true;

    try {
      // Await the draw to completion (matches Pascal's synchronous FFT_Draw)
      await this.drawFFT();
    } finally {
      // Always release lock, even if draw fails
      this.isDrawing = false;
    }
  }

  /**
   * Process FFT for individual channels
   */
  private processChannelFFTs(): void {
    // Calculate starting position for FFT samples
    const startPtr = (this.sampleWritePtr - this.displaySpec.samples) & (this.BUFFER_SIZE - 1);

    // Clear previous channel results
    this.channelFFTResults = [];

    // Process each configured channel
    for (let i = 0; i < this.channels.length && i < this.MAX_CHANNELS; i++) {
      const channel = this.channels[i];

      // Check if this channel is enabled
      if ((this.channelMask & (1 << i)) === 0) {
        // Store empty result for disabled channel
        this.channelFFTResults.push({
          power: new Int32Array(this.displaySpec.samples / 2),
          angle: new Int32Array(this.displaySpec.samples / 2),
          magnitude: channel.magnitude
        });
        continue;
      }

      // Extract samples for this specific channel
      const samples = this.extractChannelSamples(startPtr, this.displaySpec.samples, i);

      // DIAGNOSTIC: Check extracted samples
      if (ENABLE_CONSOLE_LOG) {
        const first20 = Array.from(samples.slice(0, 20));
        console.log(`[FFT EXTRACT] Ch${i} first 20 samples: ${first20.join(', ')}`);
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        console.log(`[FFT EXTRACT] Ch${i} stats: min=${min}, max=${max}, mean=${mean.toFixed(2)}`);
      }

      // Perform FFT with channel's magnitude setting
      const result = this.fftProcessor.performFFT(samples, channel.magnitude);

      // DIAGNOSTIC: Check FFT output
      if (ENABLE_CONSOLE_LOG) {
        const first20Power = Array.from(result.power.slice(0, 20));
        console.log(`[FFT OUTPUT] Ch${i} first 20 power bins: ${first20Power.join(', ')}`);
        const maxPower = Math.max(...result.power);
        const maxBin = Array.from(result.power).indexOf(maxPower);
        console.log(`[FFT OUTPUT] Ch${i} max power=${maxPower} at bin=${maxBin}`);
        console.log(
          `[FFT OUTPUT] Total bins returned: ${result.power.length}, Expected: ${this.displaySpec.samples / 2}`
        );
      }

      // Store results for this channel
      this.channelFFTResults.push({
        power: result.power,
        angle: result.angle,
        magnitude: channel.magnitude
      });

      // Also store in combined arrays (last channel wins for now)
      this.fftPower = result.power;
      this.fftAngle = result.angle;
    }
  }

  /**
   * Extract samples for a specific channel
   */
  private extractChannelSamples(startPtr: number, length: number, channelIndex: number): Int32Array {
    const samples = new Int32Array(length);

    // Extract samples for just this channel
    for (let i = 0; i < length; i++) {
      const bufferPos = ((startPtr + i) & (this.BUFFER_SIZE - 1)) * this.MAX_CHANNELS + channelIndex;
      samples[i] = this.sampleBuffer[bufferPos];
    }

    return samples;
  }

  /**
   * Clear the circular buffer and reset pointers
   * Matches Pascal CLEAR command (lines 1642-1647):
   *   ClearBitmap;
   *   BitmapToCanvas(0);
   *   SamplePop := 0;
   *   vRateCount := vRate - 1;
   */
  private clearBuffer(): void {
    // Zero out the buffer
    this.sampleBuffer.fill(0);

    // Reset pointers
    this.sampleWritePtr = 0;
    this.sampleReadPtr = 0;
    this.samplePop = 0; // Pascal: SamplePop := 0
    this.currentChannel = 0;

    // Reset rate counter to vRate - 1 (Pascal: vRateCount := vRate - 1)
    this.rateCounter = this.displaySpec.rate - 1;

    // Reset timing data
    this.lastSampleTime = 0;
    this.sampleTimestamps = [];
    this.detectedSampleRate = 0;
    this.droppedSamples = 0;

    // Clear FFT results
    this.fftPower.fill(0);
    this.fftAngle.fill(0);
    this.channelFFTResults = [];

    this.logMessage('Sample buffer and timing data cleared');
  }

  /**
   * Set the channel enable mask
   *
   * @param mask Bitmask where bit N enables channel N (0xFF = all channels)
   */
  private setChannelMask(mask: number): void {
    this.channelMask = mask & 0xff; // Ensure only 8 bits
    this.logMessage(`Channel mask set to: 0x${this.channelMask.toString(16)}`);
  }

  /**
   * Get the number of enabled channels
   */
  private getEnabledChannelCount(): number {
    let count = 0;
    for (let i = 0; i < this.MAX_CHANNELS; i++) {
      if ((this.channelMask & (1 << i)) !== 0) {
        count++;
      }
    }
    return count;
  }

  /**
   * Parse FFT window configuration from debug command
   */
  public static createDisplaySpec(displayName: string, lineParts: string[]): FFTDisplaySpec {
    const unparsedCommand = lineParts.join(' ');

    // Initialize with defaults matching Pascal
    const spec: FFTDisplaySpec = {
      displayName: displayName,
      windowTitle: `${displayName} - FFT`,
      title: '',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false, // Default: use auto-placement
      // Pascal SetDefaults: vWidth := 256; vHeight := 256 (DebugDisplayUnit.pas:2884-2885) [9win §11]
      size: { width: 256, height: 256 },
      nbrSamples: 512, // Required by BaseDisplaySpec
      samples: 512, // fft_default from Pascal
      firstBin: 0,
      lastBin: 255, // Will be adjusted based on samples
      rate: 0, // 0 means use samples value
      dotSize: 0,
      lineSize: 3, // Default from Pascal
      textSize: 10,
      window: { background: 'black', grid: 'gray' },
      isPackedData: false,
      logScale: false,
      showLabels: true,
      spectrumColor: '#00FF00',
      windowWidth: 256, // overwritten from size at parse end (see below)
      windowHeight: 256,
      hideXY: false
    };

    // Parse configuration directives
    let isValid = true;
    for (let index = 2; index < lineParts.length; index++) {
      const element = lineParts[index].toUpperCase();

      // Handle SAMPLES first since FFT needs special parsing (first/last bins)
      if (element === 'SAMPLES') {
        // Pascal key_samples (DebugDisplayUnit.pas:1573-1582): if no number follows,
        // Continue (defaults stand). Otherwise FFTexp := Trunc(Log2(Within(val,4,FFTmax)));
        // vSamples := 1 shl FFTexp — clamp to [4,2048] then FLOOR to a power of two
        // (e.g. 768 -> 512). Spin2NumericParser resolves $hex/%bin/1_024 underscore
        // literals that raw Number() drops to NaN. [9win §11]
        const samplesValue =
          index < lineParts.length - 1 ? Spin2NumericParser.parseInteger(lineParts[index + 1], true) : null;
        if (samplesValue === null) {
          continue; // Pascal: if not NextNum then Continue
        }
        index++;
        spec.samples = DisplaySpecParser.floorPowerOfTwoWithin(samplesValue, 4, 2048); // [4,2048], floor not round
        spec.nbrSamples = spec.samples; // required by BaseDisplaySpec

        // Display bins default to the full half-spectrum, then optional first/last
        // CLAMP into range via KeyValWithin (Pascal CLAMPS, never rejects):
        //   FFTfirst := Within(val, 0, vSamples/2 - 2)
        //   FFTlast  := Within(val, FFTfirst+1, vSamples/2 - 1)  (only if first present)
        spec.firstBin = 0;
        spec.lastBin = spec.samples / 2 - 1;
        // Probe the optional first/last bins ONLY when the next element is numeric (Pascal reads
        // ele_num, not a directive keyword). Without this, `SAMPLES n RANGE …` fed the RANGE
        // directive token into clampInt→parseInteger, logging a spurious "Unknown numeric format
        // - value: RANGE" (same class as the SPECTRO DEPTH / 0.9.51 quote-comma fix). [9win §11]
        if (Spin2NumericParser.isNumeric(lineParts[index + 1])) {
          const first = DisplaySpecParser.clampInt(lineParts, index + 1, 0, spec.samples / 2 - 2, true);
          if (first !== null) {
            index++;
            spec.firstBin = first;
            if (Spin2NumericParser.isNumeric(lineParts[index + 1])) {
              const last = DisplaySpecParser.clampInt(lineParts, index + 1, spec.firstBin + 1, spec.samples / 2 - 1, true);
              if (last !== null) {
                index++;
                spec.lastBin = last;
              }
            }
          }
        }
        continue;
      }

      // Try to parse common keywords (TITLE, POS, SIZE, COLOR, etc.)
      // Skip SAMPLES since we handled it above
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, spec);
      if (parsed) {
        index = index + consumed - 1; // Adjust for loop increment
        continue;
      }

      // Parse other FFT-specific keywords
      switch (element) {
        case 'RATE': {
          // Pascal key_rate: KeyValWithin(vRate, 1, FFTmax) — CLAMP to [1,2048]. [9win §11]
          const rateValue = DisplaySpecParser.clampInt(lineParts, index + 1, 1, 2048, true);
          if (rateValue !== null) {
            spec.rate = rateValue;
            index++;
          }
          break;
        }

        // NOTE: there is intentionally NO bare DOT / LINE directive — Pascal FFT_Configure
        // (DebugDisplayUnit.pas:1567-1597) handles only key_dotsize / key_linesize. key_dot
        // and key_line are real keywords but belong to PLOT_Configure (:1965,:1980), not FFT.
        // A DOT/LINE token here is therefore not an FFT directive — it falls through to the
        // default (ignored), keeping the dotSize/lineSize defaults. [9win §11]

        // NOTE: there is intentionally NO RANGE directive — Pascal FFT_Configure has no
        // key_range. The first/last display bins are set by SAMPLES (n {first {last}}),
        // handled above, exactly as Pascal does (DebugDisplayUnit.pas:1573-1582). [9win §11]

        case 'DOTSIZE': {
          // Pascal key_dotsize: KeyValWithin(vDotSize, 0, 32) — CLAMP. [9win §11]
          const dotValue = DisplaySpecParser.clampInt(lineParts, index + 1, 0, 32, true);
          if (dotValue !== null) {
            spec.dotSize = dotValue;
            index++;
          }
          break;
        }

        case 'LINESIZE': {
          // Pascal key_linesize: KeyValWithin(vLineSize, -32, 32) — CLAMP, sign preserved
          // (negative = vertical-bar mode in FFT_Draw). [9win §11]
          const lineValue = DisplaySpecParser.clampInt(lineParts, index + 1, -32, 32, true);
          if (lineValue !== null) {
            spec.lineSize = lineValue;
            index++;
          }
          break;
        }

        case 'TEXTSIZE': {
          // Pascal key_textsize: KeyTextSize -> KeyValWithin(vTextSize, 6, 200) — CLAMP. [9win §11]
          const textValue = DisplaySpecParser.clampInt(lineParts, index + 1, 6, 200, true);
          if (textValue !== null) {
            spec.textSize = textValue;
            index++;
          }
          break;
        }

        case 'COLOR':
          // Parse COLOR directive: COLOR <background> {<grid-color>}
          const [colorParsed, colors, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, index);
          if (colorParsed) {
            spec.window.background = colors.background;
            if (colors.grid) {
              spec.window.grid = colors.grid;
            }
            index = index + consumed - 1; // Adjust for loop increment
          }
          // Invalid color specs are handled by DisplaySpecParser
          break;

        case 'LOGSCALE':
          spec.logScale = true;
          break;

        // NOTE: there is intentionally NO GRID directive — Pascal FFT_Configure has no
        // key_grid. The per-channel grid lines come from the channel-def `grid` field. [9win §11]

        case 'HIDEXY':
          spec.hideXY = true;
          spec.showLabels = false;
          break;

        // Check for packed data modes
        case 'LONGS_1BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_LONGS_1BIT;
          spec.packedWidth = ePackedDataWidth.PDW_LONGS;
          break;
        case 'LONGS_2BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_LONGS_2BIT;
          spec.packedWidth = ePackedDataWidth.PDW_LONGS;
          break;
        case 'LONGS_4BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_LONGS_4BIT;
          spec.packedWidth = ePackedDataWidth.PDW_LONGS;
          break;
        case 'LONGS_8BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_LONGS_8BIT;
          spec.packedWidth = ePackedDataWidth.PDW_LONGS;
          break;
        case 'LONGS_16BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_LONGS_16BIT;
          spec.packedWidth = ePackedDataWidth.PDW_LONGS;
          break;
        case 'WORDS_1BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_WORDS_1BIT;
          spec.packedWidth = ePackedDataWidth.PDW_WORDS;
          break;
        case 'WORDS_2BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_WORDS_2BIT;
          spec.packedWidth = ePackedDataWidth.PDW_WORDS;
          break;
        case 'WORDS_4BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_WORDS_4BIT;
          spec.packedWidth = ePackedDataWidth.PDW_WORDS;
          break;
        case 'WORDS_8BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_WORDS_8BIT;
          spec.packedWidth = ePackedDataWidth.PDW_WORDS;
          break;
        case 'BYTES_1BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_BYTES_1BIT;
          spec.packedWidth = ePackedDataWidth.PDW_BYTES;
          break;
        case 'BYTES_2BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_BYTES_2BIT;
          spec.packedWidth = ePackedDataWidth.PDW_BYTES;
          break;
        case 'BYTES_4BIT':
          spec.isPackedData = true;
          spec.packedMode = ePackedDataMode.PDM_BYTES_4BIT;
          spec.packedWidth = ePackedDataWidth.PDW_BYTES;
          break;

        case 'SIGNED':
          if (spec.isPackedData) {
            spec.packedSigned = true;
          }
          break;

        case 'ALT':
          if (spec.isPackedData) {
            spec.packedAlt = true;
          }
          break;

        default:
          // Unknown directive - silently ignore (matches Pascal behavior)
          break;
      }

      if (!isValid) break;
    }

    // If rate is 0 (default), set it to samples value as per Pascal
    if (spec.rate === 0) {
      spec.rate = spec.samples;
    }

    // Apply Pascal's default: if both dotSize and lineSize are 0, set dotSize to 1
    if (spec.dotSize === 0 && spec.lineSize === 0) {
      spec.dotSize = 1;
    }

    // Ensure nbrSamples matches samples (required by BaseDisplaySpec)
    spec.nbrSamples = spec.samples;

    // Copy size dimensions to window dimensions
    spec.windowWidth = spec.size.width;
    spec.windowHeight = spec.size.height;

    return spec;
  }

  /**
   * Parse FFT declaration (wrapper for createDisplaySpec to match window creation pattern)
   * Returns [isValid, spec] tuple matching other debug windows
   */
  public static parseFftDeclaration(lineParts: string[]): [boolean, FFTDisplaySpec] {
    // Extract display name from lineParts[1]
    if (lineParts.length < 2) {
      const emptySpec = {} as FFTDisplaySpec;
      return [false, emptySpec];
    }

    const displayName = lineParts[1];
    const spec = DebugFFTWindow.createDisplaySpec(displayName, lineParts);
    return [true, spec];
  }

  /**
   * Clear display and sample buffer (called by base class CLEAR command)
   */
  protected clearDisplayContent(): void {
    this.clearBuffer();
    // Also clear the canvas if window exists
    if (this.canvasRenderer && this.debugWindow) {
      const jsCode = `
        (function() {
          const canvas = document.getElementById('${this.canvasId}');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '${this.displaySpec.window.background}';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        })();
      `;
      this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
        this.logMessage(`Failed to clear canvas: ${error}`);
      });
    }
  }

  /**
   * Force display update (called by base class UPDATE command)
   */
  protected forceDisplayUpdate(): void {
    void this.flushDraw(); // serialized through renderChain so a following SAVE can await it
  }

  /**
   * Close the debug window
   */
  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() FFT`);
    // let our base class do the work
    this.debugWindow = null;
  }

  /**
   * Get the canvas ID for this window
   */
  protected getCanvasId(): string {
    return 'fft-canvas';
  }

  /**
   * Update FFT window content with new data (async implementation).
   *
   * IMPORTANT: do NOT override updateContent() here. The base updateContent() provides single-flight
   * per-window serialization (so a following message can't clobber an in-flight SAVE capture) plus the
   * not-ready message queue. A passthrough `updateContent → processMessageImmediate` silently bypassed
   * BOTH. The base funnels here via processMessageImmediate, so this is the correct extension point.
   * [save-clobber: override bypassed base serialization]
   */
  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // Handle async operations and await them
    await this.processMessageAsync(lineParts);
  }

  /**
   * Process FFT data and commands (async implementation)
   */
  private async processMessageAsync(lineParts: string[]): Promise<void> {
    const unparsedCommand = lineParts.join(' ');

    // Window name already stripped by mainWindow routing
    if (lineParts.length < 1) {
      this.logMessage(`No data to process in: ${unparsedCommand}`);
      return;
    }

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    // Note: lineParts already has display name stripped by router
    if (await this.handleCommonCommand(lineParts)) {
      // Base class handled the command, we're done
      return;
    }

    // FFT-specific data processing
    // Process all elements
    for (let i = 0; i < lineParts.length; i++) {
      const part = lineParts[i];

      // Check for channel configuration (starts with quoted string)
      if (part.startsWith("'") || part.startsWith('"')) {
        if (ENABLE_CONSOLE_LOG) console.log(`[FFT] Found quoted string at index ${i}: "${part}"`);

        // The slot this channel goes into. Pascal vIndex saturates at Channels(=8): a 9th+
        // definition overwrites the last slot rather than growing the set (:1630). The slot
        // index also selects this channel's DefaultScopeColors default. [9win §11]
        const slot = Math.min(this.channels.length, this.MAX_CHANNELS - 1);
        const parsed = this.parseChannelConfiguration(lineParts, i, slot);

        if (parsed) {
          const { channel, partsConsumed } = parsed;
          if (this.channels.length < this.MAX_CHANNELS) {
            this.channels.push(channel);
          } else {
            this.channels[this.MAX_CHANNELS - 1] = channel; // overwrite-in-place at the cap
          }

          // Enable this channel in the mask
          this.channelMask |= 1 << slot;

          this.logMessage(`Channel slot ${slot}: ${channel.label}`);

          // Advance past the parts this channel consumed (the for-loop adds the final +1).
          i += partsConsumed - 1;
        } else {
          if (ENABLE_CONSOLE_LOG) console.log(`[FFT] Channel config parsing FAILED for part at index ${i}`);
        }
        continue;
      }

      // Check for backtick-enclosed data
      if (part.startsWith('`')) {
        // Extract data value from backticks
        const dataMatch = part.match(/^`\(([^)]+)\)`?$/);
        if (dataMatch) {
          const dataExpr = dataMatch[1];

          // Parse the data value (could be numeric or expression)
          const value = this.parseDataValue(dataExpr);
          if (value !== null) {
            // NOW create the window with all channel specifications known
            if (!this.windowCreated) {
              try {
                this.initializeCanvas();
                this.createDebugWindow();
                this.windowCreated = true;
              } catch (error) {
                // Window creation failed (e.g., in test environment)
                // Log but continue processing - FFT calculations work without window
                if (ENABLE_CONSOLE_LOG) console.log(`[FFT] Window creation failed (headless mode):`, error);
                this.windowCreated = true; // Mark as attempted to avoid repeated failures
              }
            }

            // Add sample to buffer for current channel
            // This should work even if window creation failed
            this.addSample(value, this.currentChannel);

            // Advance to next enabled channel (round-robin)
            this.currentChannel = this.getNextEnabledChannel(this.currentChannel);
          }
        }
        continue;
      }

      // Handle packed data if processor is configured
      if (this.packedDataProcessor && this.displaySpec.packedMode !== undefined) {
        // Spin2 output uses '_' as digit separator (e.g. "1_000"); Number() returns NaN for those.
        const [isValidNumber, numValue] = this.isSpinNumber(part);
        if (isValidNumber) {
          // Create PackedDataMode structure for unpacking
          const mode: PackedDataMode = {
            mode: this.displaySpec.packedMode,
            bitsPerSample: this.getBitsPerSample(this.displaySpec.packedMode),
            valueSize: this.displaySpec.packedWidth!,
            isAlternate: this.displaySpec.packedAlt || false,
            isSigned: this.displaySpec.packedSigned || false
          };

          // Process packed data to extract individual samples
          const samples = PackedDataProcessor.unpackSamples(numValue, mode);

          // Add each unpacked sample to the buffer
          for (const sample of samples) {
            this.addSample(sample, this.currentChannel);
            this.currentChannel = this.getNextEnabledChannel(this.currentChannel);
          }
        }
      } else {
        // Spin2 output uses '_' as digit separator (e.g. "1_000"); Number() returns NaN for those.
        const [isValidNumber, numValue] = this.isSpinNumber(part);
        if (isValidNumber) {
          // CREATE WINDOW on first numeric data arrival (deferred creation pattern)
          if (!this.windowCreated) {
            try {
              this.initializeCanvas();
              this.createDebugWindow();
              this.windowCreated = true;
            } catch (error) {
              // Window creation failed (e.g., in test environment)
              // Log but continue processing - FFT calculations work without window
              if (ENABLE_CONSOLE_LOG) console.log(`[FFT] Window creation failed (headless mode):`, error);
              this.windowCreated = true; // Mark as attempted to avoid repeated failures
            }
          }

          // Add sample to buffer for current channel
          // This should work even if window creation failed
          this.addSample(numValue, this.currentChannel);

          // Advance to next enabled channel
          this.currentChannel = this.getNextEnabledChannel(this.currentChannel);
        }
      }
    }
  }

  /**
   * Get the next enabled channel index (for round-robin data feeding)
   */
  private getNextEnabledChannel(current: number): number {
    for (let i = 1; i <= this.MAX_CHANNELS; i++) {
      const next = (current + i) % this.MAX_CHANNELS;
      if ((this.channelMask & (1 << next)) !== 0) {
        return next;
      }
    }
    return 0; // Default to channel 0 if none enabled
  }

  /**
   * Parse a channel configuration from the command parts
   */
  // Pascal DefaultScopeColors (DebugDisplayUnit.pas:241): clLime, clRed, clCyan, clYellow,
  // clMagenta, clBlue, clOrange, clOlive — the clXxx default palette (NOT the RGBI8X directive
  // system). SetDefaults seeds vColor[i] from this; a channel keeps it unless its def supplies
  // an explicit color (KeyColor is optional). Pascal seeds all 8 slots eagerly at init; we apply
  // the slot default lazily at parse time, which is equivalent because channels are only queried
  // after parsing completes. [9win §11]
  private static readonly DEFAULT_SCOPE_COLORS = ['LIME', 'RED', 'CYAN', 'YELLOW', 'MAGENTA', 'BLUE', 'ORANGE', 'OLIVE'];

  private defaultChannelColor(channelIndex: number): string {
    return DebugColor.fromDefaultName(DebugFFTWindow.DEFAULT_SCOPE_COLORS[channelIndex % 8], 8).rgbString;
  }

  /**
   * Parse one channel definition `'label' mag high tall base grid {color}` matching Pascal
   * FFT_Update NextStr (DebugDisplayUnit.pas:1628-1637): 5 required numerics then an OPTIONAL
   * color. When the color is omitted the channel keeps its DefaultScopeColors slot color.
   * Returns the parsed channel plus how many parts it consumed (label + 5 + maybe color).
   */
  private parseChannelConfiguration(
    parts: string[],
    startIndex: number,
    channelIndex: number
  ): { channel: FFTChannelSpec; partsConsumed: number } | null {
    // Need the label + 5 numerics (mag, high, tall, base, grid). Color is optional.
    if (startIndex + 5 >= parts.length) {
      if (ENABLE_CONSOLE_LOG) console.log(`[FFT] FAILED: Incomplete channel configuration at index ${startIndex}`);
      this.logMessage(`Incomplete channel configuration at index ${startIndex}`);
      return null;
    }

    // Extract label (remove quotes)
    const labelPart = parts[startIndex];
    const label = labelPart.replace(/^['"]|['"]$/g, '');

    // Parse numeric parameters via Spin2NumericParser ($hex/%bin/1_024 underscore aware,
    // signed) — Pascal FFT_Update parses each with NextNum (DebugDisplayUnit.pas:1631-1636).
    const mag = Spin2NumericParser.parseInteger(parts[startIndex + 1], true);
    const high = Spin2NumericParser.parseInteger(parts[startIndex + 2], true);
    const tall = Spin2NumericParser.parseInteger(parts[startIndex + 3], true);
    const base = Spin2NumericParser.parseInteger(parts[startIndex + 4], true);
    const grid = Spin2NumericParser.parseInteger(parts[startIndex + 5], true);

    // Validate parameters (Pascal: a missing NextNum aborts the channel def via Continue)
    if (mag === null || high === null || tall === null || base === null || grid === null) {
      this.logMessage(`Invalid numeric parameters in channel configuration`);
      return null;
    }

    // Optional color via shared parseKeyColor (Pascal KeyColor, :1637): a directive NAME with
    // an OPTIONAL trailing brightness (e.g. `YELLOW 12` -> both consumed) or a numeric literal.
    // The token after `grid` is a color only when it exists and is not the next channel ('...')
    // or backtick data; otherwise the channel keeps its DefaultScopeColors slot color.
    let color = this.defaultChannelColor(channelIndex);
    let partsConsumed = 6; // label + 5 numerics
    const colorTok = parts[startIndex + 6];
    if (colorTok !== undefined && !colorTok.startsWith("'") && !colorTok.startsWith('"') && !colorTok.startsWith('`')) {
      const resolved = DisplaySpecParser.parseKeyColor(parts, startIndex + 6);
      if (resolved) {
        color = resolved.rgb;
        partsConsumed = resolved.nextIdx - startIndex; // 7 for NAME/numeric, 8 for NAME+brightness
      }
    }

    return {
      channel: {
        label,
        magnitude: DisplaySpecParser.clamp(mag, 0, 11), // Pascal KeyValWithin(vMag, 0, 11)
        high: DisplaySpecParser.clamp(high, 1, 0x7fffffff), // Pascal KeyValWithin(vHigh, 1, $7FFFFFFF)
        tall, // Pascal KeyVal (plain signed)
        base,
        grid,
        color
      },
      partsConsumed
    };
  }

  /**
   * Parse a data value from an expression
   */
  private parseDataValue(expr: string): number | null {
    try {
      // Spin2 output uses '_' as digit separator (e.g. "1_000") and accepts
      // '$', '%', '%%' base prefixes; Number() doesn't. Delegate to isSpinNumber.
      const [isValid, value] = this.isSpinNumber(expr);
      return isValid ? value : null;
    } catch (error) {
      this.logMessage(`Failed to parse data value: ${expr}`);
      return null;
    }
  }

  /**
   * Handle PC_KEY or PC_MOUSE input commands
   */
  private handleInputCommand(parts: string[]): void {
    // This will be implemented with InputForwarder integration
    // For now, just log
    this.logMessage(`Input command: ${parts.join(' ')}`);
  }

  /**
   * Get bits per sample for a packed data mode
   */
  private getBitsPerSample(mode: ePackedDataMode): number {
    switch (mode) {
      case ePackedDataMode.PDM_LONGS_1BIT:
      case ePackedDataMode.PDM_WORDS_1BIT:
      case ePackedDataMode.PDM_BYTES_1BIT:
        return 1;
      case ePackedDataMode.PDM_LONGS_2BIT:
      case ePackedDataMode.PDM_WORDS_2BIT:
      case ePackedDataMode.PDM_BYTES_2BIT:
        return 2;
      case ePackedDataMode.PDM_LONGS_4BIT:
      case ePackedDataMode.PDM_WORDS_4BIT:
      case ePackedDataMode.PDM_BYTES_4BIT:
        return 4;
      case ePackedDataMode.PDM_LONGS_8BIT:
      case ePackedDataMode.PDM_WORDS_8BIT:
        return 8;
      case ePackedDataMode.PDM_LONGS_16BIT:
        return 16;
      default:
        return 32;
    }
  }

  /**
   * Draw the FFT spectrum display
   */
  private async drawFFT(): Promise<void> {
    this.logMessage(
      `drawFFT called: canvasRenderer=${this.canvasRenderer !== undefined}, debugWindow=${this.debugWindow !== null}`
    );

    if (!this.canvasRenderer || !this.debugWindow) {
      this.logMessage('  -> Skipping: canvas or window not ready');
      return;
    }

    // Clear canvas with background color (wait for completion)
    // Pascal equivalent: ClearBitmap (line 1687)
    this.logMessage('  -> Clearing canvas');
    await this.clearCanvasAsync();

    // (No window-level frequency grid — Pascal FFT has no such toggle; per-channel grid
    //  lines come from each channel's `grid` field. The invented GRID directive was removed.) [9win §11]

    // Draw FFT spectrum - Pascal: for j := vIndex - 1 downto 0 (line 1688)
    // Pascal only draws if channels are configured (vIndex > 0)
    // If no channels configured, loop is empty and nothing is drawn
    // CRITICAL FIX: Must await async drawing operations to prevent race conditions
    if (this.channels.length > 0) {
      this.logMessage(`  -> Drawing ${this.channels.length} channel spectrums`);
      await this.drawChannelSpectrums();
    } else {
      this.logMessage('  -> No channels configured, nothing to draw (Pascal parity)');
    }

    // Copy offscreen to visible canvas FIRST (Pascal: BitmapToCanvas)
    await this.copyOffscreenToVisible();

    // Draw channel labels - AFTER copy so they appear on top (Pascal: lines 3358-3375)
    this.drawChannelLabels();

    // Draw labels if enabled - AFTER copy so they appear on top (synchronous like Pascal)
    if (this.displaySpec.showLabels) {
      this.logMessage('  -> Drawing labels');
      this.drawFrequencyLabels();
    }

    // Draw "logscale" indicator if log scale enabled - AFTER copy (Pascal: lines 3350-3356)
    if (this.displaySpec.logScale) {
      this.logMessage('  -> Drawing logscale indicator');
      this.drawLogScaleIndicator();
    }

    // Pascal equivalent: BitmapToCanvas(0) - all drawing complete (line 1711)
    this.logMessage('  -> drawFFT complete');
  }

  /**
   * Copy offscreen canvas to visible canvas
   */
  private async copyOffscreenToVisible(): Promise<void> {
    if (!this.debugWindow) return;

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (!canvas) return false;

        const offscreenKey = 'fftOffscreen_${this.canvasId}';
        const offscreen = window[offscreenKey];

        // Copy offscreen to visible if offscreen exists
        if (offscreen) {
          const displayCtx = canvas.getContext('2d');
          if (displayCtx) {
            // Disable image smoothing for pixel-perfect display
            displayCtx.imageSmoothingEnabled = false;
            displayCtx.webkitImageSmoothingEnabled = false;
            displayCtx.msImageSmoothingEnabled = false;
            displayCtx.drawImage(offscreen, 0, 0);
          }
        }

        return true;
      })();
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to copy offscreen to visible: ${error}`);
    }
  }

  /**
   * Clear the canvas with background color (async version)
   */
  private async clearCanvasAsync(): Promise<void> {
    if (!this.debugWindow) return;

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (!canvas) return false;

        const offscreenKey = 'fftOffscreen_${this.canvasId}';
        const offscreen = window[offscreenKey];

        // Clear offscreen canvas if it exists, otherwise clear visible canvas
        const targetCanvas = offscreen || canvas;
        const ctx = targetCanvas.getContext('2d');

        // Clear the entire canvas first
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

        // Fill with background color
        ctx.fillStyle = '${this.displaySpec.window.background}';
        ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

        // Redraw the border after clearing (Fix #3: Use asymmetric margins, Fix #6: save/restore)
        ctx.save();
        const gridColor = '${this.displaySpec.window.grid}';
        const bgColor = '${this.displaySpec.window.background}';
        ctx.strokeStyle = (gridColor !== bgColor) ? gridColor : '#808080';
        ctx.lineWidth = 1;
        ctx.strokeRect(${this.canvasMarginLeft}, ${this.canvasMarginTop},
                     ${this.displayWidth}, ${this.displayHeight});
        ctx.restore();

        return true;
      })();
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to clear canvas: ${error}`);
    }
  }

  /**
   * Clear the canvas with background color
   */
  private clearCanvas(): void {
    if (!this.debugWindow) return;

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');

          // Clear the entire canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Fill with background color
          ctx.fillStyle = '${this.displaySpec.window.background}';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Redraw the border after clearing (Fix #3: Use asymmetric margins, Fix #6: save/restore)
          ctx.save();
          const gridColor = '${this.displaySpec.window.grid}';
          const bgColor = '${this.displaySpec.window.background}';
          ctx.strokeStyle = (gridColor !== bgColor) ? gridColor : '#808080';
          ctx.lineWidth = 1;
          ctx.strokeRect(${this.canvasMarginLeft}, ${this.canvasMarginTop},
                       ${this.displayWidth}, ${this.displayHeight});
          ctx.restore();
        }
      })();
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to clear canvas: ${error}`);
    });
  }

  /**
   * Draw individual channel spectrums
   * Pascal: draws in reverse order (vIndex - 1 downto 0) so last channel is on top
   */
  private async drawChannelSpectrums(): Promise<void> {
    if (!this.debugWindow) return;

    // Draw in reverse order so last channel is on top (Pascal: line 1688)
    // CRITICAL FIX: Must await each drawSpectrum to ensure sequential drawing
    // and completion before copyOffscreenToVisible is called
    for (let i = this.channels.length - 1; i >= 0; i--) {
      if (i < this.channelFFTResults.length && this.channelFFTResults[i]) {
        const channel = this.channels[i];
        const { power } = this.channelFFTResults[i];

        await this.drawSpectrum(power, channel.color, channel.base, channel.high, channel.tall, channel.grid);
      }
    }
  }

  /**
   * Draw a single spectrum
   *
   * NOTE: Pascal uses 8-bit fixed-point precision (multiply by 256) for sub-pixel
   * smoothing in x,y coordinates (lines 1700-1701). HTML Canvas handles this differently
   * with native float coordinates and anti-aliasing, so we use float directly.
   *
   * Pascal fixed-point example:
   *   x := vMarginLeft shl 8 + Trunc((k - FFTfirst) / (FFTlast - FFTfirst) * (vWidth - 1) * $100);
   *   This is: (marginLeft * 256) + (binPosition * (width-1) * 256)
   *
   * @param power FFT power array
   * @param color Spectrum color
   * @param base Baseline offset (Pascal: vBase[j])
   * @param high Maximum expected magnitude (Pascal: vHigh[j]) - used for log scale
   * @param tall Display height in pixels (Pascal: vTall[j])
   * @param grid Grid positioning (Pascal: vGrid[j])
   */
  private async drawSpectrum(
    power: Int32Array,
    color: string,
    base: number,
    high: number,
    tall: number,
    grid: number
  ): Promise<void> {
    if (!this.debugWindow) return;

    const width = this.displaySpec.windowWidth;
    const height = this.displaySpec.windowHeight;
    const firstBin = this.displaySpec.firstBin;
    const lastBin = Math.min(this.displaySpec.lastBin, power.length - 1);
    const numBins = lastBin - firstBin + 1;

    // Fix #7: Guard against empty bin ranges
    if (numBins <= 0) {
      if (ENABLE_CONSOLE_LOG) {
        console.log(`[FFT DRAW] Invalid bin range: firstBin=${firstBin}, lastBin=${lastBin}, numBins=${numBins}`);
      }
      return; // Early exit
    }

    // Prepare power data with log scale if needed
    // Pascal formula (line 1699): v := Round(Log2(Int64(v) + 1) / Log2(Int64(vHigh[j]) + 1) * vHigh[j])
    // Pascal uses vHigh[j] (channel's configured high) for BOTH log scale AND normalization
    // Pascal defaults vHigh[i] := $7FFFFFFF (line 1610), but respects channel configuration
    const powerData: number[] = [];

    // DIAGNOSTIC: Check what bins we're extracting
    if (ENABLE_CONSOLE_LOG) {
      console.log(`[FFT DRAW] Extracting bins ${firstBin} to ${lastBin} from power array length ${power.length}`);
      console.log(`[FFT DRAW] Raw power array first 10: ${Array.from(power.slice(0, 10)).join(', ')}`);
      console.log(`[FFT DRAW] Using high=${high} (logScale=${this.displaySpec.logScale})`);
    }

    for (let i = firstBin; i <= lastBin; i++) {
      let value = power[i];

      // Apply Pascal's log scale formula if enabled
      // Pascal (line 1699): v := Round(Log2(Int64(v) + 1) / Log2(Int64(vHigh[j]) + 1) * vHigh[j])
      // Uses channel's 'high' value, NOT a hardcoded 0x7FFFFFFF
      if (this.displaySpec.logScale) {
        const oldValue = value;

        // Pascal-exact formula using channel's configured high value
        value = Math.round((Math.log2(value + 1) / Math.log2(high + 1)) * high);

        // DIAGNOSTIC: Show first few transformations
        if (ENABLE_CONSOLE_LOG && i < firstBin + 5) {
          console.log(`[FFT LOG SCALE] Bin ${i}: ${oldValue} -> ${value}`);
        }
      }

      powerData.push(value);
    }

    // Generate drawing commands based on display mode
    // Pascal scales using configured 'high' parameter, not actual data max
    // Pascal logic (line 1702): if vLineSize >= 0 then DrawLineDot else vertical bars
    let drawCommands = '';

    // DIAGNOSTIC: Log drawing parameters
    if (ENABLE_CONSOLE_LOG) {
      console.log(`[FFT DRAW] lineSize=${this.displaySpec.lineSize}, dotSize=${this.displaySpec.dotSize}`);
      console.log(`[FFT DRAW] Channel: high=${high}, tall=${tall}, base=${base}`);
      console.log(
        `[FFT DRAW] Power data: ${powerData.length} bins, firstBin=${this.displaySpec.firstBin}, lastBin=${this.displaySpec.lastBin}`
      );

      // Show power spectrum summary
      const maxPower = Math.max(...powerData);
      const maxBin = powerData.indexOf(maxPower);
      console.log(`[FFT DRAW] Max power=${maxPower.toFixed(0)} at bin ${maxBin}`);
      console.log(
        `[FFT DRAW] First 10 bins: ${powerData
          .slice(0, 10)
          .map((v) => v.toFixed(0))
          .join(', ')}`
      );
    }

    if (this.displaySpec.lineSize >= 0) {
      // Line/Dot mode (lineSize >= 0)
      // Pascal: DrawLineDot handles both line and dot based on sizes
      if (this.displaySpec.lineSize > 0) {
        // Line mode - use channel's high for normalization (Pascal parity)
        drawCommands = this.generateLineDrawCommands(
          powerData,
          high,
          width,
          height,
          base,
          tall,
          color,
          this.displaySpec.lineSize,
          this.displaySpec.dotSize
        );
      } else if (this.displaySpec.dotSize > 0) {
        // Dot only mode (lineSize = 0, dotSize > 0)
        drawCommands = this.generateDotDrawCommands(
          powerData,
          high,
          width,
          height,
          base,
          tall,
          color,
          this.displaySpec.dotSize
        );
      }
    } else {
      // Bar mode (lineSize < 0) - Pascal: SmoothLine for vertical bars
      // Width of bar = abs(lineSize), plus optional dot on top
      drawCommands = this.generateBarDrawCommands(
        powerData,
        high,
        width,
        height,
        base,
        tall,
        color,
        Math.abs(this.displaySpec.lineSize), // Use abs(lineSize) for bar width
        this.displaySpec.dotSize // Optional dot on top of bars
      );
    }

    // Draw per-channel grid lines and labels (Pascal: lines 3283-3327)
    // grid is a bitmask: bit 1 = baseline, bit 2 = top, bit 4 = baseline label, bit 8 = top label
    let gridCommands = '';
    if (grid !== 0) {
      const displayLeft = this.canvasMarginLeft;
      const displayTop = this.canvasMarginTop;
      const displayWidth = this.displayWidth;
      const displayHeight = this.displayHeight;
      const scaledHeight = tall > 0 ? tall - 1 : 0;
      const baseY = displayTop + displayHeight - 1 - base; // Fix: -1 to match spectrum baseline

      // Use semi-transparent channel color for grid lines (Pascal: AlphaBlend with $40 = 25% opacity)
      // Convert color to rgba with 0.25 alpha
      const gridColor = this.colorToRgba(color, 0.25);

      gridCommands = `
        ctx.strokeStyle = '${gridColor}';
        ctx.fillStyle = '${gridColor}';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); // Dotted line (Pascal: psDot)
      `;

      // Bit 1: Horizontal line at baseline
      if ((grid & 1) !== 0) {
        gridCommands += `
          ctx.beginPath();
          ctx.moveTo(${displayLeft}, ${baseY});
          ctx.lineTo(${displayLeft + displayWidth}, ${baseY});
          ctx.stroke();
        `;
      }

      // Bit 2: Horizontal line at top
      if ((grid & 2) !== 0) {
        const topY = baseY - scaledHeight;
        gridCommands += `
          ctx.beginPath();
          ctx.moveTo(${displayLeft}, ${topY});
          ctx.lineTo(${displayLeft + displayWidth}, ${topY});
          ctx.stroke();
        `;
      }

      // Bit 4: Power label at baseline (shows 0, the minimum)
      if ((grid & 4) !== 0) {
        const labelText = '+0';
        gridCommands += `
          ctx.fillStyle = '${gridColor}';
          ctx.font = '${this.displaySpec.textSize}px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('${labelText}', ${displayLeft + 5}, ${baseY});
        `;
      }

      // Bit 8: Power label at top (shows high, the maximum)
      if ((grid & 8) !== 0) {
        const topY = baseY - scaledHeight;
        const labelText = high >= 0 ? `+${high}` : `${high}`;
        gridCommands += `
          ctx.fillStyle = '${gridColor}';
          ctx.font = '${this.displaySpec.textSize}px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('${labelText}', ${displayLeft + 5}, ${topY});
        `;
      }

      gridCommands += `ctx.setLineDash([]); // Reset to solid line`;
    }

    // Execute drawing commands (Fix #10: Use offscreen canvas for double buffering with fallback)
    // NOTE: clearAndCopy parameter controls whether to clear/copy or just accumulate drawing
    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (!canvas) return false;

        const offscreenKey = 'fftOffscreen_${this.canvasId}';
        const offscreen = window[offscreenKey];

        // Draw to offscreen if available, otherwise draw directly to visible canvas
        const targetCanvas = offscreen || canvas;
        const ctx = targetCanvas.getContext('2d');

        // Ensure anti-aliasing is enabled for smooth line rendering
        if (ctx.imageSmoothingEnabled !== undefined) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }

        // Draw spectrum (background/border already cleared in clearOffscreenCanvas)
        ${drawCommands}
        ${gridCommands}

        return true;
      })();
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode); // Fix #9: Await completion
    } catch (error) {
      this.logMessage(`Failed to draw spectrum: ${error}`);
    }
  }

  /**
   * Generate line drawing commands
   *
   * Pascal scaling: fScale := (vTall[j] - 1) / vHigh[j] * $100; then y := ... - Round(v * fScale)
   * Equivalent to: normalizedPower = v / high; then y = baseline - normalizedPower * tall
   */
  private generateLineDrawCommands(
    powerData: number[],
    high: number,
    width: number,
    height: number,
    base: number,
    tall: number,
    color: string,
    lineWidth: number,
    dotSize: number = 0
  ): string {
    const numBins = powerData.length;

    // Account for margins - draw within the display area (Fix #3: Use asymmetric margins)
    const displayLeft = this.canvasMarginLeft;
    const displayTop = this.canvasMarginTop;
    const displayWidth = this.displayWidth;
    const displayHeight = this.displayHeight;

    // tall and base are already in PIXELS from Pascal channel config, not percentages
    const scaledHeight = tall > 0 ? tall - 1 : 0; // Pascal: fScale uses (vTall[j] - 1)
    const baseY = displayTop + displayHeight - 1 - base; // Top-down coordinates (Fix #4: -1 for 0-indexed)

    let commands = `
      ctx.save();
      ctx.strokeStyle = '${color}';
      ctx.lineWidth = ${lineWidth / 2};  // Fix: Pascal uses radius, Canvas uses diameter
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
    `;

    // DIAGNOSTIC: Log first few points
    if (ENABLE_CONSOLE_LOG && numBins > 0) {
      console.log(`[FFT DRAW COORDS] baseY=${baseY}, scaledHeight=${scaledHeight}`);
      console.log(`[FFT DRAW COORDS] displayLeft=${displayLeft}, displayWidth=${displayWidth}`);
    }

    // Store coordinates for later dot drawing (Fix #2: prevents path-breaking bug)
    const coordinates: Array<{ x: number; y: number }> = [];

    // Build line path WITHOUT interruption
    for (let i = 0; i < numBins; i++) {
      // FIX: Remove centering offset - Pascal linearly maps bins to x-coordinates
      // Pascal: x := vMarginLeft shl 8 + Trunc((k - FFTfirst) / (FFTlast - FFTfirst) * (vWidth - 1) * $100);
      // This linearly interpolates from left margin to right edge of display area
      // Guard against division by zero when displaying single bin (numBins === 1)
      const xScale = numBins > 1 ? i / (numBins - 1) : 0.5; // Center single bin
      const x = displayLeft + xScale * (displayWidth - 1) + 0.5; // Fix: +0.5 for optimal anti-aliasing (matches Pascal +$80)
      // Pascal: normalizes to configured 'high' parameter, not actual data max
      const normalizedPower = Math.min(1, powerData[i] / high);
      const y = baseY - normalizedPower * scaledHeight + 0.5; // Fix: +0.5 for optimal anti-aliasing

      // DIAGNOSTIC: Log first few coordinate calculations
      if (ENABLE_CONSOLE_LOG && i < 5) {
        console.log(
          `[FFT DRAW COORDS] Point ${i}: powerData[${i}]=${powerData[i]}, normalized=${normalizedPower.toFixed(
            4
          )}, x=${x.toFixed(1)}, y=${y.toFixed(1)}`
        );
      }

      if (i === 0) {
        commands += `ctx.moveTo(${x}, ${y});\n`;
      } else {
        commands += `ctx.lineTo(${x}, ${y});\n`;
      }

      // Store coordinates for dot drawing
      coordinates.push({ x, y });
    }

    // Stroke the complete line FIRST
    commands += `ctx.stroke();\n`;

    // NOW draw dots on top (if enabled) - Fix #2: Draw AFTER line is complete
    if (dotSize > 0) {
      commands += `ctx.fillStyle = '${color}';\n`;
      for (const { x, y } of coordinates) {
        commands += `
          ctx.beginPath();
          ctx.arc(${x}, ${y}, ${dotSize}, 0, Math.PI * 2);
          ctx.fill();
        `;
      }
    }

    commands += `ctx.restore();`;
    return commands;
  }

  /**
   * Generate bar drawing commands
   * Pascal: SmoothLine(x, baseline, x, y, -vLineSize shl 6, color, $FF)
   * Draws vertical bars from baseline to value, with optional dot on top
   *
   * Pascal scaling: fScale := (vTall[j] - 1) / vHigh[j] * $100; then y := ... - Round(v * fScale)
   * Equivalent to: normalizedPower = v / high; then y = baseline - normalizedPower * tall
   *
   * @param barWidth Width of vertical bars (from abs(lineSize))
   * @param dotSize Optional dot size to draw on top of bars (Pascal: vDotSize)
   */
  private generateBarDrawCommands(
    powerData: number[],
    high: number,
    width: number,
    height: number,
    base: number,
    tall: number,
    color: string,
    barWidth: number = 3,
    dotSize: number = 0
  ): string {
    const numBins = powerData.length;

    // Account for margins - draw within the display area (Fix #3: Use asymmetric margins)
    const displayLeft = this.canvasMarginLeft;
    const displayTop = this.canvasMarginTop;
    const displayWidth = this.displayWidth;
    const displayHeight = this.displayHeight;

    // tall and base are already in PIXELS from Pascal channel config, not percentages
    const scaledHeight = tall > 0 ? tall - 1 : 0; // Pascal: fScale uses (vTall[j] - 1)
    const baseY = displayTop + displayHeight - 1 - base; // Top-down coordinates (Fix #4: -1 for 0-indexed)

    let commands = '';

    // Draw vertical bars
    commands += `
      ctx.save();
      ctx.strokeStyle = '${color}';
      ctx.lineWidth = ${barWidth / 2};  // Fix: Pascal uses radius, Canvas uses diameter
      ctx.lineCap = 'butt';
    `;

    for (let i = 0; i < numBins; i++) {
      // FIX: Remove centering offset - Pascal linearly maps bins to x-coordinates
      // Guard against division by zero when displaying single bin (numBins === 1)
      const xScale = numBins > 1 ? i / (numBins - 1) : 0.5; // Center single bin
      const x = displayLeft + xScale * (displayWidth - 1) + 0.5; // Fix: +0.5 for optimal anti-aliasing (matches Pascal +$80)
      // Pascal: normalizes to configured 'high' parameter, not actual data max
      const normalizedPower = Math.min(1, powerData[i] / high);
      const y = baseY - normalizedPower * scaledHeight + 0.5; // Fix: +0.5 for optimal anti-aliasing

      // Draw vertical line from baseline to value
      commands += `
        ctx.beginPath();
        ctx.moveTo(${x}, ${baseY});
        ctx.lineTo(${x}, ${y});
        ctx.stroke();
      `;

      // Optional dot on top (Pascal: if vDotSize > 0)
      if (dotSize > 0) {
        commands += `
          ctx.fillStyle = '${color}';
          ctx.beginPath();
          ctx.arc(${x}, ${y}, ${dotSize}, 0, Math.PI * 2);
          ctx.fill();
        `;
      }
    }

    commands += `ctx.restore();`;
    return commands;
  }

  /**
   * Generate dot drawing commands
   *
   * Pascal scaling: fScale := (vTall[j] - 1) / vHigh[j] * $100; then y := ... - Round(v * fScale)
   * Equivalent to: normalizedPower = v / high; then y = baseline - normalizedPower * tall
   */
  private generateDotDrawCommands(
    powerData: number[],
    high: number,
    width: number,
    height: number,
    base: number,
    tall: number,
    color: string,
    dotSize: number
  ): string {
    const numBins = powerData.length;

    // Account for margins - draw within the display area (Fix #3: Use asymmetric margins)
    const displayLeft = this.canvasMarginLeft;
    const displayTop = this.canvasMarginTop;
    const displayWidth = this.displayWidth;
    const displayHeight = this.displayHeight;

    // tall and base are already in PIXELS from Pascal channel config, not percentages
    const scaledHeight = tall > 0 ? tall - 1 : 0; // Pascal: fScale uses (vTall[j] - 1)
    const baseY = displayTop + displayHeight - 1 - base; // Top-down coordinates (Fix #4: -1 for 0-indexed)

    let commands = `
      ctx.save();
      ctx.fillStyle = '${color}';
    `;

    for (let i = 0; i < numBins; i++) {
      // FIX: Remove centering offset - Pascal linearly maps bins to x-coordinates
      // Guard against division by zero when displaying single bin (numBins === 1)
      const xScale = numBins > 1 ? i / (numBins - 1) : 0.5; // Center single bin
      const x = displayLeft + xScale * (displayWidth - 1) + 0.5; // Fix: +0.5 for optimal anti-aliasing (matches Pascal +$80)
      // Pascal: normalizes to configured 'high' parameter, not actual data max
      const normalizedPower = Math.min(1, powerData[i] / high);
      const y = baseY - normalizedPower * scaledHeight + 0.5; // Fix: +0.5 for optimal anti-aliasing

      // Draw dot as small circle
      commands += `
        ctx.beginPath();
        ctx.arc(${x}, ${y}, ${dotSize}, 0, Math.PI * 2);
        ctx.fill();
      `;
    }

    commands += `ctx.restore();`;
    return commands;
  }

  /**
   * Handle mouse move events for coordinate display
   */
  protected handleMouseMove(event: MouseEvent): void {
    if (!this.debugWindow || this.displaySpec.hideXY) return;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Update coordinate display (Pascal renders raw plot-area pixel offset, Y inverted)
    this.updateCoordinateDisplay(mouseX, mouseY);

    // Draw crosshair if enabled
    if (!this.displaySpec.hideXY) {
      this.drawCrosshair(mouseX, mouseY);
    }
  }

  /**
   * Update coordinate display with current mouse position.
   * Pascal FormMouseMove dis_fft (DebugDisplayUnit.pas:668-674): inside the plot area the
   * readout is `(X - vMarginLeft),(vMarginTop + vHeight - 1 - Y)` — the raw pixel offset within
   * the plot, with Y inverted (origin bottom-left). Outside the plot it is blank. [9win §11]
   */
  private updateCoordinateDisplay(mouseX: number, mouseY: number): void {
    if (!this.debugWindow) return;

    const ml = this.canvasMarginLeft;
    const mt = this.canvasMarginTop;
    const w = this.displayWidth;
    const h = this.displayHeight;
    const inside = mouseX >= ml && mouseX < ml + w && mouseY >= mt && mouseY < mt + h;
    const text = inside ? `${mouseX - ml},${mt + h - 1 - mouseY}` : '';

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');

          // Save current state
          ctx.save();

          // Clear previous coordinate display area
          ctx.fillStyle = '${this.displaySpec.window.background}';
          ctx.fillRect(0, 0, 200, 20);

          // Draw coordinate text
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = '12px monospace';
          ctx.textAlign = 'left';

          const text = ${JSON.stringify(text)};
          if (text) ctx.fillText(text, 5, 15);

          // Restore state
          ctx.restore();
        }
      })();
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to update coordinates: ${error}`);
    });
  }

  /**
   * Draw crosshair at mouse position
   */
  private drawCrosshair(mouseX: number, mouseY: number): void {
    if (!this.debugWindow) return;

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');

          // Save current canvas content
          ctx.save();

          // Set crosshair style
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);

          // Draw vertical line
          ctx.beginPath();
          ctx.moveTo(${mouseX}, 0);
          ctx.lineTo(${mouseX}, canvas.height);
          ctx.stroke();

          // Draw horizontal line
          ctx.beginPath();
          ctx.moveTo(0, ${mouseY});
          ctx.lineTo(canvas.width, ${mouseY});
          ctx.stroke();

          // Restore state
          ctx.setLineDash([]);
          ctx.restore();
        }
      })();
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to draw crosshair: ${error}`);
    });
  }

  /**
   * Draw "logscale" text indicator in top-right
   * Pascal: lines 3350-3356
   */
  private drawLogScaleIndicator(): void {
    if (!this.debugWindow) return;

    const displayWidth = this.displayWidth;
    // Position at right edge, centered vertically in the area ABOVE the rectangle
    const x = this.canvasMarginLeft + displayWidth;
    const y = this.canvasMarginTop / 2; // Center vertically in top margin area

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '${this.displaySpec.window.grid}';
          ctx.font = '${this.displaySpec.textSize}px monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText('logscale', ${x}, ${y});
        }
        return true;
      })();
    `;

    try {
      this.debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw logscale indicator: ${error}`);
    }
  }

  /**
   * Draw channel labels at top of window
   * Pascal: lines 3358-3375 - draws channel names with bold+italic font
   */
  private drawChannelLabels(): void {
    if (!this.debugWindow || this.channels.length === 0) return;

    const chrHeight = this.displaySpec.textSize;
    const chrWidth = chrHeight * 0.6;
    let x = this.canvasMarginLeft;
    const y = chrHeight / 2; // Vertically centered on first character height

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (!canvas) return false;

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.font = 'bold italic ${this.displaySpec.textSize}px monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        ${this.channels
          .map((channel, i) => {
            if (!channel.label) return '';
            const labelWidth = channel.label.length * chrWidth;
            const code = `
          ctx.fillStyle = '${channel.color}';
          ctx.fillText('${channel.label}', ${x}, ${y});
        `;
            x += labelWidth + chrWidth * 2; // Space between labels
            return code;
          })
          .join('')}

        ctx.restore();
        return true;
      })();
    `;

    try {
      this.debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw channel labels: ${error}`);
    }
  }

  /**
   * Save FFT display to file
   */
  private saveFFTDisplay(filename: string): void {
    if (!this.debugWindow) {
      this.logMessage('ERROR: Cannot save FFT display - window not created');
      return;
    }

    // Ensure filename has proper extension
    if (!filename.endsWith('.png') && !filename.endsWith('.bmp')) {
      filename += '.png';
    }

    // Use base class method to save window
    if (filename.endsWith('.bmp')) {
      this.saveWindowToBMPFilename(filename);
    } else {
      // For PNG, we need to convert - use BMP for now
      const bmpFilename = filename.replace('.png', '.bmp');
      this.saveWindowToBMPFilename(bmpFilename);
      this.logMessage(`Note: Saved as BMP format to ${bmpFilename}`);
      return;
    }
    this.logMessage(`FFT display saved to ${filename}`);
  }

  /**
   * Draw frequency labels
   */
  private drawFrequencyLabels(): void {
    if (!this.debugWindow) return;

    const width = this.displaySpec.windowWidth;
    const height = this.displaySpec.windowHeight;
    const firstBin = this.displaySpec.firstBin;
    const lastBin = this.displaySpec.lastBin;

    // Calculate frequency range based on sample rate
    const sampleRate = this.detectedSampleRate || 1000; // Default to 1kHz
    const nyquist = sampleRate / 2;
    const binFrequency = nyquist / (this.fftExp > 0 ? Math.pow(2, this.fftExp - 1) : 1);

    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';

          // Draw frequency labels at bottom
          const startFreq = ${firstBin * binFrequency};
          const endFreq = ${lastBin * binFrequency};

          // Label at start
          ctx.fillText('${(firstBin * binFrequency).toFixed(0)}Hz', 20, canvas.height - 5);

          // Label at end
          ctx.fillText('${(lastBin * binFrequency).toFixed(0)}Hz', canvas.width - 20, canvas.height - 5);

          // Label at center
          const centerFreq = (${firstBin * binFrequency} + ${lastBin * binFrequency}) / 2;
          ctx.fillText(centerFreq.toFixed(0) + 'Hz', canvas.width / 2, canvas.height - 5);
        }
        return true;
      })();
    `;

    try {
      this.debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw labels: ${error}`);
    }
  }

  /**
   * Get the display specification for this window
   */
  getDisplaySpec(): FFTDisplaySpec {
    return this.displaySpec;
  }

  /**
   * Initialize the canvas and renderer
   */
  protected initializeCanvas(): void {
    if (!this.canvasRenderer) {
      this.canvasRenderer = new CanvasRenderer();
    }

    // Calculate margins based on font metrics (Pascal SetSize pattern)
    // Pascal FFT_Configure calls: SetSize(ChrWidth, ChrHeight * 2, ChrWidth, ChrWidth)
    // This means: MarginLeft=ChrWidth, MarginTop=ChrHeight*2, MarginRight=ChrWidth, MarginBottom=ChrWidth
    const charHeight = Math.round(this.displaySpec.textSize * 1.333);
    const charWidth = Math.round(charHeight * 0.6);

    // Pascal FFT uses non-uniform margins: ChrWidth on sides, ChrHeight*2 on top
    // Bottom margin increased to charHeight to accommodate frequency labels (3 labels at bottom)
    const marginLeft = charWidth;
    const marginTop = charHeight * 2;
    const marginRight = charWidth;
    const marginBottom = charHeight; // Increased from charWidth for frequency labels

    // Display area is what was specified in SIZE
    this.displayWidth = this.displaySpec.size.width;
    this.displayHeight = this.displaySpec.size.height;

    // Store asymmetric margins separately (Fix #3)
    this.canvasMarginLeft = marginLeft; // charWidth
    this.canvasMarginTop = marginTop; // charHeight * 2

    // Canvas size includes asymmetric margins
    this.canvasWidth = marginLeft + this.displayWidth + marginRight;
    this.canvasHeight = marginTop + this.displayHeight + marginBottom;

    // Window creation deferred - will be called when first data arrives
  }

  /**
   * Create the debug window with canvas
   */
  private createDebugWindow(): void {
    this.logMessage(`Creating FFT debug window: ${this.displaySpec.windowTitle}`);

    let x = this.displaySpec.position.x;
    let y = this.displaySpec.position.y;

    // If no POS clause was present, use WindowPlacer for intelligent positioning
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: this.canvasWidth, height: this.canvasHeight },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`fft-${this.displaySpec.displayName}`, placementConfig);
      x = position.x;
      y = position.y;

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${x},${y} ${this.canvasWidth}x${this.canvasHeight} Mon:${monitorId}) FFT '${this.displaySpec.displayName}' POS ${x} ${y} SIZE ${this.canvasWidth} ${this.canvasHeight}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }

    // Create browser window with content size (not total window size)
    // useContentSize: true makes width/height refer to the client area,
    // and Electron adds the correct OS chrome automatically
    this.debugWindow = new BrowserWindow({
      width: this.canvasWidth,
      height: this.canvasHeight,
      x,
      y,
      useContentSize: true, // CRITICAL: Makes width/height refer to client area, not total window
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        // Keep the renderer painting + rAF firing while this window is occluded/unfocused so a
        // scripted multi-window SAVE captures a fresh frame and the capture flush never stalls.
        backgroundThrottling: false
      }
    });

    // Register window with WindowPlacer for position tracking (only if using auto-placement)
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`fft-${this.displaySpec.displayName}`, this.debugWindow);
    }

    // Set up window event handlers
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('FFT window ready to show');
      this.debugWindow?.show();
    });

    this.debugWindow.on('closed', () => {
      this.logMessage('FFT window closed');
      this.close();
    });

    // Remove menu on Linux/Windows
    this.debugWindow.once('ready-to-show', () => {
      // Register with WindowRouter when window is ready
      this.registerWithRouter();
      if (this.debugWindow && process.platform !== 'darwin') {
        try {
          this.debugWindow.removeMenu();
        } catch (error) {
          this.logMessage(`Failed to remove menu: ${error}`);
        }
      }
    });

    // Generate HTML content with canvas
    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${this.displaySpec.windowTitle}</title>
          <style>
            @font-face {
              font-family: 'Parallax';
              src: url('${this.getParallaxFontUrl()}') format('truetype');
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Parallax', monospace;
              font-size: ${this.displaySpec.textSize}px;
              background-color: ${this.displaySpec.window.background};
              color: ${this.displaySpec.window.grid};
              overflow: hidden;
            }
            #fft-canvas {
              position: absolute;
              top: 0;
              left: 0;
              /* Nearest-neighbor on the Retina (DPR>1) upscale — avoids bilinear blur of the
                 logical-res canvas. Matches BITMAP/SPECTRO; Chromium resolves to crisp-edges. */
              image-rendering: pixelated;
              image-rendering: -moz-crisp-edges;
              image-rendering: crisp-edges;
            }
            #coordinate-display {
              position: absolute;
              top: 5px;
              right: 5px;
              padding: 2px 5px;
              background: rgba(0, 0, 0, 0.7);
              color: ${this.displaySpec.window.grid};
              font-size: ${Math.max(10, this.displaySpec.textSize - 2)}px;
              display: ${this.displaySpec.hideXY ? 'none' : 'block'};
            }
          </style>
        </head>
        <body>
          <canvas id="fft-canvas" width="${this.canvasWidth}" height="${this.canvasHeight}"></canvas>
          <div id="coordinate-display"></div>
          <script>
            // Canvas setup - using normal top-down coordinates
            const canvas = document.getElementById('fft-canvas');
            const ctx = canvas.getContext('2d');

            // Clear with background color
            ctx.fillStyle = '${this.displaySpec.window.background}';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // ALWAYS draw graticule border frame (Pascal always draws this)
            // Use grid color if different from background, otherwise use a visible contrast color
            const gridColor = '${this.displaySpec.window.grid}';
            const bgColor = '${this.displaySpec.window.background}';
            ctx.strokeStyle = (gridColor !== bgColor) ? gridColor : '#808080';  // Use gray if grid==background
            ctx.lineWidth = 1;

            // Draw border - this creates the graticule frame (Fix #3: Use asymmetric margins)
            ctx.strokeRect(${this.canvasMarginLeft}, ${this.canvasMarginTop},
                         ${this.displayWidth}, ${this.displayHeight});

            // Create offscreen canvas immediately for double buffering (Fix #10)
            const offscreenKey = 'fftOffscreen_${this.canvasId}';
            window[offscreenKey] = document.createElement('canvas');
            window[offscreenKey].width = ${this.canvasWidth};
            window[offscreenKey].height = ${this.canvasHeight};
          </script>
        </body>
      </html>
    `;

    // Write HTML to temp file to allow file:// font URLs to work (like TERM window does)
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pnut-fft-${this.windowId}-${Date.now()}.html`);

    fs.writeFileSync(tempFile, htmlContent);
    this.logMessage(`Wrote FFT HTML to temp file: ${tempFile}`);

    // Load the temp file instead of using data URL
    this.debugWindow.loadFile(tempFile);

    // CRITICAL: Wait for HTML to finish loading before processing queued messages
    // This matches SCOPE pattern - ensures canvas exists before drawing
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logMessage('FFT window HTML loaded - canvas ready');

      // Mark window as ready to process queued messages
      // This is the SECOND call to onWindowReady() (first was in constructor)
      // Matches SCOPE pattern: ready for channel configs in constructor,
      // ready for drawing after HTML loads
      this.onWindowReady();
    });

    // Clean up temp file after a delay
    setTimeout(() => {
      try {
        fs.unlinkSync(tempFile);
        this.logMessage(`Cleaned up FFT temp file: ${tempFile}`);
      } catch (err) {
        // File might already be gone, that's ok
      }
    }, 5000);

    // Store canvas ID for later use
    this.canvasId = 'fft-canvas';
  }

  /**
   * Convert a hex color to rgba with specified alpha
   * Helper for AlphaBlend (Pascal: line 3285)
   */
  private colorToRgba(hexColor: string, alpha: number): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Add private properties for canvas management
  private canvasId: string = '';
  private canvasMarginLeft: number = 10;
  private canvasMarginTop: number = 20;
  private canvasWidth: number = 400;
  private canvasHeight: number = 300;
  private displayWidth: number = 380;
  private displayHeight: number = 280;
  private windowCreated: boolean = false; // Track if window has been created yet

  /**
   * Initialize input forwarding for mouse and keyboard
   */
  private initializeInputForwarding(): void {
    // Base class handles the InputForwarder setup
    // FFT window uses standard coordinate transformation
    // with bottom-up Y-axis handled in handleMouseMove
    this.logMessage('Input forwarding initialized for FFT window');
  }

  /**
   * Get maximum magnitude for the current configuration
   */
  private getMaxMagnitude(): number {
    // This will be properly calculated based on channel configurations in Phase 3
    // For now, return a default value
    return 1000;
  }

  /**
   * Enable keyboard input forwarding
   */
  protected enableKeyboardInput(): void {
    this.logMessage('Keyboard input forwarding enabled');
  }

  /**
   * Enable mouse input forwarding
   */
  protected enableMouseInput(): void {
    // FFT is dis_fft → raw client pixels (no transform), so the shared base path
    // is correct as-is. The previous body was a no-op stub that attached no
    // handlers, so PC_MOUSE never captured anything for FFT. [9win LD-3]
    super.enableMouseInput();
  }

  /**
   * Handle window close event
   */
  close(): void {
    this.closeDebugWindow();
    // Clean up any other FFT-specific resources
  }
}
