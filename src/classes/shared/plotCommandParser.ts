/** @format */

/**
 * PlotCommandParser - Main parser implementation for PLOT commands
 * Eliminates all lookahead parsing using deterministic tokenization and command registry
 */

import { Context } from '../../utils/context';
import {
  PlotCommandParser as IPlotCommandParser,
  ParsedCommand,
  CommandResult,
  CommandHandler,
  CommandContext,
  CanvasOperation,
  PlotTokenType
} from './plotCommandInterfaces';
import { PlotTokenizer } from './plotTokenizer';
import { PlotCommandRegistry, CommandDefinition } from './plotCommandRegistry';
import { PlotErrorHandler, ErrorSeverity } from './plotErrorHandler';
import { Spin2NumericParser } from './spin2NumericParser';
import { CanvasOperationType, PlotCanvasOperation, PlotOperationFactory } from './plotParserIntegration';

export class PlotCommandParser implements IPlotCommandParser {
  private tokenizer: PlotTokenizer;
  private registry: PlotCommandRegistry;
  private errorHandler: PlotErrorHandler;
  private debugLogger: any = null; // DebugLoggerWindow instance

  constructor(private context: Context) {
    this.tokenizer = new PlotTokenizer();
    this.registry = new PlotCommandRegistry();
    this.errorHandler = new PlotErrorHandler({
      logToConsole: true,
      logToDebugLogger: true,
      enableRecovery: true,
      maxErrorsPerCommand: 5,
      stopOnCriticalError: false
    });

    // Initialize debug logger integration
    this.initializeDebugLogger();

    // Register all existing PLOT commands
    this.registerCommands();
  }

  /**
   * Initialize debug logger integration following existing pattern
   */
  private initializeDebugLogger(): void {
    try {
      const DebugLoggerWindow = require('../debugLoggerWin').DebugLoggerWindow;
      this.debugLogger = DebugLoggerWindow.getInstance(this.context);
      this.errorHandler.initializeDebugLogger(this.context);
    } catch (error) {
      console.warn('Failed to initialize debug logger for PLOT parser:', error);
    }
  }

  /**
   * Register all existing PLOT commands with their definitions
   */
  private registerCommands(): void {
    // Drawing commands
    this.registerCommand({
      name: 'SET',
      parameters: [
        { name: 'x', type: 'coordinate', required: true },
        { name: 'y', type: 'coordinate', required: true }
      ],
      description: 'Set cursor position',
      examples: ['SET 100 200', 'SET -50 75'],
      handler: this.handleSetCommand.bind(this)
    });

    this.registerCommand({
      name: 'TEXT',
      parameters: [
        { name: 'size', type: 'number', required: false, defaultValue: 10, range: { min: 1, max: 100 } },
        { name: 'style', type: 'number', required: false, defaultValue: 1, range: { min: 0, max: 255 } },
        { name: 'angle', type: 'number', required: false, defaultValue: 0, range: { min: 0, max: 359 } },
        { name: 'text', type: 'string', required: true }
      ],
      description: 'Draw text at cursor position',
      examples: ['TEXT "Hello"', 'TEXT 12 4 90 "Rotated"'],
      handler: this.handleTextCommand.bind(this)
    });

    this.registerCommand({
      name: 'LINE',
      parameters: [
        { name: 'x', type: 'coordinate', required: true },
        { name: 'y', type: 'coordinate', required: true },
        { name: 'lineSize', type: 'number', required: false, defaultValue: 1, range: { min: 1, max: 32 } },
        { name: 'opacity', type: 'count', required: false, defaultValue: 255, range: { min: 0, max: 255 } }
      ],
      description: 'Draw line from cursor to coordinates',
      examples: ['LINE 100 200', 'LINE 50 75 2 200'],
      handler: this.handleLineCommand.bind(this)
    });

    this.registerCommand({
      name: 'CIRCLE',
      parameters: [
        { name: 'diameter', type: 'number', required: true, range: { min: 1, max: 2048 } },
        { name: 'lineSize', type: 'number', required: false, defaultValue: 0, range: { min: 0, max: 32 } },
        { name: 'opacity', type: 'count', required: false, defaultValue: 255, range: { min: 0, max: 255 } }
      ],
      description: 'Draw circle around cursor position',
      examples: ['CIRCLE 50', 'CIRCLE 100 2 200'],
      handler: this.handleCircleCommand.bind(this)
    });

    this.registerCommand({
      name: 'DOT',
      parameters: [
        { name: 'lineSize', type: 'number', required: false, defaultValue: 1, range: { min: 1, max: 32 } },
        { name: 'opacity', type: 'count', required: false, defaultValue: 255, range: { min: 0, max: 255 } }
      ],
      description: 'Draw dot at cursor position',
      examples: ['DOT', 'DOT 4 200'],
      handler: this.handleDotCommand.bind(this)
    });

    this.registerCommand({
      name: 'BOX',
      parameters: [
        { name: 'width', type: 'number', required: true },
        { name: 'height', type: 'number', required: true },
        { name: 'lineSize', type: 'number', required: false, defaultValue: 0, range: { min: 0, max: 32 } },
        { name: 'opacity', type: 'count', required: false, defaultValue: 255, range: { min: 0, max: 255 } }
      ],
      description: 'Draw rectangle around cursor position',
      examples: ['BOX 50 30', 'BOX 100 75 2 200'],
      handler: this.handleBoxCommand.bind(this)
    });

    this.registerCommand({
      name: 'OVAL',
      parameters: [
        { name: 'width', type: 'number', required: true },
        { name: 'height', type: 'number', required: true },
        { name: 'lineSize', type: 'number', required: false, defaultValue: 0, range: { min: 0, max: 32 } },
        { name: 'opacity', type: 'count', required: false, defaultValue: 255, range: { min: 0, max: 255 } }
      ],
      description: 'Draw ellipse around cursor position',
      examples: ['OVAL 60 40', 'OVAL 80 60 1 180'],
      handler: this.handleOvalCommand.bind(this)
    });

    // State commands
    this.registerCommand({
      name: 'ORIGIN',
      parameters: [
        { name: 'x', type: 'coordinate', required: false, defaultValue: 0 },
        { name: 'y', type: 'coordinate', required: false, defaultValue: 0 }
      ],
      description: 'Set origin point',
      examples: ['ORIGIN', 'ORIGIN 100 100'],
      handler: this.handleOriginCommand.bind(this)
    });

    this.registerCommand({
      name: 'POLAR',
      parameters: [
        { name: 'twopi', type: 'number', required: true },
        { name: 'offset', type: 'number', required: true }
      ],
      description: 'Set polar coordinate system parameters',
      examples: ['POLAR -64 -16', 'POLAR $100000000 0'],
      handler: this.handlePolarCommand.bind(this)
    });

    this.registerCommand({
      name: 'LINESIZE',
      parameters: [
        { name: 'size', type: 'number', required: true, range: { min: 1, max: 32 } }
      ],
      description: 'Set default line size',
      examples: ['LINESIZE 2'],
      handler: this.handleLineSizeCommand.bind(this)
    });

    this.registerCommand({
      name: 'OPACITY',
      parameters: [
        { name: 'level', type: 'count', required: true, range: { min: 0, max: 255 } }
      ],
      description: 'Set default opacity level',
      examples: ['OPACITY 128'],
      handler: this.handleOpacityCommand.bind(this)
    });

    // Window commands
    this.registerCommand({
      name: 'CLEAR',
      parameters: [],
      description: 'Clear the display',
      examples: ['CLEAR'],
      handler: this.handleClearCommand.bind(this)
    });

    this.registerCommand({
      name: 'UPDATE',
      parameters: [],
      description: 'Update display (flush buffer)',
      examples: ['UPDATE'],
      handler: this.handleUpdateCommand.bind(this)
    });

    this.registerCommand({
      name: 'CLOSE',
      parameters: [],
      description: 'Close the window',
      examples: ['CLOSE'],
      handler: this.handleCloseCommand.bind(this)
    });

    this.registerCommand({
      name: 'SAVE',
      parameters: [
        { name: 'target', type: 'string', required: false, defaultValue: 'window' },
        { name: 'filename', type: 'string', required: true }
      ],
      description: 'Save window or display to bitmap file',
      examples: ['SAVE "plot.bmp"', 'SAVE WINDOW "myplot.bmp"'],
      handler: this.handleSaveCommand.bind(this)
    });

    // Input commands
    this.registerCommand({
      name: 'PC_KEY',
      parameters: [],
      description: 'Enable keyboard input forwarding',
      examples: ['PC_KEY'],
      handler: this.handlePcKeyCommand.bind(this)
    });

    this.registerCommand({
      name: 'PC_MOUSE',
      parameters: [],
      description: 'Enable mouse input forwarding',
      examples: ['PC_MOUSE'],
      handler: this.handlePcMouseCommand.bind(this)
    });

    // Color commands (will be expanded in next phase)
    this.registerCommand({
      name: 'COLOR',
      parameters: [
        { name: 'color', type: 'color', required: true }
      ],
      description: 'Set drawing color',
      examples: ['COLOR RED', 'COLOR $FF0000'],
      handler: this.handleColorCommand.bind(this)
    });

    // Color name commands with optional brightness
    const colorNames = ['BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'CYAN', 'MAGENTA', 'YELLOW', 'ORANGE', 'GRAY', 'GREY'];
    for (const colorName of colorNames) {
      this.registerCommand({
        name: colorName,
        parameters: [
          { name: 'brightness', type: 'count', required: false, defaultValue: 15, range: { min: 0, max: 15 } }
        ],
        description: `Set drawing color to ${colorName}`,
        examples: [`${colorName}`, `${colorName} 10`],
        handler: this.handleColorNameCommand.bind(this)
      });
    }
  }

  /**
   * Parse command string into structured commands
   */
  parse(message: string): ParsedCommand[] {
    const commands: ParsedCommand[] = [];

    if (!message || message.trim() === '') {
      return commands;
    }

    try {
      // Tokenize the input
      const tokens = this.tokenizer.tokenize(message);

      if (tokens.length <= 1) { // Only EOF token
        return commands;
      }

      // Validate token sequence
      if (!this.tokenizer.validateTokenSequence(tokens)) {
        const error = this.errorHandler.createTokenizationError(
          message, 0, 'Invalid token sequence'
        );
        this.errorHandler.logError(error);

        return [{
          command: 'INVALID',
          parameters: [],
          isValid: false,
          errors: [error.message],
          warnings: [],
          originalText: message
        }];
      }

      // Parse commands from tokens (excluding EOF)
      const workingTokens = tokens.slice(0, -1);

      // Check if this is a compound command by looking for patterns
      if (this.isCompoundCommand(workingTokens)) {
        // Parse as compound command - all operations combined
        const compoundCommand = this.parseCompoundCommand(workingTokens, message);
        commands.push(compoundCommand);
      } else {
        // Parse as separate commands
        let currentIndex = 0;
        while (currentIndex < workingTokens.length) {
          const commandResult = this.parseCommand(workingTokens, currentIndex, message);
          commands.push(commandResult.command);
          currentIndex = commandResult.nextIndex;
        }
      }

    } catch (error) {
      const parseError = this.errorHandler.createTokenizationError(
        message, 0, `Parsing failed: ${error}`
      );
      this.errorHandler.logError(parseError);

      commands.push({
        command: 'ERROR',
        parameters: [],
        isValid: false,
        errors: [parseError.message],
        warnings: [],
        originalText: message
      });
    }

    return commands;
  }

  /**
   * Check if tokens represent a compound command
   * In PLOT, ANY sequence of multiple commands on one line is compound
   */
  private isCompoundCommand(tokens: any[]): boolean {
    // Count how many registered commands are in this token sequence
    let commandCount = 0;

    for (const token of tokens) {
      if (token.type === 'COMMAND' && this.registry.hasCommand(token.value)) {
        commandCount++;
        if (commandCount > 1) {
          // More than one command means this is a compound command
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse a compound command - execute all operations as a single unit
   */
  private parseCompoundCommand(tokens: any[], originalText: string): ParsedCommand {
    const operations: any[] = [];
    let currentIndex = 0;
    let errors: string[] = [];
    let warnings: string[] = [];

    while (currentIndex < tokens.length) {
      const token = tokens[currentIndex];

      if (token.type === 'COMMAND') {
        const commandName = token.value.toUpperCase();
        const commandDef = this.registry.getCommand(commandName);

        if (commandDef) {
          // Collect parameters for this sub-command
          const params = [];
          currentIndex++;

          // Skip delimiters
          while (currentIndex < tokens.length && tokens[currentIndex].type === 'DELIMITER') {
            currentIndex++;
          }

          // Collect parameters until next command or based on expected count
          while (currentIndex < tokens.length) {
            const nextToken = tokens[currentIndex];

            // Stop if we hit another registered command
            if (nextToken.type === 'COMMAND' && this.registry.hasCommand(nextToken.value)) {
              break;
            }

            if (nextToken.type !== 'DELIMITER') {
              params.push(nextToken);
            }
            currentIndex++;
          }

          operations.push({
            command: commandName,
            parameters: params,
            definition: commandDef
          });

          // Debug log to console, not debug logger
          console.log(`[COMPOUND] Sub-command: ${commandName} with ${params.length} params: ${params.map(p => p.value).join(', ')}`);
        } else {
          errors.push(`Unknown command in compound: ${commandName}`);
          currentIndex++;
        }
      } else {
        currentIndex++;
      }
    }

    // Create a compound command that will execute all operations together
    return {
      command: 'COMPOUND',
      parameters: operations,
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      originalText: originalText
    };
  }

  /**
   * Execute parsed commands
   */
  executeCommands(commands: ParsedCommand[]): CommandResult[] {
    const results: CommandResult[] = [];

    for (const command of commands) {
      if (!command.isValid) {
        results.push({
          success: false,
          errors: command.errors,
          warnings: command.warnings || [],
          canvasOperations: []
        });
        continue;
      }

      try {
        // Handle compound commands specially
        if (command.command === 'COMPOUND') {
          const compoundResult: CommandResult = {
            success: true,
            errors: [],
            warnings: command.warnings || [],
            canvasOperations: []
          };

          // Execute each sub-command in the compound
          for (const operation of command.parameters as any[]) {
            const handler = operation.definition?.handler;
            if (!handler) {
              compoundResult.errors.push(`No handler for sub-command: ${operation.command}`);
              compoundResult.success = false;
              continue;
            }

            const context: CommandContext = {
              tokens: operation.parameters || [],
              debugLogger: this.debugLogger,
              originalCommand: command.originalText
            };
            // Add the actual command name for handlers that need it
            (context as any).command = operation.command;

            const subResult = handler.call(this, context);

            // Accumulate results
            if (!subResult.success) {
              compoundResult.success = false;
            }
            compoundResult.errors.push(...subResult.errors);
            compoundResult.warnings.push(...subResult.warnings);
            compoundResult.canvasOperations.push(...subResult.canvasOperations);
          }

          results.push(compoundResult);
        } else {
          // Regular command handling
          const commandDef = this.registry.getCommand(command.command);
          if (!commandDef) {
            const error = this.errorHandler.createUnrecognizedCommandError(
              command.command, command.originalText
            );
            this.errorHandler.logError(error);

            results.push({
              success: false,
              errors: [error.message],
              warnings: [],
              canvasOperations: []
            });
            continue;
          }

          // Execute command with context
          const context: CommandContext = {
            tokens: command.parameters,
            debugLogger: this.debugLogger,
            originalCommand: command.originalText
          };

          const result = commandDef.handler(context);
          // Merge parsing warnings with execution warnings
          result.warnings = [...(command.warnings || []), ...(result.warnings || [])];
          results.push(result);
        }

      } catch (error) {
        results.push({
          success: false,
          errors: [`Command execution failed: ${error}`],
          warnings: command.warnings || [],
          canvasOperations: []
        });
      }
    }

    return results;
  }

  /**
   * Register command with registry
   */
  registerCommand(name: string, handler: CommandHandler): void;
  registerCommand(definition: CommandDefinition): void;
  registerCommand(nameOrDef: string | CommandDefinition, handler?: CommandHandler): void {
    if (typeof nameOrDef === 'string' && handler) {
      // Simple registration
      const definition: CommandDefinition = {
        name: nameOrDef,
        parameters: [],
        description: 'Custom command',
        examples: [],
        handler: handler
      };
      this.registry.registerCommand(definition);
    } else if (typeof nameOrDef === 'object') {
      // Full definition registration
      this.registry.registerCommand(nameOrDef);
    }
  }

  /**
   * Unregister command
   */
  unregisterCommand(name: string): boolean {
    // Registry doesn't have unregister method yet - would need to add it
    return false;
  }

  /**
   * Parse single command from tokens
   */
  private parseCommand(tokens: any[], startIndex: number, originalText: string): { command: ParsedCommand; nextIndex: number } {
    const commandToken = tokens[startIndex];
    const commandName = commandToken.value;

    // Find command definition
    const commandDef = this.registry.getCommand(commandName);
    if (!commandDef) {
      return {
        command: {
          command: commandName,
          parameters: [],
          isValid: false,
          errors: [`Unknown command: ${commandName}`],
          warnings: [],
          originalText: originalText
        },
        nextIndex: startIndex + 1
      };
    }

    // Extract parameters
    const parameters = [];
    let currentIndex = startIndex + 1;

    // Skip delimiter tokens
    while (currentIndex < tokens.length && tokens[currentIndex].type === 'DELIMITER') {
      currentIndex++;
    }

    // Collect parameter tokens until next registered command or end
    while (currentIndex < tokens.length) {
      const token = tokens[currentIndex];

      // If it's a COMMAND token, check if it's a registered command
      if (token.type === 'COMMAND') {
        const isRegisteredCommand = this.registry.hasCommand(token.value);
        if (isRegisteredCommand) {
          // Stop here - this is the start of the next command
          break;
        } else {
          // Treat unregistered command as a string parameter
          parameters.push({
            type: 'STRING',
            value: token.value,
            originalText: token.originalText,
            position: token.position
          });
        }
      } else if (token.type !== 'DELIMITER') {
        // Regular parameter tokens (NUMBER, STRING, etc.)
        parameters.push(token);
      }

      currentIndex++;
    }

    // Validate parameters
    const validation = this.registry.validateParameters(commandName, parameters.map(p => p.value));
    const errors = validation.filter(v => !v.isValid).map(v => v.errorMessage || 'Unknown error');
    const warnings = validation.filter(v => v.isValid && (v.usedDefault || v.errorMessage)).map(v => {
      if (v.usedDefault) {
        return `Used default value ${v.defaultValue} for parameter`;
      } else if (v.errorMessage) {
        return v.errorMessage;
      }
      return 'Unknown warning';
    });

    return {
      command: {
        command: commandName,
        parameters: parameters,
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        originalText: originalText
      },
      nextIndex: currentIndex
    };
  }

  // Command handlers (placeholders for now - will be implemented in migration phase)
  private handleSetCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length < 2) {
        result.success = false;
        result.errors.push('SET command requires x and y coordinates');
        this.logError(`[PLOT PARSE ERROR] Missing parameters for SET command: ${context.originalCommand}`);
        return result;
      }

      // Parse X coordinate
      const xValue = Spin2NumericParser.parseCoordinate(tokens[0].value);
      if (xValue === null) {
        result.warnings.push(`Invalid x coordinate '${tokens[0].value}', using 0`);
        this.logParameterWarning(context.originalCommand, 'SET x', tokens[0].value, 0);
      }

      // Parse Y coordinate
      const yValue = Spin2NumericParser.parseCoordinate(tokens[1].value);
      if (yValue === null) {
        result.warnings.push(`Invalid y coordinate '${tokens[1].value}', using 0`);
        this.logParameterWarning(context.originalCommand, 'SET y', tokens[1].value, 0);
      }

      const x = xValue ?? 0;
      const y = yValue ?? 0;

      // Create canvas operation
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_CURSOR,
        { x, y },
        true // SET should be deferrable to batch with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];

      console.log(`[PLOT] SET parsed: x=${x}, y=${y}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`SET command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] SET command execution failed: ${error}`);
    }

    return result;
  }

  private handleTextCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      // Parse parameters using Spin2NumericParser for robust parsing
      const tokens = context.tokens;
      let size = 10;
      let style = 1;
      let angle = 0;
      let text = '';
      let tokenIndex = 0;

      // Parse optional size parameter
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'NUMBER') {
        const sizeValue = Spin2NumericParser.parseCount(tokens[tokenIndex].value);
        if (sizeValue !== null && sizeValue >= 1 && sizeValue <= 100) {
          size = sizeValue;
        } else {
          result.warnings.push(`Invalid text size '${tokens[tokenIndex].value}', using default: ${size}`);
          this.logParameterWarning(context.originalCommand, 'TEXT size', tokens[tokenIndex].value, size);
        }
        tokenIndex++;
      }

      // Parse optional style parameter
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'NUMBER') {
        const styleValue = Spin2NumericParser.parseCount(tokens[tokenIndex].value);
        if (styleValue !== null && styleValue >= 0 && styleValue <= 255) {
          style = styleValue;
        } else {
          result.warnings.push(`Invalid text style '${tokens[tokenIndex].value}', using default: ${style}`);
          this.logParameterWarning(context.originalCommand, 'TEXT style', tokens[tokenIndex].value, style);
        }
        tokenIndex++;
      }

      // Parse optional angle parameter
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'NUMBER') {
        const angleValue = Spin2NumericParser.parseCoordinate(tokens[tokenIndex].value);
        if (angleValue !== null) {
          angle = angleValue % 360; // Normalize to 0-359 range
          if (angle < 0) angle += 360;
        } else {
          result.warnings.push(`Invalid text angle '${tokens[tokenIndex].value}', using default: ${angle}`);
          this.logParameterWarning(context.originalCommand, 'TEXT angle', tokens[tokenIndex].value, angle);
        }
        tokenIndex++;
      }

      // Parse required text content
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'STRING') {
        text = tokens[tokenIndex].value; // Tokenizer already extracted content without quotes
      } else {
        result.success = false;
        result.errors.push('TEXT command requires text string parameter');
        this.logError(`[PLOT PARSE ERROR] Missing text string for TEXT command: ${context.originalCommand}`);
        return result;
      }

      // Format style as 8-bit binary string to match existing implementation
      const styleString = this.formatAs8BitBinary(style.toString());

      // Create a single combined operation for TEXT with all parameters
      const textOperation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.DRAW_TEXT,
        {
          size: size,
          style: styleString,
          angle: angle,
          text: text
        },
        true
      );

      result.canvasOperations = [
        this.convertToCanvasOperation(textOperation)
      ];

      console.log(`[PLOT] TEXT parsed: size=${size}, style=${styleString}, angle=${angle}, text='${text}'`);

    } catch (error) {
      result.success = false;
      result.errors.push(`TEXT command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] TEXT command execution failed: ${error}`);
    }

    return result;
  }

  private handleLineCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length < 2) {
        result.success = false;
        result.errors.push('LINE command requires x and y coordinates');
        this.logError(`[PLOT PARSE ERROR] Missing parameters for LINE command: ${context.originalCommand}`);
        return result;
      }

      // Parse required X and Y coordinates
      const xValue = Spin2NumericParser.parseCoordinate(tokens[0].value);
      const yValue = Spin2NumericParser.parseCoordinate(tokens[1].value);

      if (xValue === null) {
        result.warnings.push(`Invalid x coordinate '${tokens[0].value}', using 0`);
        this.logParameterWarning(context.originalCommand, 'LINE x', tokens[0].value, 0);
      }

      if (yValue === null) {
        result.warnings.push(`Invalid y coordinate '${tokens[1].value}', using 0`);
        this.logParameterWarning(context.originalCommand, 'LINE y', tokens[1].value, 0);
      }

      const x = xValue ?? 0;
      const y = yValue ?? 0;

      // Parse optional lineSize parameter
      let lineSize = 1;
      if (tokens.length > 2 && tokens[2].type === 'NUMBER') {
        const lineSizeValue = Spin2NumericParser.parseCount(tokens[2].value);
        if (lineSizeValue !== null && lineSizeValue >= 1 && lineSizeValue <= 32) {
          lineSize = lineSizeValue;
        } else {
          result.warnings.push(`Invalid line size '${tokens[2].value}', using default: ${lineSize}`);
          this.logParameterWarning(context.originalCommand, 'LINE linesize', tokens[2].value, lineSize);
        }
      }

      // Parse optional opacity parameter
      let opacity = 255;
      if (tokens.length > 3 && tokens[3].type === 'NUMBER') {
        const opacityValue = Spin2NumericParser.parseCount(tokens[3].value);
        if (opacityValue !== null && opacityValue >= 0 && opacityValue <= 255) {
          opacity = opacityValue;
        } else {
          result.warnings.push(`Invalid opacity '${tokens[3].value}', using default: ${opacity}`);
          this.logParameterWarning(context.originalCommand, 'LINE opacity', tokens[3].value, opacity);
        }
      }

      // Create canvas operation
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.DRAW_LINE,
        { x, y, lineSize, opacity },
        true // LINE is deferrable
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];

      console.log(`[PLOT] LINE parsed: x=${x}, y=${y}, lineSize=${lineSize}, opacity=${opacity}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`LINE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] LINE command execution failed: ${error}`);
    }

    return result;
  }

  private handleCircleCommand(context: CommandContext): CommandResult {
    return this.handleShapeCommand(context, 'CIRCLE', ['diameter'], CanvasOperationType.DRAW_CIRCLE);
  }

  private handleDotCommand(context: CommandContext): CommandResult {
    return this.handleShapeCommand(context, 'DOT', [], CanvasOperationType.DRAW_DOT);
  }

  private handleBoxCommand(context: CommandContext): CommandResult {
    return this.handleShapeCommand(context, 'BOX', ['width', 'height'], CanvasOperationType.DRAW_BOX);
  }

  private handleOvalCommand(context: CommandContext): CommandResult {
    return this.handleShapeCommand(context, 'OVAL', ['width', 'height'], CanvasOperationType.DRAW_OVAL);
  }

  /**
   * Generic handler for shape commands (CIRCLE, DOT, BOX, OVAL)
   * All have optional lineSize and opacity parameters
   */
  private handleShapeCommand(
    context: CommandContext,
    commandName: string,
    requiredParams: string[],
    operationType: CanvasOperationType
  ): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;
      const params: Record<string, number> = {};
      let tokenIndex = 0;

      // Parse required parameters
      for (const paramName of requiredParams) {
        if (tokenIndex >= tokens.length || tokens[tokenIndex].type !== 'NUMBER') {
          result.success = false;
          result.errors.push(`${commandName} command requires ${paramName} parameter`);
          this.logError(`[PLOT PARSE ERROR] Missing ${paramName} for ${commandName} command: ${context.originalCommand}`);
          return result;
        }

        const value = Spin2NumericParser.parseCoordinate(tokens[tokenIndex].value);
        if (value === null) {
          result.warnings.push(`Invalid ${paramName} '${tokens[tokenIndex].value}', using 1`);
          this.logParameterWarning(context.originalCommand, `${commandName} ${paramName}`, tokens[tokenIndex].value, 1);
          params[paramName] = 1;
        } else {
          params[paramName] = value;
        }
        tokenIndex++;
      }

      // Parse optional lineSize parameter
      let lineSize = commandName === 'DOT' ? 1 : 0; // DOT defaults to 1, others to 0 (filled)
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'NUMBER') {
        const lineSizeValue = Spin2NumericParser.parseCount(tokens[tokenIndex].value);
        if (lineSizeValue !== null && lineSizeValue >= 0 && lineSizeValue <= 32) {
          lineSize = lineSizeValue;
        } else {
          result.warnings.push(`Invalid line size '${tokens[tokenIndex].value}', using default: ${lineSize}`);
          this.logParameterWarning(context.originalCommand, `${commandName} linesize`, tokens[tokenIndex].value, lineSize);
        }
        tokenIndex++;
      }

      // Parse optional opacity parameter
      let opacity = 255;
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'NUMBER') {
        const opacityValue = Spin2NumericParser.parseCount(tokens[tokenIndex].value);
        if (opacityValue !== null && opacityValue >= 0 && opacityValue <= 255) {
          opacity = opacityValue;
        } else {
          result.warnings.push(`Invalid opacity '${tokens[tokenIndex].value}', using default: ${opacity}`);
          this.logParameterWarning(context.originalCommand, `${commandName} opacity`, tokens[tokenIndex].value, opacity);
        }
      }

      // Create canvas operation
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        operationType,
        { ...params, lineSize, opacity },
        true // All drawing commands are deferrable
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];

      const paramStr = requiredParams.map(p => `${p}=${params[p]}`).join(', ');
      console.log(`[PLOT] ${commandName} parsed: ${paramStr}, lineSize=${lineSize}, opacity=${opacity}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`${commandName} command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] ${commandName} command execution failed: ${error}`);
    }

    return result;
  }

  private handleOriginCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;
      let x = 0;
      let y = 0;

      // Parse optional X coordinate
      if (tokens.length > 0 && tokens[0].type === 'NUMBER') {
        const xValue = Spin2NumericParser.parseCoordinate(tokens[0].value);
        if (xValue !== null) {
          x = xValue;
        } else {
          result.warnings.push(`Invalid x coordinate '${tokens[0].value}', using 0`);
          this.logParameterWarning(context.originalCommand, 'ORIGIN x', tokens[0].value, 0);
        }

        // Parse optional Y coordinate
        if (tokens.length > 1 && tokens[1].type === 'NUMBER') {
          const yValue = Spin2NumericParser.parseCoordinate(tokens[1].value);
          if (yValue !== null) {
            y = yValue;
          } else {
            result.warnings.push(`Invalid y coordinate '${tokens[1].value}', using 0`);
            this.logParameterWarning(context.originalCommand, 'ORIGIN y', tokens[1].value, 0);
          }
        }
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_ORIGIN,
        { x, y },
        true // ORIGIN should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      console.log(`[PLOT] ORIGIN parsed: x=${x}, y=${y}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`ORIGIN command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] ORIGIN command execution failed: ${error}`);
    }

    return result;
  }

  private handlePolarCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length < 2) {
        result.success = false;
        result.errors.push('POLAR command requires twopi and offset parameters');
        return result;
      }

      // Parse twopi parameter
      let twopi = 0;
      if (tokens[0].type === 'NUMBER') {
        const twopiValue = Spin2NumericParser.parseValue(tokens[0].value);
        if (twopiValue !== null) {
          twopi = twopiValue;
        } else {
          result.warnings.push(`Invalid twopi value '${tokens[0].value}', using 0`);
          this.logParameterWarning(context.originalCommand, 'POLAR twopi', tokens[0].value, 0);
        }
      }

      // Parse offset parameter
      let offset = 0;
      if (tokens[1].type === 'NUMBER') {
        const offsetValue = Spin2NumericParser.parseValue(tokens[1].value);
        if (offsetValue !== null) {
          offset = offsetValue;
        } else {
          result.warnings.push(`Invalid offset value '${tokens[1].value}', using 0`);
          this.logParameterWarning(context.originalCommand, 'POLAR offset', tokens[1].value, 0);
        }
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_COORDINATE_MODE,
        {
          mode: 'POLAR',
          polarConfig: { twopi, offset }
        },
        true // POLAR should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      console.log(`[PLOT] POLAR parsed: twopi=${twopi}, offset=${offset}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`POLAR command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] POLAR command execution failed: ${error}`);
    }

    return result;
  }

  private handleLineSizeCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length === 0 || tokens[0].type !== 'NUMBER') {
        result.success = false;
        result.errors.push('LINESIZE command requires size parameter');
        this.logError(`[PLOT PARSE ERROR] Missing size parameter for LINESIZE command: ${context.originalCommand}`);
        return result;
      }

      const sizeValue = Spin2NumericParser.parseCount(tokens[0].value);
      let size = 1;

      if (sizeValue !== null && sizeValue >= 1 && sizeValue <= 32) {
        size = sizeValue;
      } else {
        result.warnings.push(`Invalid line size '${tokens[0].value}', using default: ${size}`);
        this.logParameterWarning(context.originalCommand, 'LINESIZE size', tokens[0].value, size);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_LINESIZE,
        { size },
        true // LINESIZE should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      console.log(`[PLOT] LINESIZE parsed: size=${size}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`LINESIZE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] LINESIZE command execution failed: ${error}`);
    }

    return result;
  }

  private handleOpacityCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length === 0 || tokens[0].type !== 'NUMBER') {
        result.success = false;
        result.errors.push('OPACITY command requires level parameter');
        this.logError(`[PLOT PARSE ERROR] Missing level parameter for OPACITY command: ${context.originalCommand}`);
        return result;
      }

      const levelValue = Spin2NumericParser.parseCount(tokens[0].value);
      let level = 255;

      if (levelValue !== null && levelValue >= 0 && levelValue <= 255) {
        level = levelValue;
      } else {
        result.warnings.push(`Invalid opacity level '${tokens[0].value}', using default: ${level}`);
        this.logParameterWarning(context.originalCommand, 'OPACITY level', tokens[0].value, level);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_OPACITY,
        { opacity: level },
        true // OPACITY should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      console.log(`[PLOT] OPACITY parsed: level=${level}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`OPACITY command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] OPACITY command execution failed: ${error}`);
    }

    return result;
  }

  private handleClearCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
      CanvasOperationType.CLEAR_CANVAS,
      {},
      true // CLEAR is deferrable
    );

    result.canvasOperations = [this.convertToCanvasOperation(operation)];
    console.log(`[PLOT] CLEAR parsed`);

    return result;
  }

  private handleUpdateCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
      CanvasOperationType.UPDATE_DISPLAY,
      {},
      false // UPDATE is immediate
    );

    result.canvasOperations = [this.convertToCanvasOperation(operation)];
    console.log(`[PLOT] UPDATE parsed`);

    return result;
  }

  private handleCloseCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    // CLOSE is handled immediately by the window, not through canvas operations
    // This matches the existing implementation behavior
    const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
      CanvasOperationType.CONFIGURE_WINDOW,
      { action: 'CLOSE' },
      false // CLOSE is immediate
    );

    result.canvasOperations = [this.convertToCanvasOperation(operation)];
    console.log(`[PLOT] CLOSE parsed`);

    return result;
  }

  private handleSaveCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    const tokens = context.tokens;

    // SAVE command can be:
    // 1. SAVE "filename"
    // 2. SAVE WINDOW "filename"

    let filename: string;
    let target = 'window'; // default

    if (tokens.length === 1) {
      // SAVE "filename"
      if (tokens[0].type === PlotTokenType.STRING) {
        filename = tokens[0].value;
      } else {
        this.logError(`[PLOT PARSE ERROR] SAVE command requires a quoted filename: ${context.originalCommand}`);
        result.success = false;
        result.errors.push('SAVE command requires a quoted filename');
        return result;
      }
    } else if (tokens.length === 2) {
      // SAVE WINDOW "filename"
      if (tokens[0].value.toUpperCase() === 'WINDOW' && tokens[1].type === PlotTokenType.STRING) {
        target = 'window';
        filename = tokens[1].value;
      } else {
        this.logError(`[PLOT PARSE ERROR] Invalid SAVE command syntax: ${context.originalCommand}`);
        result.success = false;
        result.errors.push('Invalid SAVE command syntax. Use: SAVE "filename" or SAVE WINDOW "filename"');
        return result;
      }
    } else {
      this.logError(`[PLOT PARSE ERROR] Invalid SAVE command parameters: ${context.originalCommand}`);
      result.success = false;
      result.errors.push('Invalid SAVE command parameters');
      return result;
    }

    // SAVE is handled immediately by the window, not through canvas operations
    const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
      CanvasOperationType.CONFIGURE_WINDOW,
      { action: 'SAVE', target: target, filename: filename },
      false // SAVE is immediate
    );

    result.canvasOperations = [this.convertToCanvasOperation(operation)];
    console.log(`[PLOT] SAVE ${target} "${filename}" parsed`);

    return result;
  }

  private handlePcKeyCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
      CanvasOperationType.ENABLE_KEYBOARD,
      {},
      false // PC_KEY is immediate
    );

    result.canvasOperations = [this.convertToCanvasOperation(operation)];
    console.log(`[PLOT] PC_KEY parsed`);

    return result;
  }

  private handlePcMouseCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
      CanvasOperationType.ENABLE_MOUSE,
      {},
      false // PC_MOUSE is immediate
    );

    result.canvasOperations = [this.convertToCanvasOperation(operation)];
    console.log(`[PLOT] PC_MOUSE parsed`);

    return result;
  }

  private handleColorCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length === 0) {
        result.success = false;
        result.errors.push('COLOR command requires color value');
        this.logError(`[PLOT PARSE ERROR] Missing color value for COLOR command: ${context.originalCommand}`);
        return result;
      }

      const colorValue = tokens[0].value;

      // Try to parse as hex color first
      let parsedColor: number | null = null;
      if (colorValue.startsWith('$') || colorValue.toLowerCase().startsWith('0x')) {
        parsedColor = Spin2NumericParser.parseColor(colorValue);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_COLOR,
        { color: parsedColor !== null ? `#${parsedColor.toString(16).padStart(6, '0')}` : colorValue },
        true // COLOR should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      console.log(`[PLOT] COLOR parsed: ${colorValue}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`COLOR command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] COLOR command execution failed: ${error}`);
    }

    return result;
  }

  private handleColorNameCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;
      let brightness = 15; // Default full brightness

      // Parse optional brightness parameter
      if (tokens.length > 0 && tokens[0].type === 'NUMBER') {
        const brightnessValue = Spin2NumericParser.parseCount(tokens[0].value);
        if (brightnessValue !== null && brightnessValue >= 0 && brightnessValue <= 15) {
          brightness = brightnessValue;
        } else {
          result.warnings.push(`Invalid brightness '${tokens[0].value}', using default: ${brightness}`);
          this.logParameterWarning(context.originalCommand, 'brightness', tokens[0].value, brightness);
        }
      }

      // Get the color name from the command context for compound commands,
      // or extract from original for simple commands
      let colorName: string;
      if ((context as any).command) {
        // In compound command, use the provided command name
        colorName = (context as any).command;
      } else {
        // In simple command, extract from original
        const commandParts = context.originalCommand.trim().split(/\s+/);
        colorName = commandParts[0].toUpperCase();
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_COLOR,
        { color: colorName, brightness: brightness },
        true // Color should be deferrable to batch with drawing operations
      );
      console.log('[PARSER] Created color operation:', operation.type, '=', CanvasOperationType.SET_COLOR, 'params:', operation.parameters);

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      console.log(`[PLOT] ${colorName} parsed: brightness=${brightness}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Color command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] Color command execution failed: ${error}`);
    }

    return result;
  }

  /**
   * Helper methods for TEXT command
   */
  private formatAs8BitBinary(value: string): string {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return '00000001'; // Default style
    }
    return num.toString(2).padStart(8, '0');
  }

  private logParameterWarning(command: string, paramName: string, invalidValue: string, defaultValue: any): void {
    const error = this.errorHandler.createInvalidParameterError(
      command, paramName, invalidValue, 'valid numeric value', defaultValue
    );
    this.errorHandler.logError(error);
  }

  private logError(message: string): void {
    if (this.debugLogger) {
      try {
        this.debugLogger.logSystemMessage(message);
      } catch (error) {
        console.error('Failed to log to debug logger:', error);
      }
    }
    console.error(message);
  }

  private logDebug(message: string): void {
    if (this.debugLogger) {
      try {
        this.debugLogger.logSystemMessage(message);
      } catch (error) {
        console.error('Failed to log to debug logger:', error);
      }
    }
    console.log(message);
  }

  /**
   * Convert PlotCanvasOperation to CanvasOperation for interface compatibility
   */
  private convertToCanvasOperation(plotOp: PlotCanvasOperation): any {
    // Return the PlotCanvasOperation as-is since it has all the needed info
    // The integrator knows how to handle PlotCanvasOperation directly
    console.log('[PARSER] convertToCanvasOperation returning:', plotOp.type, plotOp.parameters);
    return plotOp;
  }
}