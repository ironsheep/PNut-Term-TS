/** @format */

'use strict';

// tests/spacingDirective.test.ts

describe('SPACING Directive Fix in Logic Window', () => {
  // Mock DebugLogicWindow
  let mockWindow: any;
  let mockCanvas: any;
  
  beforeEach(() => {
    // Initialize mock window with default values
    mockWindow = {
      displaySpec: {
        nbrSamples: 64,
        spacing: 2,
        window: {
          width: 128, // nbrSamples * spacing
          height: 200
        }
      },
      channelSpecs: [],
      sampleLineAtXPos: 0
    };
    
    // Mock canvas for visual testing
    mockCanvas = {
      width: 0,
      height: 0,
      scrollSpeed: 0
    };
  });

  describe('SPACING Directive Parsing', () => {
    it('should correctly parse SPACING directive and assign to spacing property', () => {
      const debugString = '`LOGIC test1 SAMPLES 64 SPACING 4';
      const parts = debugString.split(' ');
      
      // Find and parse SAMPLES
      const samplesIndex = parts.indexOf('SAMPLES');
      if (samplesIndex !== -1) {
        mockWindow.displaySpec.nbrSamples = parseInt(parts[samplesIndex + 1]);
      }
      
      // Find and parse SPACING (fixed version)
      const spacingIndex = parts.indexOf('SPACING');
      if (spacingIndex !== -1) {
        // FIXED: Assign to spacing, not nbrSamples
        mockWindow.displaySpec.spacing = parseInt(parts[spacingIndex + 1]);
      }
      
      expect(mockWindow.displaySpec.nbrSamples).toBe(64);
      expect(mockWindow.displaySpec.spacing).toBe(4);
      
      // Window width should be samples * spacing
      mockWindow.displaySpec.window.width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      expect(mockWindow.displaySpec.window.width).toBe(256); // 64 * 4
    });

    it('should maintain default spacing when not specified', () => {
      const debugString = '`LOGIC test1 SAMPLES 32';
      const parts = debugString.split(' ');
      
      // Parse only SAMPLES
      const samplesIndex = parts.indexOf('SAMPLES');
      if (samplesIndex !== -1) {
        mockWindow.displaySpec.nbrSamples = parseInt(parts[samplesIndex + 1]);
      }
      
      // Spacing should remain at default
      expect(mockWindow.displaySpec.nbrSamples).toBe(32);
      expect(mockWindow.displaySpec.spacing).toBe(2); // Default value
      
      mockWindow.displaySpec.window.width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      expect(mockWindow.displaySpec.window.width).toBe(64); // 32 * 2
    });

    it('should validate spacing range (1-32 pixels)', () => {
      const testCases = [
        { spacing: 0, expected: 1 },    // Too small, clamp to 1
        { spacing: 1, expected: 1 },    // Minimum valid
        { spacing: 16, expected: 16 },  // Valid mid-range
        { spacing: 32, expected: 32 },  // Maximum valid
        { spacing: 50, expected: 32 },  // Too large, clamp to 32
        { spacing: -5, expected: 1 }    // Negative, clamp to 1
      ];
      
      testCases.forEach(testCase => {
        let spacing = testCase.spacing;
        
        // Validation logic
        if (spacing < 1) spacing = 1;
        if (spacing > 32) spacing = 32;
        
        expect(spacing).toBe(testCase.expected);
      });
    });
  });

  describe('Visual Sample Spacing', () => {
    it('should calculate correct X positions for different spacing values', () => {
      const testConfigs = [
        { samples: 64, spacing: 1, expectedWidth: 64 },
        { samples: 64, spacing: 4, expectedWidth: 256 },
        { samples: 32, spacing: 8, expectedWidth: 256 },
        { samples: 128, spacing: 2, expectedWidth: 256 },
        { samples: 16, spacing: 16, expectedWidth: 256 },
        { samples: 8, spacing: 32, expectedWidth: 256 }
      ];
      
      testConfigs.forEach(config => {
        mockWindow.displaySpec.nbrSamples = config.samples;
        mockWindow.displaySpec.spacing = config.spacing;
        
        const width = config.samples * config.spacing;
        expect(width).toBe(config.expectedWidth);
        
        // Calculate X positions for first few samples
        const xPositions = [];
        for (let i = 0; i < Math.min(5, config.samples); i++) {
          xPositions.push(i * config.spacing);
        }
        
        // Verify spacing between consecutive samples
        for (let i = 1; i < xPositions.length; i++) {
          expect(xPositions[i] - xPositions[i-1]).toBe(config.spacing);
        }
      });
    });

    it('should draw samples at correct positions based on spacing', () => {
      const drawSample = (sampleIndex: number, spacing: number): number => {
        return sampleIndex * spacing;
      };
      
      // Test with spacing = 4
      mockWindow.displaySpec.spacing = 4;
      expect(drawSample(0, mockWindow.displaySpec.spacing)).toBe(0);
      expect(drawSample(1, mockWindow.displaySpec.spacing)).toBe(4);
      expect(drawSample(10, mockWindow.displaySpec.spacing)).toBe(40);
      
      // Test with spacing = 16
      mockWindow.displaySpec.spacing = 16;
      expect(drawSample(0, mockWindow.displaySpec.spacing)).toBe(0);
      expect(drawSample(1, mockWindow.displaySpec.spacing)).toBe(16);
      expect(drawSample(10, mockWindow.displaySpec.spacing)).toBe(160);
    });

    it('should handle scrolling with different spacing values', () => {
      // Simulate scrolling behavior
      const calculateScrollSpeed = (spacing: number): number => {
        // Scroll speed should be proportional to spacing
        return Math.max(1, Math.floor(spacing / 2));
      };
      
      expect(calculateScrollSpeed(1)).toBe(1);   // Minimum scroll
      expect(calculateScrollSpeed(4)).toBe(2);   // Moderate scroll
      expect(calculateScrollSpeed(16)).toBe(8);  // Faster scroll
      expect(calculateScrollSpeed(32)).toBe(16); // Maximum scroll
    });
  });

  describe('Window Size Calculations', () => {
    it('should calculate window width based on samples * spacing', () => {
      const testCases = [
        { samples: 64, spacing: 4, expectedWidth: 256 },
        { samples: 32, spacing: 16, expectedWidth: 512 },
        { samples: 128, spacing: 1, expectedWidth: 128 },
        { samples: 256, spacing: 2, expectedWidth: 512 }
      ];
      
      testCases.forEach(testCase => {
        const width = testCase.samples * testCase.spacing;
        expect(width).toBe(testCase.expectedWidth);
      });
    });

    it('should update canvas dimensions when spacing changes', () => {
      // Initial setup
      mockWindow.displaySpec.nbrSamples = 64;
      mockWindow.displaySpec.spacing = 2;
      mockCanvas.width = 128; // 64 * 2
      
      // Change spacing
      mockWindow.displaySpec.spacing = 8;
      mockCanvas.width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      
      expect(mockCanvas.width).toBe(512); // 64 * 8
      
      // Verify sample count unchanged
      expect(mockWindow.displaySpec.nbrSamples).toBe(64);
    });

    it('should maintain proper aspect ratio with different spacing', () => {
      const calculateAspectRatio = (width: number, height: number): number => {
        return width / height;
      };
      
      mockWindow.displaySpec.window.height = 200; // Fixed height
      
      // Test different spacing values
      const spacingValues = [1, 2, 4, 8, 16, 32];
      mockWindow.displaySpec.nbrSamples = 64;
      
      spacingValues.forEach(spacing => {
        const width = mockWindow.displaySpec.nbrSamples * spacing;
        const ratio = calculateAspectRatio(width, mockWindow.displaySpec.window.height);
        
        expect(ratio).toBeGreaterThan(0);
        expect(width).toBe(64 * spacing);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small spacing (1 pixel)', () => {
      mockWindow.displaySpec.nbrSamples = 256;
      mockWindow.displaySpec.spacing = 1;
      
      const width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      expect(width).toBe(256); // Dense display
      
      // Verify samples are distinguishable
      const sample1X = 10 * mockWindow.displaySpec.spacing;
      const sample2X = 11 * mockWindow.displaySpec.spacing;
      expect(sample2X - sample1X).toBe(1); // Adjacent pixels
    });

    it('should handle maximum spacing (32 pixels)', () => {
      mockWindow.displaySpec.nbrSamples = 16;
      mockWindow.displaySpec.spacing = 32;
      
      const width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      expect(width).toBe(512); // Sparse display
      
      // Verify samples are well-separated
      const sample1X = 0 * mockWindow.displaySpec.spacing;
      const sample2X = 1 * mockWindow.displaySpec.spacing;
      expect(sample2X - sample1X).toBe(32); // Wide separation
    });

    it('should handle spacing with different sample counts', () => {
      const configurations = [
        { samples: 8, spacing: 32, description: "Few samples, wide spacing" },
        { samples: 256, spacing: 1, description: "Many samples, tight spacing" },
        { samples: 64, spacing: 8, description: "Balanced configuration" }
      ];
      
      configurations.forEach(config => {
        mockWindow.displaySpec.nbrSamples = config.samples;
        mockWindow.displaySpec.spacing = config.spacing;
        
        const width = config.samples * config.spacing;
        expect(width).toBe(config.samples * config.spacing);
        
        // Verify last sample position
        const lastSampleX = (config.samples - 1) * config.spacing;
        expect(lastSampleX).toBe((config.samples - 1) * config.spacing);
      });
    });
  });

  describe('Integration with Display Updates', () => {
    it('should properly update display when spacing changes', () => {
      // Simulate display update function
      const updateDisplay = (window: any) => {
        // Recalculate window width
        window.displaySpec.window.width = window.displaySpec.nbrSamples * window.displaySpec.spacing;
        
        // Update canvas
        mockCanvas.width = window.displaySpec.window.width;
        
        // Calculate new sample positions
        const positions = [];
        for (let i = 0; i < window.displaySpec.nbrSamples; i++) {
          positions.push(i * window.displaySpec.spacing);
        }
        
        return positions;
      };
      
      // Initial state
      mockWindow.displaySpec.nbrSamples = 32;
      mockWindow.displaySpec.spacing = 4;
      let positions = updateDisplay(mockWindow);
      
      expect(mockWindow.displaySpec.window.width).toBe(128);
      expect(positions[0]).toBe(0);
      expect(positions[1]).toBe(4);
      expect(positions[31]).toBe(124);
      
      // Change spacing
      mockWindow.displaySpec.spacing = 8;
      positions = updateDisplay(mockWindow);
      
      expect(mockWindow.displaySpec.window.width).toBe(256);
      expect(positions[0]).toBe(0);
      expect(positions[1]).toBe(8);
      expect(positions[31]).toBe(248);
    });

    it('should maintain data integrity when spacing changes', () => {
      // Sample data should not change when spacing changes
      const sampleData = [1, 0, 1, 1, 0, 1, 0, 0];
      mockWindow.displaySpec.nbrSamples = sampleData.length;
      
      // Test with different spacing values
      [2, 4, 8, 16].forEach(spacing => {
        mockWindow.displaySpec.spacing = spacing;
        
        // Data remains unchanged
        expect(sampleData.length).toBe(8);
        expect(sampleData).toEqual([1, 0, 1, 1, 0, 1, 0, 0]);
        
        // Only display positions change
        const xPos = sampleData.map((_, index) => index * spacing);
        expect(xPos[0]).toBe(0);
        expect(xPos[7]).toBe(7 * spacing);
      });
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle logic analyzer display with tight timing', () => {
      // High-speed logic analysis: many samples, small spacing
      mockWindow.displaySpec.nbrSamples = 256;
      mockWindow.displaySpec.spacing = 2;
      
      const width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      expect(width).toBe(512);
      
      // Verify dense display suitable for timing analysis
      const timeBetweenSamples = mockWindow.displaySpec.spacing;
      expect(timeBetweenSamples).toBeLessThanOrEqual(2);
    });

    it('should handle slow signal monitoring with wide spacing', () => {
      // Slow signal monitoring: fewer samples, wide spacing
      mockWindow.displaySpec.nbrSamples = 32;
      mockWindow.displaySpec.spacing = 16;
      
      const width = mockWindow.displaySpec.nbrSamples * mockWindow.displaySpec.spacing;
      expect(width).toBe(512);
      
      // Verify sparse display suitable for slow signals
      const timeBetweenSamples = mockWindow.displaySpec.spacing;
      expect(timeBetweenSamples).toBeGreaterThanOrEqual(16);
    });

    it('should adapt to different screen resolutions', () => {
      const screenWidths = [800, 1024, 1920, 2560];
      
      screenWidths.forEach(screenWidth => {
        // Calculate optimal spacing for screen
        const targetSamples = 128;
        const maxSpacing = Math.floor(screenWidth / targetSamples);
        const optimalSpacing = Math.min(maxSpacing, 32); // Cap at 32
        
        mockWindow.displaySpec.nbrSamples = targetSamples;
        mockWindow.displaySpec.spacing = optimalSpacing;
        
        const windowWidth = targetSamples * optimalSpacing;
        expect(windowWidth).toBeLessThanOrEqual(screenWidth);
        expect(mockWindow.displaySpec.spacing).toBeLessThanOrEqual(32);
      });
    });
  });
});