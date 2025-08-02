/**
 * Debug Statements Documentation
 * 
 * This file contains comprehensive documentation of Parallax Spin2 debug statements
 * as documented in debugStatements.pdf. It includes all graphical debug displays,
 * their instantiation parameters, feeding commands, and usage examples.
 */

/**
 * Debug Display Types
 * 
 * The debug system supports 9 different graphical display types that can be
 * instantiated and fed data for visualization.
 */
export enum DebugDisplayType {
  LOGIC = 'LOGIC',          // Logic analyzer with single and multi-bit labels, 1..32 channels, can trigger on pattern
  SCOPE = 'SCOPE',          // Oscilloscope with 1..8 channels, can trigger on level with hysteresis
  SCOPE_XY = 'SCOPE_XY',    // XY oscilloscope with 1..8 channels, persistence of 0..512 samples, polar mode, log scale mode
  FFT = 'FFT',              // Fast Fourier Transform with 1..8 channels, 4..2048 points, windowed results, log scale mode
  SPECTRO = 'SPECTRO',      // Spectrograph with 4..2048-point FFT, windowed results, phase-coloring, and log scale mode
  PLOT = 'PLOT',            // General-purpose plotter with cartesian and polar modes
  TERM = 'TERM',            // Text terminal with up to 300 x 200 characters, 6..200 point font size, 4 simultaneous color schemes
  BITMAP = 'BITMAP',        // Bitmap, 1..2048 x 1..2048 pixels, 1/2/4/8/16/32-bit pixels with 19 color systems
  MIDI = 'MIDI',            // Piano keyboard with 1..128 keys, velocity depiction, variable screen scale
}

/**
 * Common Display Configuration Options
 * 
 * Most debug displays share these common configuration options
 */
export interface CommonDisplayConfig {
  TITLE?: string;           // Window caption
  POS?: { left: number; top: number };  // Window position
  HIDEXY?: boolean;         // Hide X,Y mouse coordinates at pointer
}

/**
 * LOGIC Display Configuration
 * 
 * Logic analyzer with single and multi-bit labels, 1..32 channels, can trigger on pattern
 */
export interface LogicDisplayConfig extends CommonDisplayConfig {
  SAMPLES?: number;         // 4 to 2048, default: 32
  SPACING?: number;         // 2 to 32, default: 8
  RATE?: number;           // 1 to 2048, default: 1
  LINESIZE?: number;       // 1 to 7, default: 1
  TEXTSIZE?: number;       // 6 to 200, default: editor text size
  COLOR?: { back: string; grid?: string };  // Background and grid colors
  channels?: Array<{
    name: string;
    bits?: number;        // 1 to 32 for channel group
    color?: string;
    isRange?: boolean;    // If true, draw as waveform
  }>;
  packed_data_mode?: PackedDataMode;
}

/**
 * LOGIC Display Feeding Commands
 */
export interface LogicDisplayFeeding {
  TRIGGER?: {
    mask: number;
    match: number;
    sample_offset?: number;  // Default: SAMPLES / 2
  };
  HOLDOFF?: number;         // 2 to 2048, default: SAMPLES
  data?: number;            // Numerical data applied LSB-first to channels
  CLEAR?: boolean;          // Clear sample buffer and display
  SAVE?: { window?: boolean; filename: string };  // Save bitmap
}

/**
 * SCOPE Display Configuration
 * 
 * Oscilloscope with 1..8 channels, can trigger on level with hysteresis
 */
export interface ScopeDisplayConfig extends CommonDisplayConfig {
  SIZE?: { width: number; height: number };  // 32..2048 x 32..2048, default: 255, 256
  SAMPLES?: number;         // 16 to 2048, default: 256
  RATE?: number;           // 1 to 2048, default: 1
  DOTSIZE?: number;        // 0 to 32, default: 0
  LINESIZE?: number;       // 0 to 32, default: 3
  TEXTSIZE?: number;       // 6 to 200, default: editor text size
  COLOR?: { back: string; grid?: string };  // Background and grid colors
  packed_data_mode?: PackedDataMode;
}

/**
 * SCOPE Channel Configuration
 */
export interface ScopeChannel {
  name: string;
  min?: number;            // Min value (or AUTO)
  max?: number;            // Max value (or AUTO)
  y_size?: number;         // Y size in pixels
  y_base?: number;         // Y base position
  legend?: number;         // %abcd bitmap for legend display
  color?: string;
}

/**
 * SCOPE_XY Display Configuration
 * 
 * XY oscilloscope with 1..8 channels, persistence of 1..512 samples
 */
export interface ScopeXYDisplayConfig extends CommonDisplayConfig {
  SIZE?: number;           // Display radius in pixels, default: 128
  RANGE?: number;          // Unit circle radius, default: $7FFFFFFF
  SAMPLES?: number;        // 0 to 512 (0 = infinite persistence), default: 256
  RATE?: number;           // 1 to 512, default: 1
  DOTSIZE?: number;        // 2 to 20, default: 6
  TEXTSIZE?: number;       // 6 to 200, default: editor text size
  COLOR?: { back: string; grid?: string };
  POLAR?: { twopi: number; offset: number };  // Polar mode settings
  LOGSCALE?: boolean;      // Log-scale mode
  channels?: Array<{ name: string; color?: string }>;
  packed_data_mode?: PackedDataMode;
}

/**
 * FFT Display Configuration
 * 
 * Fast Fourier Transform with 1..8 channels, 4..2048 points
 */
export interface FFTDisplayConfig extends CommonDisplayConfig {
  SIZE?: { width: number; height: number };  // 32..2048 x 32..2048, default: 256, 256
  SAMPLES?: { points: number; first?: number; last?: number };  // 4..2048 points
  RATE?: number;           // 1 to 2048, default: SAMPLES
  DOTSIZE?: number;        // 0 to 32, default: 0
  LINESIZE?: number;       // -32 to 32, default: 3
  TEXTSIZE?: number;       // 6 to 200
  COLOR?: { back: string; grid?: string };
  LOGSCALE?: boolean;      // Log-scale mode
  packed_data_mode?: PackedDataMode;
}

/**
 * SPECTRO Display Configuration
 * 
 * Spectrograph with 4..2048-point FFT, phase-coloring
 */
export interface SpectroDisplayConfig extends CommonDisplayConfig {
  SAMPLES?: { points: number; first?: number; last?: number };  // 4..2048 FFT points
  DEPTH?: number;          // 1 to 2048, default: 256
  MAG?: number;            // 0 to 11, default: 0
  RANGE?: number;          // Saturation power level, default: $7FFFFFFF
  RATE?: number;           // 1 to 2048, default: SAMPLES / 8
  TRACE?: number;          // 0 to 15, default: 15
  DOTSIZE?: { width: number; height?: number };  // 1..16
  luma_or_hsv?: string;    // Color scheme (LUMA8X ORANGE default)
  LOGSCALE?: boolean;      // Log-scale mode
  packed_data_mode?: PackedDataMode;
}

/**
 * PLOT Display Configuration
 * 
 * General-purpose plotter with cartesian and polar modes
 */
export interface PlotDisplayConfig extends CommonDisplayConfig {
  SIZE?: { width: number; height: number };  // 32..2048 x 32..2048, default: 256, 256
  DOTSIZE?: { width: number; height?: number };  // 1..256, default: 1, 1
  lut_mode?: ColorMode;    // Color mode, default: RGB24
  LUTCOLORS?: number[];    // For LUT modes
  BACKCOLOR?: string | number;  // Background color
  UPDATE?: boolean;        // Update mode (manual update required)
}

/**
 * TERM Display Configuration
 * 
 * Text terminal with configurable size and colors
 */
export interface TermDisplayConfig extends CommonDisplayConfig {
  SIZE?: { columns: number; rows: number };  // 1..256 x 1..256, default: 40, 20
  TEXTSIZE?: number;       // 6 to 200, default: editor text size
  COLOR?: string[];        // Text/background color combos #0..#3
  BACKCOLOR?: string | number;  // Display background color
  UPDATE?: boolean;        // Update mode
}

/**
 * BITMAP Display Configuration
 * 
 * Pixel-driven bitmap with various color modes
 */
export interface BitmapDisplayConfig extends CommonDisplayConfig {
  SIZE?: { x_pixels: number; y_pixels: number };  // 1..2048 x 1..2048, default: 256, 256
  DOTSIZE?: { width: number; height?: number };  // 1..256, default: 1, 1
  SPARSE?: string;         // Show large round pixels against colored background
  color_mode?: ColorMode;  // Color mode, default: RGB24
  LUTCOLORS?: number[];    // For LUT modes
  TRACE?: number;          // 0 to 15, pixel loading direction, default: 0
  RATE?: number;           // Pixels per update, default: line size
  packed_data_mode?: PackedDataMode;
  UPDATE?: boolean;        // Update mode
}

/**
 * MIDI Display Configuration
 * 
 * MIDI keyboard for viewing note-on/off status with velocity
 */
export interface MidiDisplayConfig extends CommonDisplayConfig {
  SIZE?: number;           // Keyboard size 1..50, default: 4
  RANGE?: { first_key: number; last_key: number };  // 0..127, default: 21, 108 (88 keys)
  CHANNEL?: number;        // MIDI channel 0..15, default: 0
  COLOR?: { white_key: string; black_key: string };  // Key colors
}

/**
 * Color Modes for BITMAP and PLOT displays
 */
export enum ColorMode {
  LUT1 = 'LUT1',           // 1-bit pixels, 2-color palette
  LUT2 = 'LUT2',           // 2-bit pixels, 4-color palette
  LUT4 = 'LUT4',           // 4-bit pixels, 16-color palette
  LUT8 = 'LUT8',           // 8-bit pixels, 256-color palette
  LUMA8 = 'LUMA8',         // 8-bit, black to color
  LUMA8W = 'LUMA8W',       // 8-bit, white to color
  LUMA8X = 'LUMA8X',       // 8-bit, black to color to white
  HSV8 = 'HSV8',           // 8-bit HSV, 16 hues x 16 luminance
  HSV8W = 'HSV8W',         // 8-bit HSV from white
  HSV8X = 'HSV8X',         // 8-bit HSV peaking in white
  RGBI8 = 'RGBI8',         // 8-bit RGBI, 8 colors x 32 luminance
  RGBI8W = 'RGBI8W',       // 8-bit RGBI from white
  RGBI8X = 'RGBI8X',       // 8-bit RGBI peaking in white
  RGB8 = 'RGB8',           // 8-bit RGB (3-3-2)
  HSV16 = 'HSV16',         // 16-bit HSV, 256 hues x 256 luminance
  HSV16W = 'HSV16W',       // 16-bit HSV from white
  HSV16X = 'HSV16X',       // 16-bit HSV peaking in white
  RGB16 = 'RGB16',         // 16-bit RGB (5-6-5)
  RGB24 = 'RGB24',         // 24-bit RGB (8-8-8)
}

/**
 * Packed Data Modes
 * 
 * Used to efficiently convey sub-byte data types
 */
export enum PackedDataMode {
  LONGS_1BIT = 'LONGS_1BIT',    // 32 x 1-bit values per long
  LONGS_2BIT = 'LONGS_2BIT',    // 16 x 2-bit values per long
  LONGS_4BIT = 'LONGS_4BIT',    // 8 x 4-bit values per long
  LONGS_8BIT = 'LONGS_8BIT',    // 4 x 8-bit values per long
  LONGS_16BIT = 'LONGS_16BIT',  // 2 x 16-bit values per long
  WORDS_1BIT = 'WORDS_1BIT',    // 16 x 1-bit values per word
  WORDS_2BIT = 'WORDS_2BIT',    // 8 x 2-bit values per word
  WORDS_4BIT = 'WORDS_4BIT',    // 4 x 4-bit values per word
  WORDS_8BIT = 'WORDS_8BIT',    // 2 x 8-bit values per word
  BYTES_1BIT = 'BYTES_1BIT',    // 8 x 1-bit values per byte
  BYTES_2BIT = 'BYTES_2BIT',    // 4 x 2-bit values per byte
  BYTES_4BIT = 'BYTES_4BIT',    // 2 x 4-bit values per byte
}

/**
 * TRACE Modes for BITMAP display
 * 
 * Determines pixel loading direction and scrolling behavior
 */
export const TRACE_MODES = {
  0: 'Right, no scroll',
  1: 'Right, scroll left',
  2: 'Down, no scroll',
  3: 'Down, scroll up',
  4: 'Left, no scroll',
  5: 'Left, scroll right',
  6: 'Up, no scroll',
  7: 'Up, scroll down',
  8: 'Right snake, no scroll',
  9: 'Right snake, scroll left',
  10: 'Down snake, no scroll',
  11: 'Down snake, scroll up',
  12: 'Left snake, no scroll',
  13: 'Left snake, scroll right',
  14: 'Up snake, no scroll',
  15: 'Up snake, scroll down',
} as const;

/**
 * Debug Display Syntax
 * 
 * When a DEBUG message contains a backtick (`) character, everything from
 * the backtick to the end is sent to the graphical debug display parser.
 * 
 * Instantiation: `display_type instance_name [configuration...]
 * Feeding: `instance_name [data/commands...]
 * 
 * Special syntax within backtick strings:
 * - `?(value) - Boolean output (BOOL_)
 * - `.(value) - Floating-point output (FDEC_)
 * - `(value) - Decimal output (SDEC_)
 * - `$(value) - Hex output (UHEX_)
 * - `%(value) - Binary output (UBIN_)
 * - `#(value) - Character output
 */
export const DEBUG_SYNTAX = {
  INSTANTIATE: '`display_type instance_name [configuration...]',
  FEED: '`instance_name [data/commands...]',
  BOOLEAN: '`?(value)',
  FLOAT: '`.(value)',
  DECIMAL: '`(value)',
  HEX: '`$(value)',
  BINARY: '`%(value)',
  CHAR: '`#(value)',
} as const;

/**
 * Color Constants
 * 
 * Standard colors available in debug displays with optional brightness 0..15
 */
export const DEBUG_COLORS = {
  BLACK: 'BLACK',
  WHITE: 'WHITE',
  ORANGE: 'ORANGE',
  BLUE: 'BLUE',
  GREEN: 'GREEN',
  CYAN: 'CYAN',
  RED: 'RED',
  MAGENTA: 'MAGENTA',
  YELLOW: 'YELLOW',
  GRAY: 'GRAY',
} as const;

/**
 * Helper function to create color with brightness
 * @param color Base color name
 * @param brightness Optional brightness 0..15 (default 8)
 */
export function colorWithBrightness(color: keyof typeof DEBUG_COLORS, brightness: number = 8): string {
  if (color === 'BLACK' || color === 'WHITE') {
    return color;
  }
  return `${color} ${brightness}`;
}

/**
 * Legend Bitmap for SCOPE/LOGIC displays
 * 
 * %abcd where each bit enables:
 * a = max legend
 * b = min legend
 * c = max line
 * d = min line
 */
export function createLegendBitmap(maxLegend: boolean, minLegend: boolean, maxLine: boolean, minLine: boolean): number {
  return (maxLegend ? 8 : 0) | (minLegend ? 4 : 0) | (maxLine ? 2 : 0) | (minLine ? 1 : 0);
}

/**
 * Text Style for PLOT display
 * 
 * %YYXXUIWW format:
 * YY = vertical justification (00=middle, 10=bottom, 11=top)
 * XX = horizontal justification (00=middle, 10=right, 11=left)
 * U = underline (1=underline)
 * I = italic (1=italic)
 * WW = weight (00=light, 01=normal, 10=bold, 11=heavy)
 */
export function createTextStyle(options: {
  vAlign?: 'middle' | 'bottom' | 'top';
  hAlign?: 'middle' | 'right' | 'left';
  underline?: boolean;
  italic?: boolean;
  weight?: 'light' | 'normal' | 'bold' | 'heavy';
}): number {
  const vAlignMap = { middle: 0, bottom: 2, top: 3 };
  const hAlignMap = { middle: 0, right: 2, left: 3 };
  const weightMap = { light: 0, normal: 1, bold: 2, heavy: 3 };
  
  const vAlign = vAlignMap[options.vAlign || 'middle'] << 6;
  const hAlign = hAlignMap[options.hAlign || 'middle'] << 4;
  const underline = (options.underline ? 1 : 0) << 3;
  const italic = (options.italic ? 1 : 0) << 2;
  const weight = weightMap[options.weight || 'normal'];
  
  return vAlign | hAlign | underline | italic | weight;
}

/**
 * Terminal Control Characters
 */
export const TERM_CONTROL = {
  CLEAR_AND_HOME: 0,       // Clear terminal display and home cursor
  HOME: 1,                 // Home cursor
  SET_COLUMN: 2,           // Set column to next character value
  SET_ROW: 3,              // Set row to next character value
  COLOR_0: 4,              // Select color combo #0
  COLOR_1: 5,              // Select color combo #1
  COLOR_2: 6,              // Select color combo #2
  COLOR_3: 7,              // Select color combo #3
  BACKSPACE: 8,            // Backspace
  TAB: 9,                  // Tab to next 8th column
  NEWLINE: 10,             // New line (also accepts 13 or 13+10)
  CARRIAGE_RETURN: 13,     // Carriage return
} as const;

/**
 * Plot Drawing Commands
 */
export interface PlotCommands {
  // Color and style
  COLOR?: string | number;
  OPACITY?: number;        // 0..255 (clear..opaque)
  LINESIZE?: number;
  TEXTSIZE?: number;       // 6..200
  TEXTSTYLE?: number;      // Use createTextStyle()
  TEXTANGLE?: number;      // Degrees in cartesian, raw in polar
  
  // Positioning
  ORIGIN?: { x?: number; y?: number };
  SET?: { x: number; y: number };
  
  // Drawing
  DOT?: { linesize?: number; opacity?: number };
  LINE?: { x: number; y: number; linesize?: number; opacity?: number };
  CIRCLE?: { diameter: number; linesize?: number; opacity?: number };
  OVAL?: { width: number; height: number; linesize?: number; opacity?: number };
  BOX?: { width: number; height: number; linesize?: number; opacity?: number };
  OBOX?: { width: number; height: number; x_radius: number; y_radius: number; linesize?: number; opacity?: number };
  TEXT?: { size?: number; style?: number; angle?: number; text: string };
  
  // Coordinate systems
  POLAR?: { twopi?: number; offset?: number };
  CARTESIAN?: { ydir?: number; xdir?: number };
  
  // Sprites and layers
  SPRITEDEF?: { id: number; x_dim: number; y_dim: number; pixels: number[]; colors: number[] };
  SPRITE?: { id: number; orient?: number; scale?: number; opacity?: number };
  LAYER?: { layer: number; filename: string };
  CROP?: { layer: number; coords?: number[] };
  
  // Control
  CLEAR?: boolean;
  UPDATE?: boolean;
  SAVE?: { window?: boolean; filename: string };
  CLOSE?: boolean;
}