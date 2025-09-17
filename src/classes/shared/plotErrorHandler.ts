/** @format */

/**
 * Error Handling and Recovery System for PLOT Parser
 * Integrates with existing debug logger for comprehensive error reporting
 */

import { ParseError, ErrorRecoveryStrategy, CommandResult, ParsedCommand } from './plotCommandInterfaces';

// Error severity levels
export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Structured error for logging
export interface PlotError {
  severity: ErrorSeverity;
  type: string;
  message: string;
  command: string;
  position?: number;
  originalText: string;
  timestamp: Date;
  recoveryApplied?: ErrorRecoveryStrategy;
  suggestion?: string;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  logToConsole: boolean;
  logToDebugLogger: boolean;
  enableRecovery: boolean;
  maxErrorsPerCommand: number;
  stopOnCriticalError: boolean;
}

export class PlotErrorHandler {
  private errors: PlotError[] = [];
  private debugLogger: any = null; // DebugLoggerWindow instance
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      logToConsole: true,
      logToDebugLogger: true,
      enableRecovery: true,
      maxErrorsPerCommand: 5,
      stopOnCriticalError: true,
      ...config
    };
  }

  /**
   * Initialize debug logger integration
   */
  initializeDebugLogger(context: any): void {
    try {
      const DebugLoggerWindow = require('../debugLoggerWin').DebugLoggerWindow;
      this.debugLogger = DebugLoggerWindow.getInstance(context);
    } catch (error) {
      console.warn('Failed to initialize debug logger for PLOT parser:', error);
    }
  }

  /**
   * Log a parsing error with context
   */
  logError(error: PlotError): void {
    this.errors.push(error);

    // Format error message for logging
    const formattedMessage = this.formatErrorMessage(error);

    // Log to console if enabled
    if (this.config.logToConsole) {
      switch (error.severity) {
        case ErrorSeverity.INFO:
          console.info(formattedMessage);
          break;
        case ErrorSeverity.WARNING:
          console.warn(formattedMessage);
          break;
        case ErrorSeverity.ERROR:
        case ErrorSeverity.CRITICAL:
          console.error(formattedMessage);
          break;
      }
    }

    // Log to debug logger if available and enabled
    if (this.config.logToDebugLogger && this.debugLogger) {
      try {
        this.debugLogger.logSystemMessage(formattedMessage);
      } catch (logError) {
        console.warn('Failed to log to debug logger:', logError);
      }
    }
  }

  /**
   * Format error message for consistent display
   */
  private formatErrorMessage(error: PlotError): string {
    const prefix = `[PLOT PARSE ${error.severity}]`;
    let message = `${prefix} ${error.message}`;

    if (error.command) {
      message += ` in command: ${error.command}`;
    }

    if (error.position !== undefined) {
      message += ` at position ${error.position}`;
    }

    if (error.recoveryApplied) {
      message += ` (Recovery: ${error.recoveryApplied})`;
    }

    if (error.suggestion) {
      message += ` → ${error.suggestion}`;
    }

    return message;
  }

  /**
   * Create error for unrecognized command
   */
  createUnrecognizedCommandError(command: string, originalText: string): PlotError {
    return {
      severity: ErrorSeverity.ERROR,
      type: 'UNRECOGNIZED_COMMAND',
      message: `Unrecognized command: ${command}`,
      command: command,
      originalText: originalText,
      timestamp: new Date(),
      suggestion: 'Check spelling or see available commands with HELP'
    };
  }

  /**
   * Create error for invalid parameter
   */
  createInvalidParameterError(
    command: string,
    paramName: string,
    value: string,
    expectedType: string,
    defaultUsed?: any
  ): PlotError {
    const message = defaultUsed !== undefined
      ? `Invalid parameter '${value}' for ${paramName}, using default: ${defaultUsed}`
      : `Invalid parameter '${value}' for ${paramName}, expected ${expectedType}`;

    return {
      severity: defaultUsed !== undefined ? ErrorSeverity.WARNING : ErrorSeverity.ERROR,
      type: 'INVALID_PARAMETER',
      message: message,
      command: command,
      originalText: value,
      timestamp: new Date(),
      recoveryApplied: defaultUsed !== undefined ? ErrorRecoveryStrategy.USE_DEFAULTS : undefined,
      suggestion: `Expected ${expectedType} value for ${paramName}`
    };
  }

  /**
   * Create error for missing required parameters
   */
  createMissingParameterError(command: string, missingParams: string[]): PlotError {
    return {
      severity: ErrorSeverity.ERROR,
      type: 'MISSING_PARAMETERS',
      message: `Missing required parameters: ${missingParams.join(', ')}`,
      command: command,
      originalText: command,
      timestamp: new Date(),
      suggestion: `Command ${command} requires: ${missingParams.join(', ')}`
    };
  }

  /**
   * Create error for tokenization failure
   */
  createTokenizationError(input: string, position: number, reason: string): PlotError {
    return {
      severity: ErrorSeverity.ERROR,
      type: 'TOKENIZATION_ERROR',
      message: `Failed to parse input: ${reason}`,
      command: 'TOKENIZER',
      position: position,
      originalText: input,
      timestamp: new Date(),
      suggestion: 'Check for unmatched quotes or invalid characters'
    };
  }

  /**
   * Apply error recovery strategy
   */
  applyRecovery(error: PlotError, strategy: ErrorRecoveryStrategy): CommandResult {
    const result: CommandResult = {
      success: false,
      errors: [error.message],
      warnings: [],
      canvasOperations: []
    };

    switch (strategy) {
      case ErrorRecoveryStrategy.SKIP_COMMAND:
        result.warnings.push(`Skipped command due to error: ${error.message}`);
        result.success = true; // Allow parsing to continue
        break;

      case ErrorRecoveryStrategy.USE_DEFAULTS:
        result.warnings.push(`Used default values due to error: ${error.message}`);
        result.success = true;
        break;

      case ErrorRecoveryStrategy.PARTIAL_EXECUTION:
        result.warnings.push(`Partial execution due to error: ${error.message}`);
        result.success = true;
        break;

      case ErrorRecoveryStrategy.STOP_PARSING:
        result.errors.push(`Stopping parser due to critical error: ${error.message}`);
        result.success = false;
        break;
    }

    // Log the recovery action
    error.recoveryApplied = strategy;
    this.logError(error);

    return result;
  }

  /**
   * Determine appropriate recovery strategy for error
   */
  getRecoveryStrategy(error: PlotError): ErrorRecoveryStrategy {
    if (!this.config.enableRecovery) {
      return ErrorRecoveryStrategy.STOP_PARSING;
    }

    switch (error.type) {
      case 'UNRECOGNIZED_COMMAND':
        return ErrorRecoveryStrategy.SKIP_COMMAND;

      case 'INVALID_PARAMETER':
        // Use defaults if we have reasonable defaults
        return error.severity === ErrorSeverity.WARNING
          ? ErrorRecoveryStrategy.USE_DEFAULTS
          : ErrorRecoveryStrategy.SKIP_COMMAND;

      case 'MISSING_PARAMETERS':
        return ErrorRecoveryStrategy.USE_DEFAULTS;

      case 'TOKENIZATION_ERROR':
        return error.severity === ErrorSeverity.CRITICAL
          ? ErrorRecoveryStrategy.STOP_PARSING
          : ErrorRecoveryStrategy.SKIP_COMMAND;

      default:
        return error.severity === ErrorSeverity.CRITICAL
          ? ErrorRecoveryStrategy.STOP_PARSING
          : ErrorRecoveryStrategy.SKIP_COMMAND;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { total: number; byType: Record<string, number>; bySeverity: Record<string, number> } {
    const stats = {
      total: this.errors.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };

    for (const error of this.errors) {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get recent errors
   */
  getRecentErrors(maxAge: number = 60000): PlotError[] {
    const cutoff = new Date(Date.now() - maxAge);
    return this.errors.filter(error => error.timestamp > cutoff);
  }
}

// Utility functions for common error scenarios
export class ErrorUtils {
  /**
   * Create suggestion for command typos
   */
  static suggestCommand(input: string, availableCommands: string[]): string | undefined {
    const inputLower = input.toLowerCase();

    // Simple Levenshtein distance for suggestions
    for (const command of availableCommands) {
      if (this.levenshteinDistance(inputLower, command.toLowerCase()) <= 2) {
        return command;
      }
    }

    return undefined;
  }

  /**
   * Calculate Levenshtein distance for typo detection
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Format parameter range error message
   */
  static formatRangeError(value: number, min: number, max: number, clamped: number): string {
    return `Value ${value} out of range [${min}, ${max}], clamped to ${clamped}`;
  }

  /**
   * Extract context around error position
   */
  static getErrorContext(text: string, position: number, contextLength: number = 20): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    const context = text.slice(start, end);
    const relativePos = position - start;

    return context.slice(0, relativePos) + '→' + context.slice(relativePos);
  }
}