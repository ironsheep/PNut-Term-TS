/** @format */

// src/classes/shared/debuggerDataManager.ts

import { EventEmitter } from 'events';
import {
  MemoryBlock,
  COGDebugState,
  DebuggerGlobalState,
  DebuggerInitialMessage,
  MEMORY_CONSTANTS,
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

  // Hub sub-block heat tracking (Pascal: HubSubBlockHit array)
  // Each value is 0-255 representing heat (brightness) for visualization
  private hubSubBlockHit: Uint8Array = new Uint8Array(MEMORY_CONSTANTS.HUB_SUB_BLOCKS);
  private hubSubBlockOld: Int32Array = new Int32Array(MEMORY_CONSTANTS.HUB_SUB_BLOCKS);
  private hubSubBlockCurrent: Int32Array = new Int32Array(MEMORY_CONSTANTS.HUB_SUB_BLOCKS);

  // Per-address heat tracking for COG+LUT (Pascal: CogImageHit[0..$3FF])
  // $000-$1FF = COG registers, $200-$3FF = LUT registers
  // Values 0-255: 255=initial, 254=just changed, decay down to 0
  private cogImageHit: Uint8Array = new Uint8Array(MEMORY_CONSTANTS.COG_LUT_SIZE);
  private cogImageOld: Int32Array = new Int32Array(MEMORY_CONSTANTS.COG_LUT_SIZE);

  // Heat decay rate (Pascal: HitDecayRate, typically 2-4)
  private readonly HIT_DECAY_RATE = 2;

  // Register watch list (Pascal: RegWatch[0..RegWatchSize-1], RegWatchList[0..RegWatchListSize-1])
  // Tracks which of the 496 general registers ($000-$1EF) have changed
  private readonly REG_WATCH_SIZE = 0x1F0; // 496 watchable registers
  private readonly REG_WATCH_LIST_SIZE = 16; // Visible entries
  private regWatchCounters: Uint16Array = new Uint16Array(0x1F0); // Per-register change counters
  private regWatchPrevValues: Int32Array = new Int32Array(0x1F0); // Previous register values
  private regWatchList: Array<{ address: number; value: number; counter: number }> = [];
  private regWatchFirstBreak: boolean = true; // First break flag ($FFFF detection)

  // Smart pin watch list (Pascal: SmartWatch, SmartWatchList)
  private readonly SMART_WATCH_LIST_SIZE = 7;
  private smartWatchCounters: Uint16Array = new Uint16Array(64);
  private smartWatchPrevValues: Int32Array = new Int32Array(64);
  private smartWatchList: Array<{ pin: number; value: number; counter: number }> = [];
  private smartWatchDirOnly: boolean = true; // Only show pins with DIR bit set

  constructor() {
    super();
    this.globalState = this.createFreshGlobalState();
    // Initialize hub sub-block tracking (Pascal: for i := 0 to HubSubBlocks - 1 do HubSubBlockHit[i] := 255)
    this.hubSubBlockHit.fill(255); // Start with max heat to show initial state
    this.hubSubBlockOld.fill(-1);  // -1 indicates not yet received
    this.hubSubBlockCurrent.fill(-1);
    // Initialize COG+LUT heat tracking (Pascal: for i := 0 to $3FF do CogImageHit[i] := 255)
    this.cogImageHit.fill(255);
    this.cogImageOld.fill(-1);
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
      lastMessage: null,
      lastUpdateTime: 0
    };

    // Initialize COG memory blocks (32 blocks of 16 longs, covering $000-$1FF)
    // Pascal combines COG+LUT as CogImage[0..$3FF] with 64 blocks total
    // We keep them separate: cogMemory = blocks 0-31, lutMemory = blocks 0-31
    for (let i = 0; i < MEMORY_CONSTANTS.COG_ONLY_BLOCKS; i++) {
      const baseAddr = i * MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4; // Convert to byte address
      state.cogMemory.set(i, createMemoryBlock(i, baseAddr, MEMORY_CONSTANTS.COG_BLOCK_SIZE));
    }

    // Initialize LUT memory blocks (32 blocks of 16 longs, covering $200-$3FF)
    for (let i = 0; i < MEMORY_CONSTANTS.LUT_ONLY_BLOCKS; i++) {
      const baseAddr = 0x800 + i * MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4; // LUT starts at 0x800 bytes
      state.lutMemory.set(i, createMemoryBlock(i, baseAddr, MEMORY_CONSTANTS.COG_BLOCK_SIZE));
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

    // Update state from message (using correct Pascal field names)
    state.lastMessage = message;
    state.programCounter = message.programCounter;
    state.skipPattern = message.skipPattern;
    state.callDepth = message.callDepth;
    state.isActive = true;
    state.isBreaked = (message.breakCZ & 0x02) !== 0; // STALLI is bit 1 of breakCZ
    state.lastUpdateTime = Date.now(); // Track when this COG was last updated

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
   * Note: Pascal sends 64 CRC words covering both COG and LUT together
   * This method handles just the COG portion (first 32 blocks, indices 0-31)
   */
  private updateCogCRCs(cogId: number, crcs: Uint32Array): void {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return;

    // COG memory uses first 32 blocks (or first 32 CRC words)
    for (let i = 0; i < Math.min(crcs.length, MEMORY_CONSTANTS.COG_ONLY_BLOCKS); i++) {
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

    for (let i = 0; i < Math.min(crcs.length, MEMORY_CONSTANTS.LUT_ONLY_BLOCKS); i++) {
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

    const blockIndex = Math.floor(address / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
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
    // Decay COG/LUT block-level heat maps (for compatibility)
    for (const state of this.globalState.cogStates.values()) {
      for (const block of state.cogMemory.values()) {
        block.hitCount = decayHeat(block.hitCount);
      }
      for (const block of state.lutMemory.values()) {
        block.hitCount = decayHeat(block.hitCount);
      }
    }

    // Decay HUB block heat map
    for (const block of this.globalState.hubMemory.values()) {
      block.hitCount = decayHeat(block.hitCount);
    }

    // Decay per-address COG/LUT heat (Pascal-style)
    this.decayCogLutHeat();

    // Decay HUB sub-block heat map (for mini-map visualization)
    this.decayHubSubBlockHeat();
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
   * Toggle a breakpoint at an address
   * @returns true if breakpoint was set, false if it was cleared
   */
  public toggleBreakpoint(cogId: number, address: number): boolean {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      if (state.breakpoints.has(address)) {
        state.breakpoints.delete(address);
        this.updateBreakpointMask();
        this.emit('breakpointCleared', { cogId, address });
        return false;
      } else {
        state.breakpoints.add(address);
        this.updateBreakpointMask();
        this.emit('breakpointSet', { cogId, address });
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a breakpoint exists at an address
   */
  public hasBreakpoint(cogId: number, address: number): boolean {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      return state.breakpoints.has(address);
    }
    return false;
  }

  /**
   * Get all breakpoints for a COG
   * @returns Array of breakpoint addresses, sorted
   */
  public getBreakpoints(cogId: number): number[] {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      return Array.from(state.breakpoints).sort((a, b) => a - b);
    }
    return [];
  }

  /**
   * Get all breakpoints across all COGs
   * @returns Map of cogId to array of breakpoint addresses
   */
  public getAllBreakpoints(): Map<number, number[]> {
    const result = new Map<number, number[]>();
    for (const [cogId, state] of this.globalState.cogStates) {
      if (state.breakpoints.size > 0) {
        result.set(cogId, Array.from(state.breakpoints).sort((a, b) => a - b));
      }
    }
    return result;
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
    const blockIndex = Math.floor(lutAddr / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
    const block = state.lutMemory.get(blockIndex);
    
    if (block && block.data) {
      const offset = Math.floor((lutAddr % (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4)) / 4);
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
   * Get smart pin data for a COG
   * Smart pin values are stored separately from COG memory
   * Returns array of 64 pin values, or undefined if not available
   */
  public getSmartPinData(cogId: number): Uint32Array | undefined {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return undefined;

    // Smart pin data would be received in Phase 3 protocol
    // For now, return a placeholder array - actual data comes from smartPinData field
    // which is populated by processPhase3Data in debugDebuggerWin.ts
    if ((state as any).smartPinData) {
      return (state as any).smartPinData;
    }

    // Fallback: return empty array
    return new Uint32Array(64);
  }

  /**
   * Set smart pin data for a COG (called from Phase 3 processing)
   */
  public setSmartPinData(cogId: number, data: Uint32Array): void {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      (state as any).smartPinData = data;
    }
  }

  /**
   * Get hub sub-block heat value for mini-map visualization
   * Pascal: HubSubBlockHit[y] - values 0-255, higher = hotter (recently changed)
   * @param subBlockIndex Index 0 to HUB_SUB_BLOCKS-1 (3967)
   * @returns Heat value 0-255
   */
  public getHubSubBlockHeat(subBlockIndex: number): number {
    if (subBlockIndex >= 0 && subBlockIndex < MEMORY_CONSTANTS.HUB_SUB_BLOCKS) {
      return this.hubSubBlockHit[subBlockIndex];
    }
    return 0;
  }

  /**
   * Update hub sub-block checksum and heat
   * Called when receiving Phase 1 or Phase 3 data with sub-block checksums
   * Pascal algorithm from lines 1677-1685:
   *   h := HubSubBlockHit[y];
   *   if i = -1 then                         // Not yet received
   *   else if i <> HubSubBlockOld[y] then h := 254  // Changed, set hot
   *   else if h > 0 then Dec(h);             // Decay heat
   *   HubSubBlockHit[y] := h;
   *   HubSubBlockOld[y] := i;
   */
  public updateHubSubBlock(subBlockIndex: number, checksum: number): void {
    if (subBlockIndex < 0 || subBlockIndex >= MEMORY_CONSTANTS.HUB_SUB_BLOCKS) {
      return;
    }

    const oldChecksum = this.hubSubBlockCurrent[subBlockIndex];
    this.hubSubBlockCurrent[subBlockIndex] = checksum;

    // Update heat based on Pascal algorithm
    if (oldChecksum === -1) {
      // First time receiving this block, don't change heat
      this.hubSubBlockOld[subBlockIndex] = checksum;
    } else if (checksum !== this.hubSubBlockOld[subBlockIndex]) {
      // Block changed - set to hot (254, not 255 to distinguish from initial state)
      this.hubSubBlockHit[subBlockIndex] = 254;
      this.hubSubBlockOld[subBlockIndex] = checksum;
    }
    // Decay is handled separately in decayHubSubBlockHeat
  }

  /**
   * Decay hub sub-block heat values
   * Called periodically to fade heat visualization
   */
  private decayHubSubBlockHeat(): void {
    for (let i = 0; i < MEMORY_CONSTANTS.HUB_SUB_BLOCKS; i++) {
      if (this.hubSubBlockHit[i] > 0) {
        this.hubSubBlockHit[i]--;
      }
    }
  }

  /**
   * Process hub sub-block checksums from Phase 1 packet
   * Updates all 3968 sub-block heat values based on changes
   * @param checksums Array of 3968 checksum values (16-bit words)
   */
  public processHubSubBlockChecksums(checksums: number[]): void {
    const count = Math.min(checksums.length, MEMORY_CONSTANTS.HUB_SUB_BLOCKS);
    for (let i = 0; i < count; i++) {
      this.updateHubSubBlock(i, checksums[i]);
    }
  }

  /**
   * Get per-address heat value for COG or LUT register
   * Pascal: CogImageHit[addr] where addr is 0-$3FF
   * @param addr Address in COG ($000-$1FF) or LUT ($200-$3FF) range
   * @returns Heat value 0-255 (0=cold, 254=just changed, 255=initial)
   */
  public getCogLutHeat(addr: number): number {
    if (addr >= 0 && addr < MEMORY_CONSTANTS.COG_LUT_SIZE) {
      return this.cogImageHit[addr];
    }
    return 0;
  }

  /**
   * Update COG/LUT register value and heat
   * Pascal algorithm from lines 1643-1650:
   *   h := CogImageHit[y];
   *   if h = 255 then h := 0          // Initial state, clear heat
   *   else if i <> CogImageOld[y] then h := 254  // Changed, set hot
   *   else Dec(h, Smaller(HitDecayRate, h));     // Decay heat
   *   CogImageHit[y] := h;
   *   CogImageOld[y] := i;
   * @param addr Address in COG/LUT range ($000-$3FF)
   * @param value New register value
   */
  public updateCogLutValue(addr: number, value: number): void {
    if (addr < 0 || addr >= MEMORY_CONSTANTS.COG_LUT_SIZE) {
      return;
    }

    let h = this.cogImageHit[addr];
    const oldValue = this.cogImageOld[addr];

    if (h === 255) {
      // Initial state - cool down from initial marker
      h = 0;
    } else if (oldValue !== -1 && value !== oldValue) {
      // Value changed - set to hot
      h = 254;
    }
    // Note: decay is handled separately in decayCogLutHeat()

    this.cogImageHit[addr] = h;
    this.cogImageOld[addr] = value;
  }

  /**
   * Decay COG/LUT per-address heat values
   * Pascal: Dec(h, Smaller(HitDecayRate, h))
   */
  private decayCogLutHeat(): void {
    for (let i = 0; i < MEMORY_CONSTANTS.COG_LUT_SIZE; i++) {
      const h = this.cogImageHit[i];
      if (h > 0 && h !== 255) {
        // Decay by HIT_DECAY_RATE but not below 0
        this.cogImageHit[i] = Math.max(0, h - this.HIT_DECAY_RATE);
      }
    }
  }

  // ==========================================================================
  // Register Watch List (Pascal: DebuggerUnit.pas Section 6.7)
  // ==========================================================================

  /**
   * Update register watch list on each breakpoint.
   * Pascal algorithm:
   * 1. For each register: if value changed, set counter=1000; else if counter>1, decrement by 1
   * 2. For each register with counter>0: find in visible list or replace oldest entry
   * 3. On first break ($FFFF counters), reset all to 0 to avoid false positives
   *
   * @param cogMemory Map of block index -> Uint32Array (16 longs each) from Phase 3
   */
  public updateRegisterWatch(cogMemory: Map<number, Uint32Array>): void {
    // First break detection — all counters start as 0, prevValues as 0
    if (this.regWatchFirstBreak) {
      this.regWatchFirstBreak = false;
      // Store current values as "previous" without triggering watches
      for (const [blockIndex, blockData] of cogMemory) {
        const baseAddr = blockIndex * 16;
        for (let j = 0; j < blockData.length && baseAddr + j < this.REG_WATCH_SIZE; j++) {
          this.regWatchPrevValues[baseAddr + j] = blockData[j];
        }
      }
      return;
    }

    // Step 1: Update counters for all watchable registers
    for (const [blockIndex, blockData] of cogMemory) {
      const baseAddr = blockIndex * 16;
      for (let j = 0; j < blockData.length; j++) {
        const addr = baseAddr + j;
        if (addr >= this.REG_WATCH_SIZE) continue;

        const newValue = blockData[j];
        const oldValue = this.regWatchPrevValues[addr];

        if (newValue !== oldValue) {
          // Value changed — set counter to 1000
          this.regWatchCounters[addr] = 1000;
          this.regWatchPrevValues[addr] = newValue;
        } else if (this.regWatchCounters[addr] > 1) {
          // No change — decay counter
          this.regWatchCounters[addr]--;
        }
      }
    }

    // Step 2: Update visible list (16 entries max)
    for (let addr = 0; addr < this.REG_WATCH_SIZE; addr++) {
      if (this.regWatchCounters[addr] === 0) continue;

      // Find this address in the visible list
      const existingIdx = this.regWatchList.findIndex(e => e.address === addr);
      if (existingIdx >= 0) {
        // Update existing entry
        this.regWatchList[existingIdx].value = this.regWatchPrevValues[addr];
        this.regWatchList[existingIdx].counter = this.regWatchCounters[addr];
      } else if (this.regWatchList.length < this.REG_WATCH_LIST_SIZE) {
        // Add new entry
        this.regWatchList.push({
          address: addr,
          value: this.regWatchPrevValues[addr],
          counter: this.regWatchCounters[addr]
        });
      } else {
        // Replace oldest entry (lowest counter)
        let oldestIdx = 0;
        let oldestCounter = this.regWatchList[0].counter;
        for (let i = 1; i < this.regWatchList.length; i++) {
          if (this.regWatchList[i].counter < oldestCounter) {
            oldestCounter = this.regWatchList[i].counter;
            oldestIdx = i;
          }
        }
        if (this.regWatchCounters[addr] > oldestCounter) {
          this.regWatchList[oldestIdx] = {
            address: addr,
            value: this.regWatchPrevValues[addr],
            counter: this.regWatchCounters[addr]
          };
        }
      }
    }
  }

  /**
   * Reset register watch list (Pascal: R key or click on watch box)
   */
  public resetRegisterWatch(): void {
    this.regWatchCounters.fill(0);
    this.regWatchList = [];
    this.regWatchFirstBreak = true;
  }

  /**
   * Get the visible register watch list for rendering.
   * Returns up to 16 entries: { address, value, counter }
   */
  public getRegisterWatchList(): ReadonlyArray<{ address: number; value: number; counter: number }> {
    return this.regWatchList;
  }

  // ==========================================================================
  // Smart Pin Watch List (Pascal: DebuggerUnit.pas Section 6.16)
  // ==========================================================================

  /**
   * Update smart pin watch list on each breakpoint.
   * Same delta algorithm as register watch but with 7 visible entries.
   * Only pins 0-61 are tracked (62/63 are TX/RX).
   *
   * @param pinData 64-element array of RQPIN values from Phase 3
   * @param pinFlags 8-byte mask array indicating which pins had non-zero RQPIN
   */
  public updateSmartPinWatch(pinData: Uint32Array, pinFlags: Uint8Array): void {
    for (let pin = 0; pin < 62; pin++) {
      // Check if this pin had a non-zero RQPIN value
      const group = Math.floor(pin / 8);
      const bit = pin % 8;
      const hasValue = (pinFlags[group] & (1 << bit)) !== 0;

      if (!hasValue) {
        // No RQPIN value — decay counter
        if (this.smartWatchCounters[pin] > 1) {
          this.smartWatchCounters[pin]--;
        }
        continue;
      }

      const newValue = pinData[pin];
      const oldValue = this.smartWatchPrevValues[pin];

      if (newValue !== oldValue) {
        this.smartWatchCounters[pin] = 1000;
        this.smartWatchPrevValues[pin] = newValue;
      } else if (this.smartWatchCounters[pin] > 1) {
        this.smartWatchCounters[pin]--;
      }
    }

    // Update visible list (7 entries max)
    for (let pin = 0; pin < 62; pin++) {
      if (this.smartWatchCounters[pin] === 0) continue;

      // DIR filter: if smartWatchDirOnly, skip pins without DIR bit
      if (this.smartWatchDirOnly) {
        const dirA = this.getCogMemoryValue(0x1FA) || 0;
        const dirB = this.getCogMemoryValue(0x1FB) || 0;
        const dirBit = pin < 32 ? ((dirA >>> pin) & 1) : ((dirB >>> (pin - 32)) & 1);
        if (!dirBit) continue;
      }

      const existingIdx = this.smartWatchList.findIndex(e => e.pin === pin);
      if (existingIdx >= 0) {
        this.smartWatchList[existingIdx].value = this.smartWatchPrevValues[pin];
        this.smartWatchList[existingIdx].counter = this.smartWatchCounters[pin];
      } else if (this.smartWatchList.length < this.SMART_WATCH_LIST_SIZE) {
        this.smartWatchList.push({
          pin,
          value: this.smartWatchPrevValues[pin],
          counter: this.smartWatchCounters[pin]
        });
      } else {
        // Replace oldest entry
        let oldestIdx = 0;
        let oldestCounter = this.smartWatchList[0].counter;
        for (let i = 1; i < this.smartWatchList.length; i++) {
          if (this.smartWatchList[i].counter < oldestCounter) {
            oldestCounter = this.smartWatchList[i].counter;
            oldestIdx = i;
          }
        }
        if (this.smartWatchCounters[pin] > oldestCounter) {
          this.smartWatchList[oldestIdx] = {
            pin,
            value: this.smartWatchPrevValues[pin],
            counter: this.smartWatchCounters[pin]
          };
        }
      }
    }
  }

  /** Reset smart pin watch list (Pascal: left-click on smart pin box) */
  public resetSmartPinWatch(): void {
    this.smartWatchCounters.fill(0);
    this.smartWatchList = [];
  }

  /** Toggle DIR-only filter (Pascal: right-click on smart pin box) */
  public toggleSmartPinDirFilter(): void {
    this.smartWatchDirOnly = !this.smartWatchDirOnly;
  }

  /** Get visible smart pin watch list for rendering */
  public getSmartPinWatchList(): ReadonlyArray<{ pin: number; value: number; counter: number }> {
    return this.smartWatchList;
  }

  /** Helper: get a single COG memory value by address */
  private getCogMemoryValue(addr: number): number {
    // Look through COG states for any active COG's memory
    for (const [, cogState] of this.globalState.cogStates) {
      const blockIdx = Math.floor(addr / 16);
      const block = cogState.cogMemory.get(blockIdx);
      if (block && block.data) {
        return block.data[addr % 16] || 0;
      }
    }
    return 0;
  }

  /**
   * Process COG+LUT memory block update with heat tracking
   * Called when receiving Phase 3 data with actual register values
   * @param startAddr Starting address ($000-$3FF)
   * @param data Array of register values
   */
  public processCogLutData(startAddr: number, data: Uint32Array): void {
    for (let i = 0; i < data.length; i++) {
      const addr = startAddr + i;
      if (addr < MEMORY_CONSTANTS.COG_LUT_SIZE) {
        this.updateCogLutValue(addr, data[i]);
      }
    }
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
      const blockIndex = Math.floor(lutAddr / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
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
      const blockIndex = Math.floor(lutAddr / (MEMORY_CONSTANTS.COG_BLOCK_SIZE * 4));
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
    // Reset hub sub-block tracking
    this.hubSubBlockHit.fill(255);
    this.hubSubBlockOld.fill(-1);
    this.hubSubBlockCurrent.fill(-1);
    // Reset COG/LUT per-address heat tracking
    this.cogImageHit.fill(255);
    this.cogImageOld.fill(-1);
    this.emit('reset');
  }
  
  // Data Access Methods for Rendering
  
  /**
   * Update status data from debugger packet
   */
  public updateStatusData(data: any): void {
    // Store status data for rendering
    this.emit('statusUpdated', data);
  }
  
  /**
   * Update a COG register value
   */
  public updateCogRegister(index: number, value: number): void {
    // Store in the first COG state we find (need to improve this)
    for (const state of this.globalState.cogStates.values()) {
      const blockIndex = Math.floor(index / 16);
      const blockOffset = index % 16;
      const block = state.cogMemory.get(blockIndex);
      if (block) {
        block.data[blockOffset] = value;
        block.hitCount = Math.min(block.hitCount + 1, 100);
      }
      break; // Just update first COG for now
    }
  }
  
  /**
   * Update a LUT register value
   */
  public updateLutRegister(index: number, value: number): void {
    // Store in the first COG state we find (need to improve this)
    for (const state of this.globalState.cogStates.values()) {
      const blockIndex = Math.floor(index / 16);
      const blockOffset = index % 16;
      const block = state.lutMemory.get(blockIndex);
      if (block) {
        block.data[blockOffset] = value;
        block.hitCount = Math.min(block.hitCount + 1, 100);
      }
      break; // Just update first COG for now
    }
  }
  
  /**
   * Get COG register value
   */
  public getCogRegister(cogId: number, index: number): number {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      const blockIndex = Math.floor(index / 16);
      const blockOffset = index % 16;
      const block = state.cogMemory.get(blockIndex);
      if (block) {
        return block.data[blockOffset];
      }
    }
    return 0;
  }
  
  /**
   * Get LUT register value
   */
  public getLutRegister(cogId: number, index: number): number {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      const blockIndex = Math.floor(index / 16);
      const blockOffset = index % 16;
      const block = state.lutMemory.get(blockIndex);
      if (block) {
        return block.data[blockOffset];
      }
    }
    return 0;
  }

  // Phase 1 Protocol - Changed Block Detection

  /**
   * Get indices of COG memory blocks that have changed (dirty)
   * Used to determine which blocks to request in Phase 2
   */
  public getChangedCogBlocks(): number[] {
    const changed: number[] = [];
    for (const state of this.globalState.cogStates.values()) {
      for (const [index, block] of state.cogMemory) {
        if (block.isDirty) {
          changed.push(index);
        }
      }
      // Also check LUT blocks (indices 32-63 in combined view)
      for (const [index, block] of state.lutMemory) {
        if (block.isDirty) {
          changed.push(32 + index); // Offset by 32 for combined COG+LUT indexing
        }
      }
      break; // Only check first COG for now
    }
    return changed;
  }

  /**
   * Get indices of Hub memory blocks that have changed (dirty)
   * Used to determine which blocks to request in Phase 2
   */
  public getChangedHubBlocks(): number[] {
    const changed: number[] = [];
    for (const [index, block] of this.globalState.hubMemory) {
      if (block.isDirty) {
        changed.push(index);
      }
    }
    return changed;
  }

  /**
   * Process Phase 1 CRC data from debugger packet
   * Takes 64 CRC words (first 32 for COG, last 32 for LUT) and 124 Hub checksums
   * Marks blocks as dirty where values have changed.
   * @param cogId The COG ID this data belongs to
   * @param cogCRCs Array of 64 CRC values (16-bit words from Phase 1 packet)
   * @param hubChecksums Array of 124 Hub checksum values (16-bit words from Phase 1 packet)
   */
  public processPhase1CRCs(cogId: number, cogCRCs: number[], hubChecksums: number[]): void {
    const state = this.globalState.cogStates.get(cogId);
    if (!state) return;

    // Process COG CRCs (first 32 words)
    for (let i = 0; i < Math.min(32, cogCRCs.length); i++) {
      const block = state.cogMemory.get(i);
      if (block && block.checksum !== cogCRCs[i]) {
        block.checksum = cogCRCs[i];
        block.isDirty = true;
        this.scheduleMemoryRequest('COG', cogId, i);
      }
    }

    // Process LUT CRCs (last 32 words, indices 32-63)
    for (let i = 0; i < Math.min(32, cogCRCs.length - 32); i++) {
      const crcIndex = 32 + i;
      const block = state.lutMemory.get(i);
      if (block && crcIndex < cogCRCs.length && block.checksum !== cogCRCs[crcIndex]) {
        block.checksum = cogCRCs[crcIndex];
        block.isDirty = true;
        this.scheduleMemoryRequest('LUT', cogId, i);
      }
    }

    // Process Hub checksums (124 words)
    for (let i = 0; i < Math.min(hubChecksums.length, MEMORY_CONSTANTS.HUB_BLOCKS); i++) {
      const block = this.globalState.hubMemory.get(i);
      if (block && block.checksum !== hubChecksums[i]) {
        block.checksum = hubChecksums[i];
        block.isDirty = true;
        this.scheduleMemoryRequest('HUB', 0, i);
      }
    }
  }

  // ===== Multi-COG Coordination Methods =====

  /**
   * Get list of active COG IDs (COGs that have debugger state)
   */
  public getActiveCogIds(): number[] {
    return Array.from(this.globalState.activeCOGs).sort((a, b) => a - b);
  }

  /**
   * Get number of active COGs
   */
  public getActiveCogCount(): number {
    return this.globalState.activeCOGs.size;
  }

  /**
   * Check if a specific COG is active
   */
  public isCogActive(cogId: number): boolean {
    return this.globalState.activeCOGs.has(cogId);
  }

  /**
   * Get COG that most recently hit a breakpoint
   * Used to determine which debugger window to focus
   */
  public getMostRecentBreakCog(): number | null {
    let mostRecent: { cogId: number; time: number } | null = null;

    for (const [cogId, state] of this.globalState.cogStates) {
      if (state.lastUpdateTime) {
        if (!mostRecent || state.lastUpdateTime > mostRecent.time) {
          mostRecent = { cogId, time: state.lastUpdateTime };
        }
      }
    }

    return mostRecent ? mostRecent.cogId : null;
  }

  /**
   * Get bitmask of COGs that have hit breakpoints
   * Pascal: DebuggerEna tracks which COGs have debugger windows
   */
  public getActiveCogMask(): number {
    let mask = 0;
    for (const cogId of this.globalState.activeCOGs) {
      mask |= (1 << cogId);
    }
    return mask;
  }

  /**
   * Request a break on specific COG(s)
   * Pascal: RequestCOGBRK is sent in Phase 2
   * @param cogMask Bitmask of COGs to request break (0-7)
   */
  public requestCogBreak(cogMask: number): void {
    this.globalState.requestCOGBRK |= (cogMask & 0xFF);
    this.emit('cogBreakRequested', { mask: cogMask });
  }

  /**
   * Clear COG break request
   */
  public clearCogBreakRequest(): void {
    this.globalState.requestCOGBRK = 0;
  }

  /**
   * Get the current COG break request mask
   * This is sent to P2 in Phase 2 to request breaks on other COGs
   */
  public getCogBreakRequest(): number {
    return this.globalState.requestCOGBRK;
  }

  /**
   * Broadcast a command to all active COGs
   * Used for synchronized operations like "step all" or "break all"
   */
  public broadcastCommand(command: string, data?: any): void {
    for (const cogId of this.globalState.activeCOGs) {
      this.emit('cogCommand', { cogId, command, data });
    }
  }

  /**
   * Get summary of all COG states for multi-COG display
   */
  public getCogSummaries(): Array<{
    cogId: number;
    pc: number;
    active: boolean;
    atBreakpoint: boolean;
    breakpointCount: number;
  }> {
    const summaries = [];

    for (const [cogId, state] of this.globalState.cogStates) {
      summaries.push({
        cogId,
        pc: state.programCounter,
        active: this.globalState.activeCOGs.has(cogId),
        atBreakpoint: this.isAtBreakpoint(cogId),
        breakpointCount: state.breakpoints.size
      });
    }

    return summaries.sort((a, b) => a.cogId - b.cogId);
  }

  /**
   * Activate a COG (create its state if needed)
   * Called when a COG sends its first debugger message
   */
  public activateCog(cogId: number): void {
    if (!this.globalState.cogStates.has(cogId)) {
      this.initializeCogState(cogId);
    }
    this.globalState.activeCOGs.add(cogId);
    this.emit('cogActivated', { cogId });
  }

  /**
   * Deactivate a COG (close its debugger but keep state)
   */
  public deactivateCog(cogId: number): void {
    this.globalState.activeCOGs.delete(cogId);
    this.emit('cogDeactivated', { cogId });
  }

  // ============================================================================
  // Window Coordination
  // ============================================================================

  private registeredWindows: Map<number, Set<string>> = new Map(); // cogId -> Set of windowIds

  /**
   * Register a debugger window for a specific COG
   * Allows coordinated updates and focus management
   */
  public registerWindow(cogId: number, windowId: string): void {
    if (!this.registeredWindows.has(cogId)) {
      this.registeredWindows.set(cogId, new Set());
    }
    this.registeredWindows.get(cogId)!.add(windowId);
    this.emit('windowRegistered', { cogId, windowId });
  }

  /**
   * Unregister a debugger window
   */
  public unregisterWindow(cogId: number, windowId: string): void {
    const windows = this.registeredWindows.get(cogId);
    if (windows) {
      windows.delete(windowId);
      if (windows.size === 0) {
        this.registeredWindows.delete(cogId);
      }
    }
    this.emit('windowUnregistered', { cogId, windowId });
  }

  /**
   * Get all registered windows for a COG
   */
  public getRegisteredWindows(cogId: number): string[] {
    const windows = this.registeredWindows.get(cogId);
    return windows ? Array.from(windows) : [];
  }

  /**
   * Get all COGs with registered windows
   */
  public getCogsWithWindows(): number[] {
    return Array.from(this.registeredWindows.keys()).sort((a, b) => a - b);
  }

  /**
   * Check if a COG has any registered windows
   */
  public hasRegisteredWindow(cogId: number): boolean {
    const windows = this.registeredWindows.get(cogId);
    return windows !== undefined && windows.size > 0;
  }

  /**
   * Consume and clear the RequestCOGBRK mask
   * Called when the break request is sent to P2 (Pascal behavior)
   */
  public consumeCogBreakRequest(): number {
    const request = this.globalState.requestCOGBRK;
    this.globalState.requestCOGBRK = 0;
    return request;
  }

  /**
   * Notify all windows that a COG hit a breakpoint
   * Emit event for window focus management
   */
  public notifyBreakpointHit(cogId: number): void {
    const state = this.globalState.cogStates.get(cogId);
    if (state) {
      state.isBreaked = true;
      state.lastUpdateTime = Date.now();
    }
    this.emit('breakpointHit', {
      cogId,
      hasWindow: this.hasRegisteredWindow(cogId),
      pc: state?.programCounter ?? 0
    });
  }

  /**
   * Synchronize state across all windows for a COG
   * Forces all windows to refresh their display
   */
  public synchronizeWindows(cogId?: number): void {
    if (cogId !== undefined) {
      this.emit('synchronizeWindow', { cogId });
    } else {
      // Synchronize all active COGs
      for (const activeCogId of this.globalState.activeCOGs) {
        this.emit('synchronizeWindow', { cogId: activeCogId });
      }
    }
  }

  /**
   * Request focus on a specific COG's debugger window
   * Used when a breakpoint hits to bring that window to front
   */
  public requestWindowFocus(cogId: number): void {
    if (this.hasRegisteredWindow(cogId)) {
      this.emit('focusWindow', { cogId });
    }
  }

  /**
   * Send a command to a specific COG's window(s)
   * Different from broadcastCommand which goes to all COGs
   */
  public sendCogCommand(cogId: number, command: string, data?: unknown): void {
    this.emit('cogCommand', { cogId, command, data });
  }

  /**
   * Get coordination state for debugging
   */
  public getCoordinationState(): {
    activeCogs: number[];
    registeredWindows: Map<number, string[]>;
    pendingBreakRequest: number;
  } {
    const windowsMap = new Map<number, string[]>();
    for (const [cogId, windows] of this.registeredWindows) {
      windowsMap.set(cogId, Array.from(windows));
    }
    return {
      activeCogs: this.getActiveCogIds(),
      registeredWindows: windowsMap,
      pendingBreakRequest: this.globalState.requestCOGBRK
    };
  }
}