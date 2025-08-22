/** @format */

// src/classes/shared/debuggerMessageParser.ts

import { EventEmitter } from 'events';
import {
  DebuggerInitialMessage,
  DebuggerMessageIndex,
  DEBUG_COMMANDS,
  MEMORY_CONSTANTS
} from './debuggerConstants';

/**
 * Message types we can identify
 */
export enum MessageType {
  INITIAL_DEBUGGER = 'initial_debugger',    // 80-byte initial message
  DEBUGGER_PROTOCOL = 'debugger_protocol',  // 0xDB header messages
  TEXT = 'text',                            // Regular text/terminal output
  BINARY_UNKNOWN = 'binary_unknown'         // Unrecognized binary data
}

/**
 * Parsed message with type and formatted display
 */
export interface ParsedMessage {
  type: MessageType;
  cogId?: number;
  rawData: Uint8Array;
  displayText?: string;
  hexDisplay?: string;
  isComplete: boolean;
  timestamp: number;
}

/**
 * DebuggerMessageParser - Opportunistic parser for mixed text/binary P2 debug streams
 * 
 * Opportunistic Parsing:
 * - Always lurking for debugger packets regardless of mode
 * - Validates and extracts debugger messages when found
 * - Doesn't affect binary data flow, just recognizes and routes
 * 
 * Synchronization Strategy:
 * - DTR reset = immediate synchronization expected
 * - Mid-stream catch = careful validation before declaring sync
 * - Buffer >80 bytes before validating initial debugger messages
 * 
 * Features:
 * - Size-based synchronization for debugger messages
 * - Comprehensive validation beyond just length
 * - Pretty hex formatting with proper spacing
 * - Message isolation to prevent display corruption
 * - Window creation triggers on initial debugger message
 */
export class DebuggerMessageParser extends EventEmitter {
  // Circular buffer implementation - fixed 4K, never reallocated
  private readonly bufferSize: number = 4096;
  private buffer: Uint8Array = new Uint8Array(this.bufferSize);
  private head: number = 0;  // Read position (consume from here)
  private tail: number = 0;  // Write position (append here)
  private isSynchronized: boolean = false;
  private syncFromDTR: boolean = false;  // True if sync expected from DTR reset
  private incompleteMessage: Uint8Array | null = null;
  private expectedMessageSize: number = 0;

  constructor() {
    super();
  }

  /**
   * Signal DTR reset occurred - processor is resetting
   * DTR is the standard control line for Parallax Prop Plugs
   * This ONLY affects synchronization expectations, NOT the receive buffer
   */
  public onDTRReset(): void {
    // Mark that we expect synchronized data from a fresh processor start
    this.syncFromDTR = true;
    this.isSynchronized = true;
    this.emit('syncStatus', { synchronized: true, source: 'DTR' });
    // NOTE: Buffer is completely independent - it keeps running regardless
  }

  /**
   * Signal RTS reset occurred - processor is resetting
   * RTS is used by some FTDI clones and non-vendor devices
   * This ONLY affects synchronization expectations, NOT the receive buffer
   */
  public onRTSReset(): void {
    // Mark that we expect synchronized data from a fresh processor start
    // RTS reset is functionally identical to DTR reset
    this.syncFromDTR = true; // Use same flag since they're mutually exclusive
    this.isSynchronized = true;
    this.emit('syncStatus', { synchronized: true, source: 'RTS' });
    // NOTE: Buffer is completely independent - it keeps running regardless
  }

  /**
   * Get current synchronization status
   */
  public getSyncStatus(): { synchronized: boolean; source: string } {
    return {
      synchronized: this.isSynchronized,
      source: this.syncFromDTR ? 'DTR' : 'stream'
    };
  }

  /**
   * Process incoming data stream - append to circular buffer
   */
  public processData(data: Uint8Array): void {
    const availableBytes = this.getAvailableBytes();
    const usedBytes = this.getUsedBytes();
    
    console.log(`[PARSER] processData: received ${data.length} bytes, used=${usedBytes}, available=${availableBytes}`);
    
    // Log incoming data in hex/ASCII format (first 64 bytes)
    const hexLines: string[] = [];
    const bytesPerLine = 16;
    for (let offset = 0; offset < Math.min(data.length, 64); offset += bytesPerLine) {
      const lineBytes = data.slice(offset, Math.min(offset + bytesPerLine, data.length));
      let hexPart = '';
      for (let i = 0; i < bytesPerLine; i++) {
        if (i < lineBytes.length) {
          hexPart += `$${lineBytes[i].toString(16).toUpperCase().padStart(2, '0')} `;
        } else {
          hexPart += '    ';
        }
        if (i === 7) hexPart += ' ';
      }
      let asciiPart = '';
      for (let i = 0; i < lineBytes.length; i++) {
        const byte = lineBytes[i];
        asciiPart += (byte >= 0x20 && byte <= 0x7E) ? String.fromCharCode(byte) : '.';
      }
      const offsetHex = offset.toString(16).padStart(4, '0');
      hexLines.push(`  ${offsetHex}: ${hexPart}  ${asciiPart}`);
    }
    console.log('[PARSER INCOMING DATA]:');
    hexLines.forEach(line => console.log(line));
    
    // Check if we have space for new data
    if (data.length > availableBytes) {
      console.error(`[PARSER] Buffer overflow! Need ${data.length} bytes but only ${availableBytes} available`);
      // In a circular buffer, we could either drop old data or new data
      // For now, we'll drop the oldest data to make room
      const bytesToDrop = data.length - availableBytes;
      console.warn(`[PARSER] Dropping ${bytesToDrop} oldest bytes to make room`);
      this.head = (this.head + bytesToDrop) % this.bufferSize;
    }
    
    // Append data to circular buffer at tail position
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.tail] = data[i];
      this.tail = (this.tail + 1) % this.bufferSize;
    }
    
    console.log(`[PARSER] Circular buffer: head=${this.head}, tail=${this.tail}, used=${this.getUsedBytes()}`);

    // Parse messages from buffer
    this.parseBuffer();
  }
  
  /**
   * Get number of bytes available for writing
   */
  private getAvailableBytes(): number {
    if (this.tail >= this.head) {
      // Normal case: tail hasn't wrapped around yet
      return this.bufferSize - (this.tail - this.head) - 1; // -1 to distinguish full from empty
    } else {
      // Wrapped case: tail has wrapped around
      return this.head - this.tail - 1;
    }
  }
  
  /**
   * Get number of bytes currently in buffer
   */
  private getUsedBytes(): number {
    if (this.tail >= this.head) {
      return this.tail - this.head;
    } else {
      return this.bufferSize - this.head + this.tail;
    }
  }
  
  /**
   * Read bytes from circular buffer without consuming
   */
  private peekBytes(offset: number, length: number): Uint8Array | null {
    const usedBytes = this.getUsedBytes();
    if (offset + length > usedBytes) {
      return null; // Not enough data
    }
    
    const result = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      const pos = (this.head + offset + i) % this.bufferSize;
      result[i] = this.buffer[pos];
    }
    return result;
  }
  
  /**
   * Consume bytes from circular buffer
   */
  private consumeBytes(count: number): void {
    const usedBytes = this.getUsedBytes();
    if (count > usedBytes) {
      console.error(`[PARSER] Trying to consume ${count} bytes but only ${usedBytes} available`);
      count = usedBytes;
    }
    this.head = (this.head + count) % this.bufferSize;
    console.log(`[PARSER] Consumed ${count} bytes, new head=${this.head}`);
  }

  /**
   * Parse messages from internal buffer using circular buffer
   * NEW ALGORITHM: Text first, then 0xDB, then 80-byte packets
   */
  private parseBuffer(): void {
    while (this.getUsedBytes() > 0) {
      const usedBytes = this.getUsedBytes();
      
      // Peek at data without consuming it
      const peekSize = Math.min(usedBytes, 256); // Look at up to 256 bytes
      const currentData = this.peekBytes(0, peekSize);
      if (!currentData) break;

      // FIRST: Check if current position looks like P2 text
      if (this.looksLikeP2Text(currentData, 0)) {
        // Find EOL
        const eolPos = this.findEOL(currentData, 0);
        if (eolPos === -1) {
          // No EOL yet, wait for more data
          console.log(`[PARSE] Text detected but no EOL yet, waiting for more data`);
          break;
        }
        
        // Extract complete line including EOL
        const textLine = currentData.slice(0, eolPos);
        this.emitTextMessage(textLine);
        this.consumeBytes(eolPos);  // Consume the text line from circular buffer
        
        // Mark synchronized if we got good text
        if (!this.isSynchronized) {
          this.isSynchronized = true;
          this.emit('syncStatus', { synchronized: true, source: 'text' });
        }
        continue;
      }

      // SECOND: Check for 0xDB header (debugger protocol message)
      if (currentData[0] === 0xDB && usedBytes >= 4) {
        const header = this.readUint32LE(currentData, 0);
        const messageType = (header >> 8) & 0xFF;  // Second byte is message type
        const payloadSize = (header >> 16) & 0xFFFF;  // Bytes 3-4 are payload size
        const totalSize = 4 + payloadSize;

        console.log(`[PARSE] Found 0xDB packet: type=0x${messageType.toString(16)}, payload=${payloadSize}, total=${totalSize}`);

        // Validate payload size is reasonable (max 4KB typical)
        if (payloadSize <= 4096) {
          if (usedBytes >= totalSize) {
            // Complete protocol message found!
            const message = this.peekBytes(0, totalSize);
            if (message) {
              this.emitDebuggerProtocolMessage(message, messageType);
              this.consumeBytes(totalSize);
            
            // We found valid debugger traffic - mark as synchronized
            if (!this.isSynchronized) {
              this.isSynchronized = true;
              this.emit('syncStatus', { synchronized: true, source: 'protocol' });
            }
            continue;
            }
          } else {
            // Wait for complete message
            console.log(`[PARSE] 0xDB packet incomplete, need ${totalSize} bytes, have ${usedBytes}`);
            break;
          }
        } else {
          console.log(`[PARSE] Invalid 0xDB packet payload size: ${payloadSize}`);
          // Skip this byte and try again
          this.consumeBytes(1);
          continue;
        }
      }

      // THIRD: Check for 80-byte initial debugger packet
      // Only if we have at least 80 bytes and first byte could be valid COG
      if (usedBytes >= 80) {
        // Check if first byte (part of COG number) is in valid range
        const firstByte = currentData[0];
        
        // For 80-byte packets, COG is a 32-bit LE number, so first byte should be 0-7
        if (firstByte <= 7) {
          // Check if we have 81+ bytes to verify text follows
          if (usedBytes > 80) {
            // Look at position 80 (first byte after the 80-byte packet)
            if (this.looksLikeP2Text(currentData, 80)) {
              console.log(`[PARSE] Found text at position 80 - treating first 80 bytes as debugger packet`);
              
              // Validate and emit the 80-byte packet
              if (this.isValidInitialMessage(currentData)) {
                const message = this.peekBytes(0, 80);
                if (message) {
                  this.emitInitialDebuggerMessage(message);
                  this.consumeBytes(80);
                
                if (!this.isSynchronized) {
                  this.isSynchronized = true;
                  this.emit('syncStatus', { synchronized: true, source: 'initial' });
                }
                  continue;
                }
              }
            }
          } else if (usedBytes === 80) {
            // Exactly 80 bytes at end of buffer - might be debugger packet
            console.log(`[PARSE] Exactly 80 bytes at end, checking if valid debugger packet`);
            if (this.isValidInitialMessage(currentData)) {
              const message = this.peekBytes(0, 80);
              if (message) {
                this.emitInitialDebuggerMessage(message);
                this.consumeBytes(80);
              
              if (!this.isSynchronized) {
                this.isSynchronized = true;
                this.emit('syncStatus', { synchronized: true, source: 'initial' });
              }
              continue;
            }
          }
        }
      } else {
        // Not enough data for 80-byte packet
        console.log(`[PARSE] Not text, not 0xDB, only ${remaining} bytes, waiting for 80+`);
        break;
      }

      // OLD CODE KEPT FOR REFERENCE (commented out):
      /*
      // OPPORTUNISTIC: Check for 80-byte initial debugger message
      if (remaining >= 80) {
        if (this.isValidInitialMessage(currentData)) {
          const message = currentData.slice(0, 80);
          this.emitInitialDebuggerMessage(message);
          processed += 80;
          
          // Initial message is good sync indicator if we validated it
          if (!this.isSynchronized) {
            this.isSynchronized = true;
            this.emit('syncStatus', { synchronized: true, source: 'initial' });
          }
          continue;
        }
      }
      
      // Sophisticated boundary detection for mixed binary/text streams
      // Use EOL markers to intelligently split binary from ASCII text
      const boundary = this.findBinaryTextBoundary(currentData);
      
      if (boundary.found) {
        console.log(`[BOUNDARY] Found boundary at offset ${boundary.offset}: binary=${boundary.binaryLength} bytes, text="${boundary.textPreview}"`);
        
        // Process binary portion if any
        if (boundary.binaryLength > 0) {
          const binaryChunk = currentData.slice(0, boundary.binaryLength);
          this.emitUnknownBinaryMessage(binaryChunk);
          processed += boundary.binaryLength;
          continue;
        }
        
        // Process text portion  
        if (boundary.textLength > 0) {
          const textChunk = currentData.slice(boundary.binaryLength, boundary.offset);
          this.emitTextMessage(textChunk);
          processed += boundary.textLength;
          
          // Good text is sync indicator
          if (!this.isSynchronized && textChunk.length > 10) {
            this.isSynchronized = true;
            this.emit('syncStatus', { synchronized: true, source: 'text' });
          }
          continue;
        }
      }
      */
      
      // Fallback: no clear pattern found
      // If we have a lot of data, process conservatively
      if (remaining >= 256) {
        console.log(`[PARSE] No clear pattern in ${remaining} bytes - processing as unknown binary`);
        const chunk = currentData.slice(0, 256);
        this.emitUnknownBinaryMessage(chunk);
        processed += 256;
        continue;
      }
      
      // Not enough data for reliable processing, wait for more
      break;
    }

    // Move unprocessed data to beginning of buffer
    // TODO: Implement circular buffer to avoid this copying
    if (processed > 0) {
      const unprocessedBytes = this.bufferPos - processed;
      if (unprocessedBytes > 0) {
        console.log(`[PARSER] Moving ${unprocessedBytes} unprocessed bytes to start (processed ${processed} of ${this.bufferPos})`);
        // Use memmove-style copy for overlapping regions
        const temp = new Uint8Array(unprocessedBytes);
        temp.set(this.buffer.subarray(processed, this.bufferPos));
        this.buffer.set(temp, 0);
        this.bufferPos = unprocessedBytes;
      } else {
        this.bufferPos = 0;
      }
    }
  }

  /**
   * Validate initial debugger message (80 bytes, 20 longs)
   * More comprehensive validation than just length
   */
  private isValidInitialMessage(data: Uint8Array): boolean {
    if (data.length < 80) return false;

    // Convert to 32-bit values for validation
    const longs = new Uint32Array(20);
    for (let i = 0; i < 20; i++) {
      longs[i] = this.readUint32LE(data, i * 4);
    }

    // Extract all validation fields first
    const cogNum = longs[DebuggerMessageIndex.mCOGN];
    const pc = longs[DebuggerMessageIndex.mPC];
    const stackA = longs[DebuggerMessageIndex.mSTAS];
    const stackB = longs[DebuggerMessageIndex.mSTBS];
    const callDepth = longs[DebuggerMessageIndex.mCALL];
    const ptrA = longs[DebuggerMessageIndex.mPTRA];
    const ptrB = longs[DebuggerMessageIndex.mPTRB];

    // Perform validation checks for logging purposes
    const cogValid = cogNum <= 7;
    const pcValid = pc <= 0x80000;
    const stackAValid = stackA <= 0x7FFFF;
    const stackBValid = stackB <= 0x7FFFF;
    const callDepthValid = callDepth <= 32;
    const ptrAValid = ptrA <= 0x7FFFF;
    const ptrBValid = ptrB <= 0x7FFFF;

    // Log all validation checks with pass/fail status
    console.log(`[DEBUGGER VALIDATION] === Checking 80-byte packet ===`);
    console.log(`[DEBUGGER VALIDATION] COG Number: ${cogNum} (≤7) - ${cogValid ? 'PASS' : 'FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] PC: 0x${pc.toString(16)} (≤0x80000) - ${pcValid ? 'PASS' : 'FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] Stack A: 0x${stackA.toString(16)} (≤0x7FFFF) - ${stackAValid ? 'PASS' : 'FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] Stack B: 0x${stackB.toString(16)} (≤0x7FFFF) - ${stackBValid ? 'PASS' : 'FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] Call Depth: ${callDepth} (≤32) - ${callDepthValid ? 'PASS' : 'FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] Ptr A: 0x${ptrA.toString(16)} (≤0x7FFFF) - ${ptrAValid ? 'PASS' : 'FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] Ptr B: 0x${ptrB.toString(16)} (≤0x7FFFF) - ${ptrBValid ? 'PASS' : 'FAIL'}`);

    // For now, ALWAYS ACCEPT to see what's happening - but log validation results
    console.log(`[DEBUGGER VALIDATION] ACCEPTED FOR ANALYSIS - Validation: ${cogValid && pcValid && callDepthValid ? 'Would PASS' : 'Would FAIL'}`);
    console.log(`[DEBUGGER VALIDATION] =======================================`);

    // Always return true for now to gather data
    return true;
  }

  /**
   * Check if data appears to be text
   */
  private isTextData(data: Uint8Array): boolean {
    let textChars = 0;
    let totalChars = Math.min(data.length, 100); // Sample first 100 bytes

    for (let i = 0; i < totalChars; i++) {
      const byte = data[i];
      // Count printable ASCII + common control chars (CR, LF, TAB)
      if ((byte >= 0x20 && byte <= 0x7E) || 
          byte === 0x09 || byte === 0x0A || byte === 0x0D) {
        textChars++;
      }
    }

    // If >80% are text characters, treat as text
    return (textChars / totalChars) > 0.8;
  }

  /**
   * Find next message boundary
   */
  private findNextBoundary(data: Uint8Array): number {
    for (let i = 0; i < data.length; i++) {
      // Check for newline
      if (data[i] === 0x0A || data[i] === 0x0D) {
        return i + 1;
      }
      // Check for 0xDB marker
      if (data[i] === 0xDB && i + 4 <= data.length) {
        return i;
      }
      // Check for 80-byte boundary if we have enough data
      if ((i % 80) === 0 && i > 0 && (i + 80) <= data.length) {
        // Validate if next 80 bytes could be initial message
        if (this.isValidInitialMessage(data.slice(i, i + 80))) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Format debugger message with nice display
   * 32 bytes per row with proper spacing:
   * - Single space between each byte
   * - Double space at 8-byte boundaries
   * - Triple space at 16-byte boundaries
   */
  private formatDebuggerMessage(data: Uint8Array, title: string): string {
    const lines: string[] = [];
    
    // Extract COG ID using proper 32-bit little-endian for 80-byte packets
    let cogId = -1;
    if (data.length === 80) {
      cogId = this.readUint32LE(data, 0); // Use proper 32-bit extraction, not just first byte
    }
    const prefix = cogId >= 0 && cogId <= 7 ? `Cog ${cogId} ` : '';
    const indent = ' '.repeat(prefix.length);
    
    for (let offset = 0; offset < data.length; offset += 32) {
      const lineBytes = Math.min(32, data.length - offset);
      
      // Build hex offset (0x00, 0x20, 0x40)
      const hexOffset = `0x${offset.toString(16).padStart(2, '0').toUpperCase()}:`;
      
      // First line gets COG prefix, others get indent
      const linePrefix = offset === 0 ? prefix : indent;
      let hexLine = `${linePrefix}${hexOffset} `;
      
      for (let i = 0; i < lineBytes; i++) {
        const byte = data[offset + i];
        hexLine += `$${byte.toString(16).padStart(2, '0').toUpperCase()}`;
        
        // Add spacing for visual grouping
        if ((i + 1) % 16 === 0 && i < lineBytes - 1) {
          hexLine += '  '; // Double space at 16-byte boundary
        } else if ((i + 1) % 8 === 0 && i < lineBytes - 1) {
          hexLine += '  '; // Double space at 8-byte boundary  
        } else if (i < lineBytes - 1) {
          hexLine += ' ';  // Single space between bytes
        }
      }
      
      lines.push(hexLine);
    }
    
    return lines.join('\n');
  }

  /**
   * Format unknown binary data as hex dump
   * Two-column hex + ASCII representation
   */
  private formatBinaryHexDump(data: Uint8Array): string {
    const lines: string[] = [];
    lines.push(`=== Binary Data (${data.length} bytes) ===`);
    
    for (let offset = 0; offset < data.length; offset += 16) {
      const lineBytes = Math.min(16, data.length - offset);
      let hexPart = `${offset.toString(16).padStart(4, '0')}: `;
      let asciiPart = '';
      
      // Hex columns
      for (let i = 0; i < 16; i++) {
        if (i < lineBytes) {
          const byte = data[offset + i];
          hexPart += `$${byte.toString(16).padStart(2, '0').toUpperCase()} `;
          // ASCII representation
          asciiPart += (byte >= 0x20 && byte <= 0x7E) ? String.fromCharCode(byte) : '.';
        } else {
          hexPart += '    '; // Empty space for alignment
        }
        
        // Add extra space in middle for readability
        if (i === 7) hexPart += ' ';
      }
      
      lines.push(`${hexPart} |${asciiPart}|`);
    }
    
    return lines.join('\\n');
  }

  /**
   * Emit initial debugger message
   */
  private emitInitialDebuggerMessage(data: Uint8Array): void {
    const longs = new Uint32Array(20);
    for (let i = 0; i < 20; i++) {
      longs[i] = this.readUint32LE(data, i * 4);
    }

    const cogId = longs[DebuggerMessageIndex.mCOGN];
    const displayText = this.formatDebuggerMessage(data, `Initial Debugger Message - COG ${cogId}`);

    const message: ParsedMessage = {
      type: MessageType.INITIAL_DEBUGGER,
      cogId,
      rawData: data,
      displayText,
      hexDisplay: displayText,
      isComplete: true,
      timestamp: Date.now()
    };

    this.emit('message', message);
  }

  /**
   * Emit debugger protocol message
   */
  private emitDebuggerProtocolMessage(data: Uint8Array, messageType: number): void {
    const displayText = this.formatDebuggerMessage(data, `Debugger Protocol - Type 0x${messageType.toString(16)}`);

    const message: ParsedMessage = {
      type: MessageType.DEBUGGER_PROTOCOL,
      rawData: data,
      displayText,
      hexDisplay: displayText,
      isComplete: true,
      timestamp: Date.now()
    };

    this.emit('message', message);
  }

  /**
   * Emit text message
   */
  private emitTextMessage(data: Uint8Array): void {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);

    const message: ParsedMessage = {
      type: MessageType.TEXT,
      rawData: data,
      displayText: text,
      isComplete: true,
      timestamp: Date.now()
    };

    this.emit('message', message);
  }

  /**
   * Emit unknown binary message
   */
  private emitUnknownBinaryMessage(data: Uint8Array): void {
    const hexDisplay = this.formatBinaryHexDump(data);

    const message: ParsedMessage = {
      type: MessageType.BINARY_UNKNOWN,
      rawData: data,
      displayText: hexDisplay,
      hexDisplay,
      isComplete: true,
      timestamp: Date.now()
    };

    this.emit('message', message);
  }

  /**
   * Read 32-bit little-endian value
   */
  private readUint32LE(data: Uint8Array, offset: number): number {
    return data[offset] |
           (data[offset + 1] << 8) |
           (data[offset + 2] << 16) |
           (data[offset + 3] << 24);
  }

  /**
   * Sophisticated binary/text boundary detection using EOL markers
   * 
   * Algorithm from user guidance:
   * 1. Find EOL in data 
   * 2. Look backwards - is there valid ASCII text start?
   * 3. If not - EOL is in binary, keep looking for next EOL
   * 4. If yes - split there: binary packet ends, ASCII text starts
   */
  private findBinaryTextBoundary(data: Uint8Array): {
    found: boolean;
    offset: number;
    binaryLength: number;
    textLength: number;
    textPreview: string;
  } {
    const result = {
      found: false,
      offset: 0,
      binaryLength: 0,
      textLength: 0,
      textPreview: ''
    };

    // Hunt for LF or CR characters
    for (let i = 0; i < data.length; i++) {
      // Found an LF or CR - now check if it's part of a two-character pair
      if (data[i] === 0x0A || data[i] === 0x0D) {
        let eolLength = 1;  // Default to single character
        let eolType = data[i] === 0x0A ? 'LF' : 'CR';
        
        // Check if it's really a two-character pair
        if (i + 1 < data.length) {
          const nextChar = data[i + 1];
          if ((data[i] === 0x0A && nextChar === 0x0D) || 
              (data[i] === 0x0D && nextChar === 0x0A)) {
            // It's a two-character pair
            eolLength = 2;
            eolType = data[i] === 0x0A ? 'LFCR' : 'CRLF';
          }
        }
        
        // Work backwards to see if we have proper ASCII text (without binary in between)
        let textStart = this.findASCIITextStart(data, i + eolLength - 1);
        
        if (textStart !== -1) {
          // Found valid ASCII text start
          result.found = true;
          result.offset = i + eolLength;
          result.binaryLength = textStart;
          result.textLength = (i + eolLength) - textStart;
          
          // Create preview of the text found
          const textBytes = data.slice(textStart, i + eolLength);
          result.textPreview = new TextDecoder('utf-8', { fatal: false })
            .decode(textBytes).replace(/[\\r\\n]/g, '\\\\n').substring(0, 50);
          
          console.log(`[BOUNDARY DEBUG] ${eolType} at ${i}, text starts at ${textStart}, binary=${result.binaryLength}, text="${result.textPreview}"`);
          return result;
        } else {
          console.log(`[BOUNDARY DEBUG] ${eolType} at ${i} but no valid ASCII text start - continuing search`);
        }
        
        // Skip the right number of characters when moving forward
        if (eolLength === 2) {
          i++; // Skip both characters of the pair
        }
        // If single character, the for-loop i++ handles it automatically
      }
    }

    return result;
  }

  /**
   * Find the start of valid ASCII text working backwards from EOL
   * Returns -1 if no valid ASCII text start found
   */
  private findASCIITextStart(data: Uint8Array, eolIndex: number): number {
    // Look backwards from EOL to find start of ASCII text
    // Text should start with "Cog" or backtick or other valid P2 message starters
    
    for (let start = Math.max(0, eolIndex - 100); start < eolIndex; start++) {
      const remainingLength = eolIndex - start;
      if (remainingLength < 4) continue; // Need at least "CogN" 
      
      // Check if this could be start of a valid message
      if (this.couldBeMessageStart(data, start, eolIndex)) {
        // Verify the entire segment looks like ASCII text
        const segment = data.slice(start, eolIndex);
        if (this.isTextData(segment)) {
          return start;
        }
      }
    }
    
    return -1;
  }

  /**
   * Check if data starting at offset could be the beginning of a P2 message
   */
  private couldBeMessageStart(data: Uint8Array, start: number, end: number): boolean {
    const length = end - start;
    if (length < 3) return false;
    
    // Convert to string for pattern matching
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data.slice(start, Math.min(start + 20, end)));
      
      // Check for common P2 message patterns
      if (text.startsWith('Cog')) return true;      // "Cog0", "Cog1", etc.
      if (text.startsWith('`')) return true;        // Backtick commands
      if (text.includes('INIT')) return true;       // "INIT" messages
      if (text.startsWith('Prop')) return true;     // "Prop_" messages
      if (/^[A-Za-z0-9_]/.test(text)) return true; // Starts with alphanumeric
      
      return false;
    } catch (e) {
      // Not valid UTF-8, definitely not ASCII text start
      return false;
    }
  }

  /**
   * Check if current position looks like start of P2 text message
   * Simpler version for forward scanning
   */
  private looksLikeP2Text(data: Uint8Array, offset: number): boolean {
    if (offset + 3 >= data.length) return false;
    
    // Check for "Cog" followed by digit
    if (data[offset] === 0x43 && data[offset+1] === 0x6F && data[offset+2] === 0x67) { // "Cog"
      if (offset + 3 < data.length && data[offset+3] >= 0x30 && data[offset+3] <= 0x39) { // '0'-'9'
        return true;
      }
    }
    
    // Check for backtick
    if (data[offset] === 0x60) { // '`'
      return true;
    }
    
    // For broader text detection, check if first 10 chars look like text
    const checkLen = Math.min(10, data.length - offset);
    let textCount = 0;
    for (let i = 0; i < checkLen; i++) {
      const byte = data[offset + i];
      if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x09 || byte === 0x0A || byte === 0x0D) {
        textCount++;
      }
    }
    
    return textCount >= 8; // 80% text chars
  }

  /**
   * Find end of line (CR, LF, CRLF, or LFCR)
   * Returns offset after EOL, or -1 if not found
   */
  private findEOL(data: Uint8Array, start: number): number {
    for (let i = start; i < data.length; i++) {
      if (data[i] === 0x0A) { // LF
        // Check for LFCR
        if (i + 1 < data.length && data[i + 1] === 0x0D) {
          return i + 2; // Skip both
        }
        return i + 1; // Just LF
      } else if (data[i] === 0x0D) { // CR
        // Check for CRLF
        if (i + 1 < data.length && data[i + 1] === 0x0A) {
          return i + 2; // Skip both
        }
        return i + 1; // Just CR
      }
    }
    return -1; // No EOL found
  }
}