import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { PlotWindowIntegrator, CanvasOperationType } from '../src/classes/shared/plotParserIntegration';

describe('PlotWindowIntegrator - Integration Tests', () => {
  let parser: PlotCommandParser;
  let mockPlotWindow: any;
  let integrator: PlotWindowIntegrator;
  let capturedOperations: string[] = [];

  beforeEach(() => {
    capturedOperations = [];

    // Create mock plot window that captures operations
    mockPlotWindow = {
      updatePlotDisplay: jest.fn((command: string) => {
        capturedOperations.push(command);
        console.log(`  -> updatePlotDisplay("${command}")`);
      }),
      writeStringToPlot: jest.fn((text: string) => {
        capturedOperations.push(`TEXT: ${text}`);
        console.log(`  -> writeStringToPlot("${text}")`);
      }),
      debugWindow: {
        close: jest.fn(),
        setTitle: jest.fn(),
        setPosition: jest.fn(),
        setSize: jest.fn()
      },
      displaySpec: {
        dotSize: 1,
        window: { background: '#000000' },
        hideXY: false
      }
    };

    parser = new PlotCommandParser({} as any);
    integrator = new PlotWindowIntegrator(mockPlotWindow);
  });

  describe('Compound Command Canvas Operations', () => {
    it('should send SET, COLOR, and TEXT operations for compound command', async () => {
      console.log('\nTest: SET + CYAN + TEXT compound');
      const command = 'set 330 270 cyan 3 text 30 3 "Hub RAM Interface"';

      // Parse the command
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      // Execute through integrator
      const ops = results[0].canvasOperations;
      console.log(`  Operations count: ${ops.length}`);

      const integratorResults = await await integrator.executeBatch(ops);

      // Check all operations succeeded
      integratorResults.forEach((r: any) => expect(r.success).toBe(true));

      // Verify the canvas operations sent
      expect(capturedOperations).toContain('SET 330 270');
      expect(capturedOperations).toContain('CYAN 3');
      expect(capturedOperations).toContain('FONT 30 00000011 0');
      expect(capturedOperations).toContain('TEXT: Hub RAM Interface');

      console.log('  Captured operations:', capturedOperations);
    });

    it('should send COLOR operations for color commands', async () => {
      console.log('\nTest: Simple CYAN command');
      const command = 'cyan 5';

      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);
      const ops = results[0].canvasOperations;

      console.log(`  Operations count: ${ops.length}`);
      console.log('  Operation type:', ops[0].type);
      console.log('  Operation params:', ops[0].parameters);

      const integratorResults = await integrator.executeBatch(ops);

      expect(integratorResults[0].success).toBe(true);
      expect(capturedOperations).toContain('CYAN 5');

      console.log('  Captured operations:', capturedOperations);
    });

    it('should handle grey line compound correctly', async () => {
      console.log('\nTest: GREY + SET + LINE compound');
      const command = 'grey 12 set 103 8 line 190 8 20';

      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);
      const ops = results[0].canvasOperations;

      console.log(`  Operations count: ${ops.length}`);

      const integratorResults = await integrator.executeBatch(ops);

      integratorResults.forEach((r: any) => expect(r.success).toBe(true));

      expect(capturedOperations).toContain('GREY 12');
      expect(capturedOperations).toContain('SET 103 8');
      expect(capturedOperations).toContain('LINE 190 8 20 255');

      console.log('  Captured operations:', capturedOperations);
    });

    it('should handle text-only commands', async () => {
      console.log('\nTest: TEXT-only command');
      const command = 'text 20 1 "Hello World"';

      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);
      const ops = results[0].canvasOperations;

      console.log(`  Operations count: ${ops.length}`);
      console.log('  Operation type:', ops[0].type);
      console.log('  Operation params:', ops[0].parameters);

      const integratorResults = await integrator.executeBatch(ops);

      expect(integratorResults[0].success).toBe(true);
      expect(capturedOperations).toContain('FONT 20 00000001 0');
      expect(capturedOperations).toContain('TEXT: Hello World');

      console.log('  Captured operations:', capturedOperations);
    });
  });

  describe('Operation Types', () => {
    it('should correctly identify operation types', async () => {
      const command = 'set 100 200 cyan 5 text 15 1 "Test"';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);
      const ops = results[0].canvasOperations;

      console.log('\nOperation Types:');
      ops.forEach((op, index) => {
        console.log(`  Op ${index}: type=${op.type}, params=`, op.parameters);
      });

      // Check operation types
      expect(ops[0].type).toBeDefined();
      expect(ops[1].type).toBeDefined();
      expect(ops[2].type).toBeDefined();
    });
  });

  describe('Close Command', () => {
    it('should handle CLOSE command', async () => {
      console.log('\nTest: CLOSE command');
      const command = 'close';

      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);
      const ops = results[0].canvasOperations;

      const integratorResults = await integrator.executeBatch(ops);

      expect(mockPlotWindow.debugWindow.close).toHaveBeenCalled();
      console.log('  Window close called:', mockPlotWindow.debugWindow.close.mock.calls.length, 'times');
    });
  });
});