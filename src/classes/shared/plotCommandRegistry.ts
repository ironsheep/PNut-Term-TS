/** @format */

/**
 * Command Registration System for PLOT Parser
 * Provides deterministic command registration without lookahead parsing
 */

import { CommandHandler, CommandContext, CommandResult, ParameterValidation } from './plotCommandInterfaces';

// Parameter definition for command validation
export interface ParameterDefinition {
  name: string;
  type: 'number' | 'string' | 'coordinate' | 'color' | 'boolean' | 'count';
  required: boolean;
  defaultValue?: any;
  range?: { min: number; max: number };
  validator?: (value: any) => ParameterValidation;
}

// Command definition for registration
export interface CommandDefinition {
  name: string;
  parameters: ParameterDefinition[];
  description: string;
  examples: string[];
  handler: CommandHandler;
  aliases?: string[];
}

// Command registry class
export class PlotCommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>(); // alias -> command name

  /**
   * Register a command with its definition
   */
  registerCommand(definition: CommandDefinition): void {
    const upperName = definition.name.toUpperCase();

    // Register main command
    this.commands.set(upperName, definition);

    // Register aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliases.set(alias.toUpperCase(), definition.name.toUpperCase());
      }
    }
  }

  /**
   * Get command definition by name or alias
   */
  getCommand(name: string): CommandDefinition | undefined {
    const upperName = name.toUpperCase();

    // Check direct command name
    if (this.commands.has(upperName)) {
      return this.commands.get(upperName);
    }

    // Check aliases
    if (this.aliases.has(upperName)) {
      const realName = this.aliases.get(upperName)!;
      return this.commands.get(realName);
    }

    return undefined;
  }

  /**
   * Check if command exists
   */
  hasCommand(name: string): boolean {
    return this.getCommand(name) !== undefined;
  }

  /**
   * Get all registered command names
   */
  getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Validate parameters against command definition
   */
  validateParameters(commandName: string, parameters: any[]): ParameterValidation[] {
    const definition = this.getCommand(commandName);
    if (!definition) {
      return [{ isValid: false, errorMessage: `Unknown command: ${commandName}` }];
    }

    const results: ParameterValidation[] = [];
    const paramDefs = definition.parameters;

    // Check required parameters
    const requiredCount = paramDefs.filter(p => p.required).length;
    if (parameters.length < requiredCount) {
      results.push({
        isValid: false,
        errorMessage: `Missing required parameters. Expected at least ${requiredCount}, got ${parameters.length}`
      });
      return results;
    }

    // Smart parameter assignment for commands with optional leading parameters
    const assignments = this.assignParameters(paramDefs, parameters);

    // Validate each parameter definition
    for (let i = 0; i < paramDefs.length; i++) {
      const paramDef = paramDefs[i];
      const value = assignments[i];

      if (value === undefined || value === null) {
        if (paramDef.required) {
          // Special case for TEXT command text parameter
          if (paramDef.name === 'text') {
            results.push({
              isValid: false,
              errorMessage: 'TEXT command requires text string parameter'
            });
          } else {
            results.push({
              isValid: false,
              errorMessage: `Missing required parameter '${paramDef.name}'`
            });
          }
        } else {
          // Use default value
          results.push({
            isValid: true,
            convertedValue: paramDef.defaultValue,
            usedDefault: true,
            defaultValue: paramDef.defaultValue
          });
        }
        continue;
      }

      // Type-specific validation
      const validation = this.validateParameterType(value, paramDef);
      results.push(validation);
    }

    return results;
  }

  /**
   * Smart parameter assignment that handles optional leading parameters
   * For TEXT command: detect when parameters should be treated as text vs numeric
   */
  private assignParameters(paramDefs: ParameterDefinition[], parameters: any[]): any[] {
    const assignments: any[] = new Array(paramDefs.length);

    // Special case for TEXT command with mixed optional/required parameters
    if (paramDefs.length >= 2 && paramDefs[paramDefs.length - 1].required && paramDefs[paramDefs.length - 1].type === 'string') {

      // If we have exactly 1 parameter and it's a string that looks like text content
      if (parameters.length === 1) {
        const param = parameters[0];
        if (typeof param === 'string' && this.looksLikeTextContent(param)) {
          // Assign directly to the text parameter (last position)
          assignments[paramDefs.length - 1] = param;
          return assignments;
        }
      }

      // Check if we have exactly the number of optional parameters but no text parameter
      // For TEXT command: 3 optional params (size, style, angle) + 1 required text = 4 total
      const optionalCount = paramDefs.filter(p => !p.required).length;
      if (parameters.length === optionalCount) {
        // Check if any parameter looks like text content
        let hasTextLikeParam = false;
        for (let i = 0; i < parameters.length; i++) {
          const param = parameters[i];
          if (typeof param === 'string' && this.looksLikeTextContent(param)) {
            hasTextLikeParam = true;
            // Assign this parameter to the text position
            assignments[paramDefs.length - 1] = param;

            // Assign remaining parameters to their positions (skipping the text one)
            let assignmentIndex = 0;
            for (let j = 0; j < parameters.length; j++) {
              if (j !== i) { // Skip the parameter we assigned to text
                assignments[assignmentIndex] = parameters[j];
                assignmentIndex++;
              }
            }
            return assignments;
          }
        }

        // If we reach here, all parameters are numeric/non-text, which means missing required text
        // Use default positional assignment, which will leave text parameter undefined and trigger validation error
        for (let i = 0; i < parameters.length && i < paramDefs.length; i++) {
          assignments[i] = parameters[i];
        }
        return assignments;
      }

      // If we have fewer parameters than definitions, check if any string params should be text
      if (parameters.length < paramDefs.length) {
        // Look for the best parameter that looks like text content
        // Prioritize: 1) Contains spaces, 2) Starts with letter, 3) Any text-like content
        let bestTextIndex = -1;
        let bestTextScore = 0;

        for (let i = 0; i < parameters.length; i++) {
          const param = parameters[i];
          if (typeof param === 'string' && this.looksLikeTextContent(param)) {
            let score = 1; // Base score for looking like text

            // Higher score for containing spaces (more obviously text)
            if (param.includes(' ')) {
              score += 3;
            }

            // Higher score for being longer (more likely to be descriptive text)
            if (param.length > 3) {
              score += 1;
            }

            // Lower score for being very short or single letter (more likely to be a parameter)
            if (param.length <= 3 && /^[a-zA-Z]+$/.test(param)) {
              score -= 2;
            }

            if (score > bestTextScore) {
              bestTextScore = score;
              bestTextIndex = i;
            }
          }
        }

        if (bestTextIndex >= 0) {
          // Assign the best text parameter to the text position
          assignments[paramDefs.length - 1] = parameters[bestTextIndex];

          // Assign remaining parameters to their positions (skipping the text one)
          let assignmentIndex = 0;
          for (let j = 0; j < parameters.length; j++) {
            if (j !== bestTextIndex) { // Skip the parameter we assigned to text
              assignments[assignmentIndex] = parameters[j];
              assignmentIndex++;
            }
          }
          return assignments;
        }
      }
    }

    // Default positional assignment
    for (let i = 0; i < parameters.length && i < paramDefs.length; i++) {
      assignments[i] = parameters[i];
    }

    return assignments;
  }

  /**
   * Determine if a string parameter looks like text content rather than a numeric value
   */
  private looksLikeTextContent(param: string): boolean {
    // Empty string is always text content for TEXT command
    if (param === '') {
      return true;
    }

    // If it contains spaces, it's definitely text content
    if (param.includes(' ')) {
      return true;
    }

    // If it starts with a letter, it's likely text content
    if (/^[a-zA-Z]/.test(param)) {
      return true;
    }

    // If it contains non-numeric characters that aren't valid in any numeric format
    if (/[^0-9$%\.eE\+\-_ABCDEFabcdef]/.test(param)) {
      return true;
    }

    // SPECIAL CASE: For very short strings (1-3 chars), be more inclusive
    // Single digit strings like "0", "1", "7" are often text labels in hardware displays
    if (param.length <= 3) {
      return true;
    }

    // If it's purely numeric and longer, it's probably meant as a number
    return false;
  }

  /**
   * Validate a single parameter against its definition
   */
  private validateParameterType(value: any, paramDef: ParameterDefinition): ParameterValidation {
    // Use custom validator if provided
    if (paramDef.validator) {
      return paramDef.validator(value);
    }

    // Built-in type validation
    switch (paramDef.type) {
      case 'number':
      case 'coordinate':
      case 'count':
        return this.validateNumber(value, paramDef);

      case 'string':
        return this.validateString(value, paramDef);

      case 'color':
        return this.validateColor(value, paramDef);

      case 'boolean':
        return this.validateBoolean(value, paramDef);

      default:
        return {
          isValid: false,
          errorMessage: `Unknown parameter type: ${paramDef.type}`
        };
    }
  }

  private validateNumber(value: any, paramDef: ParameterDefinition): ParameterValidation {
    let num: number;

    if (typeof value === 'number') {
      num = value;
    } else {
      // Use Spin2NumericParser for proper format support
      const { Spin2NumericParser } = require('./spin2NumericParser');
      const parsed = Spin2NumericParser.parseValue(String(value));
      if (parsed === null) {
        // If parsing fails but we have a default value, use it with a warning
        if (!paramDef.required && paramDef.defaultValue !== undefined) {
          // Special message format for TEXT command size parameter
          let warningMessage;
          if (paramDef.name === 'size') {
            warningMessage = `Invalid text size '${value}', using default: ${paramDef.defaultValue}`;
          } else {
            warningMessage = `Invalid ${paramDef.name}: ${value}, using default: ${paramDef.defaultValue}`;
          }
          return {
            isValid: true,
            convertedValue: paramDef.defaultValue,
            errorMessage: warningMessage
          };
        }
        return {
          isValid: false,
          errorMessage: `Invalid number: ${value}`
        };
      }
      num = parsed;
    }

    // Range validation
    if (paramDef.range) {
      if (num < paramDef.range.min || num > paramDef.range.max) {
        // Clamp to range rather than error
        const clamped = Math.max(paramDef.range.min, Math.min(paramDef.range.max, num));
        return {
          isValid: true,
          convertedValue: clamped,
          errorMessage: `Value ${num} clamped to range [${paramDef.range.min}, ${paramDef.range.max}] -> ${clamped}`
        };
      }
    }

    return {
      isValid: true,
      convertedValue: num
    };
  }

  private validateString(value: any, paramDef: ParameterDefinition): ParameterValidation {
    const str = String(value);
    return {
      isValid: true,
      convertedValue: str
    };
  }

  private validateColor(value: any, paramDef: ParameterDefinition): ParameterValidation {
    // Basic color validation - can be enhanced
    const str = String(value).toUpperCase();
    const colorNames = ['BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'CYAN', 'MAGENTA', 'YELLOW', 'ORANGE', 'GRAY'];

    if (colorNames.includes(str)) {
      return {
        isValid: true,
        convertedValue: str
      };
    }

    // Check hex format
    if (str.match(/^(\$|0X)[0-9A-F]{6}$/)) {
      return {
        isValid: true,
        convertedValue: str
      };
    }

    return {
      isValid: false,
      errorMessage: `Invalid color: ${value}`
    };
  }

  private validateBoolean(value: any, paramDef: ParameterDefinition): ParameterValidation {
    if (typeof value === 'boolean') {
      return {
        isValid: true,
        convertedValue: value
      };
    }

    const str = String(value).toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(str)) {
      return {
        isValid: true,
        convertedValue: true
      };
    }

    if (['false', '0', 'no', 'off'].includes(str)) {
      return {
        isValid: true,
        convertedValue: false
      };
    }

    return {
      isValid: false,
      errorMessage: `Invalid boolean: ${value}`
    };
  }
}

// Token type classification with regex patterns
export class TokenClassifier {
  private static readonly patterns = {
    // Numbers: decimal, hex with $ or 0x prefix, negative numbers
    NUMBER: /^-?(\d+(\.\d*)?|\$[0-9A-Fa-f]+|0[xX][0-9A-Fa-f]+)$/,

    // Strings: single or double quoted
    STRING: /^(['"])(.*?)\1$/,

    // Commands: alphabetic, possibly with underscores
    COMMAND: /^[A-Za-z][A-Za-z0-9_]*$/,

    // Delimiters: comma, space, tab
    DELIMITER: /^[,\s\t]+$/
  };

  static classifyToken(value: string): 'NUMBER' | 'STRING' | 'COMMAND' | 'DELIMITER' | 'UNKNOWN' {
    if (this.patterns.NUMBER.test(value)) {
      return 'NUMBER';
    }

    if (this.patterns.STRING.test(value)) {
      return 'STRING';
    }

    if (this.patterns.COMMAND.test(value)) {
      return 'COMMAND';
    }

    if (this.patterns.DELIMITER.test(value)) {
      return 'DELIMITER';
    }

    return 'UNKNOWN';
  }

  static extractStringContent(quotedString: string): string {
    const match = quotedString.match(this.patterns.STRING);
    return match ? match[2] : quotedString;
  }

  static parseNumber(numberString: string): number | null {
    if (!this.patterns.NUMBER.test(numberString)) {
      return null;
    }

    // Handle hex numbers
    if (numberString.startsWith('$')) {
      return parseInt(numberString.substring(1), 16);
    }

    if (numberString.toLowerCase().startsWith('0x')) {
      return parseInt(numberString, 16);
    }

    // Handle decimal numbers
    const num = parseFloat(numberString);
    return isNaN(num) ? null : num;
  }
}