/** @format */

'use strict';

// tests/triggerProcessor.test.ts

import { TriggerProcessor, LogicTriggerProcessor, ScopeTriggerProcessor } from '../src/classes/shared/triggerProcessor';

describe('TriggerProcessor Base Class', () => {
  // Create a concrete implementation for testing
  class TestTriggerProcessor extends TriggerProcessor {
    evaluateTriggerCondition(sample: any, triggerSpec: any): boolean {
      return sample === triggerSpec;
    }
  }

  let processor: TestTriggerProcessor;

  beforeEach(() => {
    processor = new TestTriggerProcessor();
  });

  test('should initialize with default state', () => {
    const state = processor.getTriggerState();
    expect(state.armed).toBe(false);
    expect(state.fired).toBe(false);
    expect(state.holdoff).toBe(0);
  });

  test('should handle holdoff countdown', () => {
    processor.setHoldoff(3);
    
    expect(processor.handleHoldoff()).toBe(true); // 3 -> 2
    expect(processor.getTriggerState().holdoff).toBe(2);
    
    expect(processor.handleHoldoff()).toBe(true); // 2 -> 1
    expect(processor.getTriggerState().holdoff).toBe(1);
    
    expect(processor.handleHoldoff()).toBe(true); // 1 -> 0
    expect(processor.getTriggerState().holdoff).toBe(0);
    
    expect(processor.handleHoldoff()).toBe(false); // 0 stays 0
    expect(processor.getTriggerState().holdoff).toBe(0);
  });

  test('should update trigger state', () => {
    processor.updateTriggerState(true, false);
    let state = processor.getTriggerState();
    expect(state.armed).toBe(true);
    expect(state.fired).toBe(false);

    processor.updateTriggerState(false, true);
    state = processor.getTriggerState();
    expect(state.armed).toBe(false);
    expect(state.fired).toBe(true);
  });

  test('should reset trigger state', () => {
    processor.updateTriggerState(true, true);
    processor.setHoldoff(5);
    
    processor.resetTrigger();
    
    const state = processor.getTriggerState();
    expect(state.armed).toBe(false);
    expect(state.fired).toBe(false);
    expect(state.holdoff).toBe(0);
  });
});

describe('LogicTriggerProcessor', () => {
  let processor: LogicTriggerProcessor;

  beforeEach(() => {
    processor = new LogicTriggerProcessor();
  });

  describe('evaluateTriggerCondition', () => {
    test('should match exact pattern', () => {
      const triggerSpec = {
        trigMask: 0xFF,    // Check all 8 bits
        trigMatch: 0xA5    // Binary: 10100101
      };
      
      expect(processor.evaluateTriggerCondition(0xA5, triggerSpec)).toBe(true);
      expect(processor.evaluateTriggerCondition(0x5A, triggerSpec)).toBe(false);
    });

    test('should match with partial mask', () => {
      const triggerSpec = {
        trigMask: 0xF0,    // Check only upper 4 bits
        trigMatch: 0xA0    // Binary: 1010xxxx
      };
      
      // These should all match (lower 4 bits ignored)
      expect(processor.evaluateTriggerCondition(0xA0, triggerSpec)).toBe(true);
      expect(processor.evaluateTriggerCondition(0xA5, triggerSpec)).toBe(true);
      expect(processor.evaluateTriggerCondition(0xAF, triggerSpec)).toBe(true);
      
      // These should not match (upper 4 bits different)
      expect(processor.evaluateTriggerCondition(0x50, triggerSpec)).toBe(false);
      expect(processor.evaluateTriggerCondition(0xB0, triggerSpec)).toBe(false);
    });

    test('should handle complex mask patterns', () => {
      const triggerSpec = {
        trigMask: 0b11110000,   // Check bits 7-4
        trigMatch: 0b10100000   // Expect 1010xxxx
      };
      
      expect(processor.evaluateTriggerCondition(0b10101111, triggerSpec)).toBe(true);
      expect(processor.evaluateTriggerCondition(0b10100000, triggerSpec)).toBe(true);
      expect(processor.evaluateTriggerCondition(0b01011111, triggerSpec)).toBe(false);
    });
  });

  describe('processSample', () => {
    test('should always update display when no trigger is configured', () => {
      const triggerSpec = {
        trigMask: 0,
        trigMatch: 0,
        trigHoldoff: 0
      };
      
      expect(processor.processSample(0xFF, triggerSpec)).toBe(true);
      expect(processor.processSample(0x00, triggerSpec)).toBe(true);
    });

    test('should trigger on first matching sample', () => {
      const triggerSpec = {
        trigMask: 0xFF,
        trigMatch: 0x42,
        trigHoldoff: 0
      };
      
      // Non-matching samples should not update display
      expect(processor.processSample(0x00, triggerSpec)).toBe(false);
      expect(processor.processSample(0x41, triggerSpec)).toBe(false);
      
      // Matching sample should trigger and update display
      expect(processor.processSample(0x42, triggerSpec)).toBe(true);
      
      const state = processor.getTriggerState();
      expect(state.fired).toBe(true);
    });

    test('should implement holdoff after trigger', () => {
      const triggerSpec = {
        trigMask: 0xFF,
        trigMatch: 0x42,
        trigHoldoff: 3
      };
      
      // Trigger on matching sample
      expect(processor.processSample(0x42, triggerSpec)).toBe(true);
      expect(processor.getTriggerState().holdoff).toBe(3);
      
      // Should update display during holdoff
      expect(processor.processSample(0x00, triggerSpec)).toBe(true);
      expect(processor.getTriggerState().holdoff).toBe(2);
      
      expect(processor.processSample(0x00, triggerSpec)).toBe(true);
      expect(processor.getTriggerState().holdoff).toBe(1);
      
      expect(processor.processSample(0x00, triggerSpec)).toBe(true);
      expect(processor.getTriggerState().holdoff).toBe(0);
    });

    test('should re-trigger after holdoff expires', () => {
      const triggerSpec = {
        trigMask: 0xFF,
        trigMatch: 0x42,
        trigHoldoff: 2
      };
      
      // First trigger
      processor.processSample(0x42, triggerSpec);
      processor.resetTrigger();
      
      // After reset, should be able to trigger again
      expect(processor.processSample(0x00, triggerSpec)).toBe(false);
      expect(processor.processSample(0x42, triggerSpec)).toBe(true);
    });
  });
});

describe('ScopeTriggerProcessor', () => {
  let processor: ScopeTriggerProcessor;

  beforeEach(() => {
    processor = new ScopeTriggerProcessor();
  });

  describe('trigger levels', () => {
    test('should set and get trigger levels', () => {
      processor.setTriggerLevels(30, 50, 'positive');
      
      const levels = processor.getTriggerLevels();
      expect(levels.armLevel).toBe(30);
      expect(levels.fireLevel).toBe(50);
      expect(levels.slope).toBe('positive');
    });

    test('should default to positive slope', () => {
      processor.setTriggerLevels(30, 50);
      
      const levels = processor.getTriggerLevels();
      expect(levels.slope).toBe('positive');
    });
  });

  describe('evaluateTriggerCondition', () => {
    test('should detect positive slope crossing', () => {
      processor.setTriggerLevels(30, 50, 'positive');
      
      // First sample establishes baseline
      expect(processor.evaluateTriggerCondition(40)).toBe(false);
      
      // No crossing
      expect(processor.evaluateTriggerCondition(45)).toBe(false);
      
      // Crosses trigger level from below
      expect(processor.evaluateTriggerCondition(55)).toBe(true);
      
      // Already above, no crossing
      expect(processor.evaluateTriggerCondition(60)).toBe(false);
    });

    test('should detect negative slope crossing', () => {
      processor.setTriggerLevels(70, 50, 'negative');
      
      // First sample establishes baseline
      expect(processor.evaluateTriggerCondition(60)).toBe(false);
      
      // No crossing
      expect(processor.evaluateTriggerCondition(55)).toBe(false);
      
      // Crosses trigger level from above
      expect(processor.evaluateTriggerCondition(45)).toBe(true);
      
      // Already below, no crossing
      expect(processor.evaluateTriggerCondition(40)).toBe(false);
    });
  });

  describe('processSample with arm/fire state machine', () => {
    test('should implement arm then fire sequence for positive slope', () => {
      processor.setTriggerLevels(30, 50, 'positive');
      const triggerSpec = { trigHoldoff: 0 };
      
      // Start below arm level
      processor.processSample(20, triggerSpec);
      expect(processor.getTriggerState().armed).toBe(false);
      
      // Cross arm level
      processor.processSample(35, triggerSpec);
      expect(processor.getTriggerState().armed).toBe(true);
      expect(processor.getTriggerState().fired).toBe(false);
      
      // Between arm and fire
      processor.processSample(40, triggerSpec);
      expect(processor.getTriggerState().armed).toBe(true);
      expect(processor.getTriggerState().fired).toBe(false);
      
      // Cross fire level
      const shouldUpdate = processor.processSample(55, triggerSpec);
      expect(shouldUpdate).toBe(true);
      expect(processor.getTriggerState().armed).toBe(false);
      expect(processor.getTriggerState().fired).toBe(true);
    });

    test('should implement arm then fire sequence for negative slope', () => {
      processor.setTriggerLevels(70, 50, 'negative');
      const triggerSpec = { trigHoldoff: 0 };
      
      // Start above arm level
      processor.processSample(80, triggerSpec);
      expect(processor.getTriggerState().armed).toBe(false);
      
      // Cross arm level
      processor.processSample(65, triggerSpec);
      expect(processor.getTriggerState().armed).toBe(true);
      expect(processor.getTriggerState().fired).toBe(false);
      
      // Between arm and fire
      processor.processSample(60, triggerSpec);
      expect(processor.getTriggerState().armed).toBe(true);
      expect(processor.getTriggerState().fired).toBe(false);
      
      // Cross fire level
      const shouldUpdate = processor.processSample(45, triggerSpec);
      expect(shouldUpdate).toBe(true);
      expect(processor.getTriggerState().armed).toBe(false);
      expect(processor.getTriggerState().fired).toBe(true);
    });

    test('should handle holdoff correctly', () => {
      processor.setTriggerLevels(30, 50, 'positive');
      const triggerSpec = { trigHoldoff: 2 };
      
      // Trigger sequence
      processor.processSample(20, triggerSpec);
      processor.processSample(35, triggerSpec); // Arm
      processor.processSample(55, triggerSpec); // Fire
      
      expect(processor.getTriggerState().holdoff).toBe(2);
      
      // Should update display during holdoff
      expect(processor.processSample(20, triggerSpec)).toBe(true);
      expect(processor.getTriggerState().holdoff).toBe(1);
      
      expect(processor.processSample(20, triggerSpec)).toBe(true);
      expect(processor.getTriggerState().holdoff).toBe(0);
    });

    test('should always update display when no trigger levels set', () => {
      processor.setTriggerLevels(0, 0);
      const triggerSpec = { trigHoldoff: 0 };
      
      expect(processor.processSample(100, triggerSpec)).toBe(true);
      expect(processor.processSample(0, triggerSpec)).toBe(true);
      expect(processor.processSample(50, triggerSpec)).toBe(true);
    });
  });

  describe('resetTrigger', () => {
    test('should reset all state including previous sample', () => {
      processor.setTriggerLevels(30, 50, 'positive');
      const triggerSpec = { trigHoldoff: 5 };
      
      // Set up some state
      processor.processSample(20, triggerSpec);
      processor.processSample(35, triggerSpec); // Arm
      processor.setHoldoff(5);
      
      // Reset
      processor.resetTrigger();
      
      const state = processor.getTriggerState();
      expect(state.armed).toBe(false);
      expect(state.fired).toBe(false);
      expect(state.holdoff).toBe(0);
      
      // Previous sample should be reset (first sample won't trigger)
      expect(processor.evaluateTriggerCondition(60)).toBe(false);
    });
  });

  describe('auto-trigger calculation', () => {
    test('should calculate 33% arm and 50% fire levels', () => {
      const minValue = 0;
      const maxValue = 100;
      
      // 33% calculation
      const armLevel = (maxValue - minValue) / 3 + minValue;
      expect(armLevel).toBeCloseTo(33.33);
      
      // 50% calculation  
      const fireLevel = (maxValue - minValue) / 2 + minValue;
      expect(fireLevel).toBe(50);
    });

    test('should handle negative ranges', () => {
      const minValue = -50;
      const maxValue = 50;
      
      // 33% of range from minimum
      const armLevel = (maxValue - minValue) / 3 + minValue;
      expect(armLevel).toBeCloseTo(-16.67);
      
      // 50% of range from minimum
      const fireLevel = (maxValue - minValue) / 2 + minValue;
      expect(fireLevel).toBe(0);
    });
  });
});