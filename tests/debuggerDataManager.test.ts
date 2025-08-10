/** @format */

// tests/debuggerDataManager.test.ts

import { DebuggerDataManager } from '../src/classes/shared/debuggerDataManager';
import { DebuggerProtocol } from '../src/classes/shared/debuggerProtocol';
import { EventEmitter } from 'events';
import {
  MEMORY_CONSTANTS,
  DebuggerInitialMessage,
  DEBUG_COMMANDS
} from '../src/classes/shared/debuggerConstants';

// Mock DebuggerProtocol
class MockProtocol extends EventEmitter {
  public requests: any[] = [];
  
  requestCogBlock(cogId: number, blockIndex: number): void {
    this.requests.push({ type: 'COG', cogId, blockIndex });
  }
  
  requestLutBlock(cogId: number, blockIndex: number): void {
    this.requests.push({ type: 'LUT', cogId, blockIndex });
  }
  
  requestHubMemory(address: number, size: number): void {
    this.requests.push({ type: 'HUB', address, size });
  }
  
  simulateInitialMessage(message: DebuggerInitialMessage, cogCRCs?: Uint32Array, lutCRCs?: Uint32Array, hubChecksums?: Uint32Array): void {
    this.emit('initialMessage', {
      message,
      cogCRCs: cogCRCs || new Uint32Array(64),
      lutCRCs: lutCRCs || new Uint32Array(64),
      hubChecksums: hubChecksums || new Uint32Array(124)
    });
  }
  
  simulateMemoryResponse(cogId: number, address: number, data: Uint32Array): void {
    this.emit('response', {
      responseType: DEBUG_COMMANDS.RESPONSE_DATA,
      cogId,
      address,
      data
    });
  }
  
  simulateCommunicationLost(): void {
    this.emit('communicationLost');
  }
}

describe('DebuggerDataManager', () => {
  let manager: DebuggerDataManager;
  let mockProtocol: MockProtocol;

  beforeEach(() => {
    manager = new DebuggerDataManager();
    mockProtocol = new MockProtocol();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.disconnect();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('COG State Management', () => {
    it('should initialize fresh COG state', () => {
      const state = manager.initializeCogState(3);
      
      expect(state.cogId).toBe(3);
      expect(state.isActive).toBe(false);
      expect(state.isBreaked).toBe(false);
      expect(state.programCounter).toBe(0);
      expect(state.breakpoints.size).toBe(0);
      expect(state.cogMemory.size).toBe(MEMORY_CONSTANTS.COG_BLOCKS);
      expect(state.lutMemory.size).toBe(MEMORY_CONSTANTS.LUT_BLOCKS);
    });

    it('should reject invalid COG IDs', () => {
      expect(() => manager.initializeCogState(-1)).toThrow('Invalid COG ID: -1');
      expect(() => manager.initializeCogState(8)).toThrow('Invalid COG ID: 8');
    });

    it('should track active COGs', () => {
      manager.initializeCogState(0);
      manager.initializeCogState(3);
      manager.initializeCogState(7);
      
      const activeCogs = manager.getActiveCogs();
      expect(activeCogs).toEqual(expect.arrayContaining([0, 3, 7]));
      expect(activeCogs.length).toBe(3);
    });

    it('should clear COG state', () => {
      manager.initializeCogState(2);
      expect(manager.getCogState(2)).toBeDefined();
      
      manager.clearCogState(2);
      expect(manager.getCogState(2)).toBeUndefined();
      expect(manager.getActiveCogs()).not.toContain(2);
    });

    it('should reset all state', () => {
      manager.initializeCogState(0);
      manager.initializeCogState(1);
      manager.setBreakpoint(0, 0x100);
      
      manager.reset();
      
      expect(manager.getActiveCogs()).toEqual([]);
      expect(manager.getCogState(0)).toBeUndefined();
      expect(manager.getBreakpointMask()).toBe(0);
    });
  });

  describe('Memory Block Management', () => {
    beforeEach(() => {
      manager.connect(mockProtocol as any);
      manager.initializeCogState(0);
    });

    it('should initialize COG memory blocks', () => {
      const state = manager.getCogState(0);
      expect(state?.cogMemory.size).toBe(64);
      
      const block = state?.cogMemory.get(0);
      expect(block).toBeDefined();
      expect(block?.size).toBe(MEMORY_CONSTANTS.COG_BLOCK_SIZE);
      expect(block?.isDirty).toBe(true);
    });

    it('should initialize LUT memory blocks', () => {
      const state = manager.getCogState(0);
      expect(state?.lutMemory.size).toBe(64);
      
      const block = state?.lutMemory.get(0);
      expect(block).toBeDefined();
      expect(block?.baseAddress).toBeGreaterThanOrEqual(0x800);
    });

    it('should handle memory response for COG', () => {
      const data = new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      mockProtocol.simulateMemoryResponse(0, 0x000, data);
      
      const value = manager.getCogMemory(0, 0x004); // Second long
      expect(value).toBe(2);
    });

    it('should handle memory response for LUT', () => {
      const data = new Uint32Array(16);
      data[5] = 0x12345678;
      mockProtocol.simulateMemoryResponse(0, 0x800, data);
      
      const value = manager.getLutMemory(0, 0x814); // 0x800 + 5*4
      expect(value).toBe(0x12345678);
    });

    it('should handle memory response for HUB', () => {
      const data = new Uint32Array(1024); // 4KB block
      data[100] = 0xDEADBEEF;
      mockProtocol.simulateMemoryResponse(0, 0x10000, data);
      
      const value = manager.getHubMemory(0x10000 + 100 * 4);
      expect(value).toBe(0xDEADBEEF);
    });
  });

  describe('Checksum and Change Detection', () => {
    beforeEach(() => {
      manager.connect(mockProtocol as any);
      manager.initializeCogState(1);
    });

    it('should detect changed COG blocks from CRCs', () => {
      const cogCRCs = new Uint32Array(64);
      cogCRCs[5] = 0x12345678; // Different CRC for block 5
      
      const message: DebuggerInitialMessage = {
        cogNumber: 1,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0x100,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      mockProtocol.simulateInitialMessage(message, cogCRCs);
      
      // Should have scheduled request for block 5
      jest.advanceTimersByTime(100);
      
      const request = mockProtocol.requests.find(r => 
        r.type === 'COG' && r.blockIndex === 5
      );
      expect(request).toBeDefined();
    });

    it('should detect changed LUT blocks from CRCs', () => {
      const lutCRCs = new Uint32Array(64);
      lutCRCs[10] = 0xABCDEF00; // Different CRC for block 10
      
      const message: DebuggerInitialMessage = {
        cogNumber: 1,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      mockProtocol.simulateInitialMessage(message, undefined, lutCRCs);
      
      jest.advanceTimersByTime(100);
      
      const request = mockProtocol.requests.find(r => 
        r.type === 'LUT' && r.blockIndex === 10
      );
      expect(request).toBeDefined();
    });

    it('should detect changed HUB blocks from checksums', () => {
      const hubChecksums = new Uint32Array(124);
      hubChecksums[20] = 0x55555555; // Different checksum for block 20
      
      const message: DebuggerInitialMessage = {
        cogNumber: 1,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      mockProtocol.simulateInitialMessage(message, undefined, undefined, hubChecksums);
      
      jest.advanceTimersByTime(100);
      
      const request = mockProtocol.requests.find(r => 
        r.type === 'HUB' && r.address === 20 * MEMORY_CONSTANTS.HUB_BLOCK_SIZE
      );
      expect(request).toBeDefined();
    });
  });

  describe('Breakpoint Management', () => {
    beforeEach(() => {
      manager.initializeCogState(2);
      manager.initializeCogState(4);
    });

    it('should set breakpoints', () => {
      manager.setBreakpoint(2, 0x100);
      manager.setBreakpoint(2, 0x200);
      manager.setBreakpoint(4, 0x300);
      
      const state2 = manager.getCogState(2);
      const state4 = manager.getCogState(4);
      
      expect(state2?.breakpoints.has(0x100)).toBe(true);
      expect(state2?.breakpoints.has(0x200)).toBe(true);
      expect(state4?.breakpoints.has(0x300)).toBe(true);
    });

    it('should clear breakpoints', () => {
      manager.setBreakpoint(2, 0x100);
      manager.setBreakpoint(2, 0x200);
      
      manager.clearBreakpoint(2, 0x100);
      
      const state = manager.getCogState(2);
      expect(state?.breakpoints.has(0x100)).toBe(false);
      expect(state?.breakpoints.has(0x200)).toBe(true);
    });

    it('should clear all breakpoints for a COG', () => {
      manager.setBreakpoint(2, 0x100);
      manager.setBreakpoint(2, 0x200);
      manager.setBreakpoint(2, 0x300);
      
      manager.clearAllBreakpoints(2);
      
      const state = manager.getCogState(2);
      expect(state?.breakpoints.size).toBe(0);
    });

    it('should update breakpoint mask', () => {
      manager.initializeCogState(0);
      manager.initializeCogState(3);
      
      expect(manager.getBreakpointMask()).toBe(0);
      
      manager.setBreakpoint(0, 0x100);
      expect(manager.getBreakpointMask()).toBe(0x01);
      
      manager.setBreakpoint(3, 0x200);
      expect(manager.getBreakpointMask()).toBe(0x09); // Bits 0 and 3
      
      manager.clearAllBreakpoints(0);
      expect(manager.getBreakpointMask()).toBe(0x08); // Only bit 3
    });

    it('should detect when at breakpoint', () => {
      manager.setBreakpoint(2, 0x100);
      
      // Update PC via initial message
      const message: DebuggerInitialMessage = {
        cogNumber: 2,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0x100,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      manager.connect(mockProtocol as any);
      mockProtocol.simulateInitialMessage(message);
      
      expect(manager.isAtBreakpoint(2)).toBe(true);
      expect(manager.isAtBreakpoint(4)).toBe(false);
    });
  });

  describe('Request Batching', () => {
    beforeEach(() => {
      manager.connect(mockProtocol as any);
      manager.initializeCogState(0);
    });

    it('should batch multiple memory requests', () => {
      // Simulate multiple changed blocks
      const cogCRCs = new Uint32Array(64);
      for (let i = 0; i < 5; i++) {
        cogCRCs[i] = 0x11111111 * (i + 1);
      }
      
      const message: DebuggerInitialMessage = {
        cogNumber: 0,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      mockProtocol.requests = [];
      mockProtocol.simulateInitialMessage(message, cogCRCs);
      
      // No requests yet
      expect(mockProtocol.requests.length).toBe(0);
      
      // Advance timer to trigger batch
      jest.advanceTimersByTime(100);
      
      // Should have sent requests
      expect(mockProtocol.requests.length).toBeGreaterThan(0);
      expect(mockProtocol.requests.length).toBeLessThanOrEqual(10); // MAX_PENDING_REQUESTS
    });

    it('should limit concurrent requests', () => {
      // Simulate many changed blocks
      const cogCRCs = new Uint32Array(64);
      for (let i = 0; i < 64; i++) {
        cogCRCs[i] = 0x11111111 * (i + 1);
      }
      
      const message: DebuggerInitialMessage = {
        cogNumber: 0,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      mockProtocol.simulateInitialMessage(message, cogCRCs);
      
      jest.advanceTimersByTime(100);
      
      // Should respect MAX_PENDING_REQUESTS limit
      expect(mockProtocol.requests.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Heat Map Tracking', () => {
    beforeEach(() => {
      manager.connect(mockProtocol as any);
      manager.initializeCogState(0);
    });

    it('should track memory access heat', () => {
      const data = new Uint32Array(16);
      
      // Initial heat should be 0
      expect(manager.getMemoryHeat('COG', 0, 0)).toBe(0);
      
      // Access memory multiple times
      mockProtocol.simulateMemoryResponse(0, 0, data);
      expect(manager.getMemoryHeat('COG', 0, 0)).toBe(1);
      
      mockProtocol.simulateMemoryResponse(0, 0, data);
      expect(manager.getMemoryHeat('COG', 0, 0)).toBe(2);
    });

    it('should decay heat over time', () => {
      const data = new Uint32Array(16);
      mockProtocol.simulateMemoryResponse(0, 0, data);
      mockProtocol.simulateMemoryResponse(0, 0, data);
      mockProtocol.simulateMemoryResponse(0, 0, data);
      
      const initialHeat = manager.getMemoryHeat('COG', 0, 0);
      expect(initialHeat).toBe(3);
      
      // Advance time to trigger decay
      jest.advanceTimersByTime(100);
      
      const decayedHeat = manager.getMemoryHeat('COG', 0, 0);
      expect(decayedHeat).toBeLessThan(initialHeat);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      manager.connect(mockProtocol as any);
    });

    it('should emit cogInitialized event', (done) => {
      manager.on('cogInitialized', (data) => {
        expect(data.cogId).toBe(5);
        expect(data.state).toBeDefined();
        done();
      });
      
      manager.initializeCogState(5);
    });

    it('should emit memoryUpdated event', (done) => {
      manager.initializeCogState(0);
      
      manager.on('memoryUpdated', (data) => {
        expect(data.type).toBe('COG');
        expect(data.cogId).toBe(0);
        expect(data.address).toBe(0);
        done();
      });
      
      const memData = new Uint32Array(16);
      mockProtocol.simulateMemoryResponse(0, 0, memData);
    });

    it('should emit breakpointSet event', (done) => {
      manager.initializeCogState(3);
      
      manager.on('breakpointSet', (data) => {
        expect(data.cogId).toBe(3);
        expect(data.address).toBe(0x200);
        done();
      });
      
      manager.setBreakpoint(3, 0x200);
    });

    it('should handle communication lost', () => {
      manager.initializeCogState(0);
      manager.initializeCogState(1);
      
      const state0 = manager.getCogState(0);
      const state1 = manager.getCogState(1);
      
      // Activate COGs
      const message: DebuggerInitialMessage = {
        cogNumber: 0,
        breakStatus: 0,
        stackAStart: 0,
        stackBStart: 0,
        callDepth: 0,
        programCounter: 0,
        skipPattern: 0,
        registerA: 0,
        registerB: 0,
        pointerA: 0,
        pointerB: 0,
        directionA: 0,
        directionB: 0,
        outputA: 0,
        outputB: 0,
        inputA: 0,
        inputB: 0,
        flags: 0,
        interruptJump: 0,
        conditionCodes: 0
      };
      
      mockProtocol.simulateInitialMessage(message);
      message.cogNumber = 1;
      mockProtocol.simulateInitialMessage(message);
      
      expect(state0?.isActive).toBe(true);
      expect(state1?.isActive).toBe(true);
      
      // Simulate communication lost
      mockProtocol.simulateCommunicationLost();
      
      expect(state0?.isActive).toBe(false);
      expect(state1?.isActive).toBe(false);
    });
  });

  describe('Immediate Memory Requests', () => {
    beforeEach(() => {
      manager.connect(mockProtocol as any);
      manager.initializeCogState(0);
    });

    it('should request COG memory immediately', () => {
      mockProtocol.requests = [];
      manager.requestMemoryUpdate('COG', 0, 0x40); // Block 1
      
      expect(mockProtocol.requests.length).toBe(1);
      expect(mockProtocol.requests[0]).toEqual({
        type: 'COG',
        cogId: 0,
        blockIndex: 1
      });
    });

    it('should request LUT memory immediately', () => {
      mockProtocol.requests = [];
      manager.requestMemoryUpdate('LUT', 0, 0x840); // LUT block 1
      
      expect(mockProtocol.requests.length).toBe(1);
      expect(mockProtocol.requests[0]).toEqual({
        type: 'LUT',
        cogId: 0,
        blockIndex: 1
      });
    });

    it('should request HUB memory immediately', () => {
      mockProtocol.requests = [];
      manager.requestMemoryUpdate('HUB', 0, 0x10000);
      
      expect(mockProtocol.requests.length).toBe(1);
      expect(mockProtocol.requests[0]).toEqual({
        type: 'HUB',
        address: 0x10000,
        size: MEMORY_CONSTANTS.HUB_SUB_BLOCK_SIZE
      });
    });
  });
});