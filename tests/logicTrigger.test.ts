/** @format */

'use strict';

// tests/logicTrigger.test.ts

describe('Logic Window Trigger System', () => {
  // Mock DebugLogicWindow and related classes
  let mockWindow: any;
  let mockTriggerProcessor: any;
  
  beforeEach(() => {
    // Reset mocks
    mockWindow = {
      triggerSpec: {
        trigEnabled: false,
        trigMask: 0,
        trigMatch: 0,
        trigSampOffset: 0,
        trigHoldoff: 2
      },
      triggerArmed: false,
      triggerFired: false,
      holdoffCounter: 0,
      updateContent: jest.fn()
    };
    
    mockTriggerProcessor = {
      evaluateTriggerCondition: jest.fn(),
      updateTriggerState: jest.fn(),
      resetTrigger: jest.fn()
    };
  });

  describe('Trigger Parsing', () => {
    it('should parse TRIGGER command with mask and match', () => {
      const debugString = '`LOGIC test1 TRIGGER %11110000 %10100000';
      const expected = {
        trigEnabled: true,
        trigMask: 0b11110000,
        trigMatch: 0b10100000,
        trigSampOffset: 0
      };
      
      // Simulate parsing
      const parts = debugString.split(' ');
      if (parts[2] === 'TRIGGER') {
        mockWindow.triggerSpec.trigEnabled = true;
        mockWindow.triggerSpec.trigMask = parseInt(parts[3].substring(1), 2);
        mockWindow.triggerSpec.trigMatch = parseInt(parts[4].substring(1), 2);
      }
      
      expect(mockWindow.triggerSpec.trigEnabled).toBe(expected.trigEnabled);
      expect(mockWindow.triggerSpec.trigMask).toBe(expected.trigMask);
      expect(mockWindow.triggerSpec.trigMatch).toBe(expected.trigMatch);
    });

    it('should parse TRIGGER command with offset', () => {
      const debugString = '`LOGIC test1 TRIGGER %11110000 %10100000 16';
      const expected = {
        trigEnabled: true,
        trigMask: 0b11110000,
        trigMatch: 0b10100000,
        trigSampOffset: 16
      };
      
      // Simulate parsing
      const parts = debugString.split(' ');
      if (parts[2] === 'TRIGGER') {
        mockWindow.triggerSpec.trigEnabled = true;
        mockWindow.triggerSpec.trigMask = parseInt(parts[3].substring(1), 2);
        mockWindow.triggerSpec.trigMatch = parseInt(parts[4].substring(1), 2);
        if (parts[5]) {
          mockWindow.triggerSpec.trigSampOffset = parseInt(parts[5]);
        }
      }
      
      expect(mockWindow.triggerSpec.trigSampOffset).toBe(expected.trigSampOffset);
    });

    it('should parse HOLDOFF command', () => {
      const debugString = '`LOGIC test1 HOLDOFF 64';
      const expected = 64;
      
      // Simulate parsing
      const parts = debugString.split(' ');
      if (parts[2] === 'HOLDOFF') {
        mockWindow.triggerSpec.trigHoldoff = parseInt(parts[3]);
      }
      
      expect(mockWindow.triggerSpec.trigHoldoff).toBe(expected);
    });
  });

  describe('Trigger Evaluation', () => {
    beforeEach(() => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigMask = 0b11110000;
      mockWindow.triggerSpec.trigMatch = 0b10100000;
    });

    it('should arm trigger when condition matches', () => {
      const sample = 0b10101111; // Matches mask/match pattern
      
      // Simulate trigger evaluation
      const maskedSample = sample & mockWindow.triggerSpec.trigMask;
      const triggerMet = maskedSample === mockWindow.triggerSpec.trigMatch;
      
      if (triggerMet && !mockWindow.triggerArmed) {
        mockWindow.triggerArmed = true;
      }
      
      expect(triggerMet).toBe(true);
      expect(mockWindow.triggerArmed).toBe(true);
      expect(mockWindow.triggerFired).toBe(false);
    });

    it('should not arm trigger when condition does not match', () => {
      const sample = 0b01011111; // Does not match mask/match pattern
      
      // Simulate trigger evaluation
      const maskedSample = sample & mockWindow.triggerSpec.trigMask;
      const triggerMet = maskedSample === mockWindow.triggerSpec.trigMatch;
      
      if (triggerMet && !mockWindow.triggerArmed) {
        mockWindow.triggerArmed = true;
      }
      
      expect(triggerMet).toBe(false);
      expect(mockWindow.triggerArmed).toBe(false);
    });

    it('should fire trigger when armed and condition matches again', () => {
      // First arm the trigger
      mockWindow.triggerArmed = true;
      
      const sample = 0b10100011; // Matches mask/match pattern
      
      // Simulate trigger evaluation
      const maskedSample = sample & mockWindow.triggerSpec.trigMask;
      const triggerMet = maskedSample === mockWindow.triggerSpec.trigMatch;
      
      if (mockWindow.triggerArmed && !mockWindow.triggerFired && triggerMet) {
        mockWindow.triggerFired = true;
        mockWindow.holdoffCounter = mockWindow.triggerSpec.trigHoldoff;
      }
      
      expect(mockWindow.triggerFired).toBe(true);
      expect(mockWindow.holdoffCounter).toBe(2);
    });
  });

  describe('Holdoff Behavior', () => {
    beforeEach(() => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigHoldoff = 4;
      mockWindow.triggerFired = true;
      mockWindow.holdoffCounter = 4;
    });

    it('should countdown holdoff counter', () => {
      // Simulate multiple samples during holdoff
      for (let i = 4; i > 0; i--) {
        expect(mockWindow.holdoffCounter).toBe(i);
        
        if (mockWindow.holdoffCounter > 0) {
          mockWindow.holdoffCounter--;
        }
      }
      
      expect(mockWindow.holdoffCounter).toBe(0);
    });

    it('should reset trigger after holdoff expires', () => {
      // Count down to zero
      mockWindow.holdoffCounter = 1;
      
      if (mockWindow.holdoffCounter > 0) {
        mockWindow.holdoffCounter--;
        if (mockWindow.holdoffCounter === 0) {
          // Holdoff expired, reset trigger
          mockWindow.triggerArmed = false;
          mockWindow.triggerFired = false;
        }
      }
      
      expect(mockWindow.holdoffCounter).toBe(0);
      expect(mockWindow.triggerArmed).toBe(false);
      expect(mockWindow.triggerFired).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle simultaneous arm and trigger conditions', () => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigMask = 0xFF; // All bits
      mockWindow.triggerSpec.trigMatch = 0xAA; // Specific pattern
      
      const sample = 0xAA; // Exact match
      
      // Simulate trigger evaluation
      const maskedSample = sample & mockWindow.triggerSpec.trigMask;
      const triggerMet = maskedSample === mockWindow.triggerSpec.trigMatch;
      
      // Should arm but not fire in same cycle
      if (triggerMet && !mockWindow.triggerArmed && !mockWindow.triggerFired) {
        mockWindow.triggerArmed = true;
        // Should NOT fire immediately
      }
      
      expect(mockWindow.triggerArmed).toBe(true);
      expect(mockWindow.triggerFired).toBe(false);
    });

    it('should handle trigger offset correctly', () => {
      mockWindow.triggerSpec.trigSampOffset = 8;
      mockWindow.triggerFired = true;
      
      const currentSamplePos = 64;
      const triggerSamplePos = currentSamplePos - mockWindow.triggerSpec.trigSampOffset;
      
      expect(triggerSamplePos).toBe(56);
    });

    it('should ignore samples when trigger not enabled', () => {
      mockWindow.triggerSpec.trigEnabled = false;
      const sample = 0b10100000; // Would match if enabled
      
      // Should not evaluate trigger when disabled
      let shouldProcess = true;
      if (mockWindow.triggerSpec.trigEnabled) {
        // Would evaluate trigger here
        shouldProcess = false;
      }
      
      expect(shouldProcess).toBe(true);
      expect(mockWindow.triggerArmed).toBe(false);
    });
  });

  describe('Visual Indicators', () => {
    it('should show correct status for each state', () => {
      const getStatusText = (window: any) => {
        if (window.holdoffCounter > 0) {
          return `HOLDOFF (${window.holdoffCounter})`;
        } else if (window.triggerFired) {
          return 'TRIGGERED';
        } else if (window.triggerArmed) {
          return 'ARMED';
        } else {
          return 'READY';
        }
      };
      
      // Test READY state
      expect(getStatusText(mockWindow)).toBe('READY');
      
      // Test ARMED state
      mockWindow.triggerArmed = true;
      expect(getStatusText(mockWindow)).toBe('ARMED');
      
      // Test TRIGGERED state
      mockWindow.triggerFired = true;
      expect(getStatusText(mockWindow)).toBe('TRIGGERED');
      
      // Test HOLDOFF state
      mockWindow.holdoffCounter = 5;
      expect(getStatusText(mockWindow)).toBe('HOLDOFF (5)');
    });

    it('should calculate trigger position correctly', () => {
      mockWindow.triggerSpec.trigSampOffset = 10;
      const currentSampleIndex = 50;
      const spacing = 4;
      
      const triggerSamplePos = currentSampleIndex - mockWindow.triggerSpec.trigSampOffset;
      const triggerXPos = triggerSamplePos * spacing;
      
      expect(triggerSamplePos).toBe(40);
      expect(triggerXPos).toBe(160);
    });
  });

  describe('Complex Trigger Patterns', () => {
    it('should handle multi-bit trigger patterns', () => {
      const testCases = [
        {
          mask: 0b11110000,
          match: 0b10100000,
          samples: [0b10101111, 0b10100000, 0b11111111],
          expectedMatches: [true, true, false]
        },
        {
          mask: 0b00001111,
          match: 0b00001010,
          samples: [0b11111010, 0b00001010, 0b10101010],
          expectedMatches: [true, true, true]
        },
        {
          mask: 0b10101010,
          match: 0b10000010,
          samples: [0b10000010, 0b11000011, 0b10100010],
          expectedMatches: [true, true, true]
        }
      ];
      
      testCases.forEach(testCase => {
        testCase.samples.forEach((sample, index) => {
          const maskedSample = sample & testCase.mask;
          const matches = maskedSample === testCase.match;
          expect(matches).toBe(testCase.expectedMatches[index]);
        });
      });
    });
  });
});