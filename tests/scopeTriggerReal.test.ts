/**
 * Real test for SCOPE trigger - no mocks, actual DebugScopeWin class
 * Sends actual message sequence from logs to reproduce issue
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DebugScopeWindow } from '../src/classes/debugScopeWin';
import { Context } from '../src/utils/context';

// Mock logger function
const createMockLogger = (logs: string[]) => ({
  forceLogMessage: (msg: string) => {
    logs.push(msg);
  },
  logMessage: (msg: string) => {
    logs.push(msg);
  },
  warn: (msg: string) => {
    logs.push(`WARN: ${msg}`);
  },
  error: (msg: string) => {
    logs.push(`ERROR: ${msg}`);
  },
  setContext: () => {}
});

describe('SCOPE Trigger - Real Integration Test', () => {
  let scopeWin: DebugScopeWindow;
  let ctx: Context;
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;

    // Create real Context object
    ctx = new Context();
    // Replace logger with mock that captures to our logs array
    ctx.logger = createMockLogger(logs) as any;

    // Create actual SCOPE window with display spec
    scopeWin = new DebugScopeWindow(
      ctx,
      {
        displayName: 'MyScope',
        windowTitle: 'MyScope',
        title: 'MyScope',
        nbrSamples: 256,
        rate: 0,
        position: { x: 100, y: 100 },
        hasExplicitPosition: true,
        size: { width: 400, height: 300 },
        dotSize: 1,
        lineSize: 1,
        textSize: 8,
        window: { background: '#000000', grid: '#333333' },
        isPackedData: false,
        hideXY: false
      },
      `scope-test-${Date.now()}`
    );
  });

  it('should trigger correctly with actual message sequence from logs', () => {
    // Actual message sequence from test logs:
    // 1. Channel specs
    scopeWin.updateContent(['FreqA', '-1000', '1000', '100', '136', '15', 'MAGENTA']);
    scopeWin.updateContent(['FreqB', '-1000', '1000', '100', '20', '15', 'ORANGE']);

    // 2. TRIGGER command
    scopeWin.updateContent(['TRIGGER', '0', 'HOLDOFF', '2']);

    // 3. First samples (should create window and start triggering)
    scopeWin.updateContent(['0', ',', '0']);
    scopeWin.updateContent(['31', ',', '63']);
    scopeWin.updateContent(['63', ',', '127']);
    scopeWin.updateContent(['94', ',', '189']);

    // Filter logs for trigger-related messages
    const triggerLogs = logs.filter(msg =>
      msg.includes('*** TRIGGER') ||
      msg.includes('>>> evaluateTrigger') ||
      msg.includes('didScroll')
    );

    console.log('\n=== TRIGGER EXECUTION LOGS ===');
    triggerLogs.forEach(log => console.log(log));

    // Verify evaluateTrigger was called
    const evaluateTriggerCalled = logs.some(msg => msg.includes('>>> evaluateTrigger ENTRY'));
    const elseBranchExecuted = logs.some(msg => msg.includes('*** TRIGGER: ELSE BRANCH'));

    console.log(`\nevaluateTrigger() called: ${evaluateTriggerCalled}`);
    console.log(`Else branch executed: ${elseBranchExecuted}`);

    // Check what the trigger condition evaluated to
    const conditionResults = logs.filter(msg => msg.includes('*** TRIGGER RESULT:'));
    if (conditionResults.length > 0) {
      console.log('\nTrigger condition results:');
      conditionResults.forEach(r => console.log(`  ${r}`));
    }

    // The condition should pass, evaluateTrigger should be called
    expect(evaluateTriggerCalled).toBe(true);
    expect(elseBranchExecuted).toBe(false);

    // Check didScroll values - should NOT always be true
    const didScrollLogs = logs.filter(msg => msg.includes('didScroll='));
    console.log('\ndidScroll values:');
    didScrollLogs.forEach(log => console.log(`  ${log}`));

    // First sample (0,0): trigger arms but doesn't fire, didScroll should be false
    // Second sample (31,63): trigger fires, holdoff=2, didScroll should be false
    // Third sample (63,127): holdoff=1, didScroll should be false
    // Fourth sample (94,189): holdoff=0, didScroll should be true (trigger expired)

    const alwaysTrue = didScrollLogs.every(log => log.includes('didScroll=(true)'));
    console.log(`\ndidScroll always true: ${alwaysTrue}`);

    // This should be FALSE - didScroll should vary based on trigger state
    expect(alwaysTrue).toBe(false);
  });

  it('should show actual trigger state values at evaluation time', () => {
    // Setup
    scopeWin.updateContent(['FreqA', '-1000', '1000', '100', '136', '15', 'MAGENTA']);
    scopeWin.updateContent(['FreqB', '-1000', '1000', '100', '20', '15', 'ORANGE']);
    scopeWin.updateContent(['TRIGGER', '0', 'HOLDOFF', '2']);

    // Process first sample
    scopeWin.updateContent(['0', ',', '0']);

    // Extract trigger evaluation logs
    const evalLogs = logs.filter(msg => msg.includes('*** TRIGGER EVAL:'));

    console.log('\n=== TRIGGER STATE AT EVALUATION ===');
    evalLogs.forEach(log => console.log(log));

    // Should see actual runtime values
    expect(evalLogs.length).toBeGreaterThan(0);

    // Parse the values from the log
    const evalLog = evalLogs[0];
    expect(evalLog).toContain('trigEnabled=');
    expect(evalLog).toContain('trigChannel=');
    expect(evalLog).toContain('nbrSamples=');
  });
});
