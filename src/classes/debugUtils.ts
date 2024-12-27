/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/scopeWindow.ts

// Name-to-RGB hex lookup
const colorNameToHex: { [key: string]: string } = {
  BLACK: '#000000',
  WHITE: '#FFFFFF',
  ORANGE: '#FFA500',
  BLUE: '#0000FF',
  GREEN: '#008000',
  CYAN: '#00FFFF',
  RED: '#FF0000',
  MAGENTA: '#FF00FF',
  YELLOW: '#FFFF00',
  GRAY: '#808080'
};

export function colorNameToHexString(colorName: string): string {
  let hexString = colorNameToHex[colorName.toUpperCase()];
  if (!hexString) {
    console.log(`colorNameToHexString: Unknown color name: ${colorName}`);
    hexString = '#5a5a5a'; // default to gray
  }
  return hexString;
}

export function rgbHexStringToNumber(hexString: string): number {
  const hexValue = hexString.startsWith('#') ? hexString.slice(1) : hexString;
  return parseInt(hexValue, 16);
}

export function colorNameToNumber(colorName: string): number {
  const rgbHexString: string = colorNameToHexString(colorName);
  return rgbHexStringToNumber(rgbHexString);
}
