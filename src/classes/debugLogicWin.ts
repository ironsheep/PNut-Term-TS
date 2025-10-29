/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow } from 'electron';
// src/classes/debugLogicWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { LogicTriggerProcessor } from './shared/triggerProcessor';
import { DisplaySpecParser } from './shared/displaySpecParser';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';

import {
  DebugWindowBase,
  eHorizJustification,
  ePackedDataMode,
  ePackedDataWidth,
  eTextWeight,
  eVertJustification,
  FontMetrics,
  PackedDataMode,
  Position,
  Size,
  TextStyle,
  WindowColor
} from './debugWindowBase';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

export interface LogicDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  title: string; // for BaseDisplaySpec compatibility
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was in original message
  size: Size;
  nbrSamples: number;
  spacing: number;
  rate: number;
  lineSize: number;
  textSize: number;
  font: FontMetrics;
  window: WindowColor;
  isPackedData: boolean;
  hideXY: boolean;
  channelSpecs: LogicChannelSpec[]; // one for each named channel bit-set
  textStyle: TextStyle;
  logicChannels: number; // number of logic channel bits (32)
  topLogicChannel: number; // top-most logic channel bit (32 - 1)
}

export interface LogicChannelSpec {
  name: string;
  color: string;
  nbrBits: number;
}

export interface LogicChannelBitSpec {
  name: string;
  color: string;
  chanNbr: number;
  height: number;
  base: number;
}

interface LogicChannelSamples {
  samples: number[];
}

export interface LogicTriggerSpec {
  // trigger
  trigEnabled: boolean; // if mask == 0 trigger is disabled
  trigMask: number; // trigger on data & trigMask == trigMatch [default: 0]
  trigMatch: number; // [default: 1]
  trigSampOffset: number; // [default: nbrSamples / 2]
  trigHoldoff: number; // in samples required, from trigger to trigger (default nbrSamples)
}

/**
 * Debug LOGIC Window - Logic Analyzer Display
 *
 * A multi-channel logic analyzer for visualizing digital signals from Propeller 2 microcontrollers.
 * Displays up to 32 digital channels with configurable triggering, channel grouping, and packed data modes.
 *
 * ## Features
 * - **32-Channel Logic Analyzer**: Display up to 32 independent digital signals
 * - **Channel Grouping**: Combine multiple bits into named channels with custom widths
 * - **Trigger System**: Configurable mask/match triggering with holdoff
 * - **Packed Data Modes**: Support for 12 different packed data formats
 * - **Auto-scrolling**: Continuous data capture with automatic scrolling
 * - **Custom Colors**: Per-channel color configuration
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SAMPLES count` - Number of samples to display (4-2048, default: 32)
 * - `SPACING pixels` - Pixel width per sample (default: 8)
 * - `RATE divisor` - Sample rate divisor (1-2048, default: 1)
 * - `LINESIZE half-pix` - Line thickness (1-7, default: 1)
 * - `TEXTSIZE half-pix` - Text size (6-200, default: editor font size)
 * - `COLOR bg {grid}` - Background and grid colors (default: BLACK, GRAY 4)
 * - `'name' {bits {color}}` - Define channel (default: 1 bit, auto-color)
 * - `TRIGGER mask match {offset {holdoff}}` - Configure triggering
 * - `HIDEXY` - Hide mouse coordinate display
 * - Packed data modes - Enable packed data processing
 *
 * ## Data Format
 * Data is fed as 32-bit values representing logic states:
 * - Each bit represents one logic channel (0=low, 1=high)
 * - Channels can be grouped and named via configuration
 * - Packed data modes allow compressed multi-sample transfers
 * - Example: `debug(\`Logic \`(portA | (portB << 8)))`
 *
 * ## Commands
 * - `numeric_data` - 32-bit logic sample data
 * - `CLEAR` - Clear display and sample buffer
 * - `UPDATE` - Force display update (when UPDATE directive used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding
 * - `PC_MOUSE` - Enable mouse input forwarding
 *
 * ## Trigger System
 * - **Mask**: Specifies which bits to monitor (1=monitor, 0=ignore)
 * - **Match**: Pattern to match on monitored bits
 * - **Offset**: Sample position for trigger (default: SAMPLES/2)
 * - **Holdoff**: Minimum samples between triggers (default: SAMPLES)
 * - Trigger fires when: `(data & mask) == match`
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `LOGIC_Configure` procedure (line 926)
 * - Update: `LOGIC_Update` procedure (line 1034)
 * - Trigger handling: Part of LOGIC_Update procedure
 *
 * ## Examples
 * ```spin2
 * ' Basic 8-channel logic analyzer
 * debug(`LOGIC MyLogic SAMPLES 64 'Port[7..0]' 8)
 * repeat
 *   debug(`MyLogic `(ina[7..0]))
 *
 * ' Triggered capture with named channels
 * debug(`LOGIC MyLogic TRIGGER $FF $80 'Data' 8 'Clock' 'Enable')
 * ```
 *
 * ## Implementation Notes
 * - Channel colors cycle through: LIME, RED, CYAN, YELLOW, MAGENTA, BLUE, ORANGE, OLIVE
 * - Trigger processor handles edge detection and holdoff timing
 * - Packed data processor supports all 12 P2 packed modes with ALT/SIGNED variants
 *
 * ## Deviations from Pascal
 * - None - Full Pascal compatibility maintained
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_LOGIC.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugLogicWindow extends DebugWindowBase {
  private displaySpec: LogicDisplaySpec = {} as LogicDisplaySpec;
  private channelBitSpecs: LogicChannelBitSpec[] = []; // one for each channel bit within the 32 possible channels
  private channelSamples: LogicChannelSamples[] = []; // one for each channel
  private triggerSpec: LogicTriggerSpec = {} as LogicTriggerSpec;
  private isFirstNumericData: boolean = true;
  private channelVInset: number = 3; // 3 pixels from top and bottom of window
  private contentInset: number = 0; // 10 pixels from left and right of window
  private canvasMargin: number = 10; // 10 pixels from to (no left,) right, top, and bottom of canvas (NOT NEEDED)
  private labelWidth: number = 0; // width of label canvas
  private labelHeight: number = 0; // height of label canvas
  private contentWidth: number = 0; // calculated content area width for setContentSize
  private contentHeight: number = 0; // calculated content area height for setContentSize
  private canvasRenderer: CanvasRenderer = new CanvasRenderer();
  private triggerProcessor: LogicTriggerProcessor;
  private packedMode: PackedDataMode = {} as PackedDataMode;
  private singleBitChannelCount: number = 0; // number of single bit channels
  // Trigger state properties
  private triggerArmed: boolean = false;
  private triggerFired: boolean = false;
  private holdoffCounter: number = 0;
  private triggerSampleIndex: number = -1; // Track which sample caused the trigger
  private postTriggerSamples: number = 0; // Samples captured after trigger
  // diagnostics used to limit the number of samples displayed while testing
  private dbgUpdateCount: number = Number.MAX_SAFE_INTEGER; // Run forever - was limiting to 31 * 6 updates
  private dbgLogMessageCount: number = Number.MAX_SAFE_INTEGER; // Log forever - was limiting to 32 * 6 logs
  // Pascal-style circular buffer implementation
  private circularBuffer: number[] = []; // Circular buffer for all samples (like Pascal's LogicSampleBuff)
  private samplePtr: number = 0; // Write pointer into circular buffer (like Pascal's SamplePtr)
  private samplePop: number = 0; // Number of valid samples in buffer (like Pascal's SamplePop)
  private bufferSize: number = 2048; // Size of circular buffer (matches Pascal's LogicSets)
  private triggerFrozenPtr: number = -1; // Pointer position when trigger fired (for frozen display)

  constructor(ctx: Context, displaySpec: LogicDisplaySpec, windowId?: string) {
    // Use the user-provided display name as the window ID for proper routing
    const actualWindowId = windowId || displaySpec.displayName;
    super(ctx, actualWindowId, 'logic');
    this.windowLogPrefix = 'lcgW';
    // record our Debug Logic Window Spec
    this.displaySpec = displaySpec;

    // Enable logging for LOGIC window
    this.isLogging = false;
    // init default Trigger Spec
    this.triggerSpec = {
      trigEnabled: false,
      trigMask: 0,
      trigMatch: 1,
      trigSampOffset: displaySpec.nbrSamples / 2,
      trigHoldoff: 0
    };
    // Initialize the trigger processor
    this.triggerProcessor = new LogicTriggerProcessor();
    // initially we don't have a packed mode...
    this.packedMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
    };

    // CRITICAL FIX: Create window immediately, don't wait for numeric data
    // This ensures windows appear when created, even if closed before data arrives
    this.logMessage('Creating LOGIC window immediately in constructor');
    this.calculateAutoTriggerAndScale();
    this.createDebugWindow();
    this.initChannelSamples();

    // CRITICAL: Mark window as ready to process messages
    this.onWindowReady();
  }

  public static colorNameFmChanNumber(chanNumber: number): string {
    const defaultColorNames: string[] = ['LIME', 'RED', 'CYAN', 'YELLOW', 'MAGENTA', 'BLUE', 'ORANGE', 'OLIVE'];
    const desiredName = defaultColorNames[chanNumber % defaultColorNames.length];
    return desiredName;
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} LOGIC`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
  }

  static parseLogicDeclaration(lineParts: string[]): [boolean, LogicDisplaySpec] {
    // here with lineParts = ['`LOGIC', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0,0]
    //   SAMPLES <nbr> [4-2048, default: 32]
    //   SPACING <nbr> [default: 8] // width is SAMPLES * SPACING
    //   RATE <rate> [1-2048, default: 1]
    //   LINESIZE <half-pix> [1-7, default: 1]
    //   TEXTSIZE <half-pix> [6-200, default: editor font size]
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GRAY 4]
    //   'name' {1_32 {color}} [default: 1, default color]
    //   packed_data_mode
    //   HIDEXY
    // where color is: rgb24 value, else BLACK / WHITE or ORANGE / BLUE / GREEN / CYAN / RED / MAGENTA / YELLOW / GRAY followed by an optional 0..15 for brightness (default 8)

    DebugLogicWindow.logConsoleMessageStatic(`CL: at parseLogicDeclaration()`);
    let displaySpec: LogicDisplaySpec = {} as LogicDisplaySpec;
    displaySpec.channelSpecs = []; // ensure this is structured too! (CRASHED without this!)
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    displaySpec.font = {} as FontMetrics; // ensure this is structured too! (CRASHED without this!)
    displaySpec.textStyle = {} as TextStyle; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY3', 4);
    DebugLogicWindow.logConsoleMessageStatic(`CL: at parseLogicDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.hasExplicitPosition = false; // Default: use auto-placement
    displaySpec.nbrSamples = 32;
    displaySpec.spacing = 8;
    displaySpec.rate = 1;
    displaySpec.lineSize = 1;
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;
    displaySpec.isPackedData = false;
    displaySpec.hideXY = false;
    displaySpec.textSize = 12;
    this.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
    const labelTextSyle: number = this.calcStyleFrom(
      eVertJustification.VJ_MIDDLE,
      eHorizJustification.HJ_RIGHT,
      eTextWeight.TW_NORMAL
    );
    this.calcStyleFromBitfield(labelTextSyle, displaySpec.textStyle);
    displaySpec.logicChannels = 32;
    displaySpec.topLogicChannel = displaySpec.logicChannels - 1;

    // now parse overrides to defaults
    DebugLogicWindow.logConsoleMessageStatic(`CL: at overrides LogicDisplaySpec: ${lineParts}`);
    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1];
      isValid = true; // invert default value
    }
    if (lineParts.length > 2) {
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];
        //console.log(`CL: LogicDisplaySpec - element=[${element}] of lineParts[${index}]`);
        if (element.startsWith("'")) {
          // have channel name...
          const newChannelSpec: LogicChannelSpec = {} as LogicChannelSpec;

          const thisGroupNbr: number = displaySpec.channelSpecs.length;
          // Pascal DefaultScopeColors: [clLime=$00FF00, clRed=$FF0000, clCyan=$00FFFF, etc.] - full RGB values
          // Use brightness 8 for full saturated color matching Pascal's defaults
          const defaultChannelColor = new DebugColor(DebugLogicWindow.colorNameFmChanNumber(thisGroupNbr), 8);
          newChannelSpec.color = defaultChannelColor.rgbString; // might be overridden below
          newChannelSpec.nbrBits = 1; // default to 1 bit (may be overridden below)
          //console.log(`CL: LogicDisplaySpec - new default: ${JSON.stringify(newChannelSpec, null, 2)}`);

          // display string at cursor position with current colors
          let displayString: string | undefined = undefined;
          const currLinePart = lineParts[index];
          // isolate string and display it. Advance index to next part after close quote
          if (currLinePart.substring(1).includes("'")) {
            // string ends as this single linepart
            displayString = currLinePart.substring(1, currLinePart.length - 1);
            //console.log(`CL:  -- displayString=[${displayString}]`);
          } else {
            // this will be a multi-part string
            const stringParts: string[] = [currLinePart.substring(1)];
            DebugLogicWindow.logConsoleMessageStatic(`CL:  -- currLinePart=[${currLinePart}]`);
            while (index < lineParts.length - 1) {
              index++;
              const nextLinePart = lineParts[index];
              DebugLogicWindow.logConsoleMessageStatic(`CL:  -- nextLinePart=[${nextLinePart}]`);
              if (nextLinePart.includes("'")) {
                // last part of string
                stringParts.push(nextLinePart.substring(0, nextLinePart.length - 1));
                break; // exit loop
              } else {
                stringParts.push(nextLinePart);
              }
            }
            displayString = stringParts.join(' ');
          }
          //console.log(`CL: LogicDisplaySpec - displayString=[${displayString}]`);
          if (displayString !== undefined) {
            // have name
            newChannelSpec.name = displayString;
            // have name, now process rest of channel spec
            //  ensure we have one more value (nbr-bits) and lineParts[++index] is decimal number
            if (index < lineParts.length - 1 && /^[0-9]+$/.test(lineParts[index + 1])) {
              // if have nbrBits, grab it
              newChannelSpec.nbrBits = Number(lineParts[++index]);
              if (index < lineParts.length - 1 && lineParts[index + 1].includes("'") == false) {
                // if have color, grab it
                const colorOrColorName = lineParts[++index];
                // if color is a number, then it is a rgb24 value
                // NOTE number could be decimal or $ prefixed hex  ($rrggbb) and either could have '_' digit separaters
                const [isValidRgb24, colorHexRgb24] = this.getValidRgb24(colorOrColorName);
                DebugLogicWindow.logConsoleMessageStatic(
                  `CL: LogicDisplaySpec - colorOrColorName: [${colorOrColorName}], isValidRgb24=(${isValidRgb24})`
                );
                if (isValidRgb24) {
                  // color is a number and is converted to #rrbbgg string
                  newChannelSpec.color = colorHexRgb24;
                } else {
                  // color is a name, so grab possible brightness
                  let brightness: number = 8; // default brightness
                  if (index < lineParts.length - 1) {
                    // let's ensure lineParts[++index] is a string of decimal digits or hex digits (hex prefix is $)
                    const brightnessStr = lineParts[++index].replace(/_/g, '');
                    if (brightnessStr.startsWith('$') && /^[0-9A-Fa-f]+$/.test(brightnessStr.substring(1))) {
                      brightness = parseInt(brightnessStr.substring(1), 16);
                    } else if (/^[0-9]+$/.test(brightnessStr)) {
                      brightness = parseInt(brightnessStr, 10);
                    } else {
                      index--; // back up to allow reprocess of this... (not part of color spec!)
                    }
                  }
                  const channelColor = new DebugColor(colorOrColorName, brightness);
                  newChannelSpec.color = channelColor.rgbString;
                }
              }
            }
            //console.log(`CL: LogicDisplaySpec - add channelSpec: ${JSON.stringify(newChannelSpec, null, 2)}`);
            displaySpec.channelSpecs.push(newChannelSpec);
          } else {
            DebugLogicWindow.logConsoleMessageStatic(
              `CL: LogicDisplaySpec: missing closing quote for Channel name [${lineParts.join(' ')}]`
            );
          }
          DebugLogicWindow.logConsoleMessageStatic(
            `CL: LogicDisplaySpec - ending at [${lineParts[index]}] of lineParts[${index}]`
          );
        } else {
          // Try to parse common keywords first
          const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, displaySpec);
          if (parsed) {
            index = index + consumed - 1; // Adjust for loop increment
            // Special handling for TEXTSIZE
            if (element.toUpperCase() === 'TEXTSIZE') {
              DebugLogicWindow.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
            }
            // Special handling for TITLE - copy title to windowTitle
            if (element.toUpperCase() === 'TITLE' && displaySpec.title) {
              displaySpec.windowTitle = displaySpec.title;
            }
            continue; // Skip to next iteration after successful parse
          } else {
            switch (element.toUpperCase()) {
              case 'COLOR':
                // Parse COLOR directive: COLOR <background> {<grid-color>}
                const [colorParsed, colors, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, index);
                if (colorParsed) {
                  displaySpec.window.background = colors.background;
                  if (colors.grid) {
                    displaySpec.window.grid = colors.grid;
                  }
                  index = index + consumed - 1; // Adjust for loop increment
                } else {
                  DebugLogicWindow.logConsoleMessageStatic(`CL: LogicDisplaySpec: Invalid COLOR specification`);
                  isValid = false;
                }
                break;

              case 'SPACING':
                // ensure we have one more value
                if (index < lineParts.length - 1) {
                  displaySpec.spacing = Number(lineParts[++index]); // FIX: was incorrectly assigning to nbrSamples
                  // Validate spacing range
                  if (displaySpec.spacing < 1 || displaySpec.spacing > 32) {
                    DebugLogicWindow.logConsoleMessageStatic(
                      `CL: LogicDisplaySpec: SPACING value ${displaySpec.spacing} out of range (1-32)`
                    );
                    displaySpec.spacing = Math.max(1, Math.min(32, displaySpec.spacing));
                  }
                } else {
                  DebugLogicWindow.logConsoleMessageStatic(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                  isValid = false;
                }
                break;

              case 'HIDEXY':
                // just set it!
                displaySpec.hideXY = true;
                break;

              default:
                // Check if it's a packed data mode
                const [isPackedMode, packedConfig] = PackedDataProcessor.validatePackedMode(element);
                if (isPackedMode) {
                  displaySpec.isPackedData = true;
                  // Packed mode configuration will be used during data processing
                } else {
                  DebugLogicWindow.logConsoleMessageStatic(`CL: LogicDisplaySpec: Unknown directive: ${element}`);
                  isValid = false;
                }
                break;
            }
          }
        }
        if (!isValid) {
          break;
        }
      }
    }
    DebugLogicWindow.logConsoleMessageStatic(
      `CL: at end of parseLogicDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`
    );
    return [isValid, displaySpec];
  }

  private createDebugWindow(): void {
    this.logMessage(`at createDebugWindow() LOGIC`);
    // calculate overall canvas sizes then window size from them!

    if (this.displaySpec.channelSpecs.length == 0) {
      // error if NO channel
      this.logMessage(`at createDebugWindow() LOGIC with NO channels!`);
    }

    // Labels need full text height for readability, traces use enhanced calculation
    const labelHeight: number = this.displaySpec.font.lineHeight; // Full text height for labels
    const canvasHeight: number = Math.round(this.displaySpec.font.charHeight * 0.75); // Increased from Pascal's 62.5% to 75% for better visual impact
    const channelSpacing: number = 0; // No spacing - channels butt together

    let labelMaxChars: number = 0;
    let activeBitChannels: number = 0;
    let channelBase: number = 0;
    for (let index = 0; index < this.displaySpec.channelSpecs.length; index++) {
      const channelSpec = this.displaySpec.channelSpecs[index];
      const bitsInGroup: number = channelSpec.nbrBits;
      const groupColor: string = channelSpec.color;
      labelMaxChars = Math.max(labelMaxChars, channelSpec.name.length + 2); // add 2 for ' N' suffix
      for (let activeIdx = 0; activeIdx < bitsInGroup; activeIdx++) {
        const bitIdx: number = activeBitChannels + activeIdx;
        let chanLabel: string;
        if (bitsInGroup == 1) {
          chanLabel = `${channelSpec.name}`;
        } else {
          if (activeIdx == 0) {
            chanLabel = `${channelSpec.name} ${activeIdx}`; // name w/bit number suffix
          } else {
            chanLabel = `${activeIdx}`; // just bit number
          }
        }
        // fill in our channel bit spec
        let newSpec: LogicChannelBitSpec = {} as LogicChannelBitSpec;
        newSpec.name = chanLabel;
        newSpec.color = groupColor;
        newSpec.chanNbr = bitIdx;
        newSpec.height = canvasHeight;
        newSpec.base = channelBase;
        // and update to next base
        channelBase += canvasHeight;
        // record the new bit spec
        this.channelBitSpecs.push(newSpec);
      }
      activeBitChannels += bitsInGroup;
    }

    this.logMessage(
      `at createDebugWindow() LOGIC with ${activeBitChannels} active bit channels: [${JSON.stringify(
        this.channelBitSpecs,
        null,
        2
      )}]`
    );

    this.singleBitChannelCount = activeBitChannels;

    const labelDivs: string[] = [];
    const dataCanvases: string[] = [];

    const labelCanvasWidth: number = this.contentInset + labelMaxChars * (this.displaySpec.font.charWidth - 2) - 4; // Reduce by 4px to move labels left
    const labelMargins: number = 16; // 8px left + 8px right margins for spacing
    const dataCanvasWidth: number = this.displaySpec.nbrSamples * this.displaySpec.spacing + this.contentInset; // contentInset' for the Xoffset into window for canvas

    // Calculate total height: match Pascal exactly - each channel gets full ChrHeight
    const channelHeight: number = this.displaySpec.font.charHeight; // Pascal: ChrHeight per channel
    const channelGroupHeight: number = channelHeight * activeBitChannels;
    const channelGroupWidth: number = labelCanvasWidth + labelMargins + dataCanvasWidth;

    // pass to other users
    this.labelHeight = labelHeight;
    this.labelWidth = labelCanvasWidth;

    // Create channels in normal order (0 to n-1) - CSS will flip display order to put channel 0 at bottom
    for (let index = 0; index < activeBitChannels; index++) {
      const idNbr: number = index;
      labelDivs.push(
        `<div id="label-${idNbr}" width="${labelCanvasWidth}" height="${channelHeight}">Label ${idNbr}</div>`
      );
      dataCanvases.push(`<canvas id="data-${idNbr}" width="${dataCanvasWidth}" height="${canvasHeight}"></canvas>`);
    }

    // set height so NO scroller by default - account for container padding (Pascal margins) + window chrome
    const containerPadding = this.displaySpec.font.charHeight * 2; // top + bottom padding (Pascal MarginTop + MarginBottom)
    const contentHeight = channelGroupHeight + containerPadding; // Pascal: MarginTop + vHeight + MarginBottom
    const contentWidth = channelGroupWidth + this.contentInset * 2 + this.canvasMargin * 1;

    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const windowHeight = windowDimensions.height;
    const windowWidth = windowDimensions.width;

    this.logMessage(
      `DEBUG: Created ${labelDivs.length} labels and ${dataCanvases.length} canvases for ${activeBitChannels} channels`
    );
    this.logMessage(`DEBUG: Window dimensions - Width: ${windowWidth}, Height: ${windowHeight}`);
    this.logMessage(
      `DEBUG: Font metrics - charHeight: ${this.displaySpec.font.charHeight}, lineHeight: ${this.displaySpec.font.lineHeight}`
    );
    this.logMessage(
      `DEBUG: Channel calculations - labelHeight: ${labelHeight}, channelHeight: ${channelHeight}, canvasHeight: ${canvasHeight}`
    );
    this.logMessage(
      `DEBUG: Pascal equivalent: vHeight = ${activeBitChannels} * charHeight(${this.displaySpec.font.charHeight}) = ${
        activeBitChannels * this.displaySpec.font.charHeight
      }`
    );
    this.logMessage(
      `DEBUG: TypeScript channelGroupHeight: ${channelGroupHeight}, containerPadding: ${containerPadding}, contentHeight: ${contentHeight}`
    );
    this.logMessage(
      `DEBUG: DETAILED CALCULATION: charHeight=${this.displaySpec.font.charHeight}, activeBitChannels=${activeBitChannels}`
    );
    this.logMessage(
      `DEBUG: DETAILED CALCULATION: channelGroupHeight = ${activeBitChannels} * ${this.displaySpec.font.charHeight} = ${channelGroupHeight}`
    );
    this.logMessage(
      `DEBUG: DETAILED CALCULATION: containerPadding = 2 * ${this.displaySpec.font.charHeight} = ${containerPadding}`
    );
    this.logMessage(
      `DEBUG: DETAILED CALCULATION: contentHeight = ${channelGroupHeight} + ${containerPadding} = ${contentHeight}`
    );
    this.logMessage(`DEBUG: DETAILED CALCULATION: windowHeight = ${contentHeight} + 40 (title bar) = ${windowHeight}`);
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
      const position = windowPlacer.getNextPosition(`logic-${this.displaySpec.displayName}`, placementConfig);
      windowX = position.x;
      windowY = position.y;
      this.logMessage(`  -- LOGIC using auto-placement: ${windowX},${windowY}`);

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) LOGIC '${this.displaySpec.displayName}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }

    this.logMessage(`  -- LOGIC window size: ${windowWidth}x${windowHeight} @${windowX},${windowY}`);

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

    // Store content dimensions for later use in ready-to-show handler
    this.contentWidth = channelGroupWidth + this.contentInset * 2 + this.canvasMargin * 1;
    this.contentHeight = contentHeight;

    // HYPOTHESIS 4 DEBUGGING: Registration Side Effects
    const beforeBounds = this.debugWindow.getBounds();
    this.logConsoleMessage(
      `[DEBUG_WIN_LOGIC] 📍 HYPOTHESIS 4: BEFORE REGISTRATION: (${beforeBounds.x}, ${beforeBounds.y}) size:${beforeBounds.width}x${beforeBounds.height}`
    );

    // Register window with WindowPlacer for position tracking (only if using auto-placement)
    if (this.debugWindow && !this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      this.logConsoleMessage(
        `[DEBUG_WIN_LOGIC] 🔄 REGISTERING: logic-${this.displaySpec.displayName} with WindowPlacer`
      );
      windowPlacer.registerWindow(`logic-${this.displaySpec.displayName}`, this.debugWindow);

      // Check for position changes after registration
      setTimeout(() => {
        const afterBounds = this.debugWindow!.getBounds();
        this.logConsoleMessage(
          `[DEBUG_WIN_LOGIC] 📍 HYPOTHESIS 4: AFTER REGISTRATION: (${afterBounds.x}, ${afterBounds.y}) size:${afterBounds.width}x${afterBounds.height}`
        );
        if (beforeBounds.x !== afterBounds.x || beforeBounds.y !== afterBounds.y) {
          this.logConsoleMessage(
            `[DEBUG_WIN_LOGIC] ⚠️ HYPOTHESIS 4: POSITION CHANGED DURING REGISTRATION! Δx:${
              afterBounds.x - beforeBounds.x
            } Δy:${afterBounds.y - beforeBounds.y}`
          );
        } else {
          this.logConsoleMessage(`[DEBUG_WIN_LOGIC] ✅ HYPOTHESIS 4: Position stable during registration`);
        }
      }, 100);
    }

    // HYPOTHESIS 6 DEBUGGING: Content Loading Interference
    this.debugWindow.on('ready-to-show', () => {
      const readyBounds = this.debugWindow!.getBounds();
      this.logConsoleMessage(`[DEBUG_WIN_LOGIC] 📍 HYPOTHESIS 6: READY-TO-SHOW: (${readyBounds.x}, ${readyBounds.y})`);
      this.logMessage('* Logic window will show...');
      this.debugWindow?.show();
    });

    this.debugWindow.webContents.once('did-finish-load', () => {
      const loadedBounds = this.debugWindow!.getBounds();
      this.logConsoleMessage(
        `[DEBUG_WIN_LOGIC] 📍 HYPOTHESIS 6: DID-FINISH-LOAD: (${loadedBounds.x}, ${loadedBounds.y})`
      );
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Logic window shown');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Logic window title updated');
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
        // Set content size to ensure the content area matches our Pascal calculations exactly
        if (this.contentWidth > 0 && this.contentHeight > 0) {
          this.debugWindow.setContentSize(this.contentWidth, this.contentHeight);
          this.logMessage(`DEBUG: Set content size to Pascal dimensions: ${this.contentWidth}x${this.contentHeight}`);
        }

        // Check actual content dimensions after adjustment
        const contentSize = this.debugWindow.getContentSize();
        const windowSize = this.debugWindow.getSize();
        this.logMessage(
          `DEBUG: FINAL SIZES - Window: ${windowSize[0]}x${windowSize[1]}, Content: ${contentSize[0]}x${contentSize[1]}`
        );
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
            //background-color:rgb(234, 121, 86);
            background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
            overflow: hidden; /* CRITICAL: Prevent scrollbars */
          }
          #labels {
            display: flex;
            flex-direction: column-reverse; /* Reverse order: channel 0 at bottom, matching Pascal */
            flex-grow: 0;
            //background-color:rgb(86, 234, 234);
            background-color: ${this.displaySpec.window.background};
            font-family: 'Parallax', sans-serif;
            font-style: italic;
            font-size: 12px;
            width: ${labelCanvasWidth}px;
            border-style: solid;
            border-width: 1px;
            border-color: ${this.displaySpec.window.background};
            padding: 0px;
            margin: 0px;
            margin-left: 8px; /* Add white space from left edge */
            margin-right: 8px; /* Add white space between labels and trace data */
          }
          #labels > div {
            flex-grow: 0;
            display: flex;
            justify-content: flex-end; /* Horizontally right-aligns the text */
            align-items: center; /* Vertically center the text */
            //background-color:rgba(188, 208, 208, 0.9);
            height: ${channelHeight}px; /* Use tight channel height */
            // padding: top right bottom left - position text to align with trace center
            padding: ${Math.floor((channelHeight - canvasHeight) / 2)}px 6px ${Math.ceil(
      (channelHeight - canvasHeight) / 2
    )}px 0px;
            margin: 0px; /* No margins - channels butt together */
          }
          #labels > div > p {
            // padding: top right bottom left;
            padding: 0px;
            margin: 0px;
          }
          #data {
            display: flex;
            flex-direction: column-reverse; /* Reverse order: channel 0 at bottom, matching Pascal */
            flex-grow: 0;
            width: ${dataCanvasWidth}px;
            border-style: solid;
            border-width: 1px;
            border-color: ${this.displaySpec.window.grid};
            //background-color:rgb(96, 234, 86);
            background-color: ${this.displaySpec.window.background};
          }
          #container {
            display: flex;
            flex-direction: row; /* Arrange children in a row */
            flex-grow: 0;
            padding: top right bottom left;
            padding: ${this.displaySpec.font.charHeight}px ${this.canvasMargin}px ${
      this.displaySpec.font.charHeight
    }px 0px;
          }
          #label-2 {
            //background-color:rgb(231, 151, 240);
          }
          #data-2 {
            //background-color:rgb(240, 194, 151);
          }
          canvas {
            //background-color:rgb(240, 194, 151);
            //background-color: ${this.displaySpec.window.background};
            margin: 0px; /* No margins - channels butt together */
            /* Center canvas vertically within the channel height, with tighter spacing */
            margin-top: ${Math.floor((channelHeight - canvasHeight) / 2) + 1}px;
            margin-bottom: ${Math.ceil((channelHeight - canvasHeight) / 2) - 1}px;
          }
          #trigger-status {
            position: absolute;
            top: 5px;
            right: 5px;
            padding: 3px 8px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 10px;
            font-family: Arial, sans-serif;
            border-radius: 3px;
            display: none !important; /* Always hidden - trigger logic still works internally */
          }
          #trigger-status.armed {
            background-color: rgba(255, 165, 0, 0.8); /* Orange for armed */
          }
          #trigger-status.triggered {
            background-color: rgba(0, 255, 0, 0.8); /* Green for triggered */
          }
          #trigger-position {
            position: absolute;
            width: 2px;
            background-color: rgba(255, 0, 0, 0.3); /* Red trigger line - more transparent */
            height: ${channelGroupHeight}px;
            pointer-events: none;
            display: none; /* Hidden by default */
            top: ${this.displaySpec.font.charHeight}px; /* Position within data area */
            left: -10px; /* Start hidden off-screen */
            box-shadow: 0 0 3px rgba(255, 0, 0, 0.3); /* Softer glow effect */
            z-index: 10; /* Ensure it's above canvas elements */
          }
          @keyframes pulse {
            0% { opacity: 0.8; transform: scaleX(1); }
            50% { opacity: 1; transform: scaleX(1.5); }
            100% { opacity: 0.8; transform: scaleX(1); }
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
          <div id="labels" width="${labelCanvasWidth}" height="${channelGroupHeight}">
            ${labelDivs.join('\n')}
          </div>
          <div id="data" width="${dataCanvasWidth}" height="${channelGroupHeight}">
            ${dataCanvases.join('\n')}
            <div id="trigger-position"></div>
          </div>
        </div>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() LOGIC`);

    try {
      this.debugWindow.setMenu(null);
      this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(htmlContent)}`);
    } catch (error) {
      this.logMessage(`Failed to load URL: ${error}`);
    }

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logMessage('at did-finish-load');
      // let's populate labels
      this.loadLables();
    });
  }

  private loadLables(): void {
    // create labels for each channel and post it to the window
    for (let bitIdx = 0; bitIdx < this.channelBitSpecs.length; bitIdx++) {
      const channelBitSpec = this.channelBitSpecs[bitIdx];
      const canvasName = `label-${bitIdx}`;
      //  set labels
      this.updateLogicChannelLabel(canvasName, channelBitSpec.name, channelBitSpec.color);
    }
  }

  private updateTriggerStatus(): void {
    // Check that window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return;
    }

    if (this.triggerSpec.trigEnabled) {
      let statusText = 'READY';
      let statusClass = '';

      if (this.holdoffCounter > 0) {
        statusText = `HOLDOFF (${this.holdoffCounter})`;
        statusClass = 'triggered';
      } else if (this.triggerFired) {
        statusText = 'TRIGGERED';
        statusClass = 'triggered';
      } else if (this.triggerArmed) {
        statusText = 'ARMED';
        statusClass = 'armed';
      }

      // Also show trigger mask/match values for debugging
      const triggerInfo = `M:${this.triggerSpec.trigMask.toString(2).padStart(8, '0')} T:${this.triggerSpec.trigMatch
        .toString(2)
        .padStart(8, '0')}`;

      this.debugWindow.webContents
        .executeJavaScript(
          `
        (function() {
          const statusEl = document.getElementById('trigger-status');
          if (statusEl) {
            statusEl.innerHTML = '${statusText}<br><span style="font-size: 8px;">${triggerInfo}</span>';
            statusEl.className = 'trigger-status ${statusClass}'.trim();
            statusEl.style.display = 'block';
          }
        })();
      `
        )
        .catch((error) => {
          this.logMessage(`Failed to update trigger status: ${error}`);
        });
    } else if (this.debugWindow) {
      // Hide trigger status when trigger is disabled
      this.debugWindow.webContents
        .executeJavaScript(
          `
        (function() {
          const statusEl = document.getElementById('trigger-status');
          const posEl = document.getElementById('trigger-position');
          if (statusEl) statusEl.style.display = 'none';
          if (posEl) posEl.style.display = 'none';
        })();
      `
        )
        .catch((error) => {
          this.logMessage(`Failed to hide trigger status: ${error}`);
        });
    }
  }

  private updateTriggerPosition(): void {
    // Check that window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return;
    }

    if (this.triggerSpec.trigEnabled && this.triggerFired) {
      // The trigger position should be displayed at trigSampOffset position from the left
      // This is where the trigger point is positioned in the frozen display
      const triggerXPos = this.triggerSpec.trigSampOffset * this.displaySpec.spacing;

      // Also need to account for the label width offset
      const labelWidth = this.labelWidth;

      this.debugWindow.webContents
        .executeJavaScript(
          `
        (function() {
          const posEl = document.getElementById('trigger-position');
          if (posEl) {
            // Position relative to the data area (after labels)
            posEl.style.left = '${labelWidth + triggerXPos}px';
            posEl.style.display = 'block';
            // Add pulsing animation when first triggered
            posEl.style.animation = 'pulse 0.5s ease-in-out 2';
            // Clear animation after it completes
            setTimeout(() => {
              posEl.style.animation = '';
            }, 1000);
          }
        })();
      `
        )
        .catch((error) => {
          this.logMessage(`Failed to update trigger position: ${error}`);
        });
    }
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() LOGIC`);
    // let our base class do the work
    this.debugWindow = null;
  }

  protected processMessageImmediate(lineParts: string[]): void {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // WindowRouter strips display name before routing, so we receive just data parts
    // lineParts = ['0'] or ['TRIGGER', '$07', '$04'] etc. (no display name)
    // ----------------------------------------------------------------
    // Valid directives are:
    // --- these update the trigger spec
    //   TRIGGER <channel|-1> {arm-level {trigger-level {offset}}} HOLDOFF <2-2048>
    //   HOLDOFF <2-2048>
    // --- these manage the window
    //   CLEAR
    //   CLOSE
    //   SAVE {WINDOW} 'filename' // save window to .bmp file
    // --- these paints new samples
    //   <numeric data> // data applied to channels in ascending order
    // ----------------------------------------------------------------
    this.logMessage(`at updateContent(${lineParts.join(' ')})`);

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    if (await this.handleCommonCommand(lineParts)) {
      // Base class handled the command, we're done
      return;
    }

    // Continue with LOGIC-specific processing (TRIGGER, HOLDOFF, channel data)
    // Process all data starting from index 0 (no display name to skip)
    if (lineParts.length > 0) {
      // have data, parse it
      for (let index = 0; index < lineParts.length; index++) {
        this.logMessage(`  -- at [${lineParts[index]}] in lineParts[${index}]`);
        if (lineParts[index].toUpperCase() == 'TRIGGER') {
          // parse trigger spec update
          //   TRIGGER1 mask2 match3 {sample_offset4}
          this.triggerSpec.trigEnabled = true;
          // Arm the trigger when enabled
          this.triggerArmed = true;
          this.triggerFired = false;
          this.holdoffCounter = 0;
          // Update trigger status when first enabled
          if (this.debugWindow) {
            this.updateTriggerStatus();
          }
          // ensure we have at least two more values
          if (index + 1 < lineParts.length - 1) {
            const [isValidMask, mask] = this.isSpinNumber(lineParts[index + 1]);
            if (isValidMask) {
              index++; // show we consumed the mask value
            }
            const [isValidMatch, match] = this.isSpinNumber(lineParts[index + 1]);
            if (isValidMatch) {
              index++; // show we consumed the match value
            }
            if (isValidMask && isValidMatch) {
              this.triggerSpec.trigMask = mask ? mask : 0;
              this.triggerSpec.trigMatch = match ? match : 1;
              if (index + 1 < lineParts.length) {
                const [isValidOffset, offsetInSamples] = this.isSpinNumber(lineParts[index + 1]);
                if (isValidOffset) {
                  if (offsetInSamples >= 0 && offsetInSamples < this.displaySpec.nbrSamples) {
                    this.triggerSpec.trigSampOffset = offsetInSamples;
                  }
                  index++; // show we consumed the offset value
                }
              }
            } else {
              this.logMessage(`at updateContent() with invalid mask or match in [${lineParts.join(' ')}]`);
            }
          }
          this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
        } else if (lineParts[index].toUpperCase() == 'HOLDOFF') {
          // parse trigger spec update
          //   HOLDOFF1 <2-2048>2
          if (lineParts.length > 2) {
            const [isValidNumber, holdoff] = this.isSpinNumber(lineParts[index + 1]);
            if (isValidNumber) {
              this.triggerSpec.trigHoldoff = holdoff;
              index++; // show we consumed the holdoff value
            }
          } else {
            this.logMessage(`at updateContent() with invalid HOLDOFF @[${index + 1}] in [${lineParts.join(' ')}]`);
          }
          this.logMessage(
            `at updateContent() with updated trigger-holdoffSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`
          );
        } else {
          // do we have packed data spec?
          // ORIGINAL CODE COMMENTED OUT - Using PackedDataProcessor instead
          // const [isPackedData, newMode] = this.isPackedDataMode(lineParts[index]);
          // if (isPackedData) {
          //   // remember the new mode so we can unpack the data correctly
          //   this.packedMode = newMode;
          //   // now look for ALT and SIGNED keywords which may follow
          //   if (index + 1 < lineParts.length) {
          //     const nextKeyword = lineParts[index + 1].toUpperCase();
          //     if (nextKeyword == 'ALT') {
          //       this.packedMode.isAlternate = true;
          //       index++;
          //       if (index + 1 < lineParts.length) {
          //         const nextKeyword = lineParts[index + 1].toUpperCase();
          //         if (nextKeyword == 'SIGNED') {
          //           this.packedMode.isSigned = true;
          //           index++;
          //         }
          //       }
          //     } else if (nextKeyword == 'SIGNED') {
          //       this.packedMode.isSigned = true;
          //       index++;
          //     }
          //   }

          // Collect packed mode and any following keywords
          const keywords: string[] = [];
          let tempIndex = index;

          // Check if current word is a packed data mode
          const [isPackedData, _] = PackedDataProcessor.validatePackedMode(lineParts[tempIndex]);
          if (isPackedData) {
            // Collect the mode and any following ALT/SIGNED keywords
            keywords.push(lineParts[tempIndex]);
            tempIndex++;

            // Look for ALT and SIGNED keywords
            while (tempIndex < lineParts.length) {
              const keyword = lineParts[tempIndex].toUpperCase();
              if (keyword === 'ALT' || keyword === 'SIGNED') {
                keywords.push(keyword);
                tempIndex++;
              } else {
                break;
              }
            }

            // Parse all keywords together
            this.packedMode = PackedDataProcessor.parsePackedModeKeywords(keywords);

            // Update index to skip processed keywords
            index = tempIndex - 1;
          } else {
            // do we have number?
            const [isValidNumber, numericValue] = this.isSpinNumber(lineParts[index]);
            if (isValidNumber) {
              if (this.isFirstNumericData) {
                this.isFirstNumericData = false;
                // Window already created in constructor, just log the packed data spec
                this.logMessage(
                  `* UPD-INFO working with packed-data-spec: ${JSON.stringify(this.packedMode, null, 2)}`
                );
              }
              // FIXME: UNDONE: add code to update the window here with our single sample value
              // ORIGINAL CODE COMMENTED OUT - Using PackedDataProcessor instead
              // let scopeSamples: number[] = this.possiblyUnpackData(numericValue, this.packedMode);
              let scopeSamples: number[] = PackedDataProcessor.unpackSamples(numericValue, this.packedMode);
              for (let index = 0; index < scopeSamples.length; index++) {
                const sample = scopeSamples[index];
                this.recordSampleToChannels(sample);
              }
            } else {
              this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[1]} of [${lineParts.join(' ')}]`);
            }
          }
        }
      }
    }
  }

  /**
   * Override base class method for CLEAR command
   * Called by base class handleCommonCommand() when CLEAR is received
   */
  protected clearDisplayContent(): void {
    this.clearChannelData();
  }

  /**
   * Override base class method for UPDATE command
   * Called by base class handleCommonCommand() when UPDATE is received
   * Note: LOGIC updates immediately as samples arrive, no deferred update mode
   */
  protected forceDisplayUpdate(): void {
    // LOGIC window updates immediately when data arrives (no buffering)
    // This method is a no-op but required for base class interface
  }

  private recordSampleToChannels(sample: number): void {
    // Pascal-style circular buffer implementation
    const nbrBitsInSample: number = this.channelBitSpecs.length;
    this.logMessage(
      `at recordSampleToChannels(0b${sample.toString(2).padStart(nbrBitsInSample, '0')}) w/${
        this.channelBitSpecs.length
      } channels`
    );

    // Add sample to circular buffer (like Pascal's LogicSampleBuff[SamplePtr])
    this.circularBuffer[this.samplePtr] = sample;
    this.samplePtr = (this.samplePtr + 1) & (this.bufferSize - 1); // Wrap around using mask
    if (this.samplePop < this.displaySpec.nbrSamples) {
      this.samplePop++;
    }

    // Handle trigger evaluation if enabled (Pascal-style)
    let shouldDraw = false;

    if (this.triggerSpec.trigEnabled && this.triggerSpec.trigMask !== 0) {
      // Only check trigger if buffer is full (like Pascal)
      if (this.samplePop === this.displaySpec.nbrSamples) {
        // Get sample at trigger offset position (like Pascal line 1083)
        const triggerCheckIndex = (this.samplePtr - this.triggerSpec.trigSampOffset) & (this.bufferSize - 1);
        const triggerCheckSample = this.circularBuffer[triggerCheckIndex];

        // Check trigger condition
        const triggerMet = ((triggerCheckSample ^ this.triggerSpec.trigMatch) & this.triggerSpec.trigMask) === 0;

        if (this.triggerArmed) {
          if (triggerMet) {
            // Trigger fired!
            this.triggerFired = true;
            this.triggerArmed = false;
            this.triggerFrozenPtr = this.samplePtr; // Remember position when triggered
            this.updateTriggerStatus();
            this.updateTriggerPosition();
          }
        } else {
          // Check for re-arm condition (opposite of trigger)
          const rearmMet = ((triggerCheckSample ^ this.triggerSpec.trigMatch) & this.triggerSpec.trigMask) !== 0;
          if (rearmMet) {
            this.triggerArmed = true;
            this.updateTriggerStatus();
          }
        }

        // Handle holdoff
        if (this.holdoffCounter > 0) {
          this.holdoffCounter--;
          this.updateTriggerStatus();
        }

        // Determine if we should draw
        if (!this.triggerFired || this.holdoffCounter > 0) {
          // Not triggered or in holdoff - don't draw
          return;
        }

        // We have a trigger and holdoff is complete - draw and reset holdoff
        this.holdoffCounter = this.triggerSpec.trigHoldoff;
        shouldDraw = true;
      }
    } else {
      // No trigger enabled - always draw when we have enough samples
      shouldDraw = this.samplePop > 0;
    }

    // Draw if needed
    if (shouldDraw) {
      this.drawAllChannelsFromBuffer();
    }
  }

  private calculateAutoTriggerAndScale(): void {
    // FIXME: UNDONE check if auto is set, if is then calculate the trigger level and scale
    this.logMessage(`at calculateAutoTriggerAndScale()`);
    if (false) {
      // calculate:
      // 1. arm level at 33%
      // 2. trigger level 50%
      // 3. ...
      // 4. set the scale to the max - min
    }
  }

  private initChannelSamples(): void {
    this.logMessage(`at initChannelSamples()`);
    // Initialize circular buffer for Pascal-style operation
    this.circularBuffer = new Array(this.bufferSize).fill(0);
    this.samplePtr = 0;
    this.samplePop = 0;
    this.triggerFrozenPtr = -1;

    // Keep channel samples for compatibility (but will be rebuilt from circular buffer)
    this.channelSamples = [];
    if (this.channelBitSpecs.length == 0) {
      this.channelSamples.push({ samples: [] });
    } else {
      for (let index = 0; index < this.channelBitSpecs.length; index++) {
        this.channelSamples.push({ samples: [] });
      }
    }
    this.logMessage(
      `  -- Initialized circular buffer size ${this.bufferSize}, channels: ${this.channelBitSpecs.length}`
    );
  }

  private clearChannelData(): void {
    this.logMessage(`at clearChannelData()`);
    // Clear circular buffer (Pascal-style)
    this.circularBuffer.fill(0);
    this.samplePtr = 0;
    this.samplePop = 0;
    this.triggerFrozenPtr = -1;

    // Clear channel samples for compatibility
    for (let index = 0; index < this.channelBitSpecs.length; index++) {
      const channelSamples = this.channelSamples[index];
      // clear the channel data
      channelSamples.samples = [];
    }
  }

  private clearAllCanvases(): void {
    // Check that window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return;
    }

    this.logMessage(`at clearAllCanvases()`);
    // Clear all channel canvases
    for (let index = 0; index < this.channelBitSpecs.length; index++) {
      const canvasName = `data-${index}`;
      const jsCode = `
        (function() {
          const canvas = document.getElementById('${canvasName}');
          if (canvas && canvas instanceof HTMLCanvasElement) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        })();
      `;
      this.debugWindow.webContents.executeJavaScript(jsCode).catch((err) => {
        this.logMessage(`Failed to clear canvas ${canvasName}: ${err}`);
      });
    }
  }

  private drawAllChannelsFromBuffer(): void {
    // Pascal-style drawing from circular buffer (like LOGIC_Draw procedure)
    this.logMessage(`at drawAllChannelsFromBuffer() with samplePop=${this.samplePop}`);

    // Check that window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return;
    }

    // Clear all canvases first (like Pascal's ClearBitmap)
    this.clearAllCanvases();

    // Use frozen pointer if triggered, otherwise use current pointer
    const drawPtr = this.triggerFrozenPtr >= 0 ? this.triggerFrozenPtr : this.samplePtr;

    // Extract samples for each channel from circular buffer
    for (let channelIdx = 0; channelIdx < this.singleBitChannelCount; channelIdx++) {
      const samples: number[] = [];

      // Extract channel bits from circular buffer (drawing backwards from current position)
      for (let k = this.samplePop - 1; k >= 0; k--) {
        // Access samples backward from write pointer (like Pascal line 1136)
        const bufferIndex = (drawPtr - k - 1) & (this.bufferSize - 1);
        const fullSample = this.circularBuffer[bufferIndex];
        // Extract bit for this channel
        const bitValue = (fullSample >> channelIdx) & 1;
        samples.push(bitValue);
      }

      // Draw this channel with extracted samples
      const canvasName = `data-${channelIdx}`;
      const channelSpec = this.channelBitSpecs[channelIdx];
      this.drawChannelFromSamples(canvasName, channelSpec, samples);
    }

    // Update trigger position indicator if triggered
    if (this.triggerFired && this.triggerSpec.trigEnabled) {
      this.updateTriggerPosition();
    }
  }

  private recordChannelSample(channelIndex: number, sample: number): boolean {
    // This method is now deprecated - using circular buffer instead
    // Kept for compatibility but not used
    return false;
  }

  private drawChannelFromSamples(canvasName: string, channelSpec: LogicChannelBitSpec, samples: number[]): void {
    // Check that window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return;
    }

    if (samples.length > 0) {
      this.logMessage(`at drawChannelFromSamples(${canvasName}, w/#${samples.length}) sample(s)`);

      const canvasWidth: number = this.displaySpec.nbrSamples * this.displaySpec.spacing;
      const canvasHeight: number = Math.round(this.displaySpec.font.charHeight * 0.75); // Increased from Pascal's 62.5% to 75% for better visual impact
      const drawHeight: number = canvasHeight - this.channelVInset * 2;
      const channelColor: string = channelSpec.color;
      const spacing: number = this.displaySpec.spacing;

      // Build JavaScript to draw samples (canvas already cleared in drawAllChannelsFromBuffer)
      let jsCode = `
        const canvas = document.getElementById('${canvasName}');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set line properties
        const lineColor = '${channelColor}';
        const lineWidth = ${this.displaySpec.lineSize};
        const spacing = ${spacing};
        const drawHeight = ${drawHeight};
        const vInset = ${this.channelVInset};

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';

        // Draw samples from right to left (Pascal-style)
        const samples = [${samples.join(',')}];
        if (samples.length === 0) return;

        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
          // Position from right edge, moving left (like Pascal line 1135)
          const x = (${canvasWidth} - (samples.length - i) * spacing);
          const invSample = 1 - samples[i];
          const y = invSample * drawHeight + vInset;

          if (i === 0) {
            // Move to first point
            ctx.moveTo(x, y);
          } else {
            // Draw from previous x to current x at previous y (horizontal)
            const prevX = (${canvasWidth} - (samples.length - i + 1) * spacing);
            const prevInvSample = 1 - samples[i - 1];
            const prevY = prevInvSample * drawHeight + vInset;

            // Draw horizontal line at previous level
            ctx.lineTo(x, prevY);
            // Draw vertical transition
            ctx.lineTo(x, y);
          }
          // Extend horizontal to next sample position (or edge)
          const nextX = (i === samples.length - 1) ? ${canvasWidth} : (${canvasWidth} - (samples.length - i - 1) * spacing);
          ctx.lineTo(nextX, y);
        }
        ctx.stroke();
      `;

      // Execute the drawing JavaScript
      try {
        if (this.debugWindow) {
          this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`).catch((error) => {
            this.logMessage(`Failed to execute channel drawing JavaScript: ${error}`);
          });
        }
      } catch (error) {
        console.error('Failed to draw channel:', error);
      }
    }
  }

  // Keep old method for compatibility but it's no longer used
  private updateLogicChannelData(
    canvasName: string,
    channelSpec: LogicChannelBitSpec,
    samples: number[],
    didScroll: boolean
  ): void {
    // This method is deprecated - use drawChannelFromSamples instead
    this.drawChannelFromSamples(canvasName, channelSpec, samples);
  }

  private updateLogicChannelLabel(divId: string, label: string, color: string): void {
    // Check that window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return;
    }

    this.logMessage(`at updateLogicChannelLabel('${divId}', '${label}', ${color})`);
    try {
      const labelSpan: string = `<p style="color: ${color};">${label}</p>`;
      const jsCode = this.canvasRenderer.updateElementHTML(divId, labelSpan);
      this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
        this.logMessage(`Failed to execute label update JavaScript: ${error}`);
      });
    } catch (error) {
      console.error(`Failed to update ${divId}: ${error}`);
    }
  }

  /**
   * Get the canvas element ID for this window
   */
  protected getCanvasId(): string {
    return 'canvas'; // Logic window uses 'canvas' as the ID
  }

  /**
   * Transform mouse coordinates to logic-specific coordinates
   * X: negative sample index from current position
   * Y: channel number
   */
  protected transformMouseCoordinates(x: number, y: number): { x: number; y: number } {
    // Calculate margins and dimensions
    const marginLeft = this.contentInset + this.labelWidth;
    const marginTop = this.channelVInset;
    const width = this.displaySpec.size.width - this.contentInset - this.labelWidth;
    const height = this.displaySpec.size.height - 2 * this.channelVInset;

    // Check if mouse is within the display area
    if (x >= marginLeft && x < marginLeft + width && y >= marginTop && y < marginTop + height) {
      // Transform to logic coordinates
      // X: negative sample number (samples back from current)
      const sampleX = -Math.floor((marginLeft + width - 1 - x) / this.displaySpec.spacing);
      // Y: channel number (0-based from top)
      const channelY = Math.floor((y - marginTop) / this.displaySpec.font.charHeight);

      return { x: sampleX, y: channelY };
    } else {
      // Mouse is outside display area
      return { x: -1, y: -1 };
    }
  }

  /**
   * Get pixel color getter for mouse events
   */
  protected getPixelColorGetter(): ((x: number, y: number) => number) | undefined {
    return (x: number, y: number) => {
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
      const marginLeft = this.contentInset + this.labelWidth;
      const marginTop = this.channelVInset;
      const displayWidth = this.displaySpec.size.width - this.contentInset - this.labelWidth;
      const displayHeight = this.displaySpec.size.height - 2 * this.channelVInset;

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

                // Calculate logic coordinates
                const sampleX = -Math.floor((${displayWidth} - 1 - dataX) / ${this.displaySpec.spacing});
                const channelY = Math.floor(dataY / ${this.displaySpec.font.charHeight});

                // Update coordinate display
                coordDisplay.textContent = sampleX + ',' + channelY;
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
          this.logMessage(`Failed to enable mouse input tracking: ${error}`);
        });
    }
  }
}
