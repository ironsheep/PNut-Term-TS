/** @format */

'use strict';

// src/classes/shared/inputForwarder.ts

import { EventEmitter } from 'events';
import { UsbSerial } from '../../utils/usb.serial';
import { PC_KEY_VALUES, MOUSE_BUTTON_STATE, MOUSE_POSITION, MouseStatus } from './debugInputConstants';

/**
 * Input event types for queuing
 */
interface KeyEvent {
  type: 'key';
  value: number;
  timestamp: number;
}

interface MouseEvent {
  type: 'mouse';
  status: MouseStatus;
  timestamp: number;
}

type InputEvent = KeyEvent | MouseEvent;

/**
 * InputForwarder handles PC_KEY and PC_MOUSE commands for debug windows
 * Manages keyboard and mouse input, queues events, and forwards to P2 device
 */
export class InputForwarder extends EventEmitter {
  private eventQueue: InputEvent[] = [];
  private usbSerial: UsbSerial | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private dotSizeX: number = 1;
  private dotSizeY: number = 1;
  private windowWidth: number = 0;
  private windowHeight: number = 0;
  
  private static readonly POLL_INTERVAL_MS = 16; // ~60Hz
  private static readonly MAX_QUEUE_SIZE = 100;

  constructor() {
    super();
  }

  /**
   * Set the USB serial connection for communication with P2
   */
  public setUsbSerial(serial: UsbSerial): void {
    this.usbSerial = serial;
  }

  /**
   * Set window dimensions for coordinate validation
   */
  public setWindowDimensions(width: number, height: number): void {
    this.windowWidth = width;
    this.windowHeight = height;
  }

  /**
   * Set DOTSIZE for coordinate transformation
   */
  public setDotSize(x: number, y: number): void {
    this.dotSizeX = Math.max(1, x);
    this.dotSizeY = Math.max(1, y);
  }

  /**
   * Start polling for input events
   */
  public startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollInterval = setInterval(() => {
      this.processEventQueue();
    }, InputForwarder.POLL_INTERVAL_MS);
  }

  /**
   * Stop polling for input events
   */
  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    this.eventQueue = [];
  }

  /**
   * Queue a keyboard event
   */
  public queueKeyEvent(keyCode: string | number): void {
    if (this.eventQueue.length >= InputForwarder.MAX_QUEUE_SIZE) {
      this.eventQueue.shift(); // Remove oldest event
    }

    let value: number = PC_KEY_VALUES.NO_KEYPRESS;

    if (typeof keyCode === 'string') {
      // Map special keys
      switch (keyCode.toLowerCase()) {
        case 'arrowleft': value = PC_KEY_VALUES.LEFT_ARROW; break;
        case 'arrowright': value = PC_KEY_VALUES.RIGHT_ARROW; break;
        case 'arrowup': value = PC_KEY_VALUES.UP_ARROW; break;
        case 'arrowdown': value = PC_KEY_VALUES.DOWN_ARROW; break;
        case 'home': value = PC_KEY_VALUES.HOME; break;
        case 'end': value = PC_KEY_VALUES.END; break;
        case 'delete': value = PC_KEY_VALUES.DELETE; break;
        case 'backspace': value = PC_KEY_VALUES.BACKSPACE; break;
        case 'tab': value = PC_KEY_VALUES.TAB; break;
        case 'insert': value = PC_KEY_VALUES.INSERT; break;
        case 'pageup': value = PC_KEY_VALUES.PAGE_UP; break;
        case 'pagedown': value = PC_KEY_VALUES.PAGE_DOWN; break;
        case 'enter': value = PC_KEY_VALUES.ENTER; break;
        case 'escape': value = PC_KEY_VALUES.ESC; break;
        default:
          // Single character
          if (keyCode.length === 1) {
            const charCode = keyCode.charCodeAt(0);
            if (charCode >= 32 && charCode <= 126) {
              value = charCode;
            }
          }
      }
    } else if (typeof keyCode === 'number') {
      // Direct key code
      if (keyCode >= 0 && keyCode <= 255) {
        value = keyCode;
      }
    }

    this.eventQueue.push({
      type: 'key',
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Queue a mouse event
   * @param x Mouse X position in window coordinates
   * @param y Mouse Y position in window coordinates
   * @param buttons Button states
   * @param wheelDelta Wheel scroll delta
   * @param pixelGetter Function to get pixel color at position
   */
  public queueMouseEvent(
    x: number,
    y: number,
    buttons: { left: boolean; middle: boolean; right: boolean },
    wheelDelta: number = 0,
    pixelGetter?: (x: number, y: number) => number
  ): void {
    if (this.eventQueue.length >= InputForwarder.MAX_QUEUE_SIZE) {
      this.eventQueue.shift(); // Remove oldest event
    }

    // Transform coordinates by DOTSIZE
    const scaledX = Math.floor(x / this.dotSizeX);
    const scaledY = Math.floor(y / this.dotSizeY);

    // Check if mouse is within window bounds
    const isInBounds = scaledX >= 0 && scaledX < this.windowWidth && 
                      scaledY >= 0 && scaledY < this.windowHeight;

    // Get pixel color if getter provided and in bounds
    let pixelColor = -1;
    if (isInBounds && pixelGetter) {
      pixelColor = pixelGetter(scaledX, scaledY) & 0xFFFFFF;
    }

    const status: MouseStatus = {
      xpos: isInBounds ? scaledX : MOUSE_POSITION.OUTSIDE,
      ypos: isInBounds ? scaledY : MOUSE_POSITION.OUTSIDE,
      wheeldelta: Math.max(-1, Math.min(1, wheelDelta)), // Clamp to -1, 0, 1
      lbutton: buttons.left ? MOUSE_BUTTON_STATE.PRESSED : MOUSE_BUTTON_STATE.RELEASED,
      mbutton: buttons.middle ? MOUSE_BUTTON_STATE.PRESSED : MOUSE_BUTTON_STATE.RELEASED,
      rbutton: buttons.right ? MOUSE_BUTTON_STATE.PRESSED : MOUSE_BUTTON_STATE.RELEASED,
      pixel: pixelColor
    };

    this.eventQueue.push({
      type: 'mouse',
      status,
      timestamp: Date.now()
    });
  }

  /**
   * Process queued events and send to P2
   */
  private async processEventQueue(): Promise<void> {
    if (!this.usbSerial || this.eventQueue.length === 0) {
      return;
    }

    // Process oldest event
    const event = this.eventQueue.shift();
    if (!event) return;

    try {
      if (event.type === 'key') {
        await this.sendKeyEvent(event.value);
      } else if (event.type === 'mouse') {
        await this.sendMouseEvent(event.status);
      }
    } catch (error) {
      // Emit error but don't crash
      this.emit('error', error);
    }
  }

  /**
   * Send PC_KEY event to P2
   */
  private async sendKeyEvent(keyValue: number): Promise<void> {
    if (!this.usbSerial) return;

    // Format: PC_KEY response as 4-byte long value
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(keyValue, 0);
    
    // Send to P2
    await this.usbSerial.write(buffer.toString('base64'));
  }

  /**
   * Send PC_MOUSE event to P2
   */
  private async sendMouseEvent(status: MouseStatus): Promise<void> {
    if (!this.usbSerial) return;

    // Format: PC_MOUSE response as 7 longs (28 bytes)
    const buffer = Buffer.allocUnsafe(28);
    
    buffer.writeInt32LE(status.xpos, 0);
    buffer.writeInt32LE(status.ypos, 4);
    buffer.writeInt32LE(status.wheeldelta, 8);
    buffer.writeInt32LE(status.lbutton, 12);
    buffer.writeInt32LE(status.mbutton, 16);
    buffer.writeInt32LE(status.rbutton, 20);
    buffer.writeInt32LE(status.pixel, 24);
    
    // Send to P2
    await this.usbSerial.write(buffer.toString('base64'));
  }

  /**
   * Get current queue size
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear event queue
   */
  public clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Check if currently polling
   */
  public get isActive(): boolean {
    return this.isPolling;
  }
}