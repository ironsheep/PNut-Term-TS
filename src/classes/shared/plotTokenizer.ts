/** @format */

/**
 * PlotTokenizer - Deterministic tokenization for PLOT commands
 * Eliminates all lookahead parsing by providing clear token boundaries
 */

import { PlotToken, PlotTokenType, PlotTokenizer as IPlotTokenizer } from './plotCommandInterfaces';
import { Spin2NumericParser } from './spin2NumericParser';

export class PlotTokenizer implements IPlotTokenizer {
  private input: string = '';
  private position: number = 0;
  private tokens: PlotToken[] = [];
  private currentChar: string = '';

  constructor() {
    // Initialize tokenizer
  }

  /**
   * Tokenize input string into structured tokens
   */
  tokenize(input: string): PlotToken[] {
    this.input = input.trim();
    this.position = 0;
    this.tokens = [];
    this.currentChar = this.input.length > 0 ? this.input[0] : '';

    // Skip leading whitespace
    this.skipWhitespace();

    // Process tokens until end of input
    while (this.position < this.input.length) {
      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
      this.skipWhitespace();
    }

    // Add EOF token
    this.tokens.push({
      type: PlotTokenType.EOF,
      value: '',
      originalText: '',
      position: this.position
    });

    return this.tokens;
  }

  /**
   * Validate that token sequence is well-formed
   */
  validateTokenSequence(tokens: PlotToken[]): boolean {
    if (tokens.length === 0) {
      return false;
    }

    // First token should be a command
    if (tokens[0].type !== PlotTokenType.COMMAND) {
      return false;
    }

    // Should end with EOF
    const lastToken = tokens[tokens.length - 1];
    if (lastToken.type !== PlotTokenType.EOF) {
      return false;
    }

    // STRING tokens are self-contained (already quoted), no need to check for balance
    // Each STRING token represents a complete quoted string from the tokenizer

    // Ensure we have at least one command token
    const hasCommand = tokens.some(token => token.type === PlotTokenType.COMMAND);
    if (!hasCommand) {
      return false;
    }

    return true;
  }

  /**
   * Get next token from input stream
   */
  private nextToken(): PlotToken | null {
    if (this.position >= this.input.length) {
      return null;
    }

    const startPos = this.position;
    const char = this.currentChar;

    // Handle quoted strings (single or double quotes)
    if (char === "'" || char === '"') {
      return this.tokenizeString(char, startPos);
    }

    // Handle numbers (including hex with $ or 0x prefix)
    if (this.isNumberStart(char)) {
      return this.tokenizeNumber(startPos);
    }

    // Handle commands/identifiers
    if (this.isAlpha(char)) {
      return this.tokenizeCommand(startPos);
    }

    // Handle delimiters
    if (this.isDelimiter(char)) {
      return this.tokenizeDelimiter(startPos);
    }

    // Handle special characters as single-character tokens
    const singleChar = this.advance();
    return {
      type: PlotTokenType.UNKNOWN,
      value: singleChar,
      originalText: singleChar,
      position: startPos
    };
  }

  /**
   * Check if character can start a Spin2 number
   */
  private isNumberStart(char: string): boolean {
    // Regular numbers: 0-9, negative sign
    if (char >= '0' && char <= '9' || char === '-') {
      return true;
    }

    // Hex numbers: $ prefix
    if (char === '$') {
      return true;
    }

    // Binary numbers: % prefix
    if (char === '%') {
      return true;
    }

    return false;
  }

  /**
   * Check if character is alphabetic
   */
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  /**
   * Check if character is alphanumeric
   */
  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || (char >= '0' && char <= '9');
  }

  /**
   * Check if character is a delimiter (separates tokens but is preserved)
   */
  private isDelimiter(char: string): boolean {
    return char === ',' || char === '\t';
  }

  /**
   * Check if character is whitespace (separates tokens but is consumed)
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\n' || char === '\r';
  }

  /**
   * Skip whitespace characters
   */
  private skipWhitespace(): void {
    while (this.position < this.input.length && this.isWhitespace(this.currentChar)) {
      this.advance();
    }
  }

  /**
   * Advance position and update current character
   */
  private advance(): string {
    const char = this.currentChar;
    this.position++;
    this.currentChar = this.position < this.input.length ? this.input[this.position] : '';
    return char;
  }

  /**
   * Peek at next character without advancing
   */
  private peek(offset: number = 1): string {
    const peekPos = this.position + offset;
    return peekPos < this.input.length ? this.input[peekPos] : '';
  }

  /**
   * Tokenize quoted string
   */
  private tokenizeString(quote: string, startPos: number): PlotToken {
    let value = '';
    let originalText = '';

    // Consume opening quote
    originalText += this.advance();

    // Consume characters until closing quote or end of input
    while (this.position < this.input.length && this.currentChar !== quote) {
      const char = this.advance();
      value += char;
      originalText += char;
    }

    // Consume closing quote if present
    if (this.position < this.input.length && this.currentChar === quote) {
      originalText += this.advance();
    }

    return {
      type: PlotTokenType.STRING,
      value: value, // Content without quotes
      originalText: originalText, // With quotes for error reporting
      position: startPos
    };
  }

  /**
   * Tokenize Spin2 numeric value using the shared parser for format detection
   */
  private tokenizeNumber(startPos: number): PlotToken {
    let originalText = '';

    // Collect characters that could be part of a Spin2 number
    while (this.position < this.input.length) {
      const char = this.currentChar;

      // Check if this character could be part of a number
      if (this.isDigit(char) || this.isHexDigit(char) ||
          char === '-' || char === '$' || char === '%' ||
          char === '.' || char === 'e' || char === 'E' ||
          char === '+' || char === '_') {
        originalText += this.advance();
      } else {
        break;
      }
    }

    // Use Spin2NumericParser to validate the format
    const isValid = Spin2NumericParser.isNumeric(originalText);

    return {
      type: isValid ? PlotTokenType.NUMBER : PlotTokenType.UNKNOWN,
      value: originalText,
      originalText: originalText,
      position: startPos
    };
  }

  /**
   * Tokenize command/identifier
   */
  private tokenizeCommand(startPos: number): PlotToken {
    let value = '';
    let originalText = '';

    // Consume alphanumeric characters and underscores
    while (this.position < this.input.length && this.isAlphaNumeric(this.currentChar)) {
      const char = this.advance();
      value += char;
      originalText += char;
    }

    return {
      type: PlotTokenType.COMMAND,
      value: value.toUpperCase(), // Normalize to uppercase
      originalText: originalText,
      position: startPos
    };
  }

  /**
   * Tokenize delimiter
   */
  private tokenizeDelimiter(startPos: number): PlotToken {
    let value = '';
    let originalText = '';

    // Consume contiguous delimiter characters
    while (this.position < this.input.length && this.isDelimiter(this.currentChar)) {
      const char = this.advance();
      value += char;
      originalText += char;
    }

    return {
      type: PlotTokenType.DELIMITER,
      value: value,
      originalText: originalText,
      position: startPos
    };
  }

  /**
   * Check if character is a digit
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Check if character is a hex digit
   */
  private isHexDigit(char: string): boolean {
    return this.isDigit(char) ||
           (char >= 'a' && char <= 'f') ||
           (char >= 'A' && char <= 'F');
  }
}