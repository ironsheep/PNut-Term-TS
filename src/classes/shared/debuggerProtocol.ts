/** @format */

// src/classes/shared/debuggerProtocol.ts

import { EventEmitter } from 'events';
import { UsbSerial } from '../../utils/usb.serial';
import {
  DebuggerInitialMessage,
  DEBUG_COMMANDS,
  MEMORY_CONSTANTS,
  LAYOUT_CONSTANTS,
  parseInitialMessage
} from './debuggerConstants';
import { DebuggerResponse } from './debuggerResponse';
import { DebuggerPhase3Receiver, Phase3Data } from './debuggerPhase3Receiver';

/**
 * DebuggerProtocol - Raw lockstep serial protocol for P2 single-step debugger
 *
 * Implements the Pascal DebuggerUnit.pas protocol exactly:
 * - Byte dispatch (ChrIn): bytes 0-7 = debugger breakpoint, 27 = ESC/end, $60 = display string
 * - Synchronous 3-phase breakpoint exchange per cog
 * - No framing, no sequence numbers, no ACK/NAK — raw bytes on serial
 *
 * Protocol flow per breakpoint:
 *   Phase 1: P2 sends 20 longs (80 bytes) + 64 CRC words (128 bytes) + 124 hub checksums (248 bytes) = 456 bytes
 *   Phase 2: Host sends 52 bytes (8 reg request + 16 hub request + 20 hub reads + 4 COGBRK + 4 STALL/BRK)
 *   Phase 3: P2 sends variable-length data (changed blocks, sub-CRCs, hub reads, smart pins)
 *
 * Reference: Pascal DebuggerUnit.pas, DebugUnit.pas, Spin2_debugger.spin2
 */
export class DebuggerProtocol extends EventEmitter {
  private serial: UsbSerial | null = null;
  private isConnected: boolean = false;
  private lastActivityTime: number = 0;
  private communicationTimeout: NodeJS.Timeout | null = null;
  private readonly COMM_TIMEOUT_MS = 5000;

  // Receive buffer for accumulating serial data
  private rxBuffer: Uint8Array = new Uint8Array(65536);
  private rxHead: number = 0;
  private rxTail: number = 0;

  // Per-cog response generators (maintain CRC state across breakpoints)
  private cogResponses: Map<number, DebuggerResponse> = new Map();

  // Display string accumulation (Pascal: started by $60, ended by CR)
  private displayStringActive: boolean = false;
  private displayStringBuffer: number[] = [];

  // Flag: waiting for more Phase 1 data (prevents re-dispatch of cog byte)
  private waitingForPhase1: boolean = false;

  // Phase 3 receiver
  private phase3Receiver: DebuggerPhase3Receiver = new DebuggerPhase3Receiver();

  constructor() {
    super();
  }

  /**
   * Connect to serial port for debug session
   */
  public connect(serial: UsbSerial): void {
    if (this.serial) {
      this.disconnect();
    }

    this.serial = serial;
    this.isConnected = true;
    this.lastActivityTime = Date.now();
    this.rxHead = 0;
    this.rxTail = 0;

    // Set up data handler — incoming bytes go into ring buffer
    this.serial.on('data', (data: Buffer) => {
      this.onSerialData(data);
    });

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
    this.stopCommunicationMonitor();
    this.cogResponses.clear();
    this.emit('disconnected');
  }

  /**
   * Buffer incoming serial data
   */
  private onSerialData(data: Buffer): void {
    this.lastActivityTime = Date.now();
    const uint8Data = new Uint8Array(data.buffer, data.byteOffset, data.length);
    for (let i = 0; i < uint8Data.length; i++) {
      this.rxBuffer[this.rxHead] = uint8Data[i];
      this.rxHead = (this.rxHead + 1) & 0xFFFF;
    }
    // Process available bytes
    this.processIncomingBytes();
  }

  /**
   * Number of bytes available in RX buffer
   */
  private rxAvailable(): number {
    return (this.rxHead - this.rxTail) & 0xFFFF;
  }

  /**
   * Read one byte from RX buffer (blocking-like, returns -1 if empty)
   */
  private rxByte(): number {
    if (this.rxHead === this.rxTail) return -1;
    const b = this.rxBuffer[this.rxTail];
    this.rxTail = (this.rxTail + 1) & 0xFFFF;
    return b;
  }

  /**
   * Push back one byte (Pascal: ReturnRByte)
   */
  private returnRxByte(b: number): void {
    this.rxTail = (this.rxTail - 1) & 0xFFFF;
    this.rxBuffer[this.rxTail] = b;
  }

  /**
   * Read N bytes from RX buffer into a Uint8Array. Returns null if not enough data.
   */
  private rxBytes(count: number): Uint8Array | null {
    if (this.rxAvailable() < count) return null;
    const result = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.rxBuffer[this.rxTail];
      this.rxTail = (this.rxTail + 1) & 0xFFFF;
    }
    return result;
  }

  /**
   * Read a 32-bit long from RX buffer (4 bytes, LSB-first). Returns null if not enough data.
   */
  private rxLong(): number | null {
    const bytes = this.rxBytes(4);
    if (!bytes) return null;
    return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
  }

  /**
   * Read a 16-bit word from RX buffer (2 bytes, LSB-first). Returns null if not enough data.
   */
  private rxWord(): number | null {
    const bytes = this.rxBytes(2);
    if (!bytes) return null;
    return bytes[0] | (bytes[1] << 8);
  }

  /**
   * Write raw bytes to serial port
   */
  private txBytes(data: Uint8Array): void {
    if (this.serial) {
      this.serial.write(Buffer.from(data) as any);
    }
  }

  /**
   * Write a 32-bit long to serial (4 bytes, LSB-first) — Pascal TLong
   */
  private txLong(value: number): void {
    const buf = new Uint8Array(4);
    buf[0] = value & 0xFF;
    buf[1] = (value >> 8) & 0xFF;
    buf[2] = (value >> 16) & 0xFF;
    buf[3] = (value >> 24) & 0xFF;
    this.txBytes(buf);
  }

  // ==========================================================================
  // Byte Dispatch (Pascal: DebugForm.ChrIn)
  // ==========================================================================

  /**
   * Process available bytes from the RX buffer.
   * This is the main byte dispatcher matching Pascal DebugForm.ChrIn.
   *
   * Byte values:
   *   0-7:    Debugger breakpoint for cog N — trigger full protocol exchange
   *   27:     ESC — end debug session
   *   $60:    Start display string (backtick)
   *   13 (CR): End display string (if active) or newline (if not)
   *   9 (TAB): Tab to next 8-column boundary
   *   $20-$7F: Printable character to text console
   */
  private processIncomingBytes(): void {
    while (this.rxAvailable() > 0) {
      // If we're waiting for more Phase 1 data, check if we have enough now
      if (this.waitingForPhase1) {
        const PHASE1_SIZE = 80 + 128 + 248; // 456 bytes
        // Need cog byte (already pushed back) + 456 bytes
        if (this.rxAvailable() < 1 + PHASE1_SIZE) {
          break; // Still not enough data
        }
        this.waitingForPhase1 = false;
      }

      const b = this.rxByte();
      if (b < 0) break;

      if (this.displayStringActive) {
        // Inside a display string — accumulate until CR
        if (b === 13) {
          // End display string — emit for parsing
          this.displayStringActive = false;
          this.emit('displayString', this.displayStringBuffer);
          this.displayStringBuffer = [];
        } else {
          this.displayStringBuffer.push(b);
        }
        continue;
      }

      if (b <= 7) {
        // Debugger breakpoint for cog N
        // Push byte back (Pascal: ReturnRByte) — the breakpoint handler re-reads it
        // Actually in Pascal, the cog byte is consumed and passed to Breakpoint method.
        // We handle it directly here.
        this.handleBreakpoint(b);
        // After the breakpoint exchange completes, continue dispatching
        continue;
      }

      switch (b) {
        case 27: // ESC — end debug session
          this.emit('endSession');
          return;

        case 0x60: // Backtick — start display string
          this.displayStringActive = true;
          this.displayStringBuffer = [];
          break;

        case 13: // CR — newline in text console
          this.emit('textConsole', { type: 'newline' });
          break;

        case 9: // TAB
          this.emit('textConsole', { type: 'tab' });
          break;

        default:
          if (b >= 0x20 && b <= 0x7F) {
            // Printable character
            this.emit('textConsole', { type: 'char', value: b });
          }
          // Other bytes silently ignored
          break;
      }
    }
  }

  // ==========================================================================
  // Breakpoint Exchange (Pascal: TDebuggerForm.Breakpoint)
  // ==========================================================================

  /**
   * Handle a complete breakpoint exchange for a cog.
   * This implements the full synchronous 3-phase lockstep protocol.
   *
   * In the Pascal implementation, this is a blocking call that reads all Phase 1 data,
   * sends Phase 2, reads all Phase 3 data, then returns. In our async/event-driven
   * environment, we attempt to process as much as available and defer if data is
   * incomplete (the P2 stall loop will re-send at ~15Hz).
   *
   * @param cogId The cog number (0-7)
   */
  private handleBreakpoint(cogId: number): void {
    // Ensure we have a response generator for this cog
    if (!this.cogResponses.has(cogId)) {
      this.cogResponses.set(cogId, new DebuggerResponse());
    }

    // ---- Phase 1: Read 456 bytes from P2 ----
    // 20 longs (80 bytes) + 64 CRC words (128 bytes) + 124 hub checksum words (248 bytes)
    const PHASE1_SIZE = 80 + 128 + 248; // 456 bytes
    if (this.rxAvailable() < PHASE1_SIZE) {
      // Not enough data yet — push the cog byte back and stop processing
      // (more data will arrive and re-trigger processIncomingBytes)
      this.returnRxByte(cogId);
      this.waitingForPhase1 = true;
      return;
    }
    this.waitingForPhase1 = false;
    const phase1Data = this.rxBytes(PHASE1_SIZE)!;

    // Parse the 20-long debugger message
    const msgData = new Uint32Array(20);
    const view = new DataView(phase1Data.buffer, phase1Data.byteOffset, phase1Data.byteLength);
    for (let i = 0; i < 20; i++) {
      msgData[i] = view.getUint32(i * 4, true); // LSB-first
    }
    const message = parseInitialMessage(msgData);

    // Emit the parsed message for display rendering
    this.emit('breakpointMessage', { cogId, message, rawPacket: phase1Data });

    // ---- Phase 2: Send 52-byte response ----
    // Allow listeners to update state before Phase 2 (e.g., set COGBRK mask)
    this.emit('beforePhase2', { cogId });
    const responseGen = this.cogResponses.get(cogId)!;
    const response = responseGen.generateResponse(phase1Data);
    this.txBytes(response);

    // Get changed block info for Phase 3 expectations
    const changedCogBlocks = responseGen.getChangedCogBlocks();
    const changedHubBlocks = responseGen.getChangedHubBlocks();

    // ---- Phase 3: Read variable-length data ----
    // Calculate expected Phase 3 data size
    this.phase3Receiver.setExpectations({
      changedCogBlocks,
      changedHubBlocks,
      getHubCode: this.getHubCodeForCog(cogId),
      disLines: LAYOUT_CONSTANTS.DIS_LINES
    });

    // Try to read Phase 3 data — it may not all be available yet
    const expectedSize = this.phase3Receiver.getExpectedSize();
    const phase3Raw = this.rxBytes(expectedSize);

    if (phase3Raw) {
      this.phase3Receiver.addData(phase3Raw);
      try {
        const phase3Data = this.phase3Receiver.parse();
        this.emit('breakpointData', {
          cogId,
          message,
          phase3: phase3Data,
          changedCogBlocks,
          changedHubBlocks
        });
      } catch (error) {
        this.emit('error', { type: 'phase3Parse', cogId, error });
      }
      this.phase3Receiver.reset();
    } else {
      // Partial Phase 3 data — consume what we can, emit partial result
      // The P2 stall loop will reconnect and we'll get full data next time
      const available = this.rxAvailable();
      if (available > 0) {
        const partial = this.rxBytes(available);
        if (partial) {
          this.phase3Receiver.addData(partial);
        }
      }

      // Emit breakpoint with whatever Phase 1 data we have
      this.emit('breakpointData', {
        cogId,
        message,
        phase3: null,
        changedCogBlocks,
        changedHubBlocks
      });
      this.phase3Receiver.reset();
    }

    // Emit breakpoint completion for state machine tracking
    this.emit('breakpointComplete', { cogId });
  }

  // ==========================================================================
  // State Control (called by debugger window / interaction handler)
  // ==========================================================================

  /**
   * Set the stall/break command for a cog's next Phase 2 response.
   * Call this BEFORE the next breakpoint exchange.
   *
   * @param cogId Cog number (0-7)
   * @param command STALL_CMD ($800) to hold, or breakValue to continue
   */
  public setStallBreak(cogId: number, command: number): void {
    const resp = this.getOrCreateResponse(cogId);
    resp.setStallBreak(command);
  }

  /**
   * Set COGBRK request mask for a specific cog's next Phase 2 response.
   * Bit N = 1 forces an async break in cog N.
   */
  public setRequestCogBrk(cogId: number, mask: number): void {
    const resp = this.getOrCreateResponse(cogId);
    resp.setRequestCogBrk(mask);
  }

  /**
   * Set COGBRK request mask on ALL cog response generators.
   * Pascal: RequestCOGBRK is a global mask sent in whichever cog's exchange happens next.
   * The mask is cleared after sending (by the response generator).
   */
  public setGlobalCogBrk(mask: number): void {
    for (const resp of this.cogResponses.values()) {
      resp.setRequestCogBrk(mask);
    }
  }

  /**
   * Set disassembly address for hub code reading
   */
  public setDisassemblyAddress(cogId: number, address: number, lines: number = 16): void {
    const resp = this.getOrCreateResponse(cogId);
    resp.setDisassemblyAddress(address, lines);
  }

  /**
   * Set whether to request hub code for disassembly
   */
  public setGetHubCode(cogId: number, enabled: boolean): void {
    const resp = this.getOrCreateResponse(cogId);
    resp.setGetHubCode(enabled);
  }

  /**
   * Set hub memory viewer address
   */
  public setHubAddress(cogId: number, address: number): void {
    const resp = this.getOrCreateResponse(cogId);
    resp.setHubAddress(address);
  }

  /**
   * Reset a cog's protocol state (e.g., after DTR reset)
   */
  public resetCog(cogId: number): void {
    const resp = this.cogResponses.get(cogId);
    if (resp) {
      resp.reset();
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getOrCreateResponse(cogId: number): DebuggerResponse {
    if (!this.cogResponses.has(cogId)) {
      this.cogResponses.set(cogId, new DebuggerResponse());
    }
    return this.cogResponses.get(cogId)!;
  }

  /**
   * Check if hub code should be requested for this cog
   * (hub-execute mode = PC >= $400)
   */
  private getHubCodeForCog(_cogId: number): boolean {
    // This will be set by the debugger window based on PC address
    // For now, return the state from the response generator
    return false;
  }

  /**
   * Start communication timeout monitor
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
   * Stop communication timeout monitor
   */
  private stopCommunicationMonitor(): void {
    if (this.communicationTimeout) {
      clearInterval(this.communicationTimeout);
      this.communicationTimeout = null;
    }
  }

  /**
   * Get connection status
   */
  public isActive(): boolean {
    return this.isConnected;
  }

  // Deprecated methods — kept for compilation compatibility during transition
  /** @deprecated Use setStallBreak() instead */
  public sendStall(cogId: number): void {
    this.setStallBreak(cogId, DEBUG_COMMANDS.STALL_CMD);
  }
  /** @deprecated Use setStallBreak() with breakValue instead */
  public sendBreak(cogId: number): void {
    this.setStallBreak(cogId, DEBUG_COMMANDS.STALL_CMD);
  }
  /** @deprecated Use setStallBreak() with breakValue instead */
  public sendGo(cogId: number): void {
    this.setStallBreak(cogId, DEBUG_COMMANDS.STALL_CMD);
  }
  /** @deprecated No longer used — protocol handles block requests automatically */
  public sendRequest(_request: any): number { return 0; }
  /** @deprecated No longer used */
  public requestCogBlock(_cogId: number, _blockIndex: number): void {}
  /** @deprecated No longer used */
  public requestLutBlock(_cogId: number, _blockIndex: number): void {}
  /** @deprecated No longer used */
  public requestHubMemory(_address: number, _size?: number): void {}
  /** @deprecated No longer used */
  public getPendingCount(): number { return 0; }
}
