/** @format */

// tests/context-ide-mode.test.ts

import { Context } from '../src/utils/context';

describe('Context IDE Mode', () => {
  it('should have ideMode property in RuntimeEnvironment interface', () => {
    const context = new Context();
    expect(context.runEnvironment).toHaveProperty('ideMode');
  });

  it('should default ideMode to false', () => {
    const context = new Context();
    expect(context.runEnvironment.ideMode).toBe(false);
  });

  it('should allow setting ideMode to true', () => {
    const context = new Context();
    context.runEnvironment.ideMode = true;
    expect(context.runEnvironment.ideMode).toBe(true);
  });

  it('should preserve other RuntimeEnvironment properties when setting ideMode', () => {
    const context = new Context();
    context.runEnvironment.ideMode = true;
    
    // Verify other properties are still present and have their defaults
    expect(context.runEnvironment.selectedPropPlug).toBe('');
    expect(context.runEnvironment.serialPortDevices).toEqual([]);
    expect(context.runEnvironment.developerModeEnabled).toBe(false);
    expect(context.runEnvironment.logFilename).toBe('');
    expect(context.runEnvironment.debugBaudrate).toBe(2000000);
  });
});