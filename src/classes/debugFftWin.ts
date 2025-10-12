/** @format */

'use strict';

import { BrowserWindow } from 'electron';

// src/classes/debugFftWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { DisplaySpecParser } from './shared/displaySpecParser';
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
  nbrSamples: number;   // Required by BaseDisplaySpec
  samples: number;      // FFT size (4-2048, power of 2)
  firstBin: number;     // First frequency bin to display
  lastBin: number;      // Last frequency bin to display
  rate: number;         // Update rate (samples between updates)
  dotSize: number;      // Dot size (0-32)
  lineSize: number;     // Line size (-32 to 32, negative for bars)
  textSize: number;     // Text size for labels
  window: WindowColor;  // Window background/grid colors
  windowWidth: number;  // Window width in pixels
  windowHeight: number; // Window height in pixels
  isPackedData: boolean;
  packedMode?: ePackedDataMode;  // Packed data mode if applicable
  packedWidth?: ePackedDataWidth; // Packed data width if applicable
  packedSigned?: boolean;         // Signed flag for packed data
  packedAlt?: boolean;            // Alt flag for packed data
  logScale: boolean;    // Enable log scale for magnitude
  grid: boolean;        // Show frequency grid
  showLabels: boolean;  // Show frequency labels
  spectrumColor?: string; // Default spectrum color
  hideXY: boolean;      // Hide coordinate display
}

/**
 * FFT Channel Specification Interface
 * Defines configuration for each FFT channel
 */
export interface FFTChannelSpec {
  label: string;        // Channel label
  magnitude: number;    // Magnitude scaling (0-11, shift amount)
  high: number;         // Maximum expected magnitude
  tall: number;         // Display height in pixels
  base: number;         // Baseline offset
  grid: number;         // Grid positioning
  color: string;        // Channel color
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
  private sampleBuffer: Int32Array;  // Changed to Int32Array to match Pascal's integer samples
  private sampleWritePtr = 0;       // Write pointer for new samples
  private sampleReadPtr = 0;        // Read pointer for FFT processing
  private sampleCount = 0;          // Number of samples written since last FFT
  private channelMask = 0xFF;       // Bitmask for enabled channels (default all 8)
  
  // Rate control and timing
  private rateCounter = 0;          // Counts samples until next FFT trigger
  private currentChannel = 0;       // Current channel index for sequential filling
  private lastSampleTime = 0;       // Timestamp of last sample received
  private sampleTimestamps: number[] = []; // Rolling buffer of sample timestamps for rate detection
  private detectedSampleRate = 0;   // Detected samples per second
  private droppedSamples = 0;       // Count of dropped samples due to overflow
  
  // FFT properties
  private fftExp = 0;               // Log2 of FFT size
  private fftSize = 0;              // Current FFT size
  
  // FFT working arrays
  private fftInput: Int32Array;     // Input to FFT (after channel summing)
  private fftPower: Int32Array;     // FFT power output (combined)
  private fftAngle: Int32Array;     // FFT phase output (combined)
  
  // Per-channel FFT results
  private channelFFTResults: Array<{
    power: Int32Array;
    angle: Int32Array;
    magnitude: number;
  }> = [];

  constructor(context: Context, displaySpec: FFTDisplaySpec, windowId: string = `fft-${Date.now()}`) {
    super(context, windowId, 'fft');
    this.windowLogPrefix = 'fftW';
    
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
    
    // Initialize rate counter
    this.rateCounter = this.displaySpec.rate;
    
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
    // Validate channel index
    if (channelIndex < 0 || channelIndex >= this.MAX_CHANNELS) {
      this.logMessage(`Invalid channel index: ${channelIndex}`);
      return;
    }
    
    // Check if this channel is enabled
    if ((this.channelMask & (1 << channelIndex)) === 0) {
      return; // Channel is disabled, ignore sample
    }
    
    // Update sample rate detection
    this.updateSampleRateDetection();
    
    // Check for buffer overflow (about to overwrite unread data)
    const nextWritePtr = (this.sampleWritePtr + 1) & (this.BUFFER_SIZE - 1);
    if (nextWritePtr === this.sampleReadPtr && this.sampleCount > 0) {
      // Buffer overflow - drop this sample
      this.droppedSamples++;
      if (this.droppedSamples % 100 === 1) { // Log every 100 dropped samples
        this.logMessage(`Buffer overflow: ${this.droppedSamples} samples dropped`);
      }
      return;
    }
    
    // Calculate buffer position for this channel's sample
    // Buffer layout: interleaved channels at each sample position
    const bufferIndex = this.sampleWritePtr * this.MAX_CHANNELS + channelIndex;
    
    // Store the sample
    this.sampleBuffer[bufferIndex] = sample;
    
    // Only advance write pointer and count when we've filled all enabled channels
    // This ensures samples stay synchronized across channels
    if (channelIndex === this.getLastEnabledChannel()) {
      // Advance write pointer with wraparound
      this.sampleWritePtr = (this.sampleWritePtr + 1) & (this.BUFFER_SIZE - 1);
      
      // Increment sample count for rate control
      this.sampleCount++;
      
      // Check if we've collected enough samples for FFT
      if (this.sampleCount >= this.displaySpec.rate) {
        this.triggerFFT();
        this.sampleCount = 0;
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
   * Extract samples from the circular buffer for FFT processing
   * 
   * @param startPtr Starting position in the circular buffer
   * @param length Number of samples to extract
   * @returns Array of samples ready for FFT
   */
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
      
      // Average the channels (or just use sum for Pascal compatibility)
      // Pascal appears to sum channels without averaging
      samples[i] = sum;
    }
    
    return samples;
  }
  
  /**
   * Trigger FFT processing when enough samples are collected
   */
  private triggerFFT(): void {
    // Only process if window exists
    if (!this.windowCreated) return;
    
    // Process FFT for each enabled channel if we have channel configurations
    if (this.channels.length > 0) {
      this.processChannelFFTs();
    } else {
      // No channels configured - process combined FFT with default settings
      this.processCombinedFFT(0);
    }
    
    // Update read pointer to match where we just processed
    this.sampleReadPtr = this.sampleWritePtr;
    
    // Trigger display update
    this.drawFFT();
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
      
      // Perform FFT with channel's magnitude setting
      const result = this.fftProcessor.performFFT(samples, channel.magnitude);
      
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
   * Process combined FFT from all enabled channels
   */
  private processCombinedFFT(magnitude: number): void {
    // Calculate starting position for FFT samples
    const startPtr = (this.sampleWritePtr - this.displaySpec.samples) & (this.BUFFER_SIZE - 1);
    
    // Extract combined samples from all enabled channels
    const samples = this.extractSamplesForFFT(startPtr, this.displaySpec.samples);
    
    // Perform FFT on the combined samples
    const result = this.fftProcessor.performFFT(samples, magnitude);
    
    // Store results for rendering
    this.fftPower = result.power;
    this.fftAngle = result.angle;
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
   */
  private clearBuffer(): void {
    // Zero out the buffer
    this.sampleBuffer.fill(0);
    
    // Reset pointers
    this.sampleWritePtr = 0;
    this.sampleReadPtr = 0;
    this.sampleCount = 0;
    this.currentChannel = 0;
    
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
    this.channelMask = mask & 0xFF; // Ensure only 8 bits
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
      windowTitle: `FFT ${displayName}`,
      title: '',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false, // Default: use auto-placement
      size: { width: 400, height: 300 },
      nbrSamples: 512,  // Required by BaseDisplaySpec
      samples: 512,  // fft_default from Pascal
      firstBin: 0,
      lastBin: 255,  // Will be adjusted based on samples
      rate: 0,       // 0 means use samples value
      dotSize: 0,
      lineSize: 3,   // Default from Pascal
      textSize: 10,
      window: { background: 'black', grid: 'gray' },
      isPackedData: false,
      logScale: false,
      grid: false,
      showLabels: true,
      spectrumColor: '#00FF00',
      windowWidth: 640,
      windowHeight: 480,
      hideXY: false
    };

    // Parse configuration directives
    let isValid = true;
    for (let index = 2; index < lineParts.length; index++) {
      const element = lineParts[index].toUpperCase();
      
      // Handle SAMPLES first since FFT needs special parsing (first/last bins)
      if (element === 'SAMPLES') {
        // FFT-specific SAMPLES parsing with optional first and last bins
        if (index < lineParts.length - 1) {
          const samplesValue = Number(lineParts[++index]);
          
          // Validate power of 2 between 4 and 2048
          if (!this.isPowerOfTwo(samplesValue) || samplesValue < 4 || samplesValue > 2048) {
            const nearest = this.nearestPowerOfTwo(samplesValue, 4, 2048);
            // Silent rounding to nearest power of 2 (matches Pascal behavior)
            spec.samples = nearest;
          } else {
            spec.samples = samplesValue;
          }
          
          // Update nbrSamples to match samples (required by BaseDisplaySpec)
          spec.nbrSamples = spec.samples;
          
          // Calculate FFT exponent for later use
          const fftExp = Math.log2(spec.samples);
          
          // Default first and last bins
          spec.firstBin = 0;
          spec.lastBin = spec.samples / 2 - 1;
          
          // Optional first bin parameter
          if (index < lineParts.length - 1 && !isNaN(Number(lineParts[index + 1]))) {
            const first = Number(lineParts[++index]);
            if (first >= 0 && first < spec.samples / 2 - 1) {
              spec.firstBin = first;
            }
            
            // Optional last bin parameter
            if (index < lineParts.length - 1 && !isNaN(Number(lineParts[index + 1]))) {
              const last = Number(lineParts[++index]);
              if (last > spec.firstBin && last <= spec.samples / 2 - 1) {
                spec.lastBin = last;
              }
            }
          }
        }
        // Missing parameter handled by using defaults
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
        case 'RATE':
          if (index < lineParts.length - 1) {
            const rateValue = Number(lineParts[++index]);
            if (rateValue >= 1 && rateValue <= 2048) {
              spec.rate = rateValue;
            }
            // Silent clamping if out of range (matches Pascal behavior)
          }
          break;
          
        case 'LINE':
          if (index < lineParts.length - 1) {
            const lineValue = Number(lineParts[++index]);
            if (lineValue >= -32 && lineValue <= 32) {
              spec.lineSize = Math.abs(lineValue);
              spec.dotSize = 0; // Line mode disables dot mode
            }
            // Silent clamping if out of range (matches Pascal behavior)
          } else {
            // Default line size
            spec.lineSize = 3;
            spec.dotSize = 0;
          }
          break;
          
        case 'DOT':
          if (index < lineParts.length - 1) {
            const dotValue = Number(lineParts[++index]);
            if (dotValue >= 0 && dotValue <= 32) {
              spec.dotSize = dotValue;
              spec.lineSize = 0; // Dot mode disables line mode
            }
            // Silent clamping if out of range (matches Pascal behavior)
          } else {
            // Default dot size
            spec.dotSize = 3;
            spec.lineSize = 0;
          }
          break;

        case 'RANGE':
          // RANGE can have 1 or 2 parameters
          if (index < lineParts.length - 1) {
            const firstParam = Number(lineParts[++index]);
            if (index < lineParts.length - 1 && !isNaN(Number(lineParts[index + 1]))) {
              // Two parameters: firstBin and lastBin
              const secondParam = Number(lineParts[++index]);
              spec.firstBin = Math.max(0, firstParam);
              spec.lastBin = Math.min(secondParam, (spec.samples / 2) - 1);
            } else {
              // One parameter: just lastBin
              spec.firstBin = 0;
              spec.lastBin = Math.min(firstParam, (spec.samples / 2) - 1);
            }
          }
          // Silent clamping to valid range (matches Pascal behavior)
          break;
          
        case 'DOTSIZE':
          if (index < lineParts.length - 1) {
            const dotValue = Number(lineParts[++index]);
            if (dotValue >= 0 && dotValue <= 32) {
              spec.dotSize = dotValue;
            }
            // Silent clamping if out of range (matches Pascal behavior)
          }
          break;
          
        case 'LINESIZE':
          if (index < lineParts.length - 1) {
            const lineValue = Number(lineParts[++index]);
            if (lineValue >= -32 && lineValue <= 32) {
              spec.lineSize = lineValue;
            }
            // Silent clamping if out of range (matches Pascal behavior)
          }
          break;
          
        case 'TEXTSIZE':
          if (index < lineParts.length - 1) {
            const textValue = Number(lineParts[++index]);
            if (textValue >= 6 && textValue <= 200) {
              spec.textSize = textValue;
            }
            // Silent clamping if out of range (matches Pascal behavior)
          }
          break;
          
        case 'COLOR':
          // Parse COLOR directive: COLOR <background> {<grid-color>}
          const [colorParsed, colors, colorIndex] = DisplaySpecParser.parseColorKeyword(lineParts, index);
          if (colorParsed) {
            spec.window.background = colors.background;
            if (colors.grid) {
              spec.window.grid = colors.grid;
            }
            index = colorIndex - 1; // Adjust for loop increment
          }
          // Invalid color specs are handled by DisplaySpecParser
          break;
          
        case 'LOGSCALE':
          spec.logScale = true;
          break;
          
        case 'GRID':
          spec.grid = true;
          break;
          
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
   * Check if a number is a power of two
   */
  private static isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Find the nearest power of two within range
   */
  private static nearestPowerOfTwo(value: number, min: number, max: number): number {
    // Pascal uses Trunc(Log2(Within(val, 4, FFTmax)))
    const clamped = Math.max(min, Math.min(max, value));
    const exp = Math.round(Math.log2(clamped));
    const result = Math.pow(2, exp);
    return Math.max(min, Math.min(max, result));
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
    this.drawFFT();
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
   * Entry point for message processing from WindowRouter
   * Called by router's updateContent(dataParts)
   */
  public updateContent(lineParts: string[]): void {
    this.processMessageImmediate(lineParts);
  }

  /**
   * Update FFT window content with new data (synchronous wrapper for async operations)
   */
  protected processMessageImmediate(lineParts: string[]): void {
    // Handle async internally
    this.processMessageAsync(lineParts);
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
        // Parse channel configuration
        const channelConfig = this.parseChannelConfiguration(lineParts, i);
        if (channelConfig) {
          // Add channel configuration
          const channelIndex = this.channels.length;
          this.channels.push(channelConfig);
          
          // Enable this channel in the mask
          this.channelMask |= (1 << channelIndex);
          
          this.logMessage(`Added channel ${channelIndex}: ${channelConfig.label}`);
          
          // Skip past the channel configuration parameters
          i += 6; // Label + 6 numeric parameters
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
              this.initializeCanvas();
              this.createDebugWindow();
              this.windowCreated = true;
            }
            
            // Add sample to buffer for current channel
            this.addSample(value, this.currentChannel);
            
            // Advance to next enabled channel (round-robin)
            this.currentChannel = this.getNextEnabledChannel(this.currentChannel);
          }
        }
        continue;
      }
      
      // Handle packed data if processor is configured
      if (this.packedDataProcessor && this.displaySpec.packedMode !== undefined) {
        // Try to parse as numeric value for packed data
        const numValue = Number(part);
        if (!isNaN(numValue)) {
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
        // Try to parse as raw numeric value
        const numValue = Number(part);
        if (!isNaN(numValue)) {
          // Add sample to buffer for current channel
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
  private parseChannelConfiguration(parts: string[], startIndex: number): FFTChannelSpec | null {
    // Format: 'label' mag high tall base grid color
    if (startIndex + 6 >= parts.length) {
      this.logMessage(`Incomplete channel configuration at index ${startIndex}`);
      return null;
    }
    
    // Extract label (remove quotes)
    const labelPart = parts[startIndex];
    const label = labelPart.replace(/^['"]|['"]$/g, '');
    
    // Parse numeric parameters
    const mag = Number(parts[startIndex + 1]);
    const high = Number(parts[startIndex + 2]);
    const tall = Number(parts[startIndex + 3]);
    const base = Number(parts[startIndex + 4]);
    const grid = Number(parts[startIndex + 5]);
    const color = parts[startIndex + 6];
    
    // Validate parameters
    if (isNaN(mag) || isNaN(high) || isNaN(tall) || isNaN(base) || isNaN(grid)) {
      this.logMessage(`Invalid numeric parameters in channel configuration`);
      return null;
    }
    
    return {
      label,
      magnitude: Math.max(0, Math.min(11, mag)), // Clamp to 0-11
      high,
      tall,
      base,
      grid,
      color: this.parseChannelColor(color)
    };
  }
  
  /**
   * Parse a color string and return hex color
   */
  private parseChannelColor(colorStr: string): string {
    const [isValid, hexColor] = DebugColor.parseColorSpec(colorStr);
    return isValid ? hexColor : '#FFFFFF';
  }
  
  /**
   * Parse a data value from an expression
   */
  private parseDataValue(expr: string): number | null {
    try {
      // For now, just try to parse as number
      // In the future, this could evaluate expressions
      const value = Number(expr);
      return isNaN(value) ? null : value;
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
  private drawFFT(): void {
    if (!this.canvasRenderer || !this.debugWindow) return;
    
    // Clear canvas with background color
    this.clearCanvas();
    
    // Draw grid if enabled
    if (this.displaySpec.grid) {
      this.drawFrequencyGrid();
    }
    
    // Draw FFT spectrum based on mode
    if (this.channels.length > 0) {
      // Draw individual channels (in reverse order for proper overlay)
      this.drawChannelSpectrums();
    } else {
      // Draw combined spectrum
      this.drawCombinedSpectrum();
    }
    
    // Draw labels if enabled
    if (this.displaySpec.showLabels) {
      this.drawFrequencyLabels();
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
          ctx.fillStyle = '${this.displaySpec.window.background}';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      })();
    `;
    
    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to clear canvas: ${error}`);
    });
  }
  
  /**
   * Draw frequency grid lines
   */
  private drawFrequencyGrid(): void {
    if (!this.debugWindow) return;
    
    const width = this.displaySpec.windowWidth;
    const height = this.displaySpec.windowHeight;
    
    // Grid lines at power-of-2 bins or linear intervals
    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
          ctx.lineWidth = 1;
          
          // Vertical grid lines
          const numVerticalLines = 8;
          for (let i = 1; i < numVerticalLines; i++) {
            const x = (canvas.width / numVerticalLines) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          
          // Horizontal grid lines
          const numHorizontalLines = 5;
          for (let i = 1; i < numHorizontalLines; i++) {
            const y = (canvas.height / numHorizontalLines) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }
        }
      })();
    `;
    
    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to draw grid: ${error}`);
    });
  }
  
  /**
   * Draw the combined FFT spectrum (when no channels configured)
   */
  private drawCombinedSpectrum(): void {
    if (!this.fftPower || !this.debugWindow) return;
    
    const power = this.fftPower;
    const color = this.displaySpec.spectrumColor || '#00FF00';
    
    this.drawSpectrum(power, color, 0, 100, 0);
  }
  
  /**
   * Draw individual channel spectrums
   */
  private drawChannelSpectrums(): void {
    if (!this.debugWindow) return;
    
    // Draw in reverse order so last channel is on top
    for (let i = this.channels.length - 1; i >= 0; i--) {
      if (i < this.channelFFTResults.length && this.channelFFTResults[i]) {
        const channel = this.channels[i];
        const { power } = this.channelFFTResults[i];
        
        this.drawSpectrum(
          power,
          channel.color,
          channel.base,
          channel.tall,
          channel.grid
        );
      }
    }
  }
  
  /**
   * Draw a single spectrum
   */
  private drawSpectrum(
    power: Int32Array,
    color: string,
    base: number,
    tall: number,
    grid: number
  ): void {
    if (!this.debugWindow) return;
    
    const width = this.displaySpec.windowWidth;
    const height = this.displaySpec.windowHeight;
    const firstBin = this.displaySpec.firstBin;
    const lastBin = Math.min(this.displaySpec.lastBin, power.length - 1);
    const numBins = lastBin - firstBin + 1;
    
    // Prepare power data with log scale if needed
    const powerData: number[] = [];
    for (let i = firstBin; i <= lastBin; i++) {
      let value = power[i];
      
      // Apply log scale if enabled
      if (this.displaySpec.logScale && value > 0) {
        value = Math.log10(value) * 20; // Convert to dB
      }
      
      powerData.push(value);
    }
    
    // Find max value for scaling
    const maxPower = Math.max(...powerData, 1);
    
    // Generate drawing commands based on display mode
    let drawCommands = '';
    
    if (this.displaySpec.lineSize > 0) {
      // Line mode
      drawCommands = this.generateLineDrawCommands(
        powerData,
        maxPower,
        width,
        height,
        base,
        tall,
        color,
        this.displaySpec.lineSize
      );
    } else if (this.displaySpec.dotSize > 0) {
      // Dot mode
      drawCommands = this.generateDotDrawCommands(
        powerData,
        maxPower,
        width,
        height,
        base,
        tall,
        color,
        this.displaySpec.dotSize
      );
    } else {
      // Bar mode (default)
      drawCommands = this.generateBarDrawCommands(
        powerData,
        maxPower,
        width,
        height,
        base,
        tall,
        color
      );
    }
    
    // Execute drawing commands
    const jsCode = `
      (function() {
        const canvas = document.getElementById('${this.canvasId}');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ${drawCommands}
        }
      })();
    `;
    
    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to draw spectrum: ${error}`);
    });
  }
  
  /**
   * Generate line drawing commands
   */
  private generateLineDrawCommands(
    powerData: number[],
    maxPower: number,
    width: number,
    height: number,
    base: number,
    tall: number,
    color: string,
    lineWidth: number
  ): string {
    const numBins = powerData.length;
    const binWidth = width / numBins;
    
    // Scale tall from 0-100 to actual height range
    const scaledHeight = (tall / 100) * height;
    const baseY = height - (base / 100) * height; // Bottom-up coordinate system
    
    let commands = `
      ctx.strokeStyle = '${color}';
      ctx.lineWidth = ${lineWidth};
      ctx.beginPath();
    `;
    
    for (let i = 0; i < numBins; i++) {
      const x = i * binWidth + binWidth / 2;
      const normalizedPower = powerData[i] / maxPower;
      const y = baseY - (normalizedPower * scaledHeight);
      
      if (i === 0) {
        commands += `ctx.moveTo(${x}, ${y});\n`;
      } else {
        commands += `ctx.lineTo(${x}, ${y});\n`;
      }
    }
    
    commands += `ctx.stroke();\n`;
    return commands;
  }
  
  /**
   * Generate bar drawing commands
   */
  private generateBarDrawCommands(
    powerData: number[],
    maxPower: number,
    width: number,
    height: number,
    base: number,
    tall: number,
    color: string
  ): string {
    const numBins = powerData.length;
    const binWidth = width / numBins;
    const barWidth = binWidth * 0.8; // 80% width for bars
    const barGap = binWidth * 0.1; // 10% gap on each side
    
    // Scale tall from 0-100 to actual height range
    const scaledHeight = (tall / 100) * height;
    const baseY = height - (base / 100) * height; // Bottom-up coordinate system
    
    let commands = `
      ctx.fillStyle = '${color}';
    `;
    
    for (let i = 0; i < numBins; i++) {
      const x = i * binWidth + barGap;
      const normalizedPower = powerData[i] / maxPower;
      const barHeight = normalizedPower * scaledHeight;
      const y = baseY - barHeight;
      
      commands += `ctx.fillRect(${x}, ${y}, ${barWidth}, ${barHeight});\n`;
    }
    
    return commands;
  }
  
  /**
   * Generate dot drawing commands
   */
  private generateDotDrawCommands(
    powerData: number[],
    maxPower: number,
    width: number,
    height: number,
    base: number,
    tall: number,
    color: string,
    dotSize: number
  ): string {
    const numBins = powerData.length;
    const binWidth = width / numBins;
    
    // Scale tall from 0-100 to actual height range
    const scaledHeight = (tall / 100) * height;
    const baseY = height - (base / 100) * height; // Bottom-up coordinate system
    
    let commands = `
      ctx.fillStyle = '${color}';
    `;
    
    for (let i = 0; i < numBins; i++) {
      const x = i * binWidth + binWidth / 2;
      const normalizedPower = powerData[i] / maxPower;
      const y = baseY - (normalizedPower * scaledHeight);
      
      // Draw dot as small circle
      commands += `
        ctx.beginPath();
        ctx.arc(${x}, ${y}, ${dotSize}, 0, Math.PI * 2);
        ctx.fill();
      `;
    }
    
    return commands;
  }
  
  /**
   * Convert mouse X coordinate to frequency bin
   */
  private mouseXToBin(mouseX: number): number {
    const width = this.displaySpec.windowWidth;
    const firstBin = this.displaySpec.firstBin;
    const lastBin = this.displaySpec.lastBin;
    const numBins = lastBin - firstBin + 1;
    
    const binIndex = Math.floor((mouseX / width) * numBins);
    return Math.max(firstBin, Math.min(lastBin, firstBin + binIndex));
  }
  
  /**
   * Convert mouse Y coordinate to magnitude value
   */
  private mouseYToMagnitude(mouseY: number): number {
    const height = this.displaySpec.windowHeight;
    // Bottom-up coordinate system
    const normalizedY = (height - mouseY) / height;
    return normalizedY * 100; // Return as percentage
  }
  
  /**
   * Get frequency for a given bin
   */
  private binToFrequency(bin: number): number {
    const sampleRate = this.detectedSampleRate || 1000;
    const nyquist = sampleRate / 2;
    const binFrequency = nyquist / (this.fftExp > 0 ? Math.pow(2, this.fftExp - 1) : 1);
    return bin * binFrequency;
  }
  
  /**
   * Handle mouse move events for coordinate display
   */
  protected handleMouseMove(event: MouseEvent): void {
    if (!this.debugWindow || this.displaySpec.hideXY) return;
    
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    // Convert to FFT coordinates
    const bin = this.mouseXToBin(mouseX);
    const frequency = this.binToFrequency(bin);
    const magnitude = this.mouseYToMagnitude(mouseY);
    
    // Update coordinate display
    this.updateCoordinateDisplay(bin, frequency, magnitude, mouseX, mouseY);
    
    // Draw crosshair if enabled
    if (!this.displaySpec.hideXY) {
      this.drawCrosshair(mouseX, mouseY);
    }
    
    // TODO: Forward mouse event through InputForwarder (Task 25)
    // if (this.inputForwarder) {
    //   // Transform coordinates for FFT window (bottom-up Y-axis)
    //   const transformedY = this.displaySpec.windowHeight - mouseY;
    //   this.inputForwarder.queueMouseEvent(mouseX, transformedY, { left: false, middle: false, right: false }, 0);
    // }
  }
  
  /**
   * Update coordinate display with current mouse position
   */
  private updateCoordinateDisplay(
    bin: number,
    frequency: number,
    magnitude: number,
    mouseX: number,
    mouseY: number
  ): void {
    if (!this.debugWindow) return;
    
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
          
          const text = 'Bin:' + ${bin} + ' Freq:' + ${frequency.toFixed(1)} + 'Hz Mag:' + ${magnitude.toFixed(1)} + '%';
          ctx.fillText(text, 5, 15);
          
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
      })();
    `;
    
    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to draw labels: ${error}`);
    });
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
    
    // Calculate canvas dimensions based on configuration
    const margin = this.displaySpec.hideXY ? 10 : 20;  // Extra margin for coordinate display
    const canvasWidth = this.displaySpec.size.width;
    const canvasHeight = this.displaySpec.size.height;
    
    // Store dimensions for later use
    this.canvasMargin = margin;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    
    // Calculate display area (accounting for margins and text)
    this.displayWidth = canvasWidth - (2 * margin);
    this.displayHeight = canvasHeight - (2 * margin);
    
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
        debugLogger.logSystemMessage(`WINDOW_PLACED (${x},${y} ${this.canvasWidth}x${this.canvasHeight} Mon:${monitorId}) FFT '${this.displaySpec.displayName}' POS ${x} ${y} SIZE ${this.canvasWidth} ${this.canvasHeight}`);
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }
    
    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(this.canvasWidth, this.canvasHeight);

    // Create browser window
    this.debugWindow = new BrowserWindow({
      width: windowDimensions.width,
      height: windowDimensions.height,
      x,
      y,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Register window with WindowPlacer for position tracking
    const windowPlacer = WindowPlacer.getInstance();
    windowPlacer.registerWindow(`fft-${this.displaySpec.displayName}`, this.debugWindow);

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
            // Canvas setup for bottom-up Y-axis (matching Pascal)
            const canvas = document.getElementById('fft-canvas');
            const ctx = canvas.getContext('2d');
            
            // Transform to bottom-up coordinate system
            // This makes Y=0 at the bottom, matching Pascal
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            
            // Save the transformed state
            ctx.save();
            
            // Clear with background color
            ctx.fillStyle = '${this.displaySpec.window.background}';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw grid if needed
            if ('${this.displaySpec.window.grid}' !== '${this.displaySpec.window.background}') {
              ctx.strokeStyle = '${this.displaySpec.window.grid}';
              ctx.lineWidth = 1;
              
              // Draw border
              ctx.strokeRect(${this.canvasMargin}, ${this.canvasMargin}, 
                           ${this.displayWidth}, ${this.displayHeight});
            }
            
            console.log('FFT canvas initialized');
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

  // Add private properties for canvas management
  private canvasId: string = '';
  private canvasMargin: number = 10;
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
    this.logMessage('Mouse input forwarding enabled');
  }

  /**
   * Handle window close event
   */
  close(): void {
    this.closeDebugWindow();
    // Clean up any other FFT-specific resources
  }
}