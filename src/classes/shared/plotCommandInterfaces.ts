/** @format */

/**
 * TypeScript interfaces for the new PLOT command parser architecture
 * Eliminates lookahead parsing by providing deterministic token-based parsing
 */

import { Context } from '../../utils/context';

// Token types for deterministic parsing
export enum PlotTokenType {
  COMMAND = 'COMMAND',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  DELIMITER = 'DELIMITER',
  EOF = 'EOF',
  UNKNOWN = 'UNKNOWN'
}

// Individual token from command string
export interface PlotToken {
  type: PlotTokenType;
  value: string;
  originalText: string; // For error reporting
  position: number; // Character position in original string
}

// Parsed numeric value with validation state
export interface ParsedNumber {
  value: number;
  isValid: boolean;
  originalText: string;
}

// Result of parsing a complete command
export interface ParsedCommand {
  command: string;
  parameters: PlotToken[];
  isValid: boolean;
  errors: string[];
  warnings: string[];
  originalText: string;
}

// Command execution context passed to handlers
export interface CommandContext {
  tokens: PlotToken[];
  debugLogger?: any; // DebugLoggerWindow instance
  originalCommand: string;
}

// Result of command execution
export interface CommandResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  canvasOperations: CanvasOperation[];
}


// Canvas operation to be executed
export interface CanvasOperation {
  type: 'DRAW_DOT' | 'DRAW_LINE' | 'DRAW_CIRCLE' | 'DRAW_BOX' | 'DRAW_OVAL' | 'DRAW_TEXT' | 'SET_CURSOR' | 'CLEAR' | 'UPDATE';
  parameters: Record<string, any>;
}

// Command handler function signature
export type CommandHandler = (context: CommandContext) => CommandResult;

// Tokenizer interface for pluggable tokenization strategies
export interface PlotTokenizer {
  tokenize(input: string): PlotToken[];
  validateTokenSequence(tokens: PlotToken[]): boolean;
}

// Main parser interface
export interface PlotCommandParser {
  parse(message: string): ParsedCommand[];
  executeCommands(commands: ParsedCommand[]): CommandResult[];
  registerCommand(name: string, handler: CommandHandler): void;
  unregisterCommand(name: string): boolean;
}

// Configuration for parser behavior
export interface ParserConfig {
  enableLogging: boolean;
  strictValidation: boolean;
  errorRecovery: boolean;
  debugMode: boolean;
}

// Error recovery strategies
export enum ErrorRecoveryStrategy {
  SKIP_COMMAND = 'SKIP_COMMAND',
  USE_DEFAULTS = 'USE_DEFAULTS',
  PARTIAL_EXECUTION = 'PARTIAL_EXECUTION',
  STOP_PARSING = 'STOP_PARSING'
}

// Parsing error with context
export interface ParseError {
  type: 'TOKENIZATION' | 'COMMAND_NOT_FOUND' | 'INVALID_PARAMETERS' | 'MISSING_PARAMETERS';
  message: string;
  position: number;
  originalText: string;
  recoveryStrategy: ErrorRecoveryStrategy;
}

// Parameter validation result
export interface ParameterValidation {
  isValid: boolean;
  convertedValue?: any;
  errorMessage?: string;
  usedDefault?: boolean;
  defaultValue?: any;
}