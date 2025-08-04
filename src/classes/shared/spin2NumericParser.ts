/**
 * Spin2 Numeric Parser
 * 
 * Centralized parser for all Spin2 numeric formats. The Spin2 language supports multiple 
 * numeric formats for integer and floating-point values. All numeric values in debug 
 * commands and data streams must be parsed according to these formats.
 * 
 * ## Integer Formats (32-bit resolution)
 * 
 * 1. **Hexadecimal**: `$` prefix followed by hex digits (0-9, A-F, a-f) with optional underscores
 *    - Examples: `$FF`, `$1234_ABCD`, `$00FF_00FF`
 *    - Valid digits: 0-9, A-F, a-f (case-insensitive)
 *    - Underscores allowed for readability
 *    - No negative support (always interpreted as unsigned)
 * 
 * 2. **Decimal**: Optional minus sign followed by decimal digits with optional underscores
 *    - Examples: `123`, `-456`, `1_000_000`, `-2_147_483_648`
 *    - Valid digits: 0-9
 *    - Underscores allowed for readability
 *    - Only format that supports negative numbers
 * 
 * 3. **Binary**: `%` prefix followed by binary digits (0-1) with optional underscores
 *    - Examples: `%1010`, `%1111_0000`, `%1010_1010_1010_1010`
 *    - Valid digits: 0-1
 *    - Underscores allowed for readability
 *    - No negative support
 * 
 * 4. **Quaternary (Double-binary)**: `%%` prefix followed by quaternary digits (0-3) with optional underscores
 *    - Examples: `%%0123`, `%%33_22_11_00`, `%%3210`
 *    - Valid digits: 0-3
 *    - Underscores allowed for readability
 *    - No negative support
 * 
 * ## Floating Point Format (32-bit IEEE 754 single precision)
 * 
 * - Standard decimal notation with decimal point
 * - Scientific notation with `e` or `E` exponent indicator
 * - Examples:
 *   - `-1.0` - Simple decimal
 *   - `1_250_000.0` - With underscores for readability
 *   - `1e9` - Scientific notation (1 × 10⁹)
 *   - `5e-6` - Negative exponent (5 × 10⁻⁶)
 *   - `-1.23456e-7` - Negative value with scientific notation
 * 
 * ## Parsing Requirements
 * 
 * - All numeric formats support underscores (`_`) for visual grouping
 * - Integer values resolve to 32-bit signed integers
 * - Floating point values follow IEEE 754 single precision format
 * - Numeric parsing must be consistent across all debug windows and commands
 * - Invalid numeric formats are handled gracefully with appropriate error messages
 * 
 * ## Context-Aware Methods
 * 
 * The parser provides specialized methods for different contexts:
 * - `parseColor()` - RGB 24-bit values (0-0xFFFFFF)
 * - `parsePixel()` - Screen coordinates (positive integers only)
 * - `parseCoordinate()` - Plot coordinates (floats and negatives allowed)
 * - `parseCount()` - Quantities and counts (positive integers)
 * - `parseInteger()` - General integer parsing with negative control
 * - `parseFloat()` - Accepts all numeric formats as floating point
 * 
 * **Note**: This parser is for command parameters and color values.
 * Packed data streams are handled separately by PackedDataProcessor.
 */

// Import removed - Context will be used when available for logging

export type NumericFormat = 'hex' | 'decimal' | 'binary' | 'quaternary' | 'float' | null;

export class Spin2NumericParser {
  private static readonly INT32_MAX = 2147483647;
  private static readonly INT32_MIN = -2147483648;
  private static readonly UINT32_MAX = 4294967295;

  /**
   * Remove underscores from numeric string
   */
  private static removeUnderscores(value: string): string {
    return value.replace(/_/g, '');
  }

  /**
   * Log parsing error to terminal log
   */
  private static logError(message: string, value: string): void {
    const errorMsg = `Spin2NumericParser: ${message} - value: "${value}"`;
    console.error(errorMsg);
    // TODO: Also log to Context logger when available
  }

  /**
   * Parse hexadecimal format: $FF, $00FF00
   * Case-insensitive, no negative support
   */
  private static parseHex(value: string): number | null {
    const cleaned = this.removeUnderscores(value);
    
    if (!cleaned.startsWith('$')) {
      return null;
    }

    const hexPart = cleaned.substring(1);
    if (!/^[0-9A-Fa-f]+$/.test(hexPart)) {
      this.logError('Invalid hexadecimal format', value);
      return null;
    }

    const parsed = parseInt(hexPart, 16);
    if (isNaN(parsed)) {
      this.logError('Failed to parse hexadecimal', value);
      return null;
    }

    // Check for overflow (treat as unsigned 32-bit)
    if (parsed > this.UINT32_MAX) {
      this.logError('Hexadecimal value exceeds 32-bit range', value);
      return this.UINT32_MAX;
    }

    return parsed;
  }

  /**
   * Parse decimal format: 123, -456, 1_000_000
   * Only format that supports negative numbers
   */
  private static parseDecimal(value: string): number | null {
    const cleaned = this.removeUnderscores(value);
    
    if (!/^-?\d+$/.test(cleaned)) {
      return null;
    }

    const parsed = parseInt(cleaned, 10);
    if (isNaN(parsed)) {
      this.logError('Failed to parse decimal', value);
      return null;
    }

    // Check for overflow/underflow
    if (parsed > this.INT32_MAX) {
      this.logError('Decimal value exceeds INT32_MAX', value);
      return this.INT32_MAX;
    }
    if (parsed < this.INT32_MIN) {
      this.logError('Decimal value below INT32_MIN', value);
      return this.INT32_MIN;
    }

    return parsed;
  }

  /**
   * Parse binary format: %1010, %1111_0000
   * No negative support
   */
  private static parseBinary(value: string): number | null {
    const cleaned = this.removeUnderscores(value);
    
    if (!cleaned.startsWith('%') || cleaned.startsWith('%%')) {
      return null;
    }

    const binaryPart = cleaned.substring(1);
    if (!/^[01]+$/.test(binaryPart)) {
      this.logError('Invalid binary format', value);
      return null;
    }

    const parsed = parseInt(binaryPart, 2);
    if (isNaN(parsed)) {
      this.logError('Failed to parse binary', value);
      return null;
    }

    // Check for overflow (treat as unsigned 32-bit)
    if (parsed > this.UINT32_MAX) {
      this.logError('Binary value exceeds 32-bit range', value);
      return this.UINT32_MAX;
    }

    return parsed;
  }

  /**
   * Parse quaternary format: %%0123, %%33_22_11_00
   * No negative support
   */
  private static parseQuaternary(value: string): number | null {
    const cleaned = this.removeUnderscores(value);
    
    if (!cleaned.startsWith('%%')) {
      return null;
    }

    const quaternaryPart = cleaned.substring(2);
    if (!/^[0-3]+$/.test(quaternaryPart)) {
      this.logError('Invalid quaternary format', value);
      return null;
    }

    const parsed = parseInt(quaternaryPart, 4);
    if (isNaN(parsed)) {
      this.logError('Failed to parse quaternary', value);
      return null;
    }

    // Check for overflow (treat as unsigned 32-bit)
    if (parsed > this.UINT32_MAX) {
      this.logError('Quaternary value exceeds 32-bit range', value);
      return this.UINT32_MAX;
    }

    return parsed;
  }

  /**
   * Parse floating point format: 1.5, -2.3e4, 5e-6
   * Supports scientific notation
   */
  private static parseScientific(value: string): number | null {
    const cleaned = this.removeUnderscores(value);
    
    // Check if it looks like a float (has decimal point or e/E)
    if (!cleaned.includes('.') && !cleaned.toLowerCase().includes('e')) {
      return null;
    }

    // Validate float format
    if (!/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(cleaned)) {
      return null;
    }

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      this.logError('Failed to parse float', value);
      return null;
    }

    // JavaScript parseFloat returns Infinity for overflow
    if (!isFinite(parsed)) {
      this.logError('Float value exceeds range', value);
      return parsed > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
    }

    return parsed;
  }

  /**
   * Detect the numeric format type
   */
  public static getNumericType(value: string): NumericFormat {
    if (!value || value.trim() === '') {
      return null;
    }

    const trimmed = value.trim();
    const cleaned = this.removeUnderscores(trimmed);

    // Check format prefixes first
    if (cleaned.startsWith('$')) {
      // Must have at least one hex digit after $
      if (cleaned.length > 1 && /^[0-9A-Fa-f]+$/.test(cleaned.substring(1))) {
        return 'hex';
      }
    } else if (cleaned.startsWith('%%')) {
      // Must have at least one quaternary digit after %%
      if (cleaned.length > 2 && /^[0-3]+$/.test(cleaned.substring(2))) {
        return 'quaternary';
      }
    } else if (cleaned.startsWith('%')) {
      // Must have at least one binary digit after %
      if (cleaned.length > 1 && /^[01]+$/.test(cleaned.substring(1))) {
        return 'binary';
      }
    } else if (cleaned.includes('.') || cleaned.toLowerCase().includes('e')) {
      // Check if it's a valid float format
      if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(cleaned)) {
        return 'float';
      }
    } else if (/^-?\d+$/.test(cleaned)) {
      return 'decimal';
    }

    return null;
  }

  /**
   * Check if string is a valid Spin2 numeric format
   */
  public static isNumeric(value: string): boolean {
    return this.getNumericType(value) !== null;
  }

  /**
   * Parse any numeric value (integer or float)
   */
  public static parseValue(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }

    const trimmed = value.trim();
    const format = this.getNumericType(trimmed);

    switch (format) {
      case 'hex':
        return this.parseHex(trimmed);
      case 'decimal':
        // Try float first if it contains decimal point or e
        const floatResult = this.parseScientific(trimmed);
        return floatResult !== null ? floatResult : this.parseDecimal(trimmed);
      case 'binary':
        return this.parseBinary(trimmed);
      case 'quaternary':
        return this.parseQuaternary(trimmed);
      case 'float':
        return this.parseScientific(trimmed);
      default:
        this.logError('Unknown numeric format', value);
        return null;
    }
  }

  /**
   * Parse integer value only (no floats)
   */
  public static parseInteger(value: string, allowNegative: boolean = true): number | null {
    const result = this.parseValue(value);
    if (result === null) {
      return null;
    }

    // Check if it was a float (1e3 = 1000 is still considered integer)
    if (!Number.isInteger(result)) {
      this.logError('Expected integer but got float', value);
      return null;
    }

    // Check negative constraint
    if (!allowNegative && result < 0) {
      this.logError('Negative value not allowed', value);
      return null;
    }

    return result;
  }

  /**
   * Parse floating point value
   */
  public static parseFloat(value: string): number | null {
    return this.parseValue(value);
  }

  /**
   * Parse coordinate value (float OK, negatives OK)
   * Used for plot coordinates, positions, etc.
   */
  public static parseCoordinate(value: string): number | null {
    return this.parseValue(value);
  }

  /**
   * Parse pixel coordinate (integer only, no negatives)
   * Used for screen positions, dimensions
   */
  public static parsePixel(value: string): number | null {
    const result = this.parseInteger(value, false);
    if (result === null) {
      return null;
    }

    // Additional validation for reasonable pixel values
    if (result > 65535) {
      this.logError('Pixel value unreasonably large', value);
      return 65535;
    }

    return result;
  }

  /**
   * Parse color value (integer only, 0-0xFFFFFF range)
   * Used for RGB color values
   */
  public static parseColor(value: string): number | null {
    const result = this.parseInteger(value, false);
    if (result === null) {
      return null;
    }

    if (result > 0xFFFFFF) {
      this.logError('Color value exceeds 24-bit RGB range', value);
      return 0xFFFFFF; // Cap at max RGB value
    }

    return result;
  }

  /**
   * Parse count/quantity value (integer only, positive)
   * Used for counts, sizes, quantities
   */
  public static parseCount(value: string): number | null {
    return this.parseInteger(value, false);
  }
}