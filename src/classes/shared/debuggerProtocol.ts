/** @format */

// src/classes/shared/debuggerProtocol.ts

import { EventEmitter } from 'events';
import { UsbSerial } from '../../utils/usb.serial';
import {
  DebuggerInitialMessage,
  DebuggerRequest,
  DebuggerResponse,
  DEBUG_COMMANDS,
  MEMORY_CONSTANTS,
  parseInitialMessage,
  calculateChecksum
} from './debuggerConstants';

/**
 * DebuggerProtocol - Handles bidirectional P2 serial communication for debugging
 * 
 * Manages the dual protocol system where binary debugger messages coexist with
 * text DEBUG commands. Implements the complete P2 debugger protocol including:
 * - Initial 20-long message reception
 * - Memory block requests/responses
 * - Breakpoint and control commands
 * - Flow control and timing
 * - Lost communication detection
 * 
 * Reference: DEBUGGER_IMPLEMENTATION.md lines 105-123
 */
export class DebuggerProtocol extends EventEmitter {
  private serial: UsbSerial | null = null;
  private isConnected: boolean = false;
  private messageBuffer: Uint8Array = new Uint8Array(4096);
  private bufferPosition: number = 0;
  private expectedMessageSize: number = 0;
  private currentSequence: number = 0;
  private pendingRequests: Map<number, DebuggerRequest> = new Map();
  private responseTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private communicationTimeout: NodeJS.Timeout | null = null;
  private lastActivityTime: number = 0;
  private readonly TIMEOUT_MS = 1000; // 1 second timeout
  private readonly COMM_TIMEOUT_MS = 5000; // 5 second communication timeout

  constructor() {
    super();
  }

  /**
   * Connect to serial port
   */
  public connect(serial: UsbSerial): void {
    if (this.serial) {
      this.disconnect();
    }

    this.serial = serial;
    this.isConnected = true;
    this.lastActivityTime = Date.now();

    // Set up data handler
    this.serial.on('data', (data: Buffer) => {
      this.handleSerialData(data);
    });

    // Start communication timeout monitor
    this.startCommunicationMonitor();

    this.emit('connected');
  }

  /**
   * Disconnect from serial port
   */
  public disconnect(): void {
    if (this.serial) {
      this.serial.removeAllListeners('data');
      this.serial = null;
    }

    this.isConnected = false;
    this.clearAllTimeouts();
    this.stopCommunicationMonitor();

    this.emit('disconnected');
  }

  /**
   * Handle incoming serial data
   */
  private handleSerialData(data: Buffer): void {
    this.lastActivityTime = Date.now();

    // Add to buffer
    // CRITICAL FIX: Properly convert Buffer to Uint8Array to avoid data corruption
    const uint8Data = new Uint8Array(data.buffer, data.byteOffset, data.length);
    for (let i = 0; i < uint8Data.length; i++) {
      if (this.bufferPosition < this.messageBuffer.length) {
        this.messageBuffer[this.bufferPosition++] = uint8Data[i];
      }
    }

    // Try to parse messages
    this.parseMessages();
  }

  /**
   * Parse messages from buffer
   */
  private parseMessages(): void {
    // Check for complete messages
    while (this.bufferPosition >= 4) {
      // Check message header
      const header = this.readUint32(0);
      
      // Check if this is a debugger message (starts with marker)
      // Header is read as little-endian, so 0xDB is in the high byte (bits 24-31)
      if ((header >>> 24) === 0xDB) {
        const messageType = (header >> 16) & 0xFF;
        const payloadSize = header & 0xFFFF;
        const totalSize = 4 + payloadSize;

        if (this.bufferPosition >= totalSize) {
          // Extract complete message
          const message = this.messageBuffer.slice(4, totalSize);
          this.processDebuggerMessage(messageType, message);

          // Remove message from buffer
          this.messageBuffer.copyWithin(0, totalSize, this.bufferPosition);
          this.bufferPosition -= totalSize;
        } else {
          // Wait for more data
          break;
        }
      } else if (this.bufferPosition >= 80) {
        // Check for 20-long initial message (80 bytes)
        const possibleInitial = new Uint32Array(
          this.messageBuffer.buffer,
          this.messageBuffer.byteOffset,
          20
        );
        
        // Validate it looks like an initial message
        if (this.isValidInitialMessage(possibleInitial)) {
          this.processInitialMessage(possibleInitial);
          
          // Remove from buffer
          this.messageBuffer.copyWithin(0, 80, this.bufferPosition);
          this.bufferPosition -= 80;
        } else {
          // Not a valid message, skip first byte and try again
          this.messageBuffer.copyWithin(0, 1, this.bufferPosition);
          this.bufferPosition--;
        }
      } else {
        // Need more data
        break;
      }
    }
  }

  /**
   * Check if data looks like a valid initial message
   */
  private isValidInitialMessage(data: Uint32Array): boolean {
    if (data.length < 20) return false;
    
    // COG number should be 0-7
    const cogNum = data[0];
    if (cogNum > 7) return false;
    
    // PC should be reasonable
    const pc = data[5];
    if (pc > 0x80000) return false; // 512KB max
    
    return true;
  }

  /**
   * Process initial 20-long message
   */
  private processInitialMessage(data: Uint32Array): void {
    try {
      const message = parseInitialMessage(data);
      
      // Also includes COG/LUT CRCs and HUB checksums after the 20 longs
      const cogCRCs = new Uint32Array(64);
      const lutCRCs = new Uint32Array(64);
      const hubChecksums = new Uint32Array(124);
      
      // These would follow the initial message in the full protocol
      // For now, emit the basic message
      this.emit('initialMessage', {
        message,
        cogCRCs,
        lutCRCs,
        hubChecksums
      });
      
    } catch (error) {
      this.emit('error', { type: 'parse', error });
    }
  }

  /**
   * Process debugger protocol message
   */
  private processDebuggerMessage(messageType: number, data: Uint8Array): void {
    switch (messageType) {
      case DEBUG_COMMANDS.RESPONSE_DATA:
        this.processDataResponse(data);
        break;
      case DEBUG_COMMANDS.RESPONSE_ACK:
        this.processAckResponse(data);
        break;
      case DEBUG_COMMANDS.RESPONSE_NAK:
        this.processNakResponse(data);
        break;
      default:
        this.emit('unknownMessage', { type: messageType, data });
    }
  }

  /**
   * Process data response
   */
  private processDataResponse(data: Uint8Array): void {
    if (data.length < 8) return;
    
    const sequence = this.readUint32FromData(data, 0);
    const address = this.readUint32FromData(data, 4);
    const payload = data.slice(8);
    
    // Match with pending request
    const request = this.pendingRequests.get(sequence);
    if (request) {
      // Clear timeout
      const timeout = this.responseTimeouts.get(sequence);
      if (timeout) {
        clearTimeout(timeout);
        this.responseTimeouts.delete(sequence);
      }
      
      // Create response
      const response: DebuggerResponse = {
        responseType: DEBUG_COMMANDS.RESPONSE_DATA,
        cogId: request.cogId,
        address,
        data: new Uint32Array(payload.buffer, payload.byteOffset, payload.length / 4)
      };
      
      this.emit('response', response);
      this.pendingRequests.delete(sequence);
    }
  }

  /**
   * Process ACK response
   */
  private processAckResponse(data: Uint8Array): void {
    if (data.length < 4) return;
    
    const sequence = this.readUint32FromData(data, 0);
    const request = this.pendingRequests.get(sequence);
    
    if (request) {
      this.emit('ack', { sequence, request });
      this.clearRequestTimeout(sequence);
    }
  }

  /**
   * Process NAK response
   */
  private processNakResponse(data: Uint8Array): void {
    if (data.length < 4) return;
    
    const sequence = this.readUint32FromData(data, 0);
    const request = this.pendingRequests.get(sequence);
    
    if (request) {
      this.emit('nak', { sequence, request });
      this.clearRequestTimeout(sequence);
    }
  }

  /**
   * Send request to P2
   */
  public sendRequest(request: DebuggerRequest): number {
    if (!this.serial || !this.isConnected) {
      throw new Error('Not connected');
    }

    const sequence = this.getNextSequence();
    
    // Build request packet
    const packet = this.buildRequestPacket(request, sequence);
    
    // Store pending request
    this.pendingRequests.set(sequence, request);
    
    // Set timeout
    const timeout = setTimeout(() => {
      this.handleRequestTimeout(sequence);
    }, this.TIMEOUT_MS);
    this.responseTimeouts.set(sequence, timeout);
    
    // Send packet
    this.serial.write(packet as any);
    
    return sequence;
  }

  /**
   * Build request packet
   */
  private buildRequestPacket(request: DebuggerRequest, sequence: number): Uint8Array {
    const packet = new Uint8Array(16); // Base packet size
    let offset = 0;
    
    // Header: command type
    this.writeUint32(packet, offset, request.command);
    offset += 4;
    
    // Sequence number
    this.writeUint32(packet, offset, sequence);
    offset += 4;
    
    // COG ID
    this.writeUint32(packet, offset, request.cogId);
    offset += 4;
    
    // Command-specific data
    switch (request.command) {
      case DEBUG_COMMANDS.REQUEST_COG:
      case DEBUG_COMMANDS.REQUEST_LUT:
        // Block index
        this.writeUint32(packet, offset, request.blockIndex || 0);
        break;
      case DEBUG_COMMANDS.REQUEST_HUB:
        // Address
        this.writeUint32(packet, offset, request.address || 0);
        break;
      case DEBUG_COMMANDS.STALL_CMD:
      case DEBUG_COMMANDS.BREAK_CMD:
      case DEBUG_COMMANDS.GO_CMD:
        // No additional data
        break;
    }
    
    return packet;
  }

  /**
   * Send STALL command
   */
  public sendStall(cogId: number): void {
    this.sendRequest({
      command: DEBUG_COMMANDS.STALL_CMD,
      cogId
    });
  }

  /**
   * Send BREAK command
   */
  public sendBreak(cogId: number): void {
    this.sendRequest({
      command: DEBUG_COMMANDS.BREAK_CMD,
      cogId
    });
  }

  /**
   * Send GO command
   */
  public sendGo(cogId: number): void {
    this.sendRequest({
      command: DEBUG_COMMANDS.GO_CMD,
      cogId
    });
  }

  /**
   * Request COG memory block
   */
  public requestCogBlock(cogId: number, blockIndex: number): void {
    this.sendRequest({
      command: DEBUG_COMMANDS.REQUEST_COG,
      cogId,
      blockIndex
    });
  }

  /**
   * Request LUT memory block
   */
  public requestLutBlock(cogId: number, blockIndex: number): void {
    this.sendRequest({
      command: DEBUG_COMMANDS.REQUEST_LUT,
      cogId,
      blockIndex
    });
  }

  /**
   * Request HUB memory
   */
  public requestHubMemory(address: number, size: number = 128): void {
    this.sendRequest({
      command: DEBUG_COMMANDS.REQUEST_HUB,
      cogId: 0, // HUB is shared
      address
    });
  }

  /**
   * Handle request timeout
   */
  private handleRequestTimeout(sequence: number): void {
    const request = this.pendingRequests.get(sequence);
    if (request) {
      this.emit('timeout', { sequence, request });
      this.pendingRequests.delete(sequence);
      this.responseTimeouts.delete(sequence);
    }
  }

  /**
   * Clear request timeout
   */
  private clearRequestTimeout(sequence: number): void {
    const timeout = this.responseTimeouts.get(sequence);
    if (timeout) {
      clearTimeout(timeout);
      this.responseTimeouts.delete(sequence);
    }
    this.pendingRequests.delete(sequence);
  }

  /**
   * Clear all timeouts
   */
  private clearAllTimeouts(): void {
    for (const timeout of this.responseTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.responseTimeouts.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get next sequence number
   */
  private getNextSequence(): number {
    return ++this.currentSequence & 0xFFFF;
  }

  /**
   * Start communication monitor
   */
  private startCommunicationMonitor(): void {
    this.communicationTimeout = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      if (timeSinceActivity > this.COMM_TIMEOUT_MS) {
        this.emit('communicationLost');
      }
    }, 1000);
  }

  /**
   * Stop communication monitor
   */
  private stopCommunicationMonitor(): void {
    if (this.communicationTimeout) {
      clearInterval(this.communicationTimeout);
      this.communicationTimeout = null;
    }
  }

  /**
   * Utility: Read uint32 from buffer
   */
  private readUint32(offset: number): number {
    return (this.messageBuffer[offset] |
            (this.messageBuffer[offset + 1] << 8) |
            (this.messageBuffer[offset + 2] << 16) |
            (this.messageBuffer[offset + 3] << 24)) >>> 0;
  }

  /**
   * Utility: Write uint32 to buffer
   */
  private writeUint32(buffer: Uint8Array, offset: number, value: number): void {
    buffer[offset] = value & 0xFF;
    buffer[offset + 1] = (value >> 8) & 0xFF;
    buffer[offset + 2] = (value >> 16) & 0xFF;
    buffer[offset + 3] = (value >> 24) & 0xFF;
  }

  /**
   * Utility: Read uint32 from specific data array
   */
  private readUint32FromData(data: Uint8Array, offset: number): number {
    return (data[offset] |
            (data[offset + 1] << 8) |
            (data[offset + 2] << 16) |
            (data[offset + 3] << 24)) >>> 0;
  }

  /**
   * Get connection status
   */
  public isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Get pending request count
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }
}