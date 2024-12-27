/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/scopeWindow.ts

import { Context } from '../utils/context';

import { DebugWindowBase, Position, Size, WindowColor } from './debugWindowBase';

export interface ScopeDisplaySpec {
  displayName: string;
  windowTitle: string;
  position: Position;
  size: Size;
  nbrSamples: number;
  rate: number;
  dotSize: number;
  lineSize: number;
  textSize: number;
  color: WindowColor;
  isPackedData: boolean;
  hideXY: boolean;
}

export class ScopeWindow extends DebugWindowBase {
  private displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;

  constructor(ctx: Context, displaySpec: ScopeDisplaySpec) {
    super(ctx);
    this.displaySpec = displaySpec;
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
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GREY 4]
    //   packed_data_mode
    //   HIDEXY
    let displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
    let isValid: boolean = false;
    // set defaults
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.size = { width: 256, height: 256 };
    displaySpec.nbrSamples = 256;
    displaySpec.rate = 1;
    displaySpec.color.background = { color: DebugWindowBase.colorNameToNumber('BLACK'), brightness: 0 };
    displaySpec.color.foreground = { color: DebugWindowBase.colorNameToNumber('GRAY'), brightness: 4 };
    // now parse overrides to defaults
    displaySpec.displayName = lineParts[1];
    if (lineParts.length > 2) {
      isValid = true; // invert default value
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];
        switch (element.toUpperCase()) {
          case 'TITLE':
            // esure we have one more value
            if (index < lineParts.length - 1) {
              displaySpec.windowTitle = lineParts[++index];
            } else {
              // console.log() as we are in class static method, not derived class...
              console.log(`ScopeDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // esure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.width = Number(lineParts[++index]);
              displaySpec.size.height = Number(lineParts[++index]);
            } else {
              console.log(`ScopeDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SAMPLES':
            // esure we have two more values
            if (index < lineParts.length - 1) {
              displaySpec.nbrSamples = Number(lineParts[++index]);
            } else {
              console.log(`ScopeDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;

          default:
            console.log(`ScopeDisplaySpec: Unknown directive: ${element}`);
            break;
        }
        if (!isValid) {
          break;
        }
      }
    }

    return [isValid, displaySpec];
  }
}
