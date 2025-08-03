import { Spin2NumericParser } from '../src/classes/shared/spin2NumericParser';

describe('Spin2NumericParser', () => {
  // Capture console errors for testing
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getNumericType', () => {
    test('identifies hexadecimal format', () => {
      expect(Spin2NumericParser.getNumericType('$FF')).toBe('hex');
      expect(Spin2NumericParser.getNumericType('$00_FF_00')).toBe('hex');
      expect(Spin2NumericParser.getNumericType('$abc123')).toBe('hex');
    });

    test('identifies decimal format', () => {
      expect(Spin2NumericParser.getNumericType('123')).toBe('decimal');
      expect(Spin2NumericParser.getNumericType('-456')).toBe('decimal');
      expect(Spin2NumericParser.getNumericType('1_000_000')).toBe('decimal');
    });

    test('identifies binary format', () => {
      expect(Spin2NumericParser.getNumericType('%1010')).toBe('binary');
      expect(Spin2NumericParser.getNumericType('%1111_0000')).toBe('binary');
    });

    test('identifies quaternary format', () => {
      expect(Spin2NumericParser.getNumericType('%%0123')).toBe('quaternary');
      expect(Spin2NumericParser.getNumericType('%%33_22_11_00')).toBe('quaternary');
    });

    test('identifies float format', () => {
      expect(Spin2NumericParser.getNumericType('1.5')).toBe('float');
      expect(Spin2NumericParser.getNumericType('-2.3e4')).toBe('float');
      expect(Spin2NumericParser.getNumericType('5e-6')).toBe('float');
      expect(Spin2NumericParser.getNumericType('1_250_000.0')).toBe('float');
    });

    test('returns null for invalid formats', () => {
      expect(Spin2NumericParser.getNumericType('')).toBe(null);
      expect(Spin2NumericParser.getNumericType('abc')).toBe(null);
      expect(Spin2NumericParser.getNumericType('$')).toBe(null);
      expect(Spin2NumericParser.getNumericType('%')).toBe(null);
    });
  });

  describe('isNumeric', () => {
    test('returns true for valid formats', () => {
      expect(Spin2NumericParser.isNumeric('$FF')).toBe(true);
      expect(Spin2NumericParser.isNumeric('123')).toBe(true);
      expect(Spin2NumericParser.isNumeric('%1010')).toBe(true);
      expect(Spin2NumericParser.isNumeric('%%0123')).toBe(true);
      expect(Spin2NumericParser.isNumeric('1.5')).toBe(true);
    });

    test('returns false for invalid formats', () => {
      expect(Spin2NumericParser.isNumeric('')).toBe(false);
      expect(Spin2NumericParser.isNumeric('abc')).toBe(false);
      expect(Spin2NumericParser.isNumeric('$G')).toBe(false);
    });
  });

  describe('parseValue - Hexadecimal', () => {
    test('parses valid hex values', () => {
      expect(Spin2NumericParser.parseValue('$FF')).toBe(255);
      expect(Spin2NumericParser.parseValue('$ff')).toBe(255);
      expect(Spin2NumericParser.parseValue('$00FF00')).toBe(65280);
      expect(Spin2NumericParser.parseValue('$00_FF_00')).toBe(65280);
      expect(Spin2NumericParser.parseValue('$FFFFFF')).toBe(16777215);
    });

    test('case insensitive hex parsing', () => {
      expect(Spin2NumericParser.parseValue('$AbCdEf')).toBe(11259375);
      expect(Spin2NumericParser.parseValue('$ABCDEF')).toBe(11259375);
      expect(Spin2NumericParser.parseValue('$abcdef')).toBe(11259375);
    });

    test('handles hex overflow', () => {
      expect(Spin2NumericParser.parseValue('$FFFFFFFF')).toBe(4294967295);
      expect(Spin2NumericParser.parseValue('$1FFFFFFFF')).toBe(4294967295);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds 32-bit range'));
    });

    test('rejects invalid hex', () => {
      expect(Spin2NumericParser.parseValue('$')).toBe(null);
      expect(Spin2NumericParser.parseValue('$G')).toBe(null);
      expect(Spin2NumericParser.parseValue('$ZZZ')).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown numeric format'));
    });

    test('hex does not support negative', () => {
      expect(Spin2NumericParser.parseValue('-$FF')).toBe(null);
    });
  });

  describe('parseValue - Decimal', () => {
    test('parses valid decimal values', () => {
      expect(Spin2NumericParser.parseValue('0')).toBe(0);
      expect(Spin2NumericParser.parseValue('123')).toBe(123);
      expect(Spin2NumericParser.parseValue('1_000_000')).toBe(1000000);
      expect(Spin2NumericParser.parseValue('2147483647')).toBe(2147483647);
    });

    test('parses negative decimals', () => {
      expect(Spin2NumericParser.parseValue('-1')).toBe(-1);
      expect(Spin2NumericParser.parseValue('-456')).toBe(-456);
      expect(Spin2NumericParser.parseValue('-1_000_000')).toBe(-1000000);
      expect(Spin2NumericParser.parseValue('-2147483648')).toBe(-2147483648);
    });

    test('handles decimal overflow/underflow', () => {
      expect(Spin2NumericParser.parseValue('2147483648')).toBe(2147483647);
      expect(Spin2NumericParser.parseValue('-2147483649')).toBe(-2147483648);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds INT32_MAX'));
    });
  });

  describe('parseValue - Binary', () => {
    test('parses valid binary values', () => {
      expect(Spin2NumericParser.parseValue('%0')).toBe(0);
      expect(Spin2NumericParser.parseValue('%1')).toBe(1);
      expect(Spin2NumericParser.parseValue('%1010')).toBe(10);
      expect(Spin2NumericParser.parseValue('%1111_0000')).toBe(240);
      expect(Spin2NumericParser.parseValue('%11111111')).toBe(255);
    });

    test('rejects invalid binary', () => {
      expect(Spin2NumericParser.parseValue('%')).toBe(null);
      expect(Spin2NumericParser.parseValue('%2')).toBe(null);
      expect(Spin2NumericParser.parseValue('%1012')).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown numeric format'));
    });

    test('binary does not support negative', () => {
      expect(Spin2NumericParser.parseValue('-%1010')).toBe(null);
    });
  });

  describe('parseValue - Quaternary', () => {
    test('parses valid quaternary values', () => {
      expect(Spin2NumericParser.parseValue('%%0')).toBe(0);
      expect(Spin2NumericParser.parseValue('%%1')).toBe(1);
      expect(Spin2NumericParser.parseValue('%%0123')).toBe(27);
      expect(Spin2NumericParser.parseValue('%%3333')).toBe(255);
      // %%33_22_11_00 in base 4: 3*4^7 + 3*4^6 + 2*4^5 + 2*4^4 + 1*4^3 + 1*4^2 + 0*4^1 + 0*4^0
      // = 3*16384 + 3*4096 + 2*1024 + 2*256 + 1*64 + 1*16 + 0 + 0
      // = 49152 + 12288 + 2048 + 512 + 64 + 16 + 0 + 0 = 64080
      expect(Spin2NumericParser.parseValue('%%33_22_11_00')).toBe(64080);
    });

    test('rejects invalid quaternary', () => {
      expect(Spin2NumericParser.parseValue('%%')).toBe(null);
      expect(Spin2NumericParser.parseValue('%%4')).toBe(null);
      expect(Spin2NumericParser.parseValue('%%0124')).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown numeric format'));
    });

    test('quaternary does not support negative', () => {
      expect(Spin2NumericParser.parseValue('-%%0123')).toBe(null);
    });
  });

  describe('parseValue - Float', () => {
    test('parses valid float values', () => {
      expect(Spin2NumericParser.parseValue('0.0')).toBe(0);
      expect(Spin2NumericParser.parseValue('1.5')).toBe(1.5);
      expect(Spin2NumericParser.parseValue('-1.0')).toBe(-1.0);
      expect(Spin2NumericParser.parseValue('1_250_000.0')).toBe(1250000.0);
    });

    test('parses scientific notation', () => {
      expect(Spin2NumericParser.parseValue('1e9')).toBe(1000000000);
      expect(Spin2NumericParser.parseValue('1E9')).toBe(1000000000);
      expect(Spin2NumericParser.parseValue('5e-6')).toBe(0.000005);
      expect(Spin2NumericParser.parseValue('-1.23456e-7')).toBe(-0.000000123456);
      expect(Spin2NumericParser.parseValue('2.5e+3')).toBe(2500);
    });

    test('handles float overflow', () => {
      const result = Spin2NumericParser.parseValue('1e308');
      expect(result).toBe(1e308);
      
      const overflow = Spin2NumericParser.parseValue('1e309');
      expect(overflow).toBe(Number.MAX_VALUE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Float value exceeds range'));
    });
  });

  describe('parseInteger', () => {
    test('parses integer values', () => {
      expect(Spin2NumericParser.parseInteger('123')).toBe(123);
      expect(Spin2NumericParser.parseInteger('$FF')).toBe(255);
      expect(Spin2NumericParser.parseInteger('%1010')).toBe(10);
      expect(Spin2NumericParser.parseInteger('%%0123')).toBe(27);
    });

    test('rejects float values', () => {
      expect(Spin2NumericParser.parseInteger('1.5')).toBe(null);
      // 1e3 = 1000, which is an integer
      expect(Spin2NumericParser.parseInteger('1e3')).toBe(1000);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Expected integer but got float'));
    });

    test('respects allowNegative parameter', () => {
      expect(Spin2NumericParser.parseInteger('-123', true)).toBe(-123);
      expect(Spin2NumericParser.parseInteger('-123', false)).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Negative value not allowed'));
    });
  });

  describe('parseFloat', () => {
    test('parses all numeric formats as float', () => {
      expect(Spin2NumericParser.parseFloat('123')).toBe(123);
      expect(Spin2NumericParser.parseFloat('1.5')).toBe(1.5);
      expect(Spin2NumericParser.parseFloat('$FF')).toBe(255);
      expect(Spin2NumericParser.parseFloat('1e3')).toBe(1000);
    });
  });

  describe('parseCoordinate', () => {
    test('accepts floats and negatives', () => {
      expect(Spin2NumericParser.parseCoordinate('123')).toBe(123);
      expect(Spin2NumericParser.parseCoordinate('-456')).toBe(-456);
      expect(Spin2NumericParser.parseCoordinate('3.14')).toBe(3.14);
      expect(Spin2NumericParser.parseCoordinate('-2.5e3')).toBe(-2500);
    });

    test('accepts all numeric formats', () => {
      expect(Spin2NumericParser.parseCoordinate('$FF')).toBe(255);
      expect(Spin2NumericParser.parseCoordinate('%1010')).toBe(10);
      expect(Spin2NumericParser.parseCoordinate('%%0123')).toBe(27);
    });
  });

  describe('parsePixel', () => {
    test('accepts positive integers only', () => {
      expect(Spin2NumericParser.parsePixel('0')).toBe(0);
      expect(Spin2NumericParser.parsePixel('100')).toBe(100);
      expect(Spin2NumericParser.parsePixel('1920')).toBe(1920);
      expect(Spin2NumericParser.parsePixel('$FF')).toBe(255);
    });

    test('rejects negative values', () => {
      expect(Spin2NumericParser.parsePixel('-1')).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Negative value not allowed'));
    });

    test('rejects float values', () => {
      expect(Spin2NumericParser.parsePixel('1.5')).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Expected integer but got float'));
    });

    test('caps unreasonably large values', () => {
      expect(Spin2NumericParser.parsePixel('65535')).toBe(65535);
      expect(Spin2NumericParser.parsePixel('100000')).toBe(65535);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Pixel value unreasonably large'));
    });
  });

  describe('parseColor', () => {
    test('accepts RGB color values', () => {
      expect(Spin2NumericParser.parseColor('0')).toBe(0);
      expect(Spin2NumericParser.parseColor('$FF0000')).toBe(16711680);
      expect(Spin2NumericParser.parseColor('$00FF00')).toBe(65280);
      expect(Spin2NumericParser.parseColor('$0000FF')).toBe(255);
      expect(Spin2NumericParser.parseColor('$FFFFFF')).toBe(16777215);
    });

    test('rejects negative values', () => {
      expect(Spin2NumericParser.parseColor('-1')).toBe(null);
    });

    test('caps values exceeding 24-bit range', () => {
      expect(Spin2NumericParser.parseColor('16777216')).toBe(16777215);
      expect(Spin2NumericParser.parseColor('$1FFFFFF')).toBe(16777215);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Color value exceeds 24-bit RGB range'));
    });
  });

  describe('parseCount', () => {
    test('accepts positive integers', () => {
      expect(Spin2NumericParser.parseCount('0')).toBe(0);
      expect(Spin2NumericParser.parseCount('1')).toBe(1);
      expect(Spin2NumericParser.parseCount('1000')).toBe(1000);
      expect(Spin2NumericParser.parseCount('$100')).toBe(256);
    });

    test('rejects negative values', () => {
      expect(Spin2NumericParser.parseCount('-1')).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Negative value not allowed'));
    });

    test('rejects float values', () => {
      expect(Spin2NumericParser.parseCount('1.5')).toBe(null);
    });
  });

  describe('edge cases', () => {
    test('handles empty and whitespace input', () => {
      expect(Spin2NumericParser.parseValue('')).toBe(null);
      expect(Spin2NumericParser.parseValue('  ')).toBe(null);
      expect(Spin2NumericParser.parseValue('\t')).toBe(null);
    });

    test('trims whitespace', () => {
      expect(Spin2NumericParser.parseValue(' 123 ')).toBe(123);
      expect(Spin2NumericParser.parseValue('\t$FF\n')).toBe(255);
    });

    test('handles underscores in all positions', () => {
      expect(Spin2NumericParser.parseValue('1_2_3')).toBe(123);
      // Underscores removed leaves valid number
      expect(Spin2NumericParser.parseValue('_123_')).toBe(123);
      expect(Spin2NumericParser.parseValue('$F_F')).toBe(255);
      expect(Spin2NumericParser.parseValue('%1_0_1_0')).toBe(10);
    });
  });
});