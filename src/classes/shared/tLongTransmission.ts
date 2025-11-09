/** @format */

'use strict';

/**
 * TLong transmission utility for sending 32-bit integers to P2 via serial protocol.
 *
 * This utility matches Pascal's TLong implementation exactly:
 * ```pascal
 * procedure TLong(x: integer);
 * var
 *   i: integer;
 * begin
 *   for i := 0 to 3 do TByte(x shr (i shl 3));
 * end;
 * ```
 *
 * The function converts a 32-bit integer to 4 bytes in little-endian format
 * and transmits them sequentially via the serial port.
 */

import { Context } from '../../utils/context';

const ENABLE_CONSOLE_LOG: boolean = false;

export class TLongTransmission {
  private context: Context;
  private sendSerialDataCallback: ((data: string | Buffer) => void) | null = null;

  constructor(ctx: Context) {
    this.context = ctx;
  }

  /**
   * Set the serial data transmission callback.
   * This should be the mainWindow.sendSerialData method.
   */
  public setSendCallback(callback: (data: string | Buffer) => void): void {
    this.sendSerialDataCallback = callback;
  }

  /**
   * Transmit a 32-bit integer as 4 bytes in little-endian format.
   * Matches Pascal's TLong implementation exactly.
   *
   * @param value - The 32-bit integer to transmit
   * @throws Error if serial port is not available
   */
  public transmitTLong(value: number): void {
    if (!this.sendSerialDataCallback) {
      throw new Error('TLong transmission: Serial port not available - no send callback set');
    }

    // Ensure value is a 32-bit signed integer
    // JavaScript bitwise operations work on 32-bit signed integers
    value = value | 0;

    // Convert to little-endian bytes matching Pascal: for i := 0 to 3 do TByte(x shr (i shl 3))
    const bytes: number[] = [];
    for (let i = 0; i < 4; i++) {
      // Extract byte i: x shr (i shl 3) = x >> (i * 8)
      const byteValue = (value >> (i * 8)) & 0xFF;
      bytes.push(byteValue);
    }

    // Create Buffer from raw bytes to avoid UTF-8 encoding issues
    // String.fromCharCode() would UTF-8 encode values >127 (e.g., 0xFF → 0xC3 0xBF)
    const buffer = Buffer.from(bytes);

    // Log transmission for debugging
    if (ENABLE_CONSOLE_LOG) {
      this.context.logger.forceLogMessage(
        `[TLONG] Transmitting value=${value} (0x${(value >>> 0).toString(16).padStart(8, '0')}) as bytes=[${bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`
      );
    }

    // Transmit via serial port using Buffer for binary data
    this.sendSerialDataCallback(buffer);
  }

  /**
   * Utility method to encode mouse position data matching Pascal SendMousePos.
   *
   * The PC_MOUSE protocol sends 2 packed longs that the P2 firmware unpacks into 7 longs:
   *
   * Long 1 (packed position + buttons + wheel):
   *   Bits 0-12:  X coordinate (13 bits, 0-8191)
   *   Bits 13-25: Y coordinate (13 bits, 0-8191)
   *   Bits 26-27: Wheel delta (2 bits, 0-3)
   *   Bit 28:     Left button (1=pressed)
   *   Bit 29:     Middle button (1=pressed)
   *   Bit 30:     Right button (1=pressed)
   *
   * Long 2 (pixel color):
   *   $00_RR_GG_BB format
   *
   * Pascal encoding:
   * v := vMouseWheel and 3 shl 26 or p.y and $1FFF shl 13 or p.x and $1FFF;
   * if GetAsyncKeyState(VK_LBUTTON) and $8000 <> 0 then v := v or $10000000;
   * if GetAsyncKeyState(VK_MBUTTON) and $8000 <> 0 then v := v or $20000000;
   * if GetAsyncKeyState(VK_RBUTTON) and $8000 <> 0 then v := v or $40000000;
   *
   * @param x - Mouse X coordinate (0-8191, will be masked to 13 bits)
   * @param y - Mouse Y coordinate (0-8191, will be masked to 13 bits)
   * @param leftButton - Left mouse button state
   * @param middleButton - Middle mouse button state
   * @param rightButton - Right mouse button state
   * @param wheelDelta - Mouse wheel delta (-1, 0, 1, will be masked to 2 bits)
   * @returns Encoded 32-bit mouse data value
   */
  public encodeMouseData(
    x: number,
    y: number,
    leftButton: boolean,
    middleButton: boolean,
    rightButton: boolean,
    wheelDelta: number
  ): number {
    // Encode according to Pascal format
    let value = 0;

    // Mouse wheel (2 bits at positions 26-27)
    value |= (wheelDelta & 0x3) << 26;

    // Y coordinate (13 bits at positions 13-25)
    value |= (y & 0x1FFF) << 13;

    // X coordinate (13 bits at positions 0-12)
    value |= (x & 0x1FFF);

    // Button states (bits 28-30)
    if (leftButton) value |= 0x10000000;   // Bit 28
    if (middleButton) value |= 0x20000000; // Bit 29
    if (rightButton) value |= 0x40000000;  // Bit 30

    return value >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Utility method to create out-of-bounds mouse data matching Pascal behavior.
   *
   * Pascal sets: v := $03FFFFFF; c := $FFFFFFFF; when mouse is out of bounds
   *
   * @returns Object with position and color values for out-of-bounds mouse
   */
  public createOutOfBoundsMouseData(): { position: number; color: number } {
    return {
      position: 0x03FFFFFF, // Out of bounds position marker
      color: 0xFFFFFFFF     // Out of bounds color marker
    };
  }

  /**
   * Transmit mouse position and color data matching Pascal SendMousePos.
   * Sends two TLong values: packed position data and pixel color.
   *
   * The P2 firmware unpacks the position long into 7 separate longs in memory.
   *
   * IMPORTANT: Both longs are sent as a SINGLE 8-byte buffer to prevent timing
   * issues that could cause the P2 to hang waiting for the second long.
   *
   * @param positionValue - Encoded mouse position data (includes x, y, buttons, wheel)
   * @param colorValue - Pixel color at mouse position
   */
  public transmitMouseData(positionValue: number, colorValue: number): void {
    if (!this.sendSerialDataCallback) {
      throw new Error('TLong transmission: Serial port not available - no send callback set');
    }

    // Ensure values are 32-bit signed integers
    positionValue = positionValue | 0;
    colorValue = colorValue | 0;

    // Create single 8-byte buffer containing both longs in little-endian format
    // This prevents timing issues where P2 might hang between receiving the two longs
    const buffer = Buffer.alloc(8);

    // Write position long (bytes 0-3) in little-endian
    for (let i = 0; i < 4; i++) {
      buffer[i] = (positionValue >> (i * 8)) & 0xFF;
    }

    // Write color long (bytes 4-7) in little-endian
    for (let i = 0; i < 4; i++) {
      buffer[4 + i] = (colorValue >> (i * 8)) & 0xFF;
    }

    // Log transmission for debugging
    if (ENABLE_CONSOLE_LOG) {
      const posBytes = Array.from(buffer.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0'));
      const colorBytes = Array.from(buffer.slice(4, 8)).map(b => '0x' + b.toString(16).padStart(2, '0'));
      this.context.logger.forceLogMessage(
        `[TLONG] Transmitting PC_MOUSE: position=0x${(positionValue >>> 0).toString(16).padStart(8, '0')} [${posBytes.join(', ')}], color=0x${(colorValue >>> 0).toString(16).padStart(8, '0')} [${colorBytes.join(', ')}]`
      );
    }

    // Transmit both longs as single atomic operation
    this.sendSerialDataCallback(buffer);
  }

  /**
   * Transmit keypress data as done in Pascal SendKeyPress.
   * Sends the keypress value and then clears the input state.
   *
   * @param keyValue - The key value to transmit
   */
  public transmitKeyPress(keyValue: number): void {
    this.transmitTLong(keyValue);
  }
}