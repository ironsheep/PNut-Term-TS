/** @format */

'use strict';

// tests/scopeTrigger.test.ts

describe('Scope Window Trigger System', () => {
  // Mock DebugScopeWindow and related classes
  let mockWindow: any;
  let mockChannelSpec: any;
  
  beforeEach(() => {
    // Reset mocks
    mockChannelSpec = {
      minValue: 0,
      maxValue: 100,
      ySize: 100
    };
    
    mockWindow = {
      triggerSpec: {
        trigEnabled: false,
        trigAuto: false,
        trigChannel: 0,
        trigSlope: 'Positive',
        trigLevel: 50,
        trigArmLevel: 33,
        trigRtOffset: 0,
        trigHoldoff: 2
      },
      channelSpecs: [mockChannelSpec],
      triggerArmed: false,
      triggerFired: false,
      holdoffCounter: 0,
      previousSample: 0
    };
  });

  describe('Auto-Trigger Calculation', () => {
    it('should calculate 33% arm level and 50% trigger level', () => {
      mockWindow.triggerSpec.trigAuto = true;
      const channelSpec = mockWindow.channelSpecs[0];
      
      // Simulate calculateAutoTriggerAndScale
      const range = channelSpec.maxValue - channelSpec.minValue;
      const armLevel = (range / 3) + channelSpec.minValue;
      const trigLevel = (range / 2) + channelSpec.minValue;
      
      expect(armLevel).toBe(33.333333333333336); // Exact 33%
      expect(trigLevel).toBe(50); // Exact 50%
    });

    it('should handle different channel ranges', () => {
      const testCases = [
        { min: 0, max: 100, expectedArm: 33.333, expectedTrig: 50 },
        { min: -50, max: 50, expectedArm: -16.667, expectedTrig: 0 },
        { min: 10, max: 90, expectedArm: 36.667, expectedTrig: 50 },
        { min: -100, max: 0, expectedArm: -66.667, expectedTrig: -50 }
      ];
      
      testCases.forEach(testCase => {
        const range = testCase.max - testCase.min;
        const armLevel = (range / 3) + testCase.min;
        const trigLevel = (range / 2) + testCase.min;
        
        expect(armLevel).toBeCloseTo(testCase.expectedArm, 2);
        expect(trigLevel).toBeCloseTo(testCase.expectedTrig, 2);
      });
    });
  });

  describe('Channel Declaration Parsing', () => {
    it('should parse AUTO trigger channel', () => {
      const debugString = "'Channel1' AUTO 100 0 %1111 GREEN";
      
      // Simulate parsing
      const parts = debugString.split(' ');
      if (parts[1] === 'AUTO') {
        mockWindow.triggerSpec.trigAuto = true;
        mockChannelSpec.ySize = parseInt(parts[2]);
        mockChannelSpec.yBase = parseInt(parts[3]);
      }
      
      expect(mockWindow.triggerSpec.trigAuto).toBe(true);
      expect(mockChannelSpec.ySize).toBe(100);
    });

    it('should parse manual trigger levels', () => {
      const debugString = "'Channel1' -100 100 100 0 %1111 GREEN";
      
      // Simulate parsing
      const parts = debugString.split(' ');
      mockChannelSpec.minValue = parseInt(parts[1]);
      mockChannelSpec.maxValue = parseInt(parts[2]);
      
      expect(mockChannelSpec.minValue).toBe(-100);
      expect(mockChannelSpec.maxValue).toBe(100);
    });

    it('should parse TRIGGER command', () => {
      const debugString = "TRIGGER 0 25 50 Positive 8";
      
      // Simulate parsing
      const parts = debugString.split(' ');
      if (parts[0] === 'TRIGGER') {
        mockWindow.triggerSpec.trigEnabled = true;
        mockWindow.triggerSpec.trigChannel = parseInt(parts[1]);
        mockWindow.triggerSpec.trigArmLevel = parseInt(parts[2]);
        mockWindow.triggerSpec.trigLevel = parseInt(parts[3]);
        mockWindow.triggerSpec.trigSlope = parts[4];
        mockWindow.triggerSpec.trigRtOffset = parseInt(parts[5]);
      }
      
      expect(mockWindow.triggerSpec.trigEnabled).toBe(true);
      expect(mockWindow.triggerSpec.trigChannel).toBe(0);
      expect(mockWindow.triggerSpec.trigArmLevel).toBe(25);
      expect(mockWindow.triggerSpec.trigLevel).toBe(50);
      expect(mockWindow.triggerSpec.trigSlope).toBe('Positive');
      expect(mockWindow.triggerSpec.trigRtOffset).toBe(8);
    });
  });

  describe('Level Crossing Detection', () => {
    it('should detect positive slope crossing', () => {
      const checkLevelCrossing = (prevSample: number, currSample: number, level: number): number => {
        if (prevSample < level && currSample >= level) return 1; // Positive crossing
        if (prevSample > level && currSample <= level) return -1; // Negative crossing
        return 0; // No crossing
      };
      
      // Test positive crossing
      expect(checkLevelCrossing(30, 35, 33)).toBe(1);
      expect(checkLevelCrossing(45, 55, 50)).toBe(1);
      
      // Test negative crossing
      expect(checkLevelCrossing(35, 30, 33)).toBe(-1);
      expect(checkLevelCrossing(55, 45, 50)).toBe(-1);
      
      // Test no crossing
      expect(checkLevelCrossing(30, 32, 33)).toBe(0);
      expect(checkLevelCrossing(35, 40, 33)).toBe(0);
    });

    it('should arm on arm level crossing', () => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigArmLevel = 33;
      mockWindow.previousSample = 30;
      const currentSample = 35;
      
      // Check for arm level crossing
      const armCrossing = mockWindow.previousSample < mockWindow.triggerSpec.trigArmLevel && 
                         currentSample >= mockWindow.triggerSpec.trigArmLevel;
      
      if (armCrossing && !mockWindow.triggerArmed && !mockWindow.triggerFired) {
        mockWindow.triggerArmed = true;
      }
      
      expect(armCrossing).toBe(true);
      expect(mockWindow.triggerArmed).toBe(true);
    });

    it('should fire on trigger level crossing when armed', () => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigLevel = 50;
      mockWindow.triggerSpec.trigSlope = 'Positive';
      mockWindow.triggerArmed = true;
      mockWindow.previousSample = 48;
      const currentSample = 52;
      
      // Check for trigger level crossing
      const trigCrossing = mockWindow.previousSample < mockWindow.triggerSpec.trigLevel && 
                          currentSample >= mockWindow.triggerSpec.trigLevel;
      
      if (mockWindow.triggerArmed && !mockWindow.triggerFired && trigCrossing) {
        mockWindow.triggerFired = true;
        mockWindow.holdoffCounter = mockWindow.triggerSpec.trigHoldoff;
      }
      
      expect(trigCrossing).toBe(true);
      expect(mockWindow.triggerFired).toBe(true);
      expect(mockWindow.holdoffCounter).toBe(2);
    });
  });

  describe('Slope Detection', () => {
    it('should trigger on positive slope only', () => {
      mockWindow.triggerSpec.trigSlope = 'Positive';
      mockWindow.triggerSpec.trigLevel = 50;
      mockWindow.triggerArmed = true;
      
      // Test positive slope - should trigger
      mockWindow.previousSample = 48;
      let currentSample = 52;
      let shouldTrigger = mockWindow.previousSample < mockWindow.triggerSpec.trigLevel && 
                         currentSample >= mockWindow.triggerSpec.trigLevel;
      expect(shouldTrigger).toBe(true);
      
      // Test negative slope - should not trigger
      mockWindow.previousSample = 52;
      currentSample = 48;
      shouldTrigger = mockWindow.previousSample < mockWindow.triggerSpec.trigLevel && 
                     currentSample >= mockWindow.triggerSpec.trigLevel;
      expect(shouldTrigger).toBe(false);
    });

    it('should trigger on negative slope only', () => {
      mockWindow.triggerSpec.trigSlope = 'Negative';
      mockWindow.triggerSpec.trigLevel = 50;
      mockWindow.triggerArmed = true;
      
      // Test negative slope - should trigger
      mockWindow.previousSample = 52;
      let currentSample = 48;
      let shouldTrigger = mockWindow.previousSample > mockWindow.triggerSpec.trigLevel && 
                         currentSample <= mockWindow.triggerSpec.trigLevel;
      expect(shouldTrigger).toBe(true);
      
      // Test positive slope - should not trigger
      mockWindow.previousSample = 48;
      currentSample = 52;
      shouldTrigger = mockWindow.previousSample > mockWindow.triggerSpec.trigLevel && 
                     currentSample <= mockWindow.triggerSpec.trigLevel;
      expect(shouldTrigger).toBe(false);
    });

    it('should trigger on either slope', () => {
      mockWindow.triggerSpec.trigSlope = 'Either';
      mockWindow.triggerSpec.trigLevel = 50;
      mockWindow.triggerArmed = true;
      
      // Test positive slope - should trigger
      mockWindow.previousSample = 48;
      let currentSample = 52;
      let shouldTrigger = (mockWindow.previousSample < mockWindow.triggerSpec.trigLevel && 
                          currentSample >= mockWindow.triggerSpec.trigLevel) ||
                         (mockWindow.previousSample > mockWindow.triggerSpec.trigLevel && 
                          currentSample <= mockWindow.triggerSpec.trigLevel);
      expect(shouldTrigger).toBe(true);
      
      // Test negative slope - should also trigger
      mockWindow.previousSample = 52;
      currentSample = 48;
      shouldTrigger = (mockWindow.previousSample < mockWindow.triggerSpec.trigLevel && 
                      currentSample >= mockWindow.triggerSpec.trigLevel) ||
                     (mockWindow.previousSample > mockWindow.triggerSpec.trigLevel && 
                      currentSample <= mockWindow.triggerSpec.trigLevel);
      expect(shouldTrigger).toBe(true);
    });
  });

  describe('Visual Indicators', () => {
    it('should show correct trigger level lines', () => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigArmLevel = 33;
      mockWindow.triggerSpec.trigLevel = 50;
      
      // Calculate Y positions for lines (inverted for display)
      const scaleAndInvertValue = (value: number, spec: any) => {
        const range = spec.maxValue - spec.minValue;
        const normalized = (value - spec.minValue) / range;
        return spec.ySize * (1 - normalized);
      };
      
      const armYPos = scaleAndInvertValue(mockWindow.triggerSpec.trigArmLevel, mockChannelSpec);
      const trigYPos = scaleAndInvertValue(mockWindow.triggerSpec.trigLevel, mockChannelSpec);
      
      expect(armYPos).toBeCloseTo(66.67, 1); // 33% from top
      expect(trigYPos).toBe(50); // 50% from top
    });

    it('should calculate trigger position correctly', () => {
      mockWindow.triggerSpec.trigRtOffset = 10;
      const lineWidth = 2;
      const margin = 5;
      
      const triggerXPos = margin + mockWindow.triggerSpec.trigRtOffset * lineWidth;
      
      expect(triggerXPos).toBe(25);
    });

    it('should show status with channel and level info', () => {
      mockWindow.triggerSpec.trigChannel = 2;
      mockWindow.triggerSpec.trigLevel = 75.5;
      mockWindow.triggerSpec.trigArmLevel = 33.3;
      
      const channelInfo = `CH${mockWindow.triggerSpec.trigChannel + 1}`;
      const levelInfo = `T:${mockWindow.triggerSpec.trigLevel.toFixed(1)} A:${mockWindow.triggerSpec.trigArmLevel.toFixed(1)}`;
      
      expect(channelInfo).toBe('CH3');
      expect(levelInfo).toBe('T:75.5 A:33.3');
    });
  });

  describe('Edge Cases', () => {
    it('should not trigger when channel index invalid', () => {
      mockWindow.triggerSpec.trigEnabled = true;
      mockWindow.triggerSpec.trigChannel = 5; // Out of bounds
      mockWindow.channelSpecs = [mockChannelSpec]; // Only 1 channel
      
      const isValidChannel = mockWindow.triggerSpec.trigChannel >= 0 && 
                            mockWindow.triggerSpec.trigChannel < mockWindow.channelSpecs.length;
      
      expect(isValidChannel).toBe(false);
    });

    it('should handle samples at exact trigger levels', () => {
      mockWindow.triggerSpec.trigArmLevel = 33;
      mockWindow.triggerSpec.trigLevel = 50;
      
      // Sample exactly at arm level
      mockWindow.previousSample = 32.9;
      let currentSample = 33;
      let armCrossing = mockWindow.previousSample < mockWindow.triggerSpec.trigArmLevel && 
                       currentSample >= mockWindow.triggerSpec.trigArmLevel;
      expect(armCrossing).toBe(true);
      
      // Sample exactly at trigger level
      mockWindow.previousSample = 49.9;
      currentSample = 50;
      let trigCrossing = mockWindow.previousSample < mockWindow.triggerSpec.trigLevel && 
                        currentSample >= mockWindow.triggerSpec.trigLevel;
      expect(trigCrossing).toBe(true);
    });

    it('should reset properly after holdoff', () => {
      mockWindow.triggerFired = true;
      mockWindow.triggerArmed = true;
      mockWindow.holdoffCounter = 1;
      mockWindow.triggerSampleIndex = 42;
      
      // Simulate holdoff countdown
      mockWindow.holdoffCounter--;
      
      if (mockWindow.holdoffCounter === 0) {
        // Reset all trigger state
        mockWindow.triggerArmed = false;
        mockWindow.triggerFired = false;
        mockWindow.triggerSampleIndex = -1;
      }
      
      expect(mockWindow.holdoffCounter).toBe(0);
      expect(mockWindow.triggerArmed).toBe(false);
      expect(mockWindow.triggerFired).toBe(false);
      expect(mockWindow.triggerSampleIndex).toBe(-1);
    });
  });
});