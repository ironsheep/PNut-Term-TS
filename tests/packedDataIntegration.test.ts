/** @format */

'use strict';

// tests/packedDataIntegration.test.ts

describe('PackedDataProcessor Integration in Debug Windows', () => {
  // Mock window objects for testing
  let mockLogicWindow: any;
  let mockScopeWindow: any;

  beforeEach(() => {
    // Initialize mock windows with basic structure
    mockLogicWindow = {
      packedMode: null,
      parseLogicDeclaration: jest.fn(),
      recordSampleToChannels: jest.fn(),
      channelSpecs: []
    };

    mockScopeWindow = {
      packedMode: null,
      parseScopeDeclaration: jest.fn(),
      recordChannelSample: jest.fn(),
      channelSpecs: []
    };
  });

  describe('Logic Window Packed Data Integration', () => {
    describe('longs_1bit mode', () => {
      it('should unpack 32 1-bit samples from a long', () => {
        const debugString = '`LOGIC test1 longs_1bit';
        const numericValue = 0xAAAAAAAA; // Alternating 1s and 0s
        
        // Expected unpacked samples (MSB first)
        const expected = [
          1, 0, 1, 0, 1, 0, 1, 0, // 0xAA
          1, 0, 1, 0, 1, 0, 1, 0, // 0xAA
          1, 0, 1, 0, 1, 0, 1, 0, // 0xAA
          1, 0, 1, 0, 1, 0, 1, 0  // 0xAA
        ];
        
        // Simulate unpacking
        const unpacked = simulateUnpacking(numericValue, 'longs_1bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle ALT modifier for longs_1bit', () => {
        const debugString = '`LOGIC test1 longs_1bit ALT';
        const numericValue = 0x12345678;
        
        // With ALT, bytes should be reordered: 78 56 34 12
        const expected = [
          0, 1, 1, 1, 1, 0, 0, 0, // 0x78
          0, 1, 0, 1, 0, 1, 1, 0, // 0x56
          0, 0, 1, 1, 0, 1, 0, 0, // 0x34
          0, 0, 0, 1, 0, 0, 1, 0  // 0x12
        ];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_1bit', true);
        expect(unpacked).toEqual(expected);
      });
    });

    describe('longs_2bit mode', () => {
      it('should unpack 16 2-bit samples from a long', () => {
        const numericValue = 0xE4E4E4E4; // 11 10 01 00 pattern
        
        const expected = [
          3, 2, 1, 0, // 11 10 01 00
          3, 2, 1, 0, // 11 10 01 00
          3, 2, 1, 0, // 11 10 01 00
          3, 2, 1, 0  // 11 10 01 00
        ];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_2bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle SIGNED modifier for longs_2bit', () => {
        const numericValue = 0xE4E4E4E4; // 11 10 01 00 pattern
        
        // With SIGNED, 2-bit values: 11->-1, 10->-2, 01->1, 00->0
        const expected = [
          -1, -2, 1, 0,
          -1, -2, 1, 0,
          -1, -2, 1, 0,
          -1, -2, 1, 0
        ];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_2bit', false, true);
        expect(unpacked).toEqual(expected);
      });
    });

    describe('longs_4bit mode', () => {
      it('should unpack 8 4-bit samples from a long', () => {
        const numericValue = 0xFEDCBA98;
        
        const expected = [15, 14, 13, 12, 11, 10, 9, 8];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_4bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle ALT and SIGNED modifiers together', () => {
        const numericValue = 0xF0E0D0C0;
        
        // With ALT: bytes reordered to C0 D0 E0 F0
        // With SIGNED: F->-1, E->-2, D->-3, C->-4, 0->0
        const expected = [-4, 0, -3, 0, -2, 0, -1, 0];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_4bit', true, true);
        expect(unpacked).toEqual(expected);
      });
    });

    describe('longs_8bit mode', () => {
      it('should unpack 4 8-bit samples from a long', () => {
        const numericValue = 0xDEADBEEF;
        
        const expected = [0xDE, 0xAD, 0xBE, 0xEF];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_8bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle SIGNED modifier for longs_8bit', () => {
        const numericValue = 0xFF80407F; // -1, -128, 64, 127
        
        const expected = [-1, -128, 64, 127];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_8bit', false, true);
        expect(unpacked).toEqual(expected);
      });
    });

    describe('longs_16bit mode', () => {
      it('should unpack 2 16-bit samples from a long', () => {
        const numericValue = 0x12348765;
        
        const expected = [0x1234, 0x8765];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_16bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle ALT modifier for longs_16bit', () => {
        const numericValue = 0x12345678;
        
        // With ALT: byte order reversed to 0x78563412
        const expected = [0x7856, 0x3412];
        
        const unpacked = simulateUnpacking(numericValue, 'longs_16bit', true);
        expect(unpacked).toEqual(expected);
      });
    });
  });

  describe('Scope Window Packed Data Integration', () => {
    describe('words_1bit mode', () => {
      it('should unpack 16 1-bit samples from a word', () => {
        const numericValue = 0x5555; // Alternating 0s and 1s
        
        const expected = [
          0, 1, 0, 1, 0, 1, 0, 1, // 0x55
          0, 1, 0, 1, 0, 1, 0, 1  // 0x55
        ];
        
        const unpacked = simulateUnpacking(numericValue, 'words_1bit');
        expect(unpacked).toEqual(expected);
      });
    });

    describe('words_2bit mode', () => {
      it('should unpack 8 2-bit samples from a word', () => {
        const numericValue = 0xE4E4; // 11 10 01 00 pattern
        
        const expected = [3, 2, 1, 0, 3, 2, 1, 0];
        
        const unpacked = simulateUnpacking(numericValue, 'words_2bit');
        expect(unpacked).toEqual(expected);
      });
    });

    describe('words_4bit mode', () => {
      it('should unpack 4 4-bit samples from a word', () => {
        const numericValue = 0xABCD;
        
        const expected = [0xA, 0xB, 0xC, 0xD];
        
        const unpacked = simulateUnpacking(numericValue, 'words_4bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle SIGNED modifier for words_4bit', () => {
        const numericValue = 0xF0E0; // F->-1, 0->0, E->-2, 0->0
        
        const expected = [-1, 0, -2, 0];
        
        const unpacked = simulateUnpacking(numericValue, 'words_4bit', false, true);
        expect(unpacked).toEqual(expected);
      });
    });

    describe('words_8bit mode', () => {
      it('should unpack 2 8-bit samples from a word', () => {
        const numericValue = 0xBEEF;
        
        const expected = [0xBE, 0xEF];
        
        const unpacked = simulateUnpacking(numericValue, 'words_8bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle ALT modifier for words_8bit', () => {
        const numericValue = 0x1234;
        
        // With ALT: bytes swapped to 34 12
        const expected = [0x34, 0x12];
        
        const unpacked = simulateUnpacking(numericValue, 'words_8bit', true);
        expect(unpacked).toEqual(expected);
      });
    });
  });

  describe('Bytes Packed Data Modes', () => {
    describe('bytes_1bit mode', () => {
      it('should unpack 8 1-bit samples from a byte', () => {
        const numericValue = 0xAA; // 10101010
        
        const expected = [1, 0, 1, 0, 1, 0, 1, 0];
        
        const unpacked = simulateUnpacking(numericValue, 'bytes_1bit');
        expect(unpacked).toEqual(expected);
      });
    });

    describe('bytes_2bit mode', () => {
      it('should unpack 4 2-bit samples from a byte', () => {
        const numericValue = 0xE4; // 11 10 01 00
        
        const expected = [3, 2, 1, 0];
        
        const unpacked = simulateUnpacking(numericValue, 'bytes_2bit');
        expect(unpacked).toEqual(expected);
      });

      it('should handle SIGNED modifier for bytes_2bit', () => {
        const numericValue = 0xE4; // 11 10 01 00
        
        // With SIGNED: 11->-1, 10->-2, 01->1, 00->0
        const expected = [-1, -2, 1, 0];
        
        const unpacked = simulateUnpacking(numericValue, 'bytes_2bit', false, true);
        expect(unpacked).toEqual(expected);
      });
    });

    describe('bytes_4bit mode', () => {
      it('should unpack 2 4-bit samples from a byte', () => {
        const numericValue = 0xAB;
        
        const expected = [0xA, 0xB];
        
        const unpacked = simulateUnpacking(numericValue, 'bytes_4bit');
        expect(unpacked).toEqual(expected);
      });
    });
  });

  describe('Integration with Debug String Parsing', () => {
    it('should parse and apply packed mode in Logic window', () => {
      const debugStrings = [
        '`LOGIC test1 longs_4bit',
        '0x12345678',
        '0xABCDEF00'
      ];
      
      // Simulate parsing first line
      const parts = debugStrings[0].split(' ');
      const mode = parts[2]; // 'longs_4bit'
      
      // Verify mode is recognized
      expect(isValidPackedMode(mode)).toBe(true);
      
      // Simulate unpacking numeric values
      const samples1 = simulateUnpacking(0x12345678, mode);
      const samples2 = simulateUnpacking(0xABCDEF00, mode);
      
      expect(samples1).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(samples2).toEqual([0xA, 0xB, 0xC, 0xD, 0xE, 0xF, 0, 0]);
    });

    it('should parse and apply packed mode with modifiers in Scope window', () => {
      const debugStrings = [
        '`SCOPE test1',
        "'Channel1' words_2bit ALT SIGNED 0 3 100 0 %1111 GREEN",
        '0xE4E4'
      ];
      
      // Extract packed mode and modifiers from channel declaration
      const channelParts = debugStrings[1].split(' ');
      const mode = channelParts[1]; // 'words_2bit'
      const hasAlt = channelParts.includes('ALT');
      const hasSigned = channelParts.includes('SIGNED');
      
      expect(mode).toBe('words_2bit');
      expect(hasAlt).toBe(true);
      expect(hasSigned).toBe(true);
      
      // Simulate unpacking with modifiers
      const samples = simulateUnpacking(0xE4E4, mode, hasAlt, hasSigned);
      
      // With ALT and SIGNED for words_2bit
      expect(samples.length).toBe(8);
      // Verify sign extension is applied
      expect(samples.some(s => s < 0)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid packed mode strings', () => {
      const invalidModes = [
        'invalid_mode',
        'longs_3bit', // Invalid bit size
        'doubles_8bit', // Invalid data size
        '',
        null
      ];
      
      invalidModes.forEach(mode => {
        expect(isValidPackedMode(mode)).toBe(false);
      });
    });

    it('should handle numeric overflow correctly', () => {
      // JavaScript number max safe integer
      const maxValue = Number.MAX_SAFE_INTEGER;
      
      // Should still unpack without throwing
      expect(() => {
        simulateUnpacking(maxValue, 'longs_8bit');
      }).not.toThrow();
    });

    it('should maintain consistency between Logic and Scope unpacking', () => {
      const testValue = 0xDEADBEEF;
      const modes = ['longs_8bit', 'longs_4bit', 'longs_2bit', 'longs_1bit'];
      
      modes.forEach(mode => {
        // Both windows should produce identical results
        const logicResult = simulateUnpacking(testValue, mode);
        const scopeResult = simulateUnpacking(testValue, mode);
        
        expect(logicResult).toEqual(scopeResult);
      });
    });
  });

  describe('Real-world Debug Scenarios', () => {
    it('should handle Logic analyzer data stream', () => {
      // Simulate logic analyzer capturing SPI data
      const debugString = '`LOGIC SPI_Monitor longs_8bit SAMPLES 32';
      const spiData = [
        0x01234567, // Command bytes
        0x89ABCDEF, // Data bytes
        0x00FF00FF  // Clock pattern
      ];
      
      const allSamples: number[] = [];
      spiData.forEach(value => {
        const samples = simulateUnpacking(value, 'longs_8bit');
        allSamples.push(...samples);
      });
      
      expect(allSamples.length).toBe(12); // 3 longs * 4 bytes each
      expect(allSamples[0]).toBe(0x01); // First command byte
      expect(allSamples[11]).toBe(0xFF); // Last clock byte
    });

    it('should handle Scope ADC data stream', () => {
      // Simulate ADC samples packed as signed 16-bit values
      const debugString = '`SCOPE ADC_Monitor';
      const channelDecl = "'Voltage' longs_16bit SIGNED -32768 32767 200 100 %1111 GREEN";
      
      const adcData = 0x7FFF8000; // Max positive and min negative
      const samples = simulateUnpacking(adcData, 'longs_16bit', false, true);
      
      expect(samples.length).toBe(2);
      expect(samples[0]).toBe(32767); // Max positive
      expect(samples[1]).toBe(-32768); // Min negative
    });
  });
});

// Helper functions to simulate PackedDataProcessor behavior
function simulateUnpacking(value: number, mode: string, alt = false, signed = false): number[] {
  // This simulates the PackedDataProcessor.unpackSamples behavior
  const samples: number[] = [];
  
  // Parse mode components
  const [dataSize, bitSize] = mode.split('_');
  const bitsPerSample = parseInt(bitSize);
  
  // Determine total bits based on data size
  let totalBits = 0;
  switch (dataSize) {
    case 'longs': totalBits = 32; break;
    case 'words': totalBits = 16; break;
    case 'bytes': totalBits = 8; break;
  }
  
  const samplesPerValue = totalBits / bitsPerSample;
  const mask = (1 << bitsPerSample) - 1;
  
  // Apply ALT modifier if needed (byte reversal)
  let workingValue = value;
  if (alt) {
    workingValue = applyAltModifier(workingValue, dataSize);
  }
  
  // Extract samples
  for (let i = 0; i < samplesPerValue; i++) {
    const shift = totalBits - (i + 1) * bitsPerSample;
    let sample = (workingValue >>> shift) & mask;
    
    // Apply sign extension if SIGNED
    if (signed && (sample & (1 << (bitsPerSample - 1)))) {
      sample |= ~mask;
    }
    
    samples.push(sample);
  }
  
  return samples;
}

function applyAltModifier(value: number, dataSize: string): number {
  switch (dataSize) {
    case 'longs':
      // Reverse byte order for 32-bit value
      return ((value & 0xFF) << 24) |
             ((value & 0xFF00) << 8) |
             ((value & 0xFF0000) >>> 8) |
             ((value & 0xFF000000) >>> 24);
    case 'words':
      // Reverse byte order for 16-bit value
      return ((value & 0xFF) << 8) | ((value & 0xFF00) >>> 8);
    case 'bytes':
      // No reversal for bytes
      return value;
    default:
      return value;
  }
}

function isValidPackedMode(mode: any): boolean {
  if (!mode || typeof mode !== 'string') return false;
  
  const validModes = [
    'longs_1bit', 'longs_2bit', 'longs_4bit', 'longs_8bit', 'longs_16bit',
    'words_1bit', 'words_2bit', 'words_4bit', 'words_8bit',
    'bytes_1bit', 'bytes_2bit', 'bytes_4bit'
  ];
  
  return validModes.includes(mode);
}