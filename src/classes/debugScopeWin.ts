/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow } from 'electron';
// src/classes/debugScopeWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ScopeTriggerProcessor } from './shared/triggerProcessor';
import { DisplaySpecParser } from './shared/displaySpecParser';
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

export interface ScopeDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  title: string; // for BaseDisplaySpec compatibility
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was in original message
  size: Size;
  nbrSamples: number;
  rate: number;
  dotSize: number;
  lineSize: number;
  textSize: number;
  window: WindowColor;
  isPackedData: boolean;
  hideXY: boolean;
}

export interface ScopeChannelSpec {
  name: string;
  color: string;
  gridColor: string;
  textColor: string;
  minValue: number;
  maxValue: number;
  ySize: number;
  yBaseOffset: number;
  lgndShowMax: boolean;
  lgndShowMin: boolean;
  lgndShowMaxLine: boolean;
  lgndShowMinLine: boolean;
}

interface ScopeChannelSamples {
  samples: number[];
}

export interface ScopeTriggerSpec {
  // trigger
  trigEnabled: boolean;
  trigAuto: boolean;
  trigChannel: number; // if channel is -1 then trigger is disabled
  trigArmLevel: number;
  trigLevel: number;
  trigSlope: string; // 'Positive', 'Negative', or 'Either'
  trigRtOffset: number;
  trigHoldoff: number; // in samples required, from trigger to trigger
}

/**
 * Debug SCOPE Window - Oscilloscope Waveform Display
 *
 * Displays real-time oscilloscope-style waveforms with multiple channels.
 * Supports trigger modes, auto-scaling, and packed data formats for high-performance data visualization.
 *
 * ## Features
 * - **Multi-Channel Display**: Up to 8 channels with independent configurations
 * - **Trigger Modes**: Manual trigger levels with arm/trigger thresholds, AUTO mode, and holdoff control
 * - **Data Visualization**: Real-time waveform rendering with configurable dot and line sizes
 * - **Packed Data Support**: Efficient data transfer using BYTE2/4, WORD2, LONG formats with SIGNED/ALT modifiers
 * - **Auto-scaling**: Automatic min/max detection for channel ranges
 * - **Coordinate Display**: Mouse position feedback with optional Y-axis inversion
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set window size (32-2048, default: 256x256)
 * - `SAMPLES nbr` - Sample buffer size (16-2048, default: 256)
 * - `RATE rate` - Sample rate divisor (1-2048, default: 1)
 * - `DOTSIZE pix` - Dot size for sample points (0-32, default: 0)
 * - `LINESIZE half-pix` - Line width (0-32, default: 3)
 * - `TEXTSIZE half-pix` - Text size for labels (6-200, default: 12)
 * - `COLOR bg {grid}` - Window and grid colors (default: BLACK, GRAY 4)
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * Channel configuration: `'{name}' {min} {max} {y-size} {y-base} {legend} {color} {bright}`
 * Auto-scaling mode: `'{name}' AUTO {y-size} {y-base} {legend} {color} {bright}`
 * - name: Channel display name
 * - min/max: Value range (AUTO uses 0-255)
 * - y-size: Vertical display size in pixels
 * - y-base: Y baseline offset
 * - legend: %abcd format (a=max legend, b=min legend, c=max line, d=min line)
 * - color: Channel color name, bright: Color brightness (0-15)
 * - Example: `debug(\`MyScope 'Ch1' 0 1024 100 50 %1111 RED 15\`(sample_value))`
 *
 * ## Commands
 * - `CLEAR` - Clear all channel data and reset display
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `TRIGGER ch {arm} {trig} {offset}` - Configure trigger levels for channel
 * - `TRIGGER ch AUTO` - Enable auto trigger on channel
 * - `TRIGGER ch HOLDOFF samples` - Set trigger holdoff period
 * - `LINE size` - Update line width, `DOT size` - Update dot size
 * - Packed data modes: `BYTE2/4`, `WORD2`, `LONG` with optional `SIGNED`/`ALT` modifiers
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `SCOPE_Configure` procedure (line 1151)
 * - Update: `SCOPE_Update` procedure (line 1209)
 * - Trigger handling: `Scope_Trigger` procedures
 * - Channel management: `Scope_Channel_Config` procedures
 *
 * ## Examples
 * ```spin2
 * ' Basic scope with two channels
 * debug(`SCOPE MyScope SIZE 400 300 SAMPLES 512 RATE 2)
 * debug(`MyScope 'Voltage' 0 3300 120 10 %1111 YELLOW 15)
 * debug(`MyScope 'Current' 0 1000 120 140 %1111 CYAN 15)
 *
 * repeat
 *   voltage := adc_read(0)
 *   current := adc_read(1)
 *   debug(`MyScope \`(voltage, current))
 * ```
 *
 * ## Implementation Notes
 * - Channels are created dynamically when channel configuration is encountered
 * - First numeric data triggers window creation and display initialization
 * - Y-axis is inverted (0 at top) to match Pascal implementation
 * - Supports both manual trigger levels and automatic triggering
 * - Mouse coordinates display with optional Y-axis inversion for debugging
 * - Efficient packed data processing for high-speed data acquisition scenarios
 *
 * ## Deviations from Pascal
 * - Enhanced mouse coordinate display with pixel-level precision
 * - Additional color validation and error handling
 * - Improved trigger state management and visual feedback
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_SCOPE.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugScopeWindow extends DebugWindowBase {
  private displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
  private channelSpecs: ScopeChannelSpec[] = []; // one for each channel
  private channelSamples: ScopeChannelSamples[] = []; // one for each channel
  private triggerSpec: ScopeTriggerSpec = {} as ScopeTriggerSpec;
  private isFirstNumericData: boolean = true;
  private channelInset: number = 10; // 10 pixels from top and bottom of window
  private contentInset: number = 10; // 10 pixels from left and right of window
  private canvasMargin: number = 0; // 3 pixels from left, right, top, and bottom of canvas (NOT NEEDED)
  private channelLineWidth: number = 2; // 2 pixels wide for channel data line
  private packedMode: PackedDataMode = {} as PackedDataMode;
  private canvasRenderer: CanvasRenderer = new CanvasRenderer();
  private triggerProcessor: ScopeTriggerProcessor;
  // Trigger state properties (Pascal-faithful: absolute level comparison, no crossing detection)
  private triggerArmed: boolean = false;
  private triggerFired: boolean = false;
  private holdoffCounter: number = 0;
  private triggerSampleIndex: number = -1; // Track which sample caused the trigger
  private windowCreated: boolean = false; // Track if window has been created yet
  // diagnostics used to limit the number of samples displayed while testing
  private dbgUpdateCount: number = 260; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
  private dbgLogMessageCount: number = 256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)

  protected logMessage(message: string): void {
    // if (this.dbgLogMessageCount > 0) {
    super.logMessage(message);
    //   this.dbgLogMessageCount--;
    // }
  }

  constructor(ctx: Context, displaySpec: ScopeDisplaySpec, windowId: string = `scope-${Date.now()}`) {
    super(ctx, windowId, 'scope');
    this.windowLogPrefix = 'scoW';
    // record our Debug Scope Window Spec
    this.displaySpec = displaySpec;

    // Enable logging for SCOPE window
    this.isLogging = false;

    // init default Trigger Spec
    this.triggerSpec = {
      trigEnabled: false,
      trigAuto: false,
      trigChannel: -1,
      trigArmLevel: 0,
      trigLevel: 0,
      trigSlope: 'Positive',
      trigRtOffset: 0,
      trigHoldoff: 0
    };
    // Initialize the trigger processor
    this.triggerProcessor = new ScopeTriggerProcessor();
    // initially we don't have a packed mode...
    this.packedMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
    };

    // Window creation deferred until first numeric data arrives and all channels are known
    // This allows proper sizing based on actual channel specifications
    // But we mark the window as "ready" to process messages for channel specs and first data
    this.onWindowReady();
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} - SCOPE`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
  }

  static parseScopeDeclaration(lineParts: string[]): [boolean, ScopeDisplaySpec] {
    // here with lineParts = ['`SCOPE', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0,0]
    //   SIZE <width> <height> [ea. 32-2048, default: 256]
    //   SAMPLES <nbr> [16-2048, default: 256]
    //   RATE <rate> [1-2048, default: 1]
    //   DOTSIZE <pix> [0-32, default: 0]
    //   LINESIZE <half-pix> [0-32, default: 3]
    //   TEXTSIZE <half-pix> [6-200, default: editor font size]
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GRAY 4]
    //   packed_data_mode
    //   HIDEXY
    // console.log(`CL: at parseScopeDeclaration()`);
    let displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY3', 4);
    // console.log(`CL: at parseScopeDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.hasExplicitPosition = false; // Default: use auto-placement
    displaySpec.size = { width: 256, height: 256 };
    displaySpec.nbrSamples = 256;
    displaySpec.rate = 1;
    displaySpec.dotSize = 0; // Default from comment
    displaySpec.lineSize = 3; // Default from comment
    displaySpec.textSize = 12; // Default editor font size - will be adjusted if needed
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;
    displaySpec.hideXY = false; // Default to showing coordinates

    // now parse overrides to defaults
    // console.log(`CL: at overrides ScopeDisplaySpec: ${lineParts}`);
    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1]; // lineParts[0] is '`SCOPE', lineParts[1] is the window name
      isValid = true; // invert default value
    }
    if (lineParts.length > 2) {
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];

        // Try to parse common keywords first
        const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, displaySpec);
        if (parsed) {
          index = index + consumed - 1; // Adjust for loop increment
        } else {
          switch (element.toUpperCase()) {
            case 'COLOR':
              // Parse COLOR directive: COLOR <background> {<grid-color>}
              const [colorParsed, colors, colorIndex] = DisplaySpecParser.parseColorKeyword(lineParts, index);
              if (colorParsed) {
                displaySpec.window.background = colors.background;
                if (colors.grid) {
                  displaySpec.window.grid = colors.grid;
                }
                index = colorIndex - 1; // Adjust for loop increment
              } else {
                // console.log(`CL: ScopeDisplaySpec: Invalid COLOR specification`);
                isValid = false;
              }
              break;

            case 'POS':
              // POS is not in the original scope parser but should be supported
              const [posParsed, pos] = DisplaySpecParser.parsePosKeyword(lineParts, index);
              if (posParsed) {
                displaySpec.position = pos;
                displaySpec.hasExplicitPosition = true; // POS clause found - use explicit position
                index += 2; // Skip x and y values
              } else {
                // console.log(`CL: ScopeDisplaySpec: Invalid POS specification`);
                isValid = false;
              }
              break;

            case 'RATE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.rate = Number(lineParts[++index]);
              } else {
                // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;

            case 'HIDEXY':
              displaySpec.hideXY = true;
              break;

            // ORIGINAL PARSING COMMENTED OUT - Using DisplaySpecParser instead
            /*
            case 'TITLE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.windowTitle = lineParts[++index];
              } else {
                // console.log() as we are in class static method, not derived class...
                // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'SIZE':
              // ensure we have two more values
              if (index < lineParts.length - 2) {
                displaySpec.size.width = Number(lineParts[++index]);
                displaySpec.size.height = Number(lineParts[++index]);
              } else {
                // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            */
            case 'SAMPLES':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.nbrSamples = Number(lineParts[++index]);
              } else {
                // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;

            default:
              // console.log(`CL: ScopeDisplaySpec: Unknown directive: ${element}`);
              break;
          }
        }
        if (!isValid) {
          break;
        }
      }
    }
    // console.log(`CL: at end of parseScopeDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`);
    return [isValid, displaySpec];
  }

  private createDebugWindow(): void {
    this.logMessage(`at createDebugWindow() SCOPE`);
    // Default channel creation has been moved to updateContent when first numeric data arrives

    // NOTES: Chip's size estimation:
    //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
    //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel

    const channelCanvases: string[] = [];
    let windowCanvasHeight: number = 0;
    let channelWidth: number = 0;
    if (this.channelSpecs.length > 0) {
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        const adjHeight = this.channelLineWidth / 2 + this.canvasMargin * 2 + channelSpec.ySize + 2 * this.channelInset; // inset is above and below
        // Pascal: vWidth comes from SIZE directive (KeySize sets vWidth)
        // Canvas width = margins + drawing area width
        channelWidth = this.canvasMargin * 2 + this.displaySpec.size.width;
        // create a canvas for each channel
        channelCanvases.push(`<canvas id="channel-${index}" width="${channelWidth}" height="${adjHeight}"></canvas>`);
        // account for channel height
        windowCanvasHeight += channelSpec.ySize + 2 * this.channelInset + this.channelLineWidth / 2;
      }
    } else {
      // error if NO channel
      this.logMessage(`at createDebugWindow() SCOPE with NO channels!`);
    }

    this.logMessage(`at createDebugWindow() SCOPE set up done... w/${channelCanvases.length} canvase(s)`);
    this.logMessage(`  -- Using SIZE directive: ${this.displaySpec.size.width}x${this.displaySpec.size.height}`);

    // Pascal: ClientHeight := vMarginTop + vHeight + vMarginBottom
    // SIZE directive values ARE the drawing area (like Pascal vHeight, vWidth)
    // We must ADD margins to get the total content area
    const channelLabelHeight = 13; // 13 pixels for channel labels 10pt + gap below

    // Calculate total content height:
    // - Container top margin (contentInset)
    // - Channel labels height
    // - Sum of all canvas heights (windowCanvasHeight already calculated above)
    // - Container bottom margin (contentInset)
    const contentHeight = 2 * this.contentInset + channelLabelHeight + windowCanvasHeight;
    const contentWidth = 2 * this.contentInset + channelWidth;

    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const windowHeight = windowDimensions.height;
    const windowWidth = windowDimensions.width;
    // Check if position was explicitly set with POS clause
    let windowX = this.displaySpec.position.x;
    let windowY = this.displaySpec.position.y;

    // If no POS clause was present, use WindowPlacer for intelligent positioning
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowWidth, height: windowHeight },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`scope-${this.displaySpec.displayName}`, placementConfig);
      windowX = position.x;
      windowY = position.y;
      this.logMessage(`  -- SCOPE using auto-placement: ${windowX},${windowY}`);

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) SCOPE '${this.displaySpec.displayName}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }

    this.logMessage(`  -- SCOPE window size: ${windowWidth}x${windowHeight} @${windowX},${windowY}`);

    // now generate the window with the calculated sizes
    const displayName: string = this.windowTitle;
    this.debugWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Register window with WindowPlacer for position tracking (only if using auto-placement)
    if (this.debugWindow && !this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`scope-${this.displaySpec.displayName}`, this.debugWindow);
    }

    // hook window events before being shown
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('* Scope window will show...');
      this.debugWindow?.show();
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Scope window shown');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Scope window title updated');
    });

    this.debugWindow.once('ready-to-show', () => {
      this.logMessage('at ready-to-show');
      // Register with WindowRouter when window is ready
      this.registerWithRouter();
      if (this.debugWindow) {
        // The following only works for linux/windows
        if (process.platform !== 'darwin') {
          try {
            //this.debugWindow.setMenu(null); // NO menu for this window  || NO WORKEE!
            this.debugWindow.removeMenu(); // Alternative to setMenu(null) with less side effects
            //this.debugWindow.setMenuBarVisibility(false); // Alternative to setMenu(null) with less side effects || NO WORKEE!
          } catch (error) {
            this.logMessage(`Failed to remove menu: ${error}`);
          }
        }
        this.debugWindow.show();
      }
    });

    // and load this window .html content
    const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8"></meta>
        <title>${displayName}</title>
        <style>
          @font-face {
            font-family: 'Parallax';
            src: url('${this.getParallaxFontUrl()}') format('truetype');
          }
          body {
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            font-family: 'Parallax', sans-serif;
            font-size: 12px;
            /* background-color: rgb(237, 142, 238); */
            background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
            position: relative;
          }
          #container {
            display: flex;
            flex-direction: column; /* Arrange children in a column */
            justify-content: flex-start;
            margin: ${this.contentInset}px ${this.contentInset}px;  /* vert horiz -OR- top right bottom left */
            padding: 0;
            background-color: ${this.displaySpec.window.background};
          }
          #labels {
            font-family: 'Parallax', sans-serif;
            font-style: italic;
            font-size: 10px;
            display: flex;
            flex-direction: row;   /* Arrange children horizontally side-by-side */
            justify-content: flex-start;  /* left edge grounded */
            align-items: center;  /* vertically centered */
            flex-grow: 0;
            gap: 10px; /* Create a 10px gap between items */
            height: ${channelLabelHeight}px;
            padding: 0px 0px 4px 0px;
            /* background-color: rgb(225, 232, 191); */
          }
          #labels > p {
            /* padding: top right bottom left; */
            padding: 0px;
            margin: 0px;
          }
          #channel-data {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0;
            /* background-color: rgb(55, 63, 170); */
          }
          #channels {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0;   /* top, right, bottom, left */
            padding: 0px;
            border-style: solid;
            border-width: 1px;
            border-color: ${this.displaySpec.window.grid}; */
            /* border-color: rgb(29, 230, 106); */
            background-color: rgb(164, 22, 22);
          }
          canvas {
            /* background-color: rgb(240, 194, 151); */
            background-color: ${this.displaySpec.window.background};
            margin: 0;
          }
          #trigger-status {
            position: absolute;
            top: 5px;
            right: 5px;
            padding: 5px 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 12px;
            font-family: Arial, sans-serif;
            border-radius: 3px;
            display: none !important; /* Always hidden - trigger logic still works internally */
            z-index: 100;
          }
          #trigger-status.armed {
            background-color: rgba(255, 165, 0, 0.8); /* Orange for armed */
          }
          #trigger-status.triggered {
            background-color: rgba(0, 255, 0, 0.8); /* Green for triggered */
          }
          .trigger-legend {
            position: absolute;
            right: 5px;
            font-size: 10px;
            font-family: Arial, sans-serif;
            color: white;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 2px 5px;
            border-radius: 2px;
            pointer-events: none;
          }
          @keyframes flash {
            0% { opacity: 0.8; }
            50% { opacity: 1; }
            100% { opacity: 0.8; }
          }
          #coordinate-display {
            position: absolute;
            padding: 2px 4px;
            background-color: ${this.displaySpec.window.background};
            color: ${this.displaySpec.window.grid};
            border: 1px solid ${this.displaySpec.window.grid};
            font-family: 'Parallax', monospace;
            font-size: 11px;
            font-style: normal;
            pointer-events: none;
            display: none;
            z-index: 20;
            white-space: nowrap;
          }
          #crosshair-horizontal, #crosshair-vertical {
            position: absolute;
            background-color: ${this.displaySpec.window.grid};
            opacity: 0.5;
            pointer-events: none;
            display: none;
            z-index: 15;
          }
          #crosshair-horizontal {
            height: 1px;
            width: 100%;
            left: 0;
          }
          #crosshair-vertical {
            width: 1px;
            height: 100%;
            top: 0;
          }
        </style>
      </head>
      <body>
        <div id="trigger-status">READY</div>
        <div id="coordinate-display"></div>
        <div id="crosshair-horizontal"></div>
        <div id="crosshair-vertical"></div>
        <div id="container">
          <div id="labels" width="${channelWidth}" height="${channelLabelHeight}">
          </div>
          <div id="channel-data">
            <div id="channels">${channelCanvases.join(' ')}</div>
          </div>
      </div>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() SCOPE with htmlContent length: ${htmlContent.length}`);

    try {
      this.debugWindow.setMenu(null);
      this.debugWindow.setTitle(this.windowTitle);
      this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(htmlContent)}`);
    } catch (error) {
      this.logMessage(`Failed to load URL: ${error}`);
    }

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logMessage('at did-finish-load');

      // Mark window as ready to process queued messages
      this.onWindowReady();

      // Only update channel labels if we have channels defined
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        this.updateScopeChannelLabel(channelSpec.name, channelSpec.color);
        const channelGridColor: string = channelSpec.gridColor;
        const channelTextColor: string = channelSpec.textColor;
        const windowGridColor: string = this.displaySpec.window.grid;
        const canvasName = `channel-${index}`;
        // paint the grid/min/max, etc.
        //  %abcd where a=enable max legend, b=min legend, c=max line, d=min line
        if (channelSpec.lgndShowMax && !channelSpec.lgndShowMaxLine) {
          //  %1x0x => max legend, NOT max line, so value ONLY
          this.drawHorizontalValue(canvasName, channelSpec, channelSpec.maxValue, channelTextColor);
        }
        if (channelSpec.lgndShowMin && !channelSpec.lgndShowMinLine) {
          //  %x1x0 => min legend, NOT min line, so value ONLY
          this.drawHorizontalValue(canvasName, channelSpec, channelSpec.minValue, channelTextColor);
        }
        if (channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
          //  %1x1x => max legend, max line, so show value and line!
          this.drawHorizontalLineAndValue(
            canvasName,
            channelSpec,
            channelSpec.maxValue,
            channelGridColor,
            channelTextColor
          );
        }
        if (channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
          //  %x1x1 => min legend, min line, so show value and line!
          this.drawHorizontalLineAndValue(
            canvasName,
            channelSpec,
            channelSpec.minValue,
            channelGridColor,
            channelTextColor
          );
        }
        if (!channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
          //  %0x1x => NOT max legend, max line, show line ONLY
          this.drawHorizontalLine(canvasName, channelSpec, channelSpec.maxValue, channelGridColor);
        }
        if (!channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
          //  %x0x1 => NOT min legend, min line, show line ONLY
          this.drawHorizontalLine(canvasName, channelSpec, channelSpec.minValue, channelGridColor);
        }
      }
      // Draw trigger levels if enabled
      this.drawTriggerLevels();
    });
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() SCOPE`);
    // let our base class do the work
    this.debugWindow = null;
  }

  /**
   * Override: Clear all channel data (called by base class CLEAR command)
   */
  protected clearDisplayContent(): void {
    this.clearChannelData();
  }

  /**
   * Override: Force display update (called by base class UPDATE command)
   * SCOPE updates automatically when new data arrives, so this is a no-op
   */
  protected forceDisplayUpdate(): void {
    // SCOPE display updates automatically on data arrival
    // No explicit refresh needed
  }

  protected processMessageImmediate(lineParts: string[]): void {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // Window name already stripped by mainWindow routing
    // Valid directives are:
    this.logMessage(`at updateContent() with lineParts=[${lineParts.join(', ')}]`);

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    if (await this.handleCommonCommand(lineParts)) {
      // Base class handled the command, we're done
      return;
    }
    // --- these create a new channel spec
    //   '{NAME}' {min {max {y-size {y-base {legend} {color}}}}}
    //   '{NAME}' AUTO {y-size {y-base {legend} {color}}}
    // --- these update the trigger spec
    //   TRIGGER <channel|-1> {arm-level {trigger-level {offset}}}
    //   HOLDOFF <2-2048>
    // --- these manage the window
    //   CLEAR
    //   CLOSE
    //   SAVE {WINDOW} 'filename' // save window to .bmp file
    // --- these paints new samples
    //   <numeric data> // data applied to channels in ascending order
    //this.logMessage(`at updateContent(${lineParts.join(' ')})`);
    // ON first numeric data, create the window! then do update
    if (lineParts.length >= 1) {
      // have data, parse it
      if (lineParts[0].charAt(0) == "'") {
        // parse channel spec
        let channelSpec: ScopeChannelSpec = {} as ScopeChannelSpec;
        channelSpec.name = lineParts[0].slice(1, -1);
        // Set defaults for all channel properties
        channelSpec.minValue = 0;
        channelSpec.maxValue = 255;
        // Pascal: vTall[i] := vHeight (SIZE directive IS the drawing area height)
        channelSpec.ySize = this.displaySpec.size.height;
        channelSpec.yBaseOffset = 0;
        channelSpec.lgndShowMax = true;
        channelSpec.lgndShowMin = true;
        channelSpec.lgndShowMaxLine = true;
        channelSpec.lgndShowMinLine = true;
        let colorName = 'LIME'; // vs. green
        let colorBrightness = 15;
        if (lineParts.length > 1 && lineParts[1].toUpperCase().startsWith('AUTO')) {
          // parse AUTO spec - set trigger auto mode for this channel
          //   '{NAME1}' AUTO2 {y-size3 {y-base4 {legend5} {color6 {bright7}}}} // legend is %abcd
          // Auto means we should use auto trigger for this channel
          this.triggerSpec.trigAuto = true;
          this.triggerSpec.trigChannel = this.channelSpecs.length; // Current channel being added
          // AUTO channels default to 0-255 range
          channelSpec.minValue = 0;
          channelSpec.maxValue = 255;
          if (lineParts.length > 2) {
            channelSpec.ySize = Number(lineParts[2]);
          }
          if (lineParts.length > 3) {
            channelSpec.yBaseOffset = Number(lineParts[3]);
          }
          if (lineParts.length > 4) {
            // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
            const legend: string = lineParts[4];
            this.parseLegend(legend, channelSpec);
          }
          if (lineParts.length > 5) {
            colorName = lineParts[5];
          }
          if (lineParts.length > 6) {
            colorBrightness = Number(lineParts[6]);
          }
        } else {
          // parse manual spec
          //   '{NAME1}' {min2 {max3 {y-size4 {y-base5 {legend6} {color7 {bright8}}}}}}  // legend is %abcd
          let isNumber: boolean = false;
          let parsedValue: number = 0;
          if (lineParts.length > 1) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[1]);
            if (isNumber) {
              channelSpec.minValue = parsedValue;
            }
          }
          if (lineParts.length > 2) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[2]);
            if (isNumber) {
              channelSpec.maxValue = parsedValue;
            }
          }
          if (lineParts.length > 3) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[3]);
            if (isNumber) {
              channelSpec.ySize = parsedValue;
            }
          }
          if (lineParts.length > 4) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[4]);
            if (isNumber) {
              channelSpec.yBaseOffset = parsedValue;
            }
          }
          if (lineParts.length > 5) {
            // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
            const legend: string = lineParts[5];
            this.parseLegend(legend, channelSpec);
          }
          if (lineParts.length > 6) {
            colorName = lineParts[6];
          }
          if (lineParts.length > 7) {
            colorBrightness = Number(lineParts[7]);
          }
        }
        const channelColor = new DebugColor(colorName, colorBrightness);
        channelSpec.color = channelColor.rgbString;
        channelSpec.gridColor = channelColor.gridRgbString;
        channelSpec.textColor = channelColor.fontRgbString;
        // and record spec for this channel
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with channelSpec: ${JSON.stringify(channelSpec, null, 2)}`);
        this.channelSpecs.push(channelSpec);

        // If window is already created, we need to add a corresponding channelSample
        if (this.windowCreated && this.channelSamples.length < this.channelSpecs.length) {
          this.channelSamples.push({ samples: [] });
          this.logMessage(
            `at updateContent() added channelSample for new channel, now have ${this.channelSamples.length} samples`
          );
        }
      } else if (lineParts[0].toUpperCase() == 'TRIGGER') {
        // parse trigger spec update
        //   TRIGGER1 <channel|-1>2 {arm-level3 {trigger-level4 {offset5}}}
        //   TRIGGER1 <channel|-1>2 {HOLDOFF3 <2-2048>4}
        //  arm-level (?-1)
        //  trigger-level (trigFire? 0)
        //  trigger offset (0) samples / 2
        // Holdoff (2-2048) samples

        // Reset trigger state when new TRIGGER command arrives (re-arm)
        this.triggerArmed = false;
        this.triggerFired = false;
        this.holdoffCounter = 0;
        this.triggerSampleIndex = -1;
        this.triggerProcessor.resetTrigger();

        this.triggerSpec.trigEnabled = true;
        // Update trigger status when first enabled (if window exists)
        if (this.windowCreated && this.debugWindow) {
          this.updateTriggerStatus();
        }
        // Default to AUTO mode unless explicit levels are provided
        let hasExplicitLevels = false;
        if (lineParts.length > 1) {
          const desiredChannel: number = Number(lineParts[1]);
          if (desiredChannel >= -1 && desiredChannel < this.channelSpecs.length) {
            this.triggerSpec.trigChannel = desiredChannel;
          } else {
            this.logMessage(`at updateContent() with invalid channel: ${desiredChannel} in [${lineParts.join(' ')}]`);
          }
          if (lineParts.length > 2) {
            if (lineParts[2].toUpperCase() == 'HOLDOFF') {
              if (lineParts.length >= 4) {
                const [isNumber, trigHoldoff] = this.isSpinNumber(lineParts[3]);
                if (isNumber) {
                  this.triggerSpec.trigHoldoff = trigHoldoff;
                }
              }
              // No explicit levels, will default to AUTO
            } else if (lineParts[2].toUpperCase() == 'AUTO') {
              this.triggerSpec.trigAuto = true;
              hasExplicitLevels = true;
              if (this.triggerSpec.trigChannel >= 0 && this.triggerSpec.trigChannel < this.channelSpecs.length) {
                const channelSpec = this.channelSpecs[this.triggerSpec.trigChannel];
                // arm range is 33% of max-min: (high - low) / 3 + low
                const newArmLevel = (channelSpec.maxValue - channelSpec.minValue) / 3 + channelSpec.minValue;
                this.triggerSpec.trigArmLevel = newArmLevel;
                // trigger level is 50% of max-min: (high - low) / 2 + low
                const newTrigLevel = (channelSpec.maxValue - channelSpec.minValue) / 2 + channelSpec.minValue;
                this.triggerSpec.trigLevel = newTrigLevel;
              }
            } else {
              let [isNumber, parsedValue] = this.isSpinNumber(lineParts[2]);
              if (isNumber) {
                this.triggerSpec.trigArmLevel = parsedValue;
                hasExplicitLevels = true;
              }
              this.triggerSpec.trigAuto = false;
              if (lineParts.length > 3) {
                [isNumber, parsedValue] = this.isSpinNumber(lineParts[3]);
                if (isNumber) {
                  this.triggerSpec.trigLevel = parsedValue;
                }
              }
              if (lineParts.length > 4) {
                [isNumber, parsedValue] = this.isSpinNumber(lineParts[4]);
                if (isNumber) {
                  this.triggerSpec.trigRtOffset = parsedValue;
                }
              }
            }
          }
        }
        // If no explicit levels provided, default to AUTO mode
        if (!hasExplicitLevels) {
          this.triggerSpec.trigAuto = true;
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[0].toUpperCase() == 'HOLDOFF') {
        // parse trigger spec update
        //   HOLDOFF1 <2-2048>2
        if (lineParts.length > 1) {
          const [isNumber, parsedValue] = this.isSpinNumber(lineParts[1]);
          if (isNumber) {
            this.triggerSpec.trigHoldoff = parsedValue;
          }
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[0].toUpperCase() == 'LINE') {
        // CLEAR, CLOSE, SAVE, PC_KEY, PC_MOUSE now handled by base class
        // Update line width
        if (lineParts.length > 2) {
          const lineSize = Number(lineParts[0]);
          if (!isNaN(lineSize) && lineSize >= 0 && lineSize <= 32) {
            this.displaySpec.lineSize = lineSize;
          }
        }
      } else if (lineParts[0].toUpperCase() == 'DOT') {
        // Update dot size
        if (lineParts.length > 2) {
          const dotSize = Number(lineParts[0]);
          if (!isNaN(dotSize) && dotSize >= 0 && dotSize <= 32) {
            this.displaySpec.dotSize = dotSize;
          }
        }
      } else {
        // do we have packed data spec?
        // ORIGINAL CODE COMMENTED OUT - Using PackedDataProcessor instead
        // const [isPackedData, newMode] = this.isPackedDataMode(lineParts[0]);
        // if (isPackedData) {
        //   // remember the new mode so we can unpack the data correctly
        //   this.packedMode = newMode;
        //   // now look for ALT and SIGNED keywords which may follow
        //   if (lineParts.length > 2) {
        //     const nextKeyword = lineParts[0].toUpperCase();
        //     if (nextKeyword == 'ALT') {
        //       this.packedMode.isAlternate = true;
        //       if (lineParts.length > 3) {
        //         const nextKeyword = lineParts[0].toUpperCase();
        //         if (nextKeyword == 'SIGNED') {
        //           this.packedMode.isSigned = true;
        //         }
        //       }
        //     } else if (nextKeyword == 'SIGNED') {
        //       this.packedMode.isSigned = true;
        //     }
        //   }

        // Check if current word is a packed data mode
        const [isPackedData, _] = PackedDataProcessor.validatePackedMode(lineParts[0]);
        if (isPackedData) {
          // Collect packed mode and any following keywords
          const keywords: string[] = [];
          let index = 1;

          // Add the mode
          keywords.push(lineParts[index]);
          index++;

          // Look for ALT and SIGNED keywords
          while (index < lineParts.length) {
            const keyword = lineParts[index].toUpperCase();
            if (keyword === 'ALT' || keyword === 'SIGNED') {
              keywords.push(keyword);
              index++;
            } else {
              break;
            }
          }

          // Parse all keywords together
          this.packedMode = PackedDataProcessor.parsePackedModeKeywords(keywords);
        } else {
          // do we have number?
          this.logMessage(`at updateContent() with numeric data: [${lineParts}](${lineParts.length})`);
          const [isValidNumber] = this.isSpinNumber(lineParts[0]);
          if (isValidNumber) {
            if (this.isFirstNumericData) {
              this.isFirstNumericData = false;
              // Create default channel if none exist
              if (this.channelSpecs.length == 0) {
                const defaultColor: DebugColor = new DebugColor('GREEN', 15);
                // Pascal: vTall[i] := vHeight (SIZE directive IS the drawing area height)
                this.channelSpecs.push({
                  name: 'Channel 0',
                  color: defaultColor.rgbString,
                  gridColor: defaultColor.gridRgbString,
                  textColor: defaultColor.fontRgbString,
                  minValue: 0,
                  maxValue: 255,
                  ySize: this.displaySpec.size.height,
                  yBaseOffset: 0,
                  lgndShowMax: true,
                  lgndShowMin: true,
                  lgndShowMaxLine: true,
                  lgndShowMinLine: true
                });
              }
              this.calculateAutoTriggerAndScale();
              this.initChannelSamples();

              // NOW create the window with all channel specifications known
              if (!this.windowCreated) {
                this.createDebugWindow();
                this.windowCreated = true;
              }
            }
            let scopeSamples: number[] = [];
            // WindowRouter strips display name before routing, so lineParts contains just the data
            // Start from index 0 to capture all sample values
            // Multi-channel data arrives as "value1 , value2" so filter out commas and empty strings
            for (let index = 0; index < lineParts.length; index++) {
              const part = lineParts[index].trim();
              // Skip commas and empty strings (multi-channel data separator)
              if (part === ',' || part === '') {
                continue;
              }
              // spin2 output has underscores for commas in numbers, so remove them
              const [isValidNumber, sampleValue] = this.isSpinNumber(part);
              if (isValidNumber) {
                scopeSamples.push(sampleValue);
              } else {
                this.logMessage(
                  `* UPD-ERROR invalid numeric data: lineParts[${index}]=${lineParts[index]} of [${lineParts.join(
                    ' '
                  )}]`
                );
              }
            }

            // FIXME: add packed data mode unpacking here
            // Handle packed data unpacking if packed mode is configured
            if (this.packedMode.mode !== ePackedDataMode.PDM_UNKNOWN) {
              // We have packed data mode - unpack all samples
              const unpackedSamples: number[] = [];
              for (const packedValue of scopeSamples) {
                const samples = PackedDataProcessor.unpackSamples(packedValue, this.packedMode);
                unpackedSamples.push(...samples);
              }
              scopeSamples = unpackedSamples;
              this.logMessage(
                `* UPD-INFO unpacked ${scopeSamples.length} samples from packed data mode: ${JSON.stringify(
                  this.packedMode
                )}`
              );
            }

            // parse numeric data
            let didScroll: boolean = false; // in case we need this for performance of window update
            const numberChannels: number = this.channelSpecs.length;
            const nbrSamples = scopeSamples.length;
            this.logMessage(
              `* UPD-INFO channels=${numberChannels}, samples=${nbrSamples}, samples=[${scopeSamples.join(',')}]`
            );
            if (nbrSamples == numberChannels) {
              // ═══════════════════════════════════════════════════════════════
              // STEP 1: RECORD ALL SAMPLES IMMEDIATELY
              // No trigger logic, no UI updates - just add to buffers
              // Matches original Pascal: didScroll based on buffer shift, not trigger
              // ═══════════════════════════════════════════════════════════════
              const clampedSamples: number[] = []; // Store clamped samples for trigger evaluation
              let bufferShifted = false; // Track if ANY buffer shifted (original behavior)

              for (let chanIdx = 0; chanIdx < nbrSamples; chanIdx++) {
                let nextSample: number = Number(scopeSamples[chanIdx]);

                // Clamp sample to channel's min/max
                const channelSpec = this.channelSpecs[chanIdx];
                if (nextSample < channelSpec.minValue) {
                  nextSample = channelSpec.minValue;
                  this.logMessage(`* UPD-WARNING sample below min: ${nextSample} of [${lineParts.join(',')}]`);
                } else if (nextSample > channelSpec.maxValue) {
                  nextSample = channelSpec.maxValue;
                  this.logMessage(`* UPD-WARNING sample above max: ${nextSample} of [${lineParts.join(',')}]`);
                }

                // Store clamped sample for later trigger evaluation
                clampedSamples[chanIdx] = nextSample;

                // Add sample to buffer - returns true if buffer was full and shifted
                const shifted = this.addSampleToBuffer(chanIdx, nextSample);
                if (shifted) {
                  bufferShifted = true; // Original Pascal: didScroll means "buffer scrolled"
                }
                this.logMessage(
                  `* UPD-INFO recorded sample ${nextSample} for channel ${chanIdx}, channelSamples[${chanIdx}].samples.length=${this.channelSamples[chanIdx].samples.length}`
                );
              }

              // Set didScroll based on buffer state (original behavior)
              didScroll = bufferShifted;

              // DIAGNOSTIC: Check if channel buffers are synchronized (they should always be the same length)
              if (this.channelSamples.length === 2) {
                const len0 = this.channelSamples[0].samples.length;
                const len1 = this.channelSamples[1].samples.length;
                if (len0 !== len1) {
                  this.logMessage(
                    `*** BUFFER DESYNC: ch0=${len0}, ch1=${len1}, diff=${len0 - len1}, maxSamples=${
                      this.displaySpec.nbrSamples
                    }`
                  );
                }
              }

              // ═══════════════════════════════════════════════════════════════
              // STEP 2: EVALUATE TRIGGER (once per sample-set)
              // Only evaluates on trigger channel, no buffer modification
              // Use the CLAMPED sample value, not the raw one
              // ═══════════════════════════════════════════════════════════════
              // DIAGNOSTIC: Log trigger condition evaluation
              this.logMessage(
                `*** TRIGGER EVAL: trigEnabled=${this.triggerSpec.trigEnabled}, trigChannel=${this.triggerSpec.trigChannel}, nbrSamples=${nbrSamples}`
              );
              this.logMessage(
                `*** TRIGGER COND: enabled=${this.triggerSpec.trigEnabled}, ch>=0=${
                  this.triggerSpec.trigChannel >= 0
                }, ch<samples=${this.triggerSpec.trigChannel < nbrSamples}`
              );
              this.logMessage(
                `*** TRIGGER RESULT: condition=${
                  this.triggerSpec.trigEnabled &&
                  this.triggerSpec.trigChannel >= 0 &&
                  this.triggerSpec.trigChannel < nbrSamples
                }`
              );

              if (
                this.triggerSpec.trigEnabled &&
                this.triggerSpec.trigChannel >= 0 &&
                this.triggerSpec.trigChannel < nbrSamples
              ) {
                // Pascal line 1288: if SamplePop <> vSamples then Continue;
                // CRITICAL: Buffer must be completely full before trigger evaluation starts
                const triggerChannelBuffer = this.channelSamples[this.triggerSpec.trigChannel];
                const bufferIsFull = triggerChannelBuffer.samples.length >= this.displaySpec.nbrSamples;
                this.logMessage(
                  `*** TRIGGER: Buffer check - length=${triggerChannelBuffer.samples.length}, required=${this.displaySpec.nbrSamples}, full=${bufferIsFull}`
                );

                if (!bufferIsFull) {
                  // Buffer not full - skip trigger evaluation entirely (Pascal: Continue)
                  this.logMessage(
                    `*** TRIGGER: BUFFER NOT FULL - skipping trigger evaluation, using buffer-based didScroll=${bufferShifted}`
                  );
                  didScroll = bufferShifted; // Use buffer-based scrolling until buffer fills
                } else {
                  // Buffer full - proceed with trigger evaluation
                  // Pascal: t := Y_SampleBuff[((SamplePtr - vTriggerOffset - 1) and Y_PtrMask) * Y_SetSize + vTriggerChannel];
                  // Get sample from buffer at trigger offset position (NOT the newest sample!)
                  const bufferLength = triggerChannelBuffer.samples.length;
                  const triggerSampleIndex = bufferLength - this.triggerSpec.trigRtOffset - 1;
                  const triggerSample = triggerChannelBuffer.samples[triggerSampleIndex];

                  this.logMessage(
                    `*** TRIGGER: Buffer position - length=${bufferLength}, offset=${this.triggerSpec.trigRtOffset}, sampleIndex=${triggerSampleIndex}, sample=${triggerSample}`
                  );
                  this.logMessage(
                    `*** TRIGGER: CALLING evaluateTrigger() with channel=${this.triggerSpec.trigChannel}, sample=${triggerSample}`
                  );
                  didScroll = this.evaluateTrigger(this.triggerSpec.trigChannel, triggerSample);
                  this.logMessage(`*** TRIGGER: evaluateTrigger() returned didScroll=${didScroll}`);
                }
              } else {
                // No trigger enabled - Pascal line 1332: else if RateCycle then SCOPE_Draw;
                // When trigger disabled, always draw (rate limiting happens elsewhere)
                this.logMessage(`*** TRIGGER: ELSE BRANCH - no trigger, setting didScroll=true (continuous draw)`);
                didScroll = true;
              }

              // ═══════════════════════════════════════════════════════════════
              // STEP 3: UPDATE DISPLAY (if trigger conditions met)
              // Pascal: SCOPE_Draw is called ONCE per sample-set, ONLY when trigger conditions met
              // ═══════════════════════════════════════════════════════════════
              if (didScroll) {
                // Update ALL channels' display now that we have a complete sample set
                for (let chanIdx = 0; chanIdx < nbrSamples; chanIdx++) {
                  const canvasName = `channel-${chanIdx}`;
                  const channelSpec = this.channelSpecs[chanIdx];
                  if (this.channelSamples[chanIdx]) {
                    this.updateScopeChannelData(
                      canvasName,
                      channelSpec,
                      this.channelSamples[chanIdx].samples,
                      didScroll
                    );
                  } else {
                    this.logMessage(`* UPD-ERROR channel samples not initialized for channel ${chanIdx}`);
                  }
                }
              }
            } else {
              this.logMessage(
                `* UPD-ERROR wrong nbr of samples: #${numberChannels} channels, #${nbrSamples} samples of [${lineParts.join(
                  ','
                )}]`
              );
            }
          } else {
            this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[0]} of [${lineParts.join(' ')}]`);
          }
        }
      }
    }
  }

  private calculateAutoTriggerAndScale() {
    this.logMessage(`at calculateAutoTriggerAndScale()`);

    // Pascal line 1022/1202: vTriggerOffset := vSamples div 2;
    // Set default trigger offset to center of display (half the samples)
    if (this.triggerSpec.trigRtOffset === 0) {
      this.triggerSpec.trigRtOffset = Math.floor(this.displaySpec.nbrSamples / 2);
      this.logMessage(`  Set default trigger offset to center: ${this.triggerSpec.trigRtOffset}`);
    }

    if (
      this.triggerSpec.trigAuto &&
      this.triggerSpec.trigChannel >= 0 &&
      this.triggerSpec.trigChannel < this.channelSpecs.length
    ) {
      // Get the channel spec for the trigger channel
      const channelSpec = this.channelSpecs[this.triggerSpec.trigChannel];

      // Calculate arm level at 33% from bottom
      const range = channelSpec.maxValue - channelSpec.minValue;
      this.triggerSpec.trigArmLevel = range / 3 + channelSpec.minValue;

      // Calculate trigger level at 50% (center)
      this.triggerSpec.trigLevel = range / 2 + channelSpec.minValue;

      this.logMessage(`Auto-trigger calculated for channel ${this.triggerSpec.trigChannel}:`);
      this.logMessage(`  Range: ${channelSpec.minValue} to ${channelSpec.maxValue}`);
      this.logMessage(`  Arm level (33%): ${this.triggerSpec.trigArmLevel}`);
      this.logMessage(`  Trigger level (50%): ${this.triggerSpec.trigLevel}`);
    }
  }

  private initChannelSamples() {
    this.logMessage(`at initChannelSamples()`);
    // clear the channel data
    this.channelSamples = [];
    if (this.channelSpecs.length == 0) {
      this.channelSamples.push({ samples: [] });
    } else {
      for (let index = 0; index < this.channelSpecs.length; index++) {
        this.channelSamples.push({ samples: [] });
      }
    }
    this.logMessage(`  -- [${JSON.stringify(this.channelSamples, null, 2)}]`);
  }

  private clearChannelData() {
    this.logMessage(`at clearChannelData()`);
    // Ensure channelSamples array matches channelSpecs
    if (this.channelSamples.length !== this.channelSpecs.length) {
      this.channelSamples = [];
      for (let i = 0; i < this.channelSpecs.length; i++) {
        this.channelSamples.push({ samples: [] });
      }
    } else {
      // Clear existing samples
      for (let index = 0; index < this.channelSamples.length; index++) {
        const channelSamples = this.channelSamples[index];
        // clear the channel data
        channelSamples.samples = [];
      }
    }
  }

  /**
   * Add sample to buffer - simple, unconditional recording
   * No trigger logic, no UI updates, just add to circular buffer
   * Returns true if buffer was full and shifted (matches original Pascal behavior where didScroll meant "buffer scrolled")
   */
  private addSampleToBuffer(channelIndex: number, sample: number): boolean {
    const channelSamples = this.channelSamples[channelIndex];
    const beforeLength = channelSamples.samples.length;
    const maxSamples = this.displaySpec.nbrSamples;
    let bufferShifted = false;

    // If buffer is full, remove oldest sample (shift left)
    if (channelSamples.samples.length >= maxSamples) {
      channelSamples.samples.shift();
      bufferShifted = true; // Original meaning: buffer scrolled/shifted
    }

    // Add new sample to end (newest)
    channelSamples.samples.push(sample);

    const afterLength = channelSamples.samples.length;
    this.logMessage(
      `*** BUFFER ADD ch${channelIndex}: before=${beforeLength}, max=${maxSamples}, after=${afterLength}, sample=${sample}, shifted=${bufferShifted}`
    );

    return bufferShifted;
  }

  /**
   * Evaluate trigger conditions on trigger channel
   * Returns true if display should update (trigger fired and holdoff expired)
   */
  private evaluateTrigger(channelIndex: number, sample: number): boolean {
    this.logMessage(
      `>>> evaluateTrigger ENTRY: channel=${channelIndex}, sample=${sample}, armed=${this.triggerArmed}, holdoff=${this.holdoffCounter}`
    );
    let didScroll = false;

    // Pascal line 1285: vTriggered := False; (reset at start of EACH sample evaluation)
    let vTriggered = false;

    // Pascal lines 1295-1324: Inline trigger evaluation
    const t = sample;
    const armLevel = this.triggerSpec.trigArmLevel;
    const fireLevel = this.triggerSpec.trigLevel;
    const isPositiveSlope = fireLevel >= armLevel;

    if (this.triggerArmed) {
      // Already armed - check if we should fire
      if (isPositiveSlope) {
        // Positive slope: fire when sample >= fireLevel
        if (t >= fireLevel) {
          vTriggered = true;
          this.triggerArmed = false;
          this.logMessage(`>>> TRIGGER FIRED (positive): sample=${t} >= fireLevel=${fireLevel}`);
        }
      } else {
        // Negative slope: fire when sample <= fireLevel
        if (t <= fireLevel) {
          vTriggered = true;
          this.triggerArmed = false;
          this.logMessage(`>>> TRIGGER FIRED (negative): sample=${t} <= fireLevel=${fireLevel}`);
        }
      }
    } else {
      // Not armed - check if we should arm
      if (isPositiveSlope) {
        // Positive slope: arm when sample <= armLevel
        if (t <= armLevel) {
          this.triggerArmed = true;
          this.logMessage(`>>> TRIGGER ARMED (positive): sample=${t} <= armLevel=${armLevel}`);
        }
      } else {
        // Negative slope: arm when sample >= armLevel
        if (t >= armLevel) {
          this.triggerArmed = true;
          this.logMessage(`>>> TRIGGER ARMED (negative): sample=${t} >= armLevel=${armLevel}`);
        }
      }
    }

    // Pascal line 1326: if vHoldOffCount > 0 then Dec(vHoldOffCount);
    if (this.holdoffCounter > 0) {
      this.holdoffCounter--;
      this.logMessage(`>>> HOLDOFF decrement: ${this.holdoffCounter + 1} -> ${this.holdoffCounter}`);
    }

    // Pascal line 1327: if not vTriggered or (vHoldOffCount > 0) then Continue;
    // Skip drawing if didn't trigger OR holdoff active
    if (!vTriggered || this.holdoffCounter > 0) {
      this.logMessage(`>>> SKIP UPDATE: triggered=${vTriggered}, holdoff=${this.holdoffCounter}`);
      return false; // Continue (skip draw)
    }

    // Pascal line 1328: vHoldOffCount := vHoldOff;
    // Reached here: triggered AND holdoff expired - reset holdoff and draw
    this.holdoffCounter = this.triggerSpec.trigHoldoff;
    didScroll = true;
    this.logMessage(`>>> ALLOW UPDATE: Reset holdoff to ${this.holdoffCounter}, didScroll=true`);

    return didScroll;
  }

  private parseLegend(legend: string, channelSpec: ScopeChannelSpec): void {
    // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
    let validLegend: boolean = false;
    if (legend.length > 4 && legend.charAt(0) == '%') {
      channelSpec.lgndShowMax = legend.charAt(1) == '1' ? true : false;
      channelSpec.lgndShowMin = legend.charAt(2) == '1' ? true : false;
      channelSpec.lgndShowMaxLine = legend.charAt(3) == '1' ? true : false;
      channelSpec.lgndShowMinLine = legend.charAt(4) == '1' ? true : false;
      validLegend = true;
    } else if (legend.charAt(0) >= '0' && legend.charAt(0) <= '9') {
      // get integer value of legend and ensure it is within range 0-15
      const legendValue = Number(legend);
      if (legendValue >= 0 && legendValue <= 15) {
        channelSpec.lgndShowMax = (legendValue & 0x1) == 0x1 ? true : false;
        channelSpec.lgndShowMin = (legendValue & 0x2) == 0x2 ? true : false;
        channelSpec.lgndShowMaxLine = (legendValue & 0x4) == 0x4 ? true : false;
        channelSpec.lgndShowMinLine = (legendValue & 0x8) == 0x8 ? true : false;
        validLegend = true;
      }
    }
    if (!validLegend) {
      this.logMessage(`at parseLegend() with invalid legend: ${legend}`);
      channelSpec.lgndShowMax = false;
      channelSpec.lgndShowMin = false;
      channelSpec.lgndShowMaxLine = false;
      channelSpec.lgndShowMinLine = false;
    }
  }

  /**
   * Update scope channel display using Pascal's clear-and-redraw approach
   * This approach is required for triggering support - we draw from the circular buffer
   * at calculated positions instead of scrolling pixels
   */
  private updateScopeChannelData(
    canvasName: string,
    channelSpec: ScopeChannelSpec,
    samples: number[],
    didScroll: boolean
  ): void {
    if (this.debugWindow) {
      if (--this.dbgLogMessageCount > 0) {
        this.logMessage(
          `at updateScopeChannelData(${canvasName}, w/#${samples.length}) sample(s), didScroll=(${didScroll})`
        );
      }
      try {
        // Draw region dimensions
        // Pascal: drawWidth comes from SIZE directive (vWidth), not calculated from samples
        const drawWidth: number = this.displaySpec.size.width;
        const drawHeight: number = channelSpec.ySize + this.channelLineWidth / 2;
        const drawXOffset: number = this.canvasMargin;
        const drawYOffset: number = this.channelInset + this.canvasMargin;
        const channelColor: string = channelSpec.color;

        // Pascal approach: Clear ENTIRE canvas, redraw graticule, then redraw all samples
        let jsCode = '';

        // 1. Clear the ENTIRE canvas (fillRect with background color)
        jsCode += `
          const canvas = document.getElementById('${canvasName}');
          if (!canvas) { console.error('Canvas not found'); return; }
          const ctx = canvas.getContext('2d');
          if (!ctx) { console.error('Context not available'); return; }

          // Clear entire canvas with background color (including graticule area)
          ctx.fillStyle = '${this.displaySpec.window.background}';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        `;

        // 2. Redraw graticule (grid lines and labels)
        jsCode += this.redrawGraticule(channelSpec);

        // 2b. Draw trigger indicator if triggered (Pascal: drawn in ClearBitmap when vTriggered is true)
        if (this.triggerFired && this.triggerSpec.trigEnabled) {
          jsCode += this.generateTriggerIndicatorJS(canvasName, channelSpec);
        }

        // 3. Draw all samples from buffer at calculated positions (Pascal algorithm)
        // Pascal: x := (vMarginLeft + vWidth - 1) shl 8 - Round(k / vSamples * vWidth * $100);
        // We draw from newest (index 0) to oldest, with newest at the right edge
        jsCode += `
          // Draw all samples from circular buffer
          ctx.strokeStyle = '${channelColor}';
          ctx.lineWidth = ${this.channelLineWidth};
          ctx.setLineDash([]); // Solid line
          ctx.beginPath();
        `;

        let firstSample = true;
        for (let k = 0; k < samples.length; k++) {
          const sample = samples[k];
          const invertedY = this.scaleAndInvertValue(sample, channelSpec);

          // Calculate X position: samples[0] is oldest (left), samples[length-1] is newest (right)
          // Array structure: shift() removes oldest from front, push() adds newest to end
          const normalizedPos = k / (this.displaySpec.nbrSamples - 1);
          const x = drawXOffset + Math.round(normalizedPos * (drawWidth - this.channelLineWidth));
          const y = drawYOffset + invertedY + this.channelLineWidth / 2;

          if (firstSample) {
            jsCode += `ctx.moveTo(${x}, ${y});\n`;
            firstSample = false;
          } else {
            jsCode += `ctx.lineTo(${x}, ${y});\n`;
          }
        }

        jsCode += `ctx.stroke();\n`;

        // Execute all the JavaScript at once
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`).catch((error) => {
          this.logMessage(`Failed to execute channel data JavaScript: ${error}`);
        });
      } catch (error) {
        console.error('Failed to update channel data:', error);
      }
    }
  }

  private updateScopeChannelLabel(name: string, colorString: string): void {
    if (this.debugWindow) {
      this.logMessage(`at updateScopeChannelLabel(${name}, ${colorString})`);
      try {
        const channelLabel: string = `<p style="color: ${colorString};">${name}</p>`;
        this.debugWindow.webContents
          .executeJavaScript(
            `
          (function() {
            const labelsDivision = document.getElementById('labels');
            if (labelsDivision) {
              let labelContent = labelsDivision.innerHTML;
              labelContent += \'${channelLabel}\';
              labelsDivision.innerHTML = labelContent;
            }
          })();
        `
          )
          .catch((error) => {
            this.logMessage(`Failed to execute channel label JavaScript: ${error}`);
          });
      } catch (error) {
        console.error('Failed to update channel label:', error);
      }
    }
  }

  private drawHorizontalLine(
    canvasName: string,
    channelSpec: ScopeChannelSpec,
    YOffset: number,
    gridColor: string,
    lineWidth: number = 1
  ) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLine(${canvasName}, ${YOffset}, ${gridColor}, width=${lineWidth})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const horizLineWidth: number = 2;
        const lineYOffset: number =
          (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
          this.channelInset +
          this.canvasMargin;
        const lineXOffset: number = this.canvasMargin;
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset})`);
        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = \'${gridColor}\';
        //         const lineWidth = ${horizLineWidth};
        //         const canWidth = canvas.width - (2 * ${this.canvasMargin});
        //
        //         // Set the dash pattern
        //         ctx.setLineDash([3, 3]); // 3px dash, 3px gap
        //
        //         // Draw the line
        //         ctx.strokeStyle = lineColor;
        //         ctx.lineWidth = lineWidth;
        //         ctx.beginPath();
        //         ctx.moveTo(${lineXOffset}, ${lineYOffset});
        //         ctx.lineTo(canWidth, ${lineYOffset});
        //         ctx.stroke();
        //       }
        //     }
        //   })();
        // `);

        // Calculate the proper end X coordinate for the dashed line
        // Use a large value that will be constrained by canvas width in the JavaScript
        const lineEndX = 9999; // Canvas width will limit this in the renderer

        // Generate the JavaScript code using CanvasRenderer with dynamic width calculation
        const jsCode = this.canvasRenderer
          .drawDashedLine(
            canvasName,
            lineXOffset,
            lineYOffset,
            lineEndX,
            lineYOffset,
            gridColor,
            horizLineWidth,
            [3, 3]
          )
          .replace(`ctx.lineTo(${lineEndX},`, 'ctx.lineTo(canvas.width - (2 * ' + this.canvasMargin + '),');

        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`).catch((error) => {
          this.logMessage(`Failed to execute line draw JavaScript: ${error}`);
        });
      } catch (error) {
        console.error('Failed to update line:', error);
      }
    }
  }

  private drawHorizontalValue(canvasName: string, channelSpec: ScopeChannelSpec, YOffset: number, textColor: string) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalValue(${canvasName}, ${YOffset}, ${textColor})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const lineYOffset: number = atTop ? this.channelInset : channelSpec.ySize + this.channelInset;
        const textYOffset: number = lineYOffset + (atTop ? 0 : 5); // 9pt font: offset text to top? rise from baseline, bottom? descend from line
        const textXOffset: number = 5 + this.canvasMargin;
        const value: number = atTop ? channelSpec.maxValue : channelSpec.minValue;
        const valueText: string = this.stringForRangeValue(value);
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset}), text=[${valueText}]`);

        // Validate parameters to prevent JavaScript errors
        if (!isFinite(textXOffset) || !isFinite(textYOffset)) {
          this.logMessage(
            `ERROR: Invalid parameters in drawHorizontalValue: textX=${textXOffset}, textY=${textYOffset}`
          );
          return;
        }

        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = \'${textColor}\';
        //         //const lineWidth = 2;
        //
        //         // Set the dash pattern
        //         //ctx.setLineDash([]); // Empty array for solid line
        //
        //         // Add text
        //         ctx.font = '9px Arial';
        //         ctx.fillStyle = lineColor;
        //         ctx.fillText('${valueText}', ${textXOffset}, ${textYOffset});
        //       }
        //     }
        //   })();
        // `);

        const jsCode = this.canvasRenderer.drawText(
          canvasName,
          valueText,
          textXOffset,
          textYOffset,
          textColor,
          '9px',
          'Arial',
          'left',
          'top'
        );

        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`).catch((error) => {
          this.logMessage(`Failed to execute text draw JavaScript: ${error}`);
        });
      } catch (error) {
        console.error('Failed to update text:', error);
      }
    }
  }

  private drawHorizontalLineAndValue(
    canvasName: string,
    channelSpec: ScopeChannelSpec,
    YOffset: number,
    gridColor: string,
    textColor: string
  ) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLineAndValue(${canvasName}, ${YOffset}, ${gridColor}, ${textColor})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const horizLineWidth: number = 2;
        const lineYOffset: number =
          (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
          this.channelInset +
          this.canvasMargin;
        const lineXOffset: number = this.canvasMargin;
        const textYOffset: number = lineYOffset + (atTop ? 0 : 5); // 9pt font: offset text to top? rise from baseline, bottom? descend from line
        const textXOffset: number = 5 + this.canvasMargin;
        const value: number = atTop ? channelSpec.maxValue : channelSpec.minValue;
        const valueText: string = this.stringForRangeValue(value);
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset}), valueText=[${valueText}]`);

        // Validate parameters to prevent JavaScript errors
        if (
          !isFinite(lineXOffset) ||
          !isFinite(lineYOffset) ||
          !isFinite(textXOffset) ||
          !isFinite(textYOffset) ||
          !isFinite(horizLineWidth)
        ) {
          this.logMessage(
            `ERROR: Invalid parameters in drawHorizontalLineAndValue: lineX=${lineXOffset}, lineY=${lineYOffset}, textX=${textXOffset}, textY=${textYOffset}, lineWidth=${horizLineWidth}`
          );
          return;
        }

        // Escape valueText to prevent JavaScript injection
        const escapedValueText = valueText.replace(/'/g, "\\'").replace(/"/g, '\\"');

        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = \'${gridColor}\';
        //         const textColor = \'${textColor}\';
        //         const lineWidth = ${horizLineWidth};
        //         const canWidth = canvas.width - (2 * ${this.canvasMargin});
        //
        //         // Set the dash pattern
        //         ctx.setLineDash([3, 3]); // 5px dash, 3px gap
        //
        //         // Measure the text width
        //         ctx.font = '9px Arial';
        //         const textMetrics = ctx.measureText(\'${valueText}\');
        //         const textWidth = textMetrics.width;
        //
        //         // Draw the line
        //         ctx.strokeStyle = lineColor;
        //         ctx.lineWidth = lineWidth;
        //         ctx.beginPath();
        //         ctx.moveTo(textWidth + 8 + ${lineXOffset}, ${lineYOffset}); // start of line
        //         ctx.lineTo(canWidth, ${lineYOffset}); // draw to end of line
        //         ctx.stroke();
        //
        //         // Add text
        //         ctx.fillStyle = textColor;
        //         ctx.fillText(\'${valueText}\', ${textXOffset}, ${textYOffset});
        //       }
        //     }
        //   })();
        // `);

        // Compute all values before template to avoid scope issues
        const canvasMarginValue = this.canvasMargin;

        // Generate clean JavaScript code for dashed line and text without fragile string replacement
        // Use IIFE to avoid variable redeclaration errors
        const jsCode = `
          (function() {
            const canvas = document.getElementById('${canvasName}');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Measure text width
            ctx.font = '9px Arial';
            const textMetrics = ctx.measureText('${escapedValueText}');
            const textWidth = textMetrics.width;
            const canWidth = canvas.width - (2 * ${canvasMarginValue});

            // Draw the dashed line after the text
            ctx.save();
            ctx.strokeStyle = '${gridColor}';
            ctx.lineWidth = ${horizLineWidth};
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(textWidth + 8 + ${lineXOffset}, ${lineYOffset});
            ctx.lineTo(canWidth, ${lineYOffset});
            ctx.stroke();
            ctx.restore();

            // Draw the text
            ctx.font = '9px Arial';
            ctx.fillStyle = '${textColor}';
            ctx.fillText('${escapedValueText}', ${textXOffset}, ${textYOffset});
          })();
        `;

        this.logMessage(`DEBUG: Generated jsCode for drawHorizontalLineAndValue: ${jsCode.substring(0, 300)}...`);
        this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
          this.logMessage(`Failed to execute line & text JavaScript: ${error}`);
        });
      } catch (error) {
        console.error('Failed to update line & text:', error);
      }
    }
  }

  /**
   * Generate JavaScript to redraw the graticule (grid lines and labels) for a channel
   * Generates raw canvas commands that use the canvas/ctx from the calling context
   */
  private redrawGraticule(channelSpec: ScopeChannelSpec): string {
    let jsCode = '';
    const channelGridColor: string = channelSpec.gridColor;
    const channelTextColor: string = channelSpec.textColor;

    // Redraw grid lines and labels using the same logic as initial drawing
    // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
    if (channelSpec.lgndShowMax && !channelSpec.lgndShowMaxLine) {
      //  %1x0x => max legend, NOT max line, so value ONLY
      jsCode += this.generateHorizontalValueJS(channelSpec, channelSpec.maxValue, channelTextColor);
    }
    if (channelSpec.lgndShowMin && !channelSpec.lgndShowMinLine) {
      //  %x1x0 => min legend, NOT min line, so value ONLY
      jsCode += this.generateHorizontalValueJS(channelSpec, channelSpec.minValue, channelTextColor);
    }
    if (channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
      //  %1x1x => max legend, max line, so show value and line!
      jsCode += this.generateHorizontalLineAndValueJS(
        channelSpec,
        channelSpec.maxValue,
        channelGridColor,
        channelTextColor
      );
    }
    if (channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
      //  %x1x1 => min legend, min line, so show value and line!
      jsCode += this.generateHorizontalLineAndValueJS(
        channelSpec,
        channelSpec.minValue,
        channelGridColor,
        channelTextColor
      );
    }
    if (!channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
      //  %0x1x => NOT max legend, max line, show line ONLY
      jsCode += this.generateHorizontalLineJS(channelSpec, channelSpec.maxValue, channelGridColor);
    }
    if (!channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
      //  %x0x1 => NOT min legend, min line, show line ONLY
      jsCode += this.generateHorizontalLineJS(channelSpec, channelSpec.minValue, channelGridColor);
    }

    return jsCode;
  }

  /**
   * Generate raw canvas commands to draw a horizontal line (helper for redrawGraticule)
   * Assumes canvas and ctx are already defined in the calling context
   */
  private generateHorizontalLineJS(channelSpec: ScopeChannelSpec, YOffset: number, gridColor: string): string {
    const atTop: boolean = YOffset == channelSpec.maxValue;
    const horizLineWidth: number = 2;
    const lineYOffset: number =
      (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
      this.channelInset +
      this.canvasMargin;
    const lineXOffset: number = this.canvasMargin;

    return `
      ctx.save();
      ctx.strokeStyle = '${gridColor}';
      ctx.lineWidth = ${horizLineWidth};
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(${lineXOffset}, ${lineYOffset});
      ctx.lineTo(canvas.width - (2 * ${this.canvasMargin}), ${lineYOffset});
      ctx.stroke();
      ctx.restore();
    `;
  }

  /**
   * Generate raw canvas commands to draw a horizontal value label (helper for redrawGraticule)
   * Assumes canvas and ctx are already defined in the calling context
   * Text is centered vertically on the graticule line
   */
  private generateHorizontalValueJS(channelSpec: ScopeChannelSpec, YOffset: number, textColor: string): string {
    const atTop: boolean = YOffset == channelSpec.maxValue;
    const horizLineWidth: number = 2;
    // Use the SAME Y calculation as the line to ensure text is aligned with it
    const lineYOffset: number =
      (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
      this.channelInset +
      this.canvasMargin;
    const textXOffset: number = 5 + this.canvasMargin;
    const value: number = atTop ? channelSpec.maxValue : channelSpec.minValue;
    const valueText: string = this.stringForRangeValue(value);

    return `
      ctx.save();
      ctx.fillStyle = '${textColor}';
      ctx.font = '9px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('${valueText}', ${textXOffset}, ${lineYOffset});
      ctx.restore();
    `;
  }

  /**
   * Generate raw canvas commands to draw a horizontal line with value label (helper for redrawGraticule)
   * Assumes canvas and ctx are already defined in the calling context
   */
  private generateHorizontalLineAndValueJS(
    channelSpec: ScopeChannelSpec,
    YOffset: number,
    gridColor: string,
    textColor: string
  ): string {
    let jsCode = '';
    jsCode += this.generateHorizontalLineJS(channelSpec, YOffset, gridColor);
    jsCode += this.generateHorizontalValueJS(channelSpec, YOffset, textColor);
    return jsCode;
  }

  /**
   * Generate raw canvas commands to draw the trigger indicator (vertical dashed line)
   * Assumes canvas and ctx are already defined in the calling context
   * Pascal reference: x := vBitmapWidth - vMarginRight - Round((vTriggerOffset + 1) / vSamples * vWidth)
   */
  private generateTriggerIndicatorJS(canvasName: string, channelSpec: ScopeChannelSpec): string {
    // Calculate drawing area dimensions
    // Pascal: drawWidth comes from SIZE directive (vWidth)
    const drawWidth: number = this.displaySpec.size.width;
    const drawXOffset: number = this.canvasMargin;

    // Calculate trigger X position (Pascal algorithm)
    // x = rightEdge - ((trigOffset + 1) / nbrSamples) * width
    const triggerX = Math.round(
      drawXOffset + drawWidth - ((this.triggerSpec.trigRtOffset + 1) / this.displaySpec.nbrSamples) * drawWidth
    );

    // Calculate Y range (top to bottom of channel)
    const topY = this.channelInset + this.canvasMargin;
    const bottomY = topY + channelSpec.ySize;

    // Use translucent red for trigger indicator (like LOGIC window)
    // LOGIC uses: rgba(255, 0, 0, 0.3) with box-shadow for glow effect
    const triggerColor = 'rgba(255, 0, 0, 0.3)';

    return `
      ctx.save();
      ctx.strokeStyle = '${triggerColor}';
      ctx.lineWidth = 2;  // Slightly thicker for visibility
      ctx.setLineDash([]);  // Solid line (more visible with translucency)
      ctx.shadowColor = '${triggerColor}';
      ctx.shadowBlur = 3;  // Soft glow like LOGIC
      ctx.beginPath();
      ctx.moveTo(${triggerX}, ${topY});
      ctx.lineTo(${triggerX}, ${bottomY});
      ctx.stroke();
      ctx.restore();
    `;
  }

  private scaleAndInvertValue(value: number, channelSpec: ScopeChannelSpec): number {
    // scale the value to the vertical channel size then invert the value
    const range: number = channelSpec.maxValue - channelSpec.minValue;
    const adjustedValue = value - channelSpec.minValue;
    let possiblyScaledValue: number;

    // Scale the value to fit in the display range
    if (range != 0) {
      possiblyScaledValue = Math.round((adjustedValue / range) * (channelSpec.ySize - 1));
    } else {
      possiblyScaledValue = 0;
    }

    // Clamp to valid range
    possiblyScaledValue = Math.max(0, Math.min(channelSpec.ySize - 1, possiblyScaledValue));
    const invertedValue: number = channelSpec.ySize - 1 - possiblyScaledValue;
    if (this.dbgLogMessageCount > 0) {
      this.logMessage(
        `  -- scaleAndInvertValue(${value}) => (${possiblyScaledValue}->${invertedValue}) range=[${channelSpec.minValue}:${channelSpec.maxValue}] ySize=(${channelSpec.ySize})`
      );
    }
    return invertedValue;
  }

  private stringForRangeValue(value: number): string {
    // add +/- prefix to range value
    const prefix: string = value < 0 ? '' : '+';
    const valueString: string = `${prefix}${value} `;
    return valueString;
  }

  private updateTriggerStatus(): void {
    if (this.debugWindow && this.triggerSpec.trigEnabled) {
      let statusText = 'READY';
      let statusClass = 'trigger-status'; // Base class

      if (this.holdoffCounter > 0) {
        statusText = `HOLDOFF (${this.holdoffCounter})`;
        statusClass += ' triggered';
      } else if (this.triggerFired) {
        statusText = 'TRIGGERED';
        statusClass += ' triggered';
      } else if (this.triggerArmed) {
        statusText = 'ARMED';
        statusClass += ' armed';
      }

      // Update window title to show trigger status
      const baseTitle = this.displaySpec.windowTitle;
      this.debugWindow.setTitle(`${baseTitle} - ${statusText}`);

      // Update HTML status element
      const channelInfo = this.triggerSpec.trigChannel >= 0 ? `CH${this.triggerSpec.trigChannel + 1}` : '';
      const levelInfo = `T:${this.triggerSpec.trigLevel.toFixed(1)} A:${this.triggerSpec.trigArmLevel.toFixed(1)}`;

      this.debugWindow.webContents
        .executeJavaScript(
          `
        (function() {
          const statusEl = document.getElementById('trigger-status');
          if (statusEl) {
            statusEl.innerHTML = '${statusText}<br><span style="font-size: 10px;">${channelInfo} ${levelInfo}</span>';
            statusEl.className = '${statusClass}';
            statusEl.style.display = 'block';
          }
        })();
      `
        )
        .catch((error) => {
          this.logMessage(`Failed to update scope trigger status: ${error}`);
        });
    } else if (this.debugWindow) {
      // Hide trigger status when disabled
      this.debugWindow.webContents
        .executeJavaScript(
          `
        (function() {
          const statusEl = document.getElementById('trigger-status');
          if (statusEl) statusEl.style.display = 'none';
        })();
      `
        )
        .catch((error) => {
          this.logMessage(`Failed to hide scope trigger status: ${error}`);
        });

      // Reset window title
      this.debugWindow.setTitle(this.windowTitle);
    }
  }

  private updateTriggerPosition(): void {
    if (this.debugWindow && this.triggerSpec.trigEnabled && this.triggerFired) {
      // For scope, the trigger position is at the current sample offset
      const triggerXPos = this.canvasMargin + this.triggerSpec.trigRtOffset * this.channelLineWidth;

      // Draw a vertical line at the trigger position for all channels
      let allJsCode = '';
      for (let chanIdx = 0; chanIdx < this.channelSpecs.length; chanIdx++) {
        const canvasName = `channel-${chanIdx}`;
        const channelSpec = this.channelSpecs[chanIdx];

        // Draw vertical trigger position line with glow effect
        const jsCode = this.canvasRenderer.drawLine(
          canvasName,
          triggerXPos,
          this.channelInset + this.canvasMargin,
          triggerXPos,
          this.channelInset + this.canvasMargin + channelSpec.ySize,
          'rgba(255, 0, 0, 0.8)', // Red trigger line
          2
        );

        // Add a second line for glow effect
        const glowCode = this.canvasRenderer.drawLine(
          canvasName,
          triggerXPos,
          this.channelInset + this.canvasMargin,
          triggerXPos,
          this.channelInset + this.canvasMargin + channelSpec.ySize,
          'rgba(255, 0, 0, 0.3)', // Semi-transparent for glow
          4
        );

        allJsCode += jsCode + glowCode;
      }

      // Add trigger position marker at top
      if (this.channelSpecs.length > 0) {
        const markerCode = this.canvasRenderer.drawText(
          'channel-0',
          '▼',
          triggerXPos - 5,
          this.canvasMargin - 2,
          'rgba(255, 0, 0, 0.9)',
          '12px Arial'
        );
        allJsCode += markerCode;
      }

      this.debugWindow.webContents.executeJavaScript(`(function() { ${allJsCode} })();`).catch((error) => {
        this.logMessage(`Failed to execute channel update JavaScript: ${error}`);
      });
    }
  }

  private drawTriggerLevels(): void {
    if (
      this.debugWindow &&
      this.triggerSpec.trigEnabled &&
      this.triggerSpec.trigChannel >= 0 &&
      this.triggerSpec.trigChannel < this.channelSpecs.length
    ) {
      const chanIdx = this.triggerSpec.trigChannel;
      const canvasName = `channel-${chanIdx}`;
      const channelSpec = this.channelSpecs[chanIdx];
      // Pascal: canvas width from SIZE directive (vWidth) + margins
      const canvasWidth = this.displaySpec.size.width + this.canvasMargin;

      // Draw arm level (orange solid line with label)
      if (
        this.triggerSpec.trigArmLevel >= channelSpec.minValue &&
        this.triggerSpec.trigArmLevel <= channelSpec.maxValue
      ) {
        const armYInverted = this.scaleAndInvertValue(this.triggerSpec.trigArmLevel, channelSpec);
        const armYOffset = this.channelInset + this.canvasMargin + armYInverted;

        // Draw solid orange line
        const jsCodeArm = this.canvasRenderer.drawLine(
          canvasName,
          this.canvasMargin,
          armYOffset,
          canvasWidth,
          armYOffset,
          'rgba(255, 165, 0, 0.8)', // Orange for arm level
          1
        );

        // Add "ARM" label
        const armLabelCode = this.canvasRenderer.drawText(
          canvasName,
          'ARM',
          canvasWidth - 35,
          armYOffset - 2,
          'rgba(255, 165, 0, 0.9)',
          '9px Arial'
        );

        this.debugWindow.webContents
          .executeJavaScript(`(function() { ${jsCodeArm} ${armLabelCode} })();`)
          .catch((error) => {
            this.logMessage(`Failed to execute trigger arm level JavaScript: ${error}`);
          });
      }

      // Draw trigger level (green solid line with label)
      if (this.triggerSpec.trigLevel >= channelSpec.minValue && this.triggerSpec.trigLevel <= channelSpec.maxValue) {
        const trigYInverted = this.scaleAndInvertValue(this.triggerSpec.trigLevel, channelSpec);
        const trigYOffset = this.channelInset + this.canvasMargin + trigYInverted;

        // Draw solid green line (thicker)
        const jsCodeTrig = this.canvasRenderer.drawLine(
          canvasName,
          this.canvasMargin,
          trigYOffset,
          canvasWidth,
          trigYOffset,
          'rgba(0, 255, 0, 0.8)', // Green for trigger level
          2
        );

        // Add "TRIG" label
        const trigLabelCode = this.canvasRenderer.drawText(
          canvasName,
          'TRIG',
          canvasWidth - 35,
          trigYOffset - 2,
          'rgba(0, 255, 0, 0.9)',
          '9px Arial'
        );

        this.debugWindow.webContents
          .executeJavaScript(`(function() { ${jsCodeTrig} ${trigLabelCode} })();`)
          .catch((error) => {
            this.logMessage(`Failed to execute trigger level JavaScript: ${error}`);
          });
      }
    }
  }

  /**
   * Get the canvas element ID for this window
   */
  protected getCanvasId(): string {
    return 'canvas'; // Scope window uses 'canvas' as the ID
  }

  /**
   * Transform mouse coordinates to scope-specific coordinates
   * X: pixel position within display area (0 to width-1)
   * Y: inverted pixel position (bottom = 0)
   */
  protected transformMouseCoordinates(x: number, y: number): { x: number; y: number } {
    // Calculate margins and dimensions
    const marginLeft = this.contentInset;
    const marginTop = this.channelInset;
    const width = this.displaySpec.size.width - 2 * this.contentInset;
    const height = this.displaySpec.size.height - 2 * this.channelInset;

    // Check if mouse is within the display area
    if (x >= marginLeft && x < marginLeft + width && y >= marginTop && y < marginTop + height) {
      // Transform to scope coordinates
      // X: relative to left margin
      const scopeX = x - marginLeft;
      // Y: inverted with bottom = 0
      const scopeY = marginTop + height - 1 - y;

      return { x: scopeX, y: scopeY };
    } else {
      // Mouse is outside display area
      return { x: -1, y: -1 };
    }
  }

  /**
   * Get pixel color getter for mouse events
   */
  protected getPixelColorGetter(): ((x: number, y: number) => number) | undefined {
    return (_x: number, _y: number) => {
      if (this.debugWindow) {
        // This would need to be implemented to sample pixel color from canvas
        // For now, return a default value
        return 0x000000;
      }
      return -1;
    };
  }

  /**
   * Override enableMouseInput to add coordinate display functionality
   */
  protected enableMouseInput(): void {
    // Call base implementation first
    super.enableMouseInput();

    // Add coordinate display functionality
    if (this.debugWindow) {
      const marginLeft = this.contentInset;
      const marginTop = this.channelInset;
      const displayWidth = this.displaySpec.size.width - 2 * this.contentInset;
      const displayHeight = this.displaySpec.size.height - 2 * this.channelInset;

      this.debugWindow.webContents
        .executeJavaScript(
          `
        (function() {
          const container = document.getElementById('container');
          const coordDisplay = document.getElementById('coordinate-display');
          const crosshairH = document.getElementById('crosshair-horizontal');
          const crosshairV = document.getElementById('crosshair-vertical');

          if (container && coordDisplay && crosshairH && crosshairV) {
            // Track mouse position
            let lastMouseX = -1;
            let lastMouseY = -1;

            container.addEventListener('mousemove', (event) => {
              const rect = container.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const y = event.clientY - rect.top;

              // Calculate relative position within data area
              const dataX = x - ${marginLeft};
              const dataY = y - ${marginTop};

              // Check if within display area
              if (dataX >= 0 && dataX < ${displayWidth} &&
                  dataY >= 0 && dataY < ${displayHeight}) {

                // Calculate scope coordinates
                const scopeX = dataX;
                const scopeY = ${displayHeight} - 1 - dataY;

                // Update coordinate display
                coordDisplay.textContent = scopeX + ',' + scopeY;
                coordDisplay.style.display = 'block';

                // Position the display near cursor, avoiding edges
                const displayRect = coordDisplay.getBoundingClientRect();
                let displayX = event.clientX + 10;
                let displayY = event.clientY - displayRect.height - 10;

                // Adjust if too close to edges
                if (displayX + displayRect.width > window.innerWidth - 10) {
                  displayX = event.clientX - displayRect.width - 10;
                }
                if (displayY < 10) {
                  displayY = event.clientY + 10;
                }

                coordDisplay.style.left = displayX + 'px';
                coordDisplay.style.top = displayY + 'px';

                // Update crosshair position
                crosshairH.style.display = 'block';
                crosshairV.style.display = 'block';
                crosshairH.style.top = event.clientY + 'px';
                crosshairV.style.left = event.clientX + 'px';

                lastMouseX = x;
                lastMouseY = y;
              } else {
                // Hide displays when outside data area
                coordDisplay.style.display = 'none';
                crosshairH.style.display = 'none';
                crosshairV.style.display = 'none';
              }
            });

            // Hide displays when mouse leaves container
            container.addEventListener('mouseleave', () => {
              coordDisplay.style.display = 'none';
              crosshairH.style.display = 'none';
              crosshairV.style.display = 'none';
            });
          }
        })();
      `
        )
        .catch((error) => {
          this.logMessage(`Failed to enable scope mouse input tracking: ${error}`);
        });
    }
  }
}
