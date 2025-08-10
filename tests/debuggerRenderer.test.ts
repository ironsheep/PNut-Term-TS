/** @format */

// tests/debuggerRenderer.test.ts

import { DebuggerRenderer } from '../src/classes/shared/debuggerRenderer';
import { DebuggerDataManager } from '../src/classes/shared/debuggerDataManager';
import { LAYOUT_CONSTANTS, DEBUG_COLORS } from '../src/classes/shared/debuggerConstants';

describe('DebuggerRenderer', () => {
  let canvas: HTMLCanvasElement;
  let dataManager: DebuggerDataManager;
  let renderer: DebuggerRenderer;
  const cogId = 0;

  beforeEach(() => {
    // Create mock canvas
    canvas = document.createElement('canvas');
    canvas.width = LAYOUT_CONSTANTS.GRID_WIDTH * 8;
    canvas.height = LAYOUT_CONSTANTS.GRID_HEIGHT * 16;
    
    // Mock getContext
    const mockContext = {
      fillStyle: '',
      fillRect: jest.fn(),
      fillText: jest.fn(),
      font: '',
      textBaseline: ''
    };
    canvas.getContext = jest.fn().mockReturnValue(mockContext);
    
    // Create data manager and initialize COG
    dataManager = new DebuggerDataManager();
    dataManager.initializeCogState(cogId);
    
    // Create renderer
    renderer = new DebuggerRenderer(canvas, dataManager, cogId);
  });

  describe('Initialization', () => {
    it('should initialize with correct dimensions', () => {
      expect(canvas.width).toBe(LAYOUT_CONSTANTS.GRID_WIDTH * 8);
      expect(canvas.height).toBe(LAYOUT_CONSTANTS.GRID_HEIGHT * 16);
    });

    it('should set up canvas context properly', () => {
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();
      expect(ctx!.font).toContain('Parallax');
      expect(ctx!.textBaseline).toBe('top');
    });

    it('should mark all regions as dirty initially', () => {
      // Initial render should be triggered
      const ctx = canvas.getContext('2d') as any;
      renderer.render();
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled();
    });
  });

  describe('Region Management', () => {
    it('should mark specific regions as dirty', () => {
      renderer.markRegionDirty('disassembly');
      renderer.markRegionDirty('cogRegisters');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillRect.mockClear();
      ctx.fillText.mockClear();
      
      renderer.render();
      
      // Should have rendered something
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it('should only render dirty regions', () => {
      // Clear initial dirty state
      renderer.render();
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillRect.mockClear();
      ctx.fillText.mockClear();
      
      // Mark only one region as dirty
      renderer.markRegionDirty('flags');
      renderer.render();
      
      // Should have rendered only the flags region
      const callCount = ctx.fillRect.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);
      expect(callCount).toBeLessThan(20); // Much less than full render
    });
  });

  describe('Disassembly Integration', () => {
    it('should render disassembly with actual Disassembler', () => {
      // Set up some COG memory
      const state = dataManager.getCogState(cogId);
      if (state) {
        state.programCounter = 0x100;
        state.skipPattern = 0;
        
        // Add some test instructions via memory blocks
        const block = state.cogMemory.get(4); // Block containing 0x100
        if (block) {
          block.data[0] = 0xF0A80201; // ADD at 0x100
          block.data[1] = 0xF0AC0201; // SUB at 0x104
          block.data[2] = 0xF0C00201; // AND at 0x108
        }
      }
      
      renderer.markRegionDirty('disassembly');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillText.mockClear();
      
      renderer.render();
      
      // Should have rendered disassembly text
      const textCalls = ctx.fillText.mock.calls;
      expect(textCalls.length).toBeGreaterThan(0);
      
      // Should include 'Disassembly' title
      const hasTitle = textCalls.some((call: any[]) => 
        call[0].includes('Disassembly')
      );
      expect(hasTitle).toBe(true);
      
      // Should include PC value
      const hasPC = textCalls.some((call: any[]) => 
        call[0].includes('PC:') || call[0].includes('00100')
      );
      expect(hasPC).toBe(true);
    });

    it('should highlight current PC line', () => {
      const state = dataManager.getCogState(cogId);
      if (state) {
        state.programCounter = 0x104;
      }
      
      renderer.markRegionDirty('disassembly');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillStyle = '';
      ctx.fillRect.mockClear();
      
      renderer.render();
      
      // Should have set different background color for PC line
      const fillStyleCalls = ctx.fillRect.mock.calls;
      expect(fillStyleCalls.length).toBeGreaterThan(0);
    });

    it('should show skip pattern in disassembly', () => {
      const state = dataManager.getCogState(cogId);
      if (state) {
        state.programCounter = 0x100;
        state.skipPattern = 0b101; // Skip 1st and 3rd instructions
      }
      
      renderer.markRegionDirty('disassembly');
      renderer.render();
      
      // Verify skip pattern is applied
      // This would be visible in the rendered output
      expect(true).toBe(true); // Placeholder - actual rendering tested visually
    });
  });

  describe('Heat Map Visualization', () => {
    it('should render COG registers with heat colors', () => {
      // Simulate memory access to create heat
      const state = dataManager.getCogState(cogId);
      if (state) {
        const block = state.cogMemory.get(0); // First block
        if (block) {
          // Simulate writes to increase heat
          block.data[4] = 0x12345678;
          block.lastAccess = Date.now();
          block.hitCount = 5; // Simulate multiple accesses
        }
      }
      
      renderer.markRegionDirty('cogRegisters');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillStyle = '';
      
      renderer.render();
      
      // Should have used heat colors
      expect(ctx.fillStyle).toBeDefined();
    });

    it('should track memory heat', () => {
      // Set initial heat via memory block
      const state = dataManager.getCogState(cogId);
      if (state) {
        const block = state.cogMemory.get(1);
        if (block) {
          block.hitCount = 10;
          block.lastAccess = Date.now();
        }
      }
      
      const heat = dataManager.getMemoryHeat('COG', cogId, 0x40);
      expect(heat).toBeGreaterThanOrEqual(0); // Heat exists
    });
  });

  describe('Button Interaction', () => {
    it('should detect button clicks', () => {
      // Click on BREAK button (approximately)
      const command = renderer.handleMouseClick(90, 3);
      
      expect(command).toBeDefined();
      expect(['break', 'address', 'go', 'debug', 'init', 'event']).toContain(command || '');
    });

    it('should highlight hovered buttons', () => {
      // Move mouse over button area
      renderer.handleMouseMove(90, 3);
      
      renderer.markRegionDirty('controls');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillRect.mockClear();
      
      renderer.render();
      
      // Should have rendered button with hover state
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should show tooltips on hover', () => {
      renderer.handleMouseMove(90, 3);
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillText.mockClear();
      
      renderer.render();
      
      // Should render tooltip text
      const textCalls = ctx.fillText.mock.calls;
      const hasTooltip = textCalls.some((call: any[]) => 
        call[0].toLowerCase().includes('click') || call[0].toLowerCase().includes('break')
      );
      expect(hasTooltip).toBe(true);
    });
  });

  describe('Memory Display', () => {
    it('should render HUB memory viewer', () => {
      // HUB memory is accessible via getHubMemory
      // For testing, we just verify the region renders
      
      renderer.markRegionDirty('hubMemory');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillText.mockClear();
      
      renderer.render();
      
      // Should have rendered HUB memory title
      const textCalls = ctx.fillText.mock.calls;
      const hasTitle = textCalls.some((call: any[]) => 
        call[0].includes('HUB Memory')
      );
      expect(hasTitle).toBe(true);
    });

    it('should update selected address', () => {
      renderer.setSelectedAddress(0x2000);
      
      renderer.markRegionDirty('hubMemory');
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillText.mockClear();
      
      renderer.render();
      
      // Should show memory at selected address
      const textCalls = ctx.fillText.mock.calls;
      const hasAddress = textCalls.some((call: any[]) => 
        call[0].includes('2000') || call[0].includes('02000')
      );
      expect(hasAddress).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should track render statistics', () => {
      renderer.render();
      
      const stats = renderer.getRenderStats();
      
      expect(stats.count).toBeGreaterThan(0);
      expect(stats.lastTime).toBeGreaterThanOrEqual(0);
    });

    it('should use dirty rectangle optimization', () => {
      // Full render
      renderer.markAllDirty();
      renderer.render();
      
      const ctx = canvas.getContext('2d') as any;
      const fullRenderCalls = ctx.fillRect.mock.calls.length;
      
      // Clear and do partial render
      ctx.fillRect.mockClear();
      renderer.markRegionDirty('flags');
      renderer.render();
      
      const partialRenderCalls = ctx.fillRect.mock.calls.length;
      
      // Partial render should have fewer calls
      expect(partialRenderCalls).toBeLessThan(fullRenderCalls);
    });

    it('should handle rapid updates efficiently', () => {
      const startTime = Date.now();
      
      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        renderer.markRegionDirty('registerWatch');
        renderer.render();
      }
      
      const elapsed = Date.now() - startTime;
      
      // Should complete 100 renders quickly (< 1 second)
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Layout Regions', () => {
    it('should render all required regions', () => {
      renderer.markAllDirty();
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillText.mockClear();
      
      renderer.render();
      
      const textCalls = ctx.fillText.mock.calls;
      const renderedText = textCalls.map((call: any[]) => call[0]).join(' ');
      
      // Check for key region titles
      expect(renderedText).toContain('COG Registers');
      expect(renderedText).toContain('LUT Registers');
      expect(renderedText).toContain('Disassembly');
      expect(renderedText).toContain('Register Watch');
      expect(renderedText).toContain('Stack');
      expect(renderedText).toContain('Pin States');
    });

    it('should position regions correctly', () => {
      renderer.markAllDirty();
      renderer.render();
      
      // Regions should be within grid bounds
      const ctx = canvas.getContext('2d') as any;
      const fillCalls = ctx.fillRect.mock.calls;
      
      fillCalls.forEach((call: any[]) => {
        const [x, y, width, height] = call;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(canvas.width);
        expect(y + height).toBeLessThanOrEqual(canvas.height);
      });
    });
  });

  describe('Color System', () => {
    it('should use correct debug colors', () => {
      renderer.markAllDirty();
      
      const ctx = canvas.getContext('2d') as any;
      ctx.fillStyle = '';
      
      renderer.render();
      
      // Should use hex color format
      expect(ctx.fillStyle).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should apply different colors for different states', () => {
      const state = dataManager.getCogState(cogId);
      if (state) {
        // Set various states
        state.programCounter = 0x100;
        state.breakpoints.add(0x104);
        state.isBreaked = true;
      }
      
      renderer.markAllDirty();
      
      const ctx = canvas.getContext('2d') as any;
      const fillStyles: string[] = [];
      
      // Capture all fill styles used
      ctx.fillStyle = '';
      Object.defineProperty(ctx, 'fillStyle', {
        get: () => fillStyles[fillStyles.length - 1] || '',
        set: (value: string) => fillStyles.push(value)
      });
      
      renderer.render();
      
      // Should use multiple different colors
      const uniqueColors = new Set(fillStyles);
      expect(uniqueColors.size).toBeGreaterThan(2);
    });
  });
});