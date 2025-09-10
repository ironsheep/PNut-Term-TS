/** @format */

// src/classes/shared/messageExtractor.ts

import { EventEmitter } from 'events';
import { CircularBuffer, NextStatus } from './circularBuffer';
import { DynamicQueue } from './dynamicQueue';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * Two-Tier Pattern Matching: Message Classification by Confidence Level
 * Based on Pascal study decisions for P2 message routing
 */
export enum MessageType {
  // TIER 1: VERY DISTINCTIVE (Always route correctly)
  DB_PACKET = 'DB_PACKET',                    // 0xDB binary protocol packets
  COG_MESSAGE = 'COG_MESSAGE',                // "Cog[0-7]:" text patterns
  BACKTICK_WINDOW = 'BACKTICK_WINDOW',        // Backtick window commands with catalog validation
  
  // TIER 2: NEEDS CONTEXT VALIDATION  
  DEBUGGER_416BYTE = 'DEBUGGER_416BYTE',      // COG ID (0-7) + 415 bytes (full packet)
  P2_SYSTEM_INIT = 'P2_SYSTEM_INIT',          // "Cog0 INIT $0000_0000 $0000_0000 load"
  
  // DEFAULT ROUTE
  TERMINAL_OUTPUT = 'TERMINAL_OUTPUT',        // Everything else → Terminal (blue window)
  
  // SPECIAL CASES  
  INCOMPLETE_DEBUG = 'INCOMPLETE_DEBUG',      // Partial debug messages with warning
  INVALID_COG = 'INVALID_COG'                // Invalid COG ID → Debug Logger with warning
}

/**
 * Two-Tier Pattern Matching: Pattern Definition Types
 */
export enum PatternElementType {
  EXACT_BYTE = 'EXACT_BYTE',           // { type: 'exact', value: 0xDB }
  ANY_BYTE = 'ANY_BYTE',               // { type: 'any', length: 1 }
  LENGTH_FIELD = 'LENGTH_FIELD',       // { type: 'length_field', bytes: 2 }
  UNTIL_BYTE = 'UNTIL_BYTE',           // { type: 'until', value: 0x20 }
  COG_ID_RANGE = 'COG_ID_RANGE',       // { type: 'cog_range', min: 0, max: 7 } - ASCII COG IDs '0'-'7'
  COG_ID_BINARY = 'COG_ID_BINARY',     // { type: 'cog_binary', min: 0, max: 7 } - Binary COG IDs 0x00-0x07
  TEXT_PATTERN = 'TEXT_PATTERN',       // { type: 'text', pattern: "Cog" }
  TERMINATOR = 'TERMINATOR'            // { type: 'terminator', value: 0x0D }
}

export interface PatternElement {
  type: PatternElementType;
  value?: number | string;
  length?: number;
  bytes?: number;
  min?: number;
  max?: number;
  pattern?: string;
  caseSensitive?: boolean;
}

/**
 * Message Pattern Definition for Two-Tier Matching
 */
export interface MessagePattern {
  messageType: MessageType;
  confidence: 'VERY_DISTINCTIVE' | 'DISTINCTIVE' | 'NEEDS_CONTEXT';
  tier1Pattern: PatternElement[];    // Pattern recognition
  tier2Validation?: string[];        // Validation rules for tier 2
  priority: number;                  // Processing order (lower = higher priority)
  description: string;
}

/**
 * Extracted message with enhanced Two-Tier metadata and reference counting
 */
export interface ExtractedMessage {
  type: MessageType;
  data: Uint8Array;
  timestamp: number;
  confidence: 'VERY_DISTINCTIVE' | 'DISTINCTIVE' | 'NEEDS_CONTEXT' | 'DEFAULT';
  
  // Reference counting for single-copy message passing
  consumerCount?: number;       // Total number of consumers
  consumersRemaining?: number;  // How many consumers still need this message
  disposed?: boolean;            // Flag to catch double-release bugs
  poolId?: number;              // ID from message pool for tracking
  
  metadata?: {
    cogId?: number;
    windowCommand?: string;
    payloadSize?: number;
    validationStatus?: 'COMPLETE' | 'INCOMPLETE' | 'INVALID';
    warningMessage?: string;
    patternMatched?: string;
  };
}

/**
 * MessageExtractor - Two-Tier Pattern Matching with Single Forward Scan
 * 
 * Based on Pascal study architectural decisions for P2 serial message routing.
 * Implements Two-Tier Pattern Matching with confidence-based classification.
 * 
 * TIER 1 - PATTERN RECOGNITION (What type of message is this?)
 * - Recognize basic message patterns without full validation
 * - Priority-ordered pattern matching (0xDB → COG → Backtick → 80-byte)
 * - Fast pattern recognition for immediate classification
 * 
 * TIER 2 - COMPLETENESS VALIDATION (Is the message complete and valid?)
 * - Validate full payload received for 0xDB packets
 * - Validate COG ID ranges and terminators for text messages
 * - Validate catalog entries for window commands  
 * - Context validation for 80-byte debugger packets
 * 
 * ROUTING PHILOSOPHY: "Terminal FIRST, Debugger SECOND"
 * - Everything routes to Terminal (blue window) unless proven to be debug data
 * - Invalid debug messages → Debug Logger with warnings, not Terminal
 * - Partial messages → Intended destination with INCOMPLETE warning
 * 
 * SINGLE-PASS PROCESSING (No putbacks, more efficient than Chip's Pascal)
 * - Never rescans data using position save/restore for backtrack scenarios
 * - Handles partial messages by waiting for completion
 * - Advances buffer only after successful extraction or definitive routing decision
 * 
 * DEFENSIVE PATTERN MATCHING
 * - Handles P2 protocol ambiguities with confidence levels
 * - Pattern validation prevents misrouting binary data to terminal
 * - Context-aware 80-byte packet detection
 */

export class MessageExtractor extends EventEmitter {
  private buffer: CircularBuffer;
  private outputQueue: DynamicQueue<ExtractedMessage>;
  private lastScanPosition: number = 0;
  private partialMessageDetected: boolean = false;
  
  // Zero-byte filtering state (for hardware issues causing spurious COG0 debugger packets)
  private justProcessedDebuggerPacket: boolean = false;
  
  // Batch extraction configuration
  private readonly MAX_BATCH_SIZE = 100;  // Process up to 100 messages per batch
  private readonly MAX_BATCH_TIME_MS = 10; // Process for up to 10ms
  
  // Batch extraction metrics
  private totalBatches = 0;
  private totalBatchTime = 0;
  private totalBatchMessages = 0;
  private largestBatch = 0;
  
  // Statistics
  private messagesExtracted: Record<MessageType, number> = {
    [MessageType.DB_PACKET]: 0,
    [MessageType.COG_MESSAGE]: 0,
    [MessageType.BACKTICK_WINDOW]: 0,
    [MessageType.DEBUGGER_416BYTE]: 0,
    [MessageType.P2_SYSTEM_INIT]: 0,
    [MessageType.TERMINAL_OUTPUT]: 0,
    [MessageType.INCOMPLETE_DEBUG]: 0,
    [MessageType.INVALID_COG]: 0
  };
  private partialMessageWaits: number = 0;
  private totalBytesExtracted: number = 0;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;

  // Two-Tier Pattern Definitions (Pascal study decisions)
  private readonly MESSAGE_PATTERNS: MessagePattern[] = [
    // TIER 1: 0xDB Packets - VERY DISTINCTIVE (Priority 1)
    {
      messageType: MessageType.DB_PACKET,
      confidence: 'VERY_DISTINCTIVE', 
      tier1Pattern: [
        { type: PatternElementType.EXACT_BYTE, value: 0xDB },
        { type: PatternElementType.ANY_BYTE, length: 1 },      // Subtype
        { type: PatternElementType.LENGTH_FIELD, bytes: 2 }    // Payload length
      ],
      tier2Validation: ['VALIDATE_PAYLOAD_RECEIVED', 'VALIDATE_CHECKSUM'],
      priority: 1,
      description: '0xDB protocol packets with length validation'
    },

    // TIER 1: COG Messages - DISTINCTIVE (Priority 2)
    {
      messageType: MessageType.COG_MESSAGE,
      confidence: 'DISTINCTIVE',
      tier1Pattern: [
        { type: PatternElementType.TEXT_PATTERN, pattern: 'Cog', caseSensitive: true },
        { type: PatternElementType.COG_ID_RANGE, min: 0, max: 7 },
        { type: PatternElementType.EXACT_BYTE, value: 0x20 },   // ' ' (first space)
        { type: PatternElementType.EXACT_BYTE, value: 0x20 }    // ' ' (second space)
      ],
      tier2Validation: ['VALIDATE_COG_ID', 'VALIDATE_CR_TERMINATOR'],
      priority: 2,
      description: 'COG messages with two spaces after COG ID (no colon)'
    },

    // TIER 1: P2 System Init - VERY DISTINCTIVE (Priority 3)
    {
      messageType: MessageType.P2_SYSTEM_INIT,
      confidence: 'VERY_DISTINCTIVE',
      tier1Pattern: [
        { type: PatternElementType.TEXT_PATTERN, pattern: 'Cog0 INIT $0000_0000 $0000_0000 load', caseSensitive: true }
      ],
      tier2Validation: ['VALIDATE_P2_SYSTEM_INIT_EOL'],
      priority: 3,
      description: 'P2 system reboot synchronization marker'
    },

    // TIER 1: Backtick Window Commands - DISTINCTIVE (Priority 4)
    {
      messageType: MessageType.BACKTICK_WINDOW,
      confidence: 'DISTINCTIVE',
      tier1Pattern: [
        { type: PatternElementType.EXACT_BYTE, value: 0x60 },   // Backtick
        { type: PatternElementType.UNTIL_BYTE, value: 0x20 }    // Extract to space
      ],
      tier2Validation: ['VALIDATE_WINDOW_CATALOG', 'VALIDATE_CR_TERMINATOR'],
      priority: 4,
      description: 'Backtick window commands with catalog validation'
    },

    // TIER 2: 416-byte Debugger Packet - NEEDS CONTEXT (Priority 5)
    {
      messageType: MessageType.DEBUGGER_416BYTE,
      confidence: 'NEEDS_CONTEXT',
      tier1Pattern: [
        { type: PatternElementType.COG_ID_BINARY, min: 0, max: 7 },
        { type: PatternElementType.ANY_BYTE, length: 415 }       // Remaining packet data (40 status + 128 CRC + 248 hub)
      ],
      tier2Validation: ['VALIDATE_DEBUGGER_PACKET_SIZE', 'VALIDATE_COG_CONTEXT'],
      priority: 5,
      description: '416-byte debugger packets: 40-byte status + 128-byte CRC + 248-byte hub checksums'
    }
  ];

  constructor(buffer: CircularBuffer, outputQueue: DynamicQueue<ExtractedMessage>) {
    super();
    this.buffer = buffer;
    this.outputQueue = outputQueue;
  }

  /**
   * Set performance monitor for instrumentation
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * TIER 1: Pattern Recognition Engine
   * Attempts to match buffer data against known patterns
   */
  private matchPattern(pattern: MessagePattern): { matched: boolean; length: number; metadata?: any } {
    this.buffer.savePosition();
    let matchedLength = 0;
    const metadata: any = {};

    try {
      for (const element of pattern.tier1Pattern) {
        const result = this.matchPatternElement(element, metadata);
        if (!result.matched) {
          this.buffer.restorePosition();
          return { matched: false, length: 0 };
        }
        matchedLength += result.length;
      }

      // Pattern matched successfully
      this.buffer.restorePosition(); // Reset for actual extraction
      return { matched: true, length: matchedLength, metadata };
    } catch (error) {
      this.buffer.restorePosition();
      return { matched: false, length: 0 };
    }
  }

  /**
   * Match individual pattern elements
   */
  private matchPatternElement(element: PatternElement, metadata: any): { matched: boolean; length: number } {
    switch (element.type) {
      case PatternElementType.EXACT_BYTE:
        return this.matchExactByte(element.value as number);

      case PatternElementType.ANY_BYTE:
        return this.matchAnyBytes(element.length || 1);

      case PatternElementType.LENGTH_FIELD:
        return this.matchLengthField(element.bytes || 2, metadata);

      case PatternElementType.UNTIL_BYTE:
        return this.matchUntilByte(element.value as number, metadata);

      case PatternElementType.COG_ID_RANGE:
        return this.matchCogIdRange(element.min || 0, element.max || 7, metadata);

      case PatternElementType.COG_ID_BINARY:
        return this.matchCogIdBinary(element.min || 0, element.max || 7, metadata);

      case PatternElementType.TEXT_PATTERN:
        return this.matchTextPattern(element.pattern!, element.caseSensitive || false);

      case PatternElementType.TERMINATOR:
        return this.matchExactByte(element.value as number);

      default:
        return { matched: false, length: 0 };
    }
  }

  /**
   * Match exact byte value
   */
  private matchExactByte(expectedValue: number): { matched: boolean; length: number } {
    const result = this.buffer.next();
    if (result.status === NextStatus.DATA && result.value === expectedValue) {
      return { matched: true, length: 1 };
    }
    return { matched: false, length: 0 };
  }

  /**
   * Match any sequence of bytes
   */
  private matchAnyBytes(length: number): { matched: boolean; length: number } {
    for (let i = 0; i < length; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        return { matched: false, length: 0 };
      }
    }
    return { matched: true, length };
  }

  /**
   * Match and extract length field
   */
  private matchLengthField(bytes: number, metadata: any): { matched: boolean; length: number } {
    let payloadLength = 0;
    for (let i = 0; i < bytes; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        return { matched: false, length: 0 };
      }
      payloadLength |= (result.value! << (i * 8)); // Little-endian
    }
    metadata.payloadSize = payloadLength;
    return { matched: true, length: bytes };
  }

  /**
   * Match until specific byte value
   */
  private matchUntilByte(terminator: number, metadata: any): { matched: boolean; length: number } {
    let length = 0;
    let command = '';
    
    while (length < 256) { // Prevent infinite loops
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        return { matched: false, length: 0 };
      }
      
      length++;
      if (result.value === terminator) {
        metadata.windowCommand = command;
        return { matched: true, length };
      }
      
      command += String.fromCharCode(result.value!);
    }
    return { matched: false, length: 0 };
  }

  /**
   * Match COG ID in valid range
   */
  private matchCogIdRange(min: number, max: number, metadata: any): { matched: boolean; length: number } {
    const result = this.buffer.next();
    if (result.status === NextStatus.DATA) {
      // COG IDs in P2 messages are ASCII digits '0'-'7' (0x30-0x37)
      const cogIdAscii = result.value!;
      if (cogIdAscii >= 0x30 && cogIdAscii <= 0x37) {
        const cogId = cogIdAscii - 0x30; // Convert ASCII to number (0-7)
        if (cogId >= min && cogId <= max) {
          metadata.cogId = cogId;
          return { matched: true, length: 1 };
        }
      }
    }
    return { matched: false, length: 0 };
  }

  /**
   * Match binary COG ID in valid range (0x00-0x07)
   */
  private matchCogIdBinary(min: number, max: number, metadata: any): { matched: boolean; length: number } {
    const result = this.buffer.next();
    if (result.status === NextStatus.DATA) {
      // COG IDs in binary packets are raw bytes 0x00-0x07
      const cogId = result.value!;
      if (cogId >= min && cogId <= max) {
        metadata.cogId = cogId;
        return { matched: true, length: 1 };
      }
    }
    return { matched: false, length: 0 };
  }

  /**
   * Match text pattern
   */
  private matchTextPattern(pattern: string, caseSensitive: boolean): { matched: boolean; length: number } {
    const targetBytes = new TextEncoder().encode(caseSensitive ? pattern : pattern.toLowerCase());
    
    for (let i = 0; i < targetBytes.length; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        return { matched: false, length: 0 };
      }
      
      let byteValue = result.value!;
      if (!caseSensitive && byteValue >= 65 && byteValue <= 90) {
        byteValue += 32; // Convert to lowercase
      }
      
      if (byteValue !== targetBytes[i]) {
        return { matched: false, length: 0 };
      }
    }
    
    return { matched: true, length: targetBytes.length };
  }

  /**
   * TIER 2: Validation Engine
   * Validates pattern completeness and context
   */
  private validatePattern(pattern: MessagePattern, metadata: any): { valid: boolean; status: string; warning?: string; eolLength?: number; eolSequence?: string; messageEndPosition?: number } {
    if (!pattern.tier2Validation) {
      return { valid: true, status: 'COMPLETE' };
    }

    let mergedResult: { valid: boolean; status: string; warning?: string; eolLength?: number; eolSequence?: string; messageEndPosition?: number } = {
      valid: true,
      status: 'COMPLETE'
    };

    for (const validation of pattern.tier2Validation) {
      const result = this.performValidation(validation, pattern, metadata);
      if (!result.valid) {
        return result;
      }
      
      // Merge validation results (preserve eolLength, eolSequence, messageEndPosition, etc.)
      if (result.eolLength !== undefined) {
        mergedResult.eolLength = result.eolLength;
      }
      if (result.eolSequence !== undefined) {
        mergedResult.eolSequence = result.eolSequence;
      }
      if (result.messageEndPosition !== undefined) {
        mergedResult.messageEndPosition = result.messageEndPosition;
      }
    }

    return mergedResult;
  }

  /**
   * Perform individual validation checks
   */
  private performValidation(validation: string, pattern: MessagePattern, metadata: any): { valid: boolean; status: string; warning?: string; eolLength?: number; eolSequence?: string; messageEndPosition?: number } {
    switch (validation) {
      case 'VALIDATE_PAYLOAD_RECEIVED':
        return this.validatePayloadReceived(metadata);

      case 'VALIDATE_CHECKSUM':
        return this.validateChecksum(metadata);

      case 'VALIDATE_COG_ID':
        return this.validateCogId(metadata);

      case 'VALIDATE_CR_TERMINATOR':
        return this.validateCRTerminator();

      case 'GOLDEN_SYNC_POINT':
        return this.handleGoldenSyncPoint();

      case 'VALIDATE_P2_SYSTEM_INIT_EOL':
        return this.validateP2SystemInitEOL();

      case 'VALIDATE_WINDOW_CATALOG':
        return this.validateWindowCatalog(metadata);

      case 'VALIDATE_NEXT_MESSAGE_BOUNDARY':
        return this.validateNextMessageBoundary(metadata);

      case 'VALIDATE_DEBUGGER_PACKET_SIZE':
        return this.validateDebuggerPacketSize(metadata);

      case 'VALIDATE_COG_CONTEXT':
        return this.validateCogContext(metadata);

      default:
        return { valid: false, status: 'INVALID', warning: `Unknown validation: ${validation}` };
    }
  }

  /**
   * Validate that full payload has been received for 0xDB packets
   */
  private validatePayloadReceived(metadata: any): { valid: boolean; status: string; warning?: string } {
    if (!metadata.payloadSize) {
      return { valid: false, status: 'INCOMPLETE', warning: 'No payload size found' };
    }

    // Reject unreasonably large payloads (over 8KB is suspicious for P2)
    if (metadata.payloadSize > 8192) {
      return { valid: false, status: 'INVALID', warning: `Payload too large: ${metadata.payloadSize} bytes` };
    }

    // Check if enough data is available in buffer for payload after current position
    // We need to peek ahead to see if payload is complete without consuming
    // First, advance past the header (4 bytes for 0xDB packets)
    this.buffer.savePosition();
    
    // Skip header bytes (0xDB + subtype + 2-byte length = 4 bytes)
    for (let i = 0; i < 4; i++) {
      const headerResult = this.buffer.next();
      if (headerResult.status !== NextStatus.DATA) {
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: 'Cannot read header' };
      }
    }
    
    let payloadBytesAvailable = 0;
    
    // Now check payload bytes
    for (let i = 0; i < metadata.payloadSize; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: `Payload incomplete: ${payloadBytesAvailable}/${metadata.payloadSize} bytes` };
      }
      payloadBytesAvailable++;
    }
    
    this.buffer.restorePosition();
    return { valid: true, status: 'COMPLETE' };
  }

  /**
   * Validate checksum for 0xDB packets (placeholder implementation)
   */
  private validateChecksum(metadata: any): { valid: boolean; status: string; warning?: string } {
    // TODO: Implement actual checksum validation when protocol is fully understood
    return { valid: true, status: 'COMPLETE' };
  }

  /**
   * Validate COG ID is in valid range and not prohibited
   */
  private validateCogId(metadata: any): { valid: boolean; status: string; warning?: string } {
    if (metadata.cogId === undefined) {
      return { valid: false, status: 'INVALID', warning: 'Missing COG ID' };
    }

    // COG 0 debugger windows are not created by test hardware
    if (metadata.cogId === 0 && metadata.forDebuggerWindow) {
      return { valid: false, status: 'INVALID', warning: 'COG 0 debugger packets not expected from test hardware' };
    }

    if (metadata.cogId < 0 || metadata.cogId > 7) {
      return { valid: false, status: 'INVALID', warning: `Invalid COG ID: ${metadata.cogId}` };
    }

    return { valid: true, status: 'COMPLETE' };
  }

  /**
   * Validate CR terminator exists for text messages
   * Returns actual EOL sequence found and its length
   */
  private validateCRTerminator(): { valid: boolean; status: string; warning?: string; eolLength?: number; eolSequence?: string; messageEndPosition?: number } {
    // Save position to check for CR without consuming
    this.buffer.savePosition();
    
    // Scan ahead for CR within reasonable distance
    for (let i = 0; i < 512; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: 'No data available for CR check' };
      }
      
      if (result.value === 0x0D) { // CR found
        // Check if it's followed by LF (CRLF sequence)
        let eolLength = 1;
        let eolSequence = '\r';
        
        const nextResult = this.buffer.next();
        if (nextResult.status === NextStatus.DATA && nextResult.value === 0x0A) {
          // Found CRLF sequence
          eolLength = 2;
          eolSequence = '\r\n';
        }
        
        this.buffer.restorePosition();
        return { 
          valid: true, 
          status: 'COMPLETE', 
          eolLength, 
          eolSequence,
          messageEndPosition: i // Absolute position of CR from start of validation
        };
      }
    }
    
    this.buffer.restorePosition();
    return { valid: false, status: 'INCOMPLETE', warning: 'CR terminator not found within 512 bytes' };
  }

  /**
   * Handle P2 system synchronization point
   */
  private handleGoldenSyncPoint(): { valid: boolean; status: string; warning?: string } {
    // P2 system reboot - perfect synchronization
    this.emit('goldenSyncPoint', { timestamp: Date.now() });
    return { valid: true, status: 'COMPLETE' };
  }

  /**
   * Validate P2 System Init message with proper EOL handling
   */
  private validateP2SystemInitEOL(): { valid: boolean; status: string; warning?: string; messageEndPosition?: number; eolLength?: number; eolSequence?: string } {
    // P2 System Init messages are ASCII text that must end with CRLF, LFCR, CR, or LF
    // Use the same EOL validation as COG messages
    this.buffer.savePosition();
    
    let i = 0;
    const maxBytes = 512; // Reasonable limit for P2 init message
    
    while (i < maxBytes && this.buffer.hasData()) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: 'Buffer exhausted before finding terminator' };
      }
      
      if (result.value === 0x0D) { // CR
        let eolLength = 1;
        let eolSequence = '\r';
        
        // Check for LF following CR (CRLF pattern)
        if (this.buffer.hasData()) {
          const nextResult = this.buffer.next();
          if (nextResult.status === NextStatus.DATA && nextResult.value === 0x0A) {
            eolLength = 2;
            eolSequence = '\r\n';
          } else {
            // Put back the byte that wasn't LF
            this.buffer.restorePosition();
            this.buffer.savePosition();
            // Re-advance to CR position
            for (let j = 0; j <= i; j++) {
              this.buffer.next();
            }
          }
        }
        
        this.buffer.restorePosition();
        // Emit golden sync point for P2 system reboot detection
        this.emit('goldenSyncPoint', { timestamp: Date.now() });
        return { 
          valid: true, 
          status: 'COMPLETE', 
          messageEndPosition: i, // Position of CR from start
          eolLength,
          eolSequence
        };
      } else if (result.value === 0x0A) { // LF
        let eolLength = 1;
        let eolSequence = '\n';
        
        // Check for CR following LF (LFCR pattern)
        if (this.buffer.hasData()) {
          const nextResult = this.buffer.next();
          if (nextResult.status === NextStatus.DATA && nextResult.value === 0x0D) {
            eolLength = 2;
            eolSequence = '\n\r';
          } else {
            // Put back the byte that wasn't CR
            this.buffer.restorePosition();
            this.buffer.savePosition();
            // Re-advance to LF position
            for (let j = 0; j <= i; j++) {
              this.buffer.next();
            }
          }
        }
        
        this.buffer.restorePosition();
        // Emit golden sync point for P2 system reboot detection
        this.emit('goldenSyncPoint', { timestamp: Date.now() });
        return { 
          valid: true, 
          status: 'COMPLETE', 
          messageEndPosition: i, // Position of LF from start
          eolLength,
          eolSequence
        };
      }
      
      i++;
    }
    
    this.buffer.restorePosition();
    return { valid: false, status: 'INCOMPLETE', warning: 'EOL terminator not found within 512 bytes' };
  }

  /**
   * Validate window command against catalog or created windows
   */
  private validateWindowCatalog(metadata: any): { valid: boolean; status: string; warning?: string } {
    if (!metadata.windowCommand) {
      return { valid: false, status: 'INVALID', warning: 'No window command found' };
    }

    // TODO: Implement actual window catalog validation
    // For now, accept all window commands
    return { valid: true, status: 'COMPLETE' };
  }

  /**
   * Validate 80-byte debugger packet by checking what follows
   */
  private validateNextMessageBoundary(metadata: any): { valid: boolean; status: string; warning?: string } {
    // Save position after current packet
    this.buffer.savePosition();
    
    // Skip the COG ID byte (already validated by pattern matching)
    const cogResult = this.buffer.next();
    if (cogResult.status !== NextStatus.DATA) {
      this.buffer.restorePosition();
      return { valid: false, status: 'INCOMPLETE', warning: 'COG ID byte not available' };
    }
    
    // Consume the 79 remaining bytes of the 80-byte packet
    for (let i = 0; i < 79; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: '80-byte packet incomplete' };
      }
    }
    
    // Check what follows: should be 0xDB, "Cog", backtick, or another 0-7
    const nextResult = this.buffer.next();
    this.buffer.restorePosition();
    
    // If no more data, assume it's at the end of the stream (valid)
    if (nextResult.status !== NextStatus.DATA) {
      return { valid: true, status: 'COMPLETE' };
    }
    
    const nextByte = nextResult.value!;
    
    // Valid followers: 0xDB, 'C' (Cog), 0x60 (backtick), or 0-7 (another packet)
    if (nextByte === 0xDB || nextByte === 0x43 || nextByte === 0x60 || (nextByte >= 0 && nextByte <= 7)) {
      return { valid: true, status: 'COMPLETE' };
    }
    
    return { valid: false, status: 'INVALID', warning: `Invalid byte after 80-byte packet: 0x${nextByte.toString(16)}` };
  }

  /**
   * Validate debugger packet size (exactly 416 bytes)
   * P2 debugger sends: 40-byte status + 128-byte CRC + 248-byte hub checksums
   */
  private validateDebuggerPacketSize(metadata: any): { valid: boolean; status: string; warning?: string } {
    this.buffer.savePosition();
    
    // CRITICAL: COG debugger packets are exactly 416 bytes
    // Don't scan for boundaries - binary data could contain any byte value
    
    let availableBytes = 0;
    // Count exactly how many bytes are available (including the COG ID)
    while (availableBytes < 416 && this.buffer.hasData()) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        break;
      }
      availableBytes++;
    }
    
    this.buffer.restorePosition();
    
    // We need exactly 416 bytes for a complete COG packet
    if (availableBytes >= 416) {
      metadata.actualPacketSize = 416; // Always exactly 416 bytes
      return { valid: true, status: 'COMPLETE' };
    }
    
    return { valid: false, status: 'INCOMPLETE', warning: `Insufficient data: ${availableBytes} bytes (need exactly 416)` };
  }

  /**
   * Validate COG context for debugger packets
   */
  private validateCogContext(metadata: any): { valid: boolean; status: string; warning?: string } {
    // TODO: Implement context validation based on COG activity
    // For now, accept all COG contexts
    return { valid: true, status: 'COMPLETE' };
  }

  /**
   * Extract a batch of messages efficiently
   * Returns array of extracted messages and whether more might be available
   */
  public extractBatch(): { messages: ExtractedMessage[], hasMore: boolean } {
    const batchStart = performance.now();
    const messages: ExtractedMessage[] = [];
    let batchTime = 0;

    // Process up to MAX_BATCH_SIZE messages or MAX_BATCH_TIME_MS milliseconds
    while (this.buffer.hasData() && 
           messages.length < this.MAX_BATCH_SIZE &&
           batchTime < this.MAX_BATCH_TIME_MS) {
      
      const extracted = this.extractNextMessage();
      
      if (extracted) {
        messages.push(extracted);
        
        // Record performance metrics
        if (this.performanceMonitor) {
          this.performanceMonitor.recordExtraction();
          this.performanceMonitor.recordMessage();
        }
      } else {
        // No complete message available
        break;
      }
      
      // Update batch time
      batchTime = performance.now() - batchStart;
    }

    // Update batch metrics
    if (messages.length > 0) {
      this.totalBatches++;
      this.totalBatchTime += batchTime;
      this.totalBatchMessages += messages.length;
      this.largestBatch = Math.max(this.largestBatch, messages.length);
      
      // Log batch performance in development
      if (process.env.NODE_ENV === 'development' && messages.length > 10) {
        const avgTime = (batchTime / messages.length * 1000).toFixed(0);
        console.log(`[MessageExtractor] Batch: ${messages.length} messages in ${batchTime.toFixed(2)}ms (${avgTime}μs/msg)`);
      }
    }

    return {
      messages,
      hasMore: this.buffer.hasData() && this.partialMessageDetected
    };
  }

  /**
   * Extract messages from buffer (legacy interface)
   * Called by SerialReceiver via setImmediate
   * Returns true if more data might be extractable
   */
  public extractMessages(): boolean {
    const batchStart = performance.now();
    let messagesExtracted = 0;
    let continueExtracting = true;
    let batchTime = 0;

    // Process up to MAX_BATCH_SIZE messages or MAX_BATCH_TIME_MS milliseconds
    while (continueExtracting && 
           this.buffer.hasData() && 
           messagesExtracted < this.MAX_BATCH_SIZE &&
           batchTime < this.MAX_BATCH_TIME_MS) {
      
        const extracted = this.extractNextMessage();
      
      if (extracted) {
        messagesExtracted++;
        
        // Record performance metrics
        if (this.performanceMonitor) {
          this.performanceMonitor.recordExtraction();
          this.performanceMonitor.recordMessage();
        }
        
        // Queue the message
        const queued = this.outputQueue.enqueue(extracted);
        if (!queued) {
          console.error('[MessageExtractor] Output queue full, message dropped');
          this.emit('queueFull', extracted);
          
          // Record extraction error
          if (this.performanceMonitor) {
            this.performanceMonitor.recordExtractionError();
          }
        }
      } else {
        // No complete message available
        continueExtracting = false;
      }
      
      // Update batch time
      batchTime = performance.now() - batchStart;
    }

    // Update batch metrics
    if (messagesExtracted > 0) {
      this.totalBatches++;
      this.totalBatchTime += batchTime;
      this.totalBatchMessages += messagesExtracted;
      this.largestBatch = Math.max(this.largestBatch, messagesExtracted);
      
      this.emit('messagesExtracted', messagesExtracted);
      
      // Log batch performance in development
      if (process.env.NODE_ENV === 'development' && messagesExtracted > 10) {
        console.log(`[MessageExtractor] Batch: ${messagesExtracted} messages in ${batchTime.toFixed(2)}ms (${(batchTime / messagesExtracted * 1000).toFixed(0)}μs/msg)`);
      }
    }

    return this.buffer.hasData() && this.partialMessageDetected;
  }

  /**
   * HARDWARE WORKAROUND: Filter consecutive zero bytes after debugger packets
   * Hardware sends streams of zeros between valid traffic, causing spurious COG0 debugger packets
   * Returns number of zero bytes filtered
   */
  private filterPostDebuggerZeros(): number {
    let zerosFiltered = 0;
    
    // Skip consecutive zero bytes
    while (this.buffer.hasData()) {
      // Save position before checking next byte
      this.buffer.savePosition();
      
      // Look at the next byte
      const result = this.buffer.next();
      if (result.status === NextStatus.DATA && result.value === 0x00) {
        // This is a zero byte, consume it (don't restore position)
        zerosFiltered++;
      } else if (result.status === NextStatus.DATA) {
        // Found non-zero byte, restore position so it can be processed normally
        this.buffer.restorePosition();
        // Clear the flag since we've found the end of the zero stream
        this.justProcessedDebuggerPacket = false;
        break;
      } else {
        // No more data or error, restore position
        this.buffer.restorePosition();
        break;
      }
    }
    
    return zerosFiltered;
  }

  /**
   * Extract next complete message using Two-Tier Pattern Matching
   * Returns null if no complete message available
   */
  private extractNextMessage(): ExtractedMessage | null {
    // Reset partial flag
    this.partialMessageDetected = false;

    // *** THIS IS THE ONLY PLACE WE FILTER ZEROS FROM THE STREAM ***
    // HARDWARE WORKAROUND: Remove consecutive zero bytes that follow debugger packets
    // Hardware sends streams of zeros between valid traffic. We filter ONLY these specific zeros:
    // 1. ONLY after a debugger 416-byte packet (justProcessedDebuggerPacket = true)
    // 2. ONLY consecutive zero bytes (0x00) 
    // 3. ONLY until first non-zero byte (then stop and resume normal processing)
    // This prevents zero-filled "packets" from being classified as debugger data
    if (this.justProcessedDebuggerPacket) {
      const zerosFiltered = this.filterPostDebuggerZeros();
      if (zerosFiltered > 0) {
        console.log(`[MessageExtractor] Filtered ${zerosFiltered} zero bytes after debugger packet`);
      }
      // Note: justProcessedDebuggerPacket flag is cleared inside filterPostDebuggerZeros()
      // when it encounters the first non-zero byte
    }

    // TIER 1: Try each pattern in priority order
    for (const pattern of this.MESSAGE_PATTERNS) {
      const match = this.matchPattern(pattern);
      
      if (match.matched) {
        // TIER 2: Validate pattern completeness
        const validation = this.validatePattern(pattern, match.metadata);
        
        if (validation.valid) {
          // Extract complete message
          const extracted = this.extractCompleteMessage(pattern, match.length, match.metadata, validation);
          if (extracted) {
            return extracted;
          }
        } else if (validation.status === 'INCOMPLETE') {
          // Partial message - wait for more data
          // KEEP buffer position at start of message so we can re-match when more data arrives
          // The matchPattern already restored position, so we don't need to advance
          this.partialMessageDetected = true;
          this.partialMessageWaits++;
          return null;
        } else {
          // Invalid pattern - route to appropriate destination with warning
          return this.handleInvalidPattern(pattern, match.metadata, validation);
        }
      }
    }

    // No patterns matched - default to Terminal Output (Terminal FIRST principle)
    return this.extractTerminalOutput();
  }

  /**
   * Extract complete validated message
   */
  private extractCompleteMessage(pattern: MessagePattern, length: number, metadata: any, validation: any): ExtractedMessage | null {
    
    // For 0xDB packets, include payload in total message length
    let totalLength = length;
    if (pattern.messageType === MessageType.DB_PACKET && metadata.payloadSize) {
      totalLength = length + metadata.payloadSize; // Header + payload
    }
    
    // For text messages, calculate total length from message end position + EOL length
    if (validation.messageEndPosition !== undefined && validation.eolLength) {
      totalLength = validation.messageEndPosition + validation.eolLength; // Absolute position of CR + EOL length
    }
    
    // For debugger packets, use actual measured size if available
    if (pattern.messageType === MessageType.DEBUGGER_416BYTE && metadata.actualPacketSize) {
      totalLength = metadata.actualPacketSize;
    }
    
    
    // Extract the actual message data
    const messageData = new Uint8Array(totalLength);
    
    for (let i = 0; i < totalLength; i++) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        console.error('[MessageExtractor] Failed to extract validated message');
        return null;
      }
      messageData[i] = result.value!;
    }

    // Update statistics
    this.messagesExtracted[pattern.messageType]++;
    this.totalBytesExtracted += totalLength;

    // Determine consumer count based on message type routing
    // All messages go to logger + one other destination
    const consumerCount = 2;  // Logger + destination window
    
    // Strip EOL characters from COG and BACKTICK messages only
    // These are ASCII text messages where CR/LF are just terminators
    // Binary messages must remain untouched
    let cleanedData: Uint8Array = messageData;
    if (pattern.messageType === MessageType.COG_MESSAGE || 
        pattern.messageType === MessageType.BACKTICK_WINDOW) {
      cleanedData = this.stripEOLCharacters(messageData) as Uint8Array;
    }
    
    // Create extracted message with Two-Tier metadata and reference counting
    const extractedMessage: ExtractedMessage = {
      type: pattern.messageType,
      data: cleanedData,
      timestamp: Date.now(),
      confidence: pattern.confidence,
      // Reference counting initialization
      consumerCount: consumerCount,
      consumersRemaining: consumerCount,
      disposed: false,
      metadata: {
        ...metadata,
        validationStatus: validation.status as 'COMPLETE' | 'INCOMPLETE' | 'INVALID',
        patternMatched: pattern.description
      }
    };

    // Log message classification for debugging (disabled in production)
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CLASSIFICATION) {
      const preview = messageData.length > 0 ? 
        `[${Array.from(messageData.slice(0, Math.min(8, messageData.length))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}${messageData.length > 8 ? '...' : ''}]` : 
        '[empty]';
      console.log(`[MessageExtractor] CLASSIFIED: ${pattern.messageType} - ${messageData.length} bytes - ${preview}`);
    }

    // HARDWARE WORKAROUND: Set flag to filter zeros after debugger packets
    if (pattern.messageType === MessageType.DEBUGGER_416BYTE) {
      this.justProcessedDebuggerPacket = true;
    }

    return extractedMessage;
  }

  /**
   * Handle invalid patterns with warning routing
   */
  private handleInvalidPattern(pattern: MessagePattern, metadata: any, validation: any): ExtractedMessage | null {
    // For invalid COG IDs, route to Debug Logger with warning
    if (pattern.messageType === MessageType.COG_MESSAGE && validation.warning?.includes('Invalid COG ID')) {
      // Consume the problematic message to CR
      const invalidData = this.consumeToTerminator(0x0D, 512);
      if (invalidData) {
        this.messagesExtracted[MessageType.INVALID_COG]++;
        this.totalBytesExtracted += invalidData.length;
        
        // Log message classification for debugging
        // Log invalid COG classification for debugging (disabled in production)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CLASSIFICATION) {
          const preview = invalidData.length > 0 ? 
            `[${Array.from(invalidData.slice(0, Math.min(8, invalidData.length))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}${invalidData.length > 8 ? '...' : ''}]` : 
            '[empty]';
          console.log(`[MessageExtractor] CLASSIFIED: INVALID_COG - ${invalidData.length} bytes - ${preview}`);
        }

        return {
          type: MessageType.INVALID_COG,
          data: invalidData,
          timestamp: Date.now(),
          confidence: 'DEFAULT',
          metadata: {
            ...metadata,
            validationStatus: 'INVALID' as const,
            warningMessage: validation.warning
          }
        };
      }
    }

    // For other invalid patterns, try extracting to terminal
    return this.extractTerminalOutput();
  }

  /**
   * Extract terminal output (default route - Terminal FIRST principle)
   * FIXED: Proper EOL handling for complete messages only
   */
  private extractTerminalOutput(): ExtractedMessage | null {
    // Look for complete line with proper EOL termination
    let terminalData = this.consumeToEOL(1024);
    
    // If no complete line found, return null to wait for more data
    // Note: Empty lines (just EOL) are valid messages, so we only check for null
    if (terminalData === null) {
      return null; // Wait for complete message
    }

    this.messagesExtracted[MessageType.TERMINAL_OUTPUT]++;
    this.totalBytesExtracted += terminalData.length;

    // Log message classification for debugging
    // Log terminal output classification for debugging (disabled in production) 
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CLASSIFICATION) {
      const preview = terminalData.length > 0 ? 
        `[${Array.from(terminalData.slice(0, Math.min(8, terminalData.length))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}${terminalData.length > 8 ? '...' : ''}]` : 
        '[empty]';
      console.log(`[MessageExtractor] CLASSIFIED: TERMINAL_OUTPUT (fallback) - ${terminalData.length} bytes - ${preview}`);
    }

    return {
      type: MessageType.TERMINAL_OUTPUT,
      data: terminalData,
      timestamp: Date.now(),
      confidence: 'DEFAULT'
    };
  }

  // consumeRemainingData REMOVED - Would break pattern sync!
  // This function was destructive to pattern matching as it could
  // consume sync bytes needed for re-synchronization.
  // DO NOT RE-IMPLEMENT - breaks Two-Tier Pattern Matching

  /**
   * OPTIMIZED: Consume complete line with proper EOL handling
   * Handles: CR, LF, CRLF, LFCR - returns null if no complete line found
   * Future optimization: Use extractRange when buffer supports peek operations
   */
  private consumeToEOL(maxBytes: number): Uint8Array | null {
    // Save initial position and reset if no EOL found
    this.buffer.savePosition();
    
    // For now, use array collection until we add peek support to buffer
    const bytes: number[] = [];
    let foundEOL = false;
    
    // CRITICAL: Limit search to prevent scanning into binary COG packet data
    const searchLimit = Math.min(maxBytes, 45);
    
    // Scan for EOL
    while (bytes.length < searchLimit && this.buffer.hasData()) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        break;
      }
      
      bytes.push(result.value!);
      
      // Check for EOL patterns
      if (result.value === 0x0D || result.value === 0x0A) { // CR or LF
        foundEOL = true;
        
        // Look ahead for CRLF or LFCR pattern
        if (this.buffer.hasData()) {
          this.buffer.savePosition();
          const nextResult = this.buffer.next();
          if (nextResult.status === NextStatus.DATA) {
            const nextByte = nextResult.value!;
            // Check for two-character EOL patterns
            if ((result.value === 0x0D && nextByte === 0x0A) || // CRLF
                (result.value === 0x0A && nextByte === 0x0D)) { // LFCR
              // It's a two-character EOL, consume it
              bytes.push(nextByte);
            } else {
              // Single character EOL, restore position to leave nextByte in buffer
              this.buffer.restorePosition();
            }
          } else {
            // Couldn't read next byte, restore position
            this.buffer.restorePosition();
          }
        }
        break;
      }
    }
    
    if (foundEOL) {
      // Calculate EOL length
      let eolLength = 1;
      if (bytes.length >= 2) {
        const lastTwo = bytes.slice(-2);
        if ((lastTwo[0] === 0x0D && lastTwo[1] === 0x0A) || 
            (lastTwo[0] === 0x0A && lastTwo[1] === 0x0D)) {
          eolLength = 2;
        }
      }
      
      // Return data without EOL - single allocation here
      return new Uint8Array(bytes.slice(0, bytes.length - eolLength));
    } else {
      // No complete line found, restore position
      this.buffer.restorePosition();
      return null;
    }
  }

  /**
   * LEGACY: Consume bytes until terminator or limit
   */
  /**
   * Strip all forms of EOL characters from the end of a message
   * Handles CR, LF, CRLF, and LFCR
   * Only used for ASCII text messages (COG and BACKTICK)
   */
  private stripEOLCharacters(data: Uint8Array): Uint8Array {
    let endIndex = data.length;
    
    // Work backwards, removing any combination of CR (0x0D) and LF (0x0A)
    while (endIndex > 0) {
      const lastByte = data[endIndex - 1];
      if (lastByte === 0x0D || lastByte === 0x0A) {
        endIndex--;
      } else {
        break;
      }
    }
    
    // Return the data without EOL characters
    if (endIndex === data.length) {
      return data; // No EOL found, return original
    }
    return data.slice(0, endIndex);
  }
  
  private consumeToTerminator(terminator: number, maxBytes: number): Uint8Array | null {
    const bytes: number[] = [];
    
    while (bytes.length < maxBytes && this.buffer.hasData()) {
      const result = this.buffer.next();
      if (result.status !== NextStatus.DATA) {
        break;
      }
      
      bytes.push(result.value!);
      
      if (result.value === terminator) {
        break;
      }
    }
    
    return bytes.length > 0 ? new Uint8Array(bytes) : null;
  }

  /**
   * Get batch extraction statistics
   */
  public getBatchStats() {
    const avgBatchSize = this.totalBatches > 0 ? 
      this.totalBatchMessages / this.totalBatches : 0;
    const avgBatchTime = this.totalBatches > 0 ? 
      this.totalBatchTime / this.totalBatches : 0;
    const avgMessageTime = this.totalBatchMessages > 0 ?
      (this.totalBatchTime / this.totalBatchMessages) * 1000 : 0; // in microseconds
    
    return {
      totalBatches: this.totalBatches,
      totalMessages: this.totalBatchMessages,
      avgBatchSize: avgBatchSize.toFixed(1),
      largestBatch: this.largestBatch,
      avgBatchTimeMs: avgBatchTime.toFixed(2),
      avgMessageTimeMicros: avgMessageTime.toFixed(1)
    };
  }

  /**
   * Get extraction statistics
   */
  public getStats() {
    return {
      messagesExtracted: { ...this.messagesExtracted },
      partialMessageWaits: this.partialMessageWaits,
      totalBytesExtracted: this.totalBytesExtracted,
      outputQueueStats: this.outputQueue.getStats()
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    for (const key in this.messagesExtracted) {
      this.messagesExtracted[key as MessageType] = 0;
    }
    this.partialMessageWaits = 0;
    this.totalBytesExtracted = 0;
  }

  /**
   * Get output queue reference
   */
  public getOutputQueue(): DynamicQueue<ExtractedMessage> {
    return this.outputQueue;
  }
}