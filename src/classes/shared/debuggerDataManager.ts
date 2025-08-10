/** @format */

// src/classes/shared/debuggerDataManager.ts

import { EventEmitter } from 'events';
import {
  MemoryBlock,
  COGDebugState,
  DebuggerGlobalState,
  DebuggerInitialMessage,
  MEMORY_CONSTANTS,
  calculateChecksum,
  createMemoryBlock,
  decayHeat
} from './debuggerConstants';
import { DebuggerProtocol } from './debuggerProtocol';

/**
 * DebuggerDataManager - Efficient memory caching and state management for P2 debugging
 * 
 * This class manages the complex memory hierarchy of the P2 microcontroller,
 * implementing intelligent caching and change detection to minimize data transfers.
 * 
 * Key Features:
 * - COG/LUT memory: 64 blocks of 16 longs each, checksum-based updates
 * - HUB memory: 124 blocks of 4KB with 128-byte sub-blocks for granular updates
 * - Independent state per COG (0-7) with fresh initialization on window open
 * - Breakpoint management for address and event-based debugging
 * - Heat map tracking for memory visualization
 * - Optimized request batching to reduce serial traffic
 * 
 * Reference: DEBUGGER_IMPLEMENTATION.md lines 124-142
 */
export class DebuggerDataManager extends EventEmitter {
  private globalState: DebuggerGlobalState;
  private protocol: DebuggerProtocol | null = null;
  private updateTimer: NodeJS.Timeout | null = null;
  private pendingRequests: Set<string> = new Set();
  private readonly UPDATE_INTERVAL_MS = 100; // Batch updates every 100ms
  private readonly MAX_PENDING_REQUESTS = 10; // Limit concurrent requests

  constructor() {
    super();
    this.globalState = this.createFreshGlobalState();
  }

  /**
   * Create fresh global state (shared across all debugger windows)
   */
  private createFreshGlobalState(): DebuggerGlobalState {
    return {
      requestCOGBRK: 0,  // Shared break request mask
      activeCOGs: new Set(),
      cogStates: new Map(),
      hubMemory: new Map(),
      isRecording: false,
      lastUpdateTime: Date.now()
    };
  }

  /**
   * Initialize a fresh COG state (per window open, no persistence)
   * Implements ResetRegWatch, ResetSmartWatch behavior from Pascal
   */
  public initializeCogState(cogId: number): COGDebugState {
    if (cogId < 0 || cogId > 7) {
      throw new Error(`Invalid COG ID: ${cogId}`);
    }

    const state: COGDebugState = {
      cogId,
      isActive: false,
      isBreaked: false,
      programCounter: 0,
      skipPattern: 0,
      callDepth: 0,
      breakpoints: new Set(),
      cogMemory: new Map(),
      lutMemory: new Map(),
      lastMessage: null
    };

    // Initialize COG memory blocks (64 blocks of 16 longs)
    for (let i = 0; i < MEMORY_CONSTANTS.COG_BLOCKS; i++) {
      const baseAddr = i * MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4; // Convert to byte address
      state.cogMemory.set(i, createMemoryBlock(i, baseAddr, MEMORY_CONSTANTS.COG_BLOCK_SIZE));
    }

    // Initialize LUT memory blocks (64 blocks of 16 longs)
    for (let i = 0; i < MEMORY_CONSTANTS.LUT_BLOCKS; i++) {
      const baseAddr = 0x800 + i * MEMORY_CONSTANTS.LUT_BLOCK_SIZE * 4; // LUT starts at 0x800
      state.lutMemory.set(i, createMemoryBlock(i, baseAddr, MEMORY_CONSTANTS.LUT_BLOCK_SIZE));
    }

    // Store in global state
    this.globalState.cogStates.set(cogId, state);
    this.globalState.activeCOGs.add(cogId);

    this.emit('cogInitialized', { cogId, state });
    return state;
  }

  /**
   * Initialize HUB memory cache
   * 124 blocks of 4KB each = 496KB total
   */
  private initializeHubMemory(): void {
    for (let i = 0; i < MEMORY_CONSTANTS.HUB_BLOCKS; i++) {
      const baseAddr = i * MEMORY_CONSTANTS.HUB_BLOCK_SIZE;
      const block = createMemoryBlock(i, baseAddr, MEMORY_CONSTANTS.HUB_BLOCK_SIZE / 4); // Size in longs
      this.globalState.hubMemory.set(i, block);
    }
  }

  /**
   * Connect to protocol handler
   */
  public connect(protocol: DebuggerProtocol): void {
    this.protocol = protocol;
    
    // Listen for protocol events
    protocol.on('initialMessage', (data) => this.handleInitialMessage(data));
    protocol.on('response', (response) => this.handleMemoryResponse(response));
    protocol.on('timeout', (data) => this.handleRequestTimeout(data));
    protocol.on('communicationLost', () => this.handleCommunicationLost());

    // Initialize HUB memory if not already done
    if (this.globalState.hubMemory.size === 0) {
      this.initializeHubMemory();
    }

    // Start update timer
    this.startUpdateTimer();
  }

  /**
   * Disconnect from protocol
   */
  public disconnect(): void {
    if (this.protocol) {
      this.protocol.removeAllListeners();
      this.protocol = null;
    }

    this.stopUpdateTimer();
    this.pendingRequests.clear();
  }

  /**
   * Handle initial 20-long message from P2
   */
  private handleInitialMessage(data: any): void {
    const message: DebuggerInitialMessage = data.message;
    const cogId = message.cogNumber;

    // Get or create COG state
    let state = this.globalState.cogStates.get(cogId);
    if (!state) {
      state = this.initializeCogState(cogId);
    }

    // Update state from message
    state.lastMessage = message;
    state.programCounter = message.programCounter;
    state.skipPattern = message.skipPattern;
    state.callDepth = message.callDepth;
    state.isActive = true;
    state.isBreaked = (message.breakStatus & 0x01) !== 0;

    // Check CRCs and mark blocks as dirty if changed
    if (data.cogCRCs) {
      this.updateCogCRCs(cogId, data.cogCRCs);
    }
    if (data.lutCRCs) {
      this.updateLutCRCs(cogId, data.lutCRCs);
    }
    if (data.hubChecksums) {
      this.updateHubChecksums(data.hubChecksums);
    }

    this.emit('cogStateUpdated', { cogId, state });
  }

  /**
   * Update COG memory CRCs and mark dirty blocks
   */
  private updateCogCRCs(cogId: number, crcs: Uint32Array): void {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return;

    for (let i = 0; i < Math.min(crcs.length, MEMORY_CONSTANTS.COG_BLOCKS); i++) {
      const block = state.cogMemory.get(i);
      if (block && block.checksum !== crcs[i]) {
        block.checksum = crcs[i];
        block.isDirty = true;
        this.scheduleMemoryRequest('COG', cogId, i);
      }
    }
  }

  /**
   * Update LUT memory CRCs and mark dirty blocks
   */
  private updateLutCRCs(cogId: number, crcs: Uint32Array): void {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return;

    for (let i = 0; i < Math.min(crcs.length, MEMORY_CONSTANTS.LUT_BLOCKS); i++) {
      const block = state.lutMemory.get(i);
      if (block && block.checksum !== crcs[i]) {
        block.checksum = crcs[i];
        block.isDirty = true;
        this.scheduleMemoryRequest('LUT', cogId, i);
      }
    }
  }

  /**
   * Update HUB memory checksums and mark dirty blocks
   */
  private updateHubChecksums(checksums: Uint32Array): void {
    for (let i = 0; i < Math.min(checksums.length, MEMORY_CONSTANTS.HUB_BLOCKS); i++) {
      const block = this.globalState.hubMemory.get(i);
      if (block && block.checksum !== checksums[i]) {
        block.checksum = checksums[i];
        block.isDirty = true;
        this.scheduleMemoryRequest('HUB', 0, i);
      }
    }
  }

  /**
   * Schedule a memory request (batched for efficiency)
   */
  private scheduleMemoryRequest(type: string, cogId: number, blockIndex: number): void {
    const key = `${type}-${cogId}-${blockIndex}`;
    
    if (this.pendingRequests.size >= this.MAX_PENDING_REQUESTS) {
      return; // Limit concurrent requests
    }

    this.pendingRequests.add(key);
  }

  /**
   * Process pending memory requests
   */
  private processPendingRequests(): void {
    if (!this.protocol || this.pendingRequests.size === 0) return;

    const requests = Array.from(this.pendingRequests).slice(0, this.MAX_PENDING_REQUESTS);
    
    for (const key of requests) {
      const [type, cogIdStr, blockIndexStr] = key.split('-');
      const cogId = parseInt(cogIdStr);
      const blockIndex = parseInt(blockIndexStr);

      switch (type) {
        case 'COG':
          this.protocol.requestCogBlock(cogId, blockIndex);
          break;
        case 'LUT':
          this.protocol.requestLutBlock(cogId, blockIndex);
          break;
        case 'HUB':
          const address = blockIndex * MEMORY_CONSTANTS.HUB_BLOCK_SIZE;
          this.protocol.requestHubMemory(address, MEMORY_CONSTANTS.HUB_BLOCK_SIZE);
          break;
      }

      this.pendingRequests.delete(key);
    }
  }

  /**
   * Handle memory response from protocol
   */
  private handleMemoryResponse(response: any): void {
    if (!response.data) return;

    const cogId = response.cogId;
    const address = response.address || 0;
    const data = response.data;

    // Determine memory type based on address
    if (address < 0x800) {
      // COG memory
      this.updateCogMemory(cogId, address, data);
    } else if (address < 0x1000) {
      // LUT memory
      this.updateLutMemory(cogId, address - 0x800, data);
    } else {
      // HUB memory
      this.updateHubMemory(address, data);
    }
  }

  /**
   * Update COG memory block
   */
  private updateCogMemory(cogId: number, address: number, data: Uint32Array): void {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return;

    const blockIndex = Math.floor(address / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
    const block = state.cogMemory.get(blockIndex);
    
    if (block) {
      block.data = data;
      block.isDirty = false;
      block.lastAccess = Date.now();
      block.hitCount++;
      
      this.emit('memoryUpdated', {
        type: 'COG',
        cogId,
        blockIndex,
        address,
        data
      });
    }
  }

  /**
   * Update LUT memory block
   */
  private updateLutMemory(cogId: number, address: number, data: Uint32Array): void {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return;

    const blockIndex = Math.floor(address / (MEMORY_CONSTANTS.LUT_BLOCK_SIZE * 4));
    const block = state.lutMemory.get(blockIndex);
    
    if (block) {
      block.data = data;
      block.isDirty = false;
      block.lastAccess = Date.now();
      block.hitCount++;
      
      this.emit('memoryUpdated', {
        type: 'LUT',
        cogId,
        blockIndex,
        address: address + 0x800,
        data
      });
    }
  }

  /**
   * Update HUB memory block
   */
  private updateHubMemory(address: number, data: Uint32Array): void {
    const blockIndex = Math.floor(address / MEMORY_CONSTANTS.HUB_BLOCK_SIZE);
    const block = this.globalState.hubMemory.get(blockIndex);
    
    if (block) {
      block.data = data;
      block.isDirty = false;
      block.lastAccess = Date.now();
      block.hitCount++;
      
      this.emit('memoryUpdated', {
        type: 'HUB',
        cogId: 0,
        blockIndex,
        address,
        data
      });
    }
  }

  /**
   * Handle request timeout
   */
  private handleRequestTimeout(data: any): void {
    this.emit('requestTimeout', data);
  }

  /**
   * Handle communication lost
   */
  private handleCommunicationLost(): void {
    // Mark all COGs as inactive
    for (const state of this.globalState.cogStates.values()) {
      state.isActive = false;
    }
    
    this.emit('communicationLost');
  }

  /**
   * Start update timer for batch processing
   */
  private startUpdateTimer(): void {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(() => {
      this.processPendingRequests();
      this.decayHeatMaps();
    }, this.UPDATE_INTERVAL_MS);
  }

  /**
   * Stop update timer
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Decay heat map values for visualization
   */
  private decayHeatMaps(): void {
    // Decay COG/LUT heat maps
    for (const state of this.globalState.cogStates.values()) {
      for (const block of state.cogMemory.values()) {
        block.hitCount = decayHeat(block.hitCount);
      }
      for (const block of state.lutMemory.values()) {
        block.hitCount = decayHeat(block.hitCount);
      }
    }

    // Decay HUB heat map
    for (const block of this.globalState.hubMemory.values()) {
      block.hitCount = decayHeat(block.hitCount);
    }
  }

  // Breakpoint Management

  /**
   * Set a breakpoint
   */
  public setBreakpoint(cogId: number, address: number): void {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      state.breakpoints.add(address);
      this.updateBreakpointMask();
      this.emit('breakpointSet', { cogId, address });
    }
  }

  /**
   * Clear a breakpoint
   */
  public clearBreakpoint(cogId: number, address: number): void {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      state.breakpoints.delete(address);
      this.updateBreakpointMask();
      this.emit('breakpointCleared', { cogId, address });
    }
  }

  /**
   * Clear all breakpoints for a COG
   */
  public clearAllBreakpoints(cogId: number): void {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      state.breakpoints.clear();
      this.updateBreakpointMask();
      this.emit('breakpointsCleared', { cogId });
    }
  }

  /**
   * Update the shared RequestCOGBRK mask
   */
  private updateBreakpointMask(): void {
    let mask = 0;
    
    for (const [cogId, state] of this.globalState.cogStates) {
      if (state.breakpoints.size > 0) {
        mask |= (1 << cogId);
      }
    }
    
    this.globalState.requestCOGBRK = mask;
    this.emit('breakpointMaskUpdated', { mask });
  }

  // Data Access Methods

  /**
   * Get COG state
   */
  public getCogState(cogId: number): COGDebugState | undefined {
    return this.globalState.cogStates.get(cogId);
  }

  /**
   * Get COG memory
   */
  public getCogMemory(cogId: number, address: number): number | undefined {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return undefined;

    const blockIndex = Math.floor(address / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
    const block = state.cogMemory.get(blockIndex);
    
    if (block && block.data) {
      const offset = Math.floor((address % (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4)) / 4);
      return block.data[offset];
    }
    
    return undefined;
  }

  /**
   * Get LUT memory
   */
  public getLutMemory(cogId: number, address: number): number | undefined {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return undefined;

    const lutAddr = address - 0x800;
    const blockIndex = Math.floor(lutAddr / (MEMORY_CONSTANTS.LUT_BLOCK_SIZE * 4));
    const block = state.lutMemory.get(blockIndex);
    
    if (block && block.data) {
      const offset = Math.floor((lutAddr % (MEMORY_CONSTANTS.LUT_BLOCK_SIZE * 4)) / 4);
      return block.data[offset];
    }
    
    return undefined;
  }

  /**
   * Get HUB memory
   */
  public getHubMemory(address: number): number | undefined {
    const blockIndex = Math.floor(address / MEMORY_CONSTANTS.HUB_BLOCK_SIZE);
    const block = this.globalState.hubMemory.get(blockIndex);
    
    if (block && block.data) {
      const offset = Math.floor((address % MEMORY_CONSTANTS.HUB_BLOCK_SIZE) / 4);
      return block.data[offset];
    }
    
    return undefined;
  }

  /**
   * Get all active COG IDs
   */
  public getActiveCogs(): number[] {
    return Array.from(this.globalState.activeCOGs);
  }

  /**
   * Get breakpoint mask
   */
  public getBreakpointMask(): number {
    return this.globalState.requestCOGBRK;
  }

  /**
   * Check if a COG is at a breakpoint
   */
  public isAtBreakpoint(cogId: number): boolean {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return false;
    
    return state.breakpoints.has(state.programCounter);
  }

  /**
   * Get memory heat value for visualization
   */
  public getMemoryHeat(type: 'COG' | 'LUT' | 'HUB', cogId: number, address: number): number {
    if (type === 'HUB') {
      const blockIndex = Math.floor(address / MEMORY_CONSTANTS.HUB_BLOCK_SIZE);
      const block = this.globalState.hubMemory.get(blockIndex);
      return block ? block.hitCount : 0;
    }

    const state = this.globalState.cogStates.get(cogId);
    if (!state) return 0;

    if (type === 'COG') {
      const blockIndex = Math.floor(address / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
      const block = state.cogMemory.get(blockIndex);
      return block ? block.hitCount : 0;
    } else {
      const lutAddr = address - 0x800;
      const blockIndex = Math.floor(lutAddr / (MEMORY_CONSTANTS.LUT_BLOCK_SIZE * 4));
      const block = state.lutMemory.get(blockIndex);
      return block ? block.hitCount : 0;
    }
  }

  /**
   * Request immediate memory update
   */
  public requestMemoryUpdate(type: 'COG' | 'LUT' | 'HUB', cogId: number, address: number): void {
    if (!this.protocol) return;

    if (type === 'COG') {
      const blockIndex = Math.floor(address / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
      this.protocol.requestCogBlock(cogId, blockIndex);
    } else if (type === 'LUT') {
      const lutAddr = address - 0x800;
      const blockIndex = Math.floor(lutAddr / (MEMORY_CONSTANTS.LUT_BLOCK_SIZE * 4));
      this.protocol.requestLutBlock(cogId, blockIndex);
    } else {
      this.protocol.requestHubMemory(address, MEMORY_CONSTANTS.HUB_SUB_BLOCK_SIZE);
    }
  }

  /**
   * Clear all state for a COG
   */
  public clearCogState(cogId: number): void {
    this.globalState.cogStates.delete(cogId);
    this.globalState.activeCOGs.delete(cogId);
    this.updateBreakpointMask();
    this.emit('cogCleared', { cogId });
  }

  /**
   * Reset all state
   */
  public reset(): void {
    this.stopUpdateTimer();
    this.pendingRequests.clear();
    this.globalState = this.createFreshGlobalState();
    this.emit('reset');
  }
}