/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

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
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }
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
      const LoggerWindow = require('../loggerWin').LoggerWindow;
      this.debugLogger = LoggerWindow.getInstance(this.context);
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

    // Window commands - REMOVED: CLEAR, UPDATE, CLOSE, SAVE now handled by base class handleCommonCommand()

    // Input commands - REMOVED: PC_KEY and PC_MOUSE now handled by base class handleCommonCommand()

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

    // CONFIGURE commands for window appearance and positioning
    this.registerCommand({
      name: 'CONFIGURE',
      parameters: [
        { name: 'option', type: 'string', required: true },
        { name: 'value', type: 'string', required: false }
      ],
      description: 'Configure window properties (TITLE, POS, SIZE, DOTSIZE, BACKCOLOR, HIDEXY, UPDATE)',
      examples: ['CONFIGURE TITLE "My Plot"', 'CONFIGURE POS 100 200', 'CONFIGURE SIZE 800 600'],
      handler: this.handleConfigureCommand.bind(this)
    });

    // Enhanced rendering control commands
    this.registerCommand({
      name: 'COLORMODE',
      parameters: [
        { name: 'mode', type: 'number', required: true, range: { min: 0, max: 3 } }
      ],
      description: 'Set color interpretation mode (0=RGB, 1=HSV, 2=indexed palette, 3=grayscale)',
      examples: ['COLORMODE 0', 'COLORMODE 1'],
      handler: this.handleColorModeCommand.bind(this)
    });

    this.registerCommand({
      name: 'TEXTSIZE',
      parameters: [
        { name: 'multiplier', type: 'number', required: true, range: { min: 1, max: 100 } }
      ],
      description: 'Set text size multiplier for all future TEXT commands',
      examples: ['TEXTSIZE 12', 'TEXTSIZE 24'],
      handler: this.handleTextSizeCommand.bind(this)
    });

    this.registerCommand({
      name: 'TEXTSTYLE',
      parameters: [
        { name: 'style', type: 'number', required: true, range: { min: 0, max: 7 } }
      ],
      description: 'Set text style bitfield (bit 0=bold, bit 1=italic, bit 2=underline)',
      examples: ['TEXTSTYLE 0', 'TEXTSTYLE 3', 'TEXTSTYLE 7'],
      handler: this.handleTextStyleCommand.bind(this)
    });

    // Interactive input commands - REMOVED: PC_KEY and PC_MOUSE duplicates, now handled by base class

    // Sprite and layer commands
    this.registerCommand({
      name: 'SPRITEDEF',
      parameters: [
        { name: 'id', type: 'number', required: true, range: { min: 0, max: 255 } },
        { name: 'width', type: 'number', required: true, range: { min: 1, max: 32 } },
        { name: 'height', type: 'number', required: true, range: { min: 1, max: 32 } }
        // Note: pixels and colors are variable-length arrays parsed manually in handler
      ],
      description: 'Define a sprite with pixel indices and color palette (Pascal format: SPRITEDEF id xsize ysize pixels... colors...)',
      examples: ['SPRITEDEF 0 2 2 0 1 0 1 $FF0000 $00FF00', 'SPRITEDEF 1 4 4 0 1 2 3 ... $000000 $FFFFFF ...'],
      handler: this.handleSpriteDefCommand.bind(this)
    });

    this.registerCommand({
      name: 'SPRITE',
      parameters: [
        { name: 'id', type: 'number', required: true, range: { min: 0, max: 255 } },
        { name: 'orientation', type: 'number', required: false, defaultValue: 0, range: { min: 0, max: 359 } },
        { name: 'scale', type: 'number', required: false, defaultValue: 1.0 },
        { name: 'opacity', type: 'count', required: false, defaultValue: 255, range: { min: 0, max: 255 } }
      ],
      description: 'Render a previously defined sprite with transformation support (Pascal format: SPRITE id {orientation {scale {opacity}}})',
      examples: ['SPRITE 0', 'SPRITE 42 90', 'SPRITE 5 180 2.0', 'SPRITE 1 45 0.5 128'],
      handler: this.handleSpriteCommand.bind(this)
    });

    this.registerCommand({
      name: 'LAYER',
      parameters: [
        { name: 'layerIndex', type: 'number', required: true, range: { min: 1, max: 16 } },
        { name: 'filename', type: 'string', required: true }
      ],
      description: 'Load external bitmap file (.bmp) from working directory into specified layer (1-16) for CROP operations (Pascal format: LAYER layer \'filename.bmp\')',
      examples: ['LAYER 1 "background.bmp"', 'LAYER 3 "texture.bmp"'],
      handler: this.handleLayerCommand.bind(this)
    });

    this.registerCommand({
      name: 'CROP',
      parameters: [
        { name: 'layerIndex', type: 'number', required: true, range: { min: 1, max: 16 } }
        // Note: Additional parameters vary by mode (explicit vs AUTO) and are parsed manually
      ],
      description: 'Copy rectangular region from loaded layer bitmap to canvas (Pascal formats: CROP layer {left top width height {x y}} or CROP layer AUTO x y)',
      examples: ['CROP 1 0 0 64 64', 'CROP 2 10 20 50 30 100 150', 'CROP 3 AUTO 50 75'],
      handler: this.handleCropCommand.bind(this)
    });

    this.registerCommand({
      name: 'LUT',
      parameters: [
        { name: 'index', type: 'number', required: true, range: { min: 0, max: 255 } },
        { name: 'color', type: 'color', required: true }
      ],
      description: 'Set single palette entry for indexed color mode (Pascal: LUT index color)',
      examples: ['LUT 0 $FF0000', 'LUT 1 RED', 'LUT 15 0x00FF00'],
      handler: this.handleLutCommand.bind(this)
    });

    this.registerCommand({
      name: 'LUTCOLORS',
      parameters: [
        // Parameters are variable length and parsed manually
      ],
      description: 'Load multiple RGB24 color values into consecutive palette entries (Pascal: LUTCOLORS color1 color2 ... colorN)',
      examples: ['LUTCOLORS $FF0000 $00FF00 $0000FF', 'LUTCOLORS RED GREEN BLUE'],
      handler: this.handleLutColorsCommand.bind(this)
    });

    this.registerCommand({
      name: 'PRECISE',
      parameters: [],
      description: 'Toggle coordinate precision mode between standard (0) and high precision (8) for 256ths of pixel accuracy (Pascal: vPrecise := vPrecise xor 8)',
      examples: ['PRECISE'],
      handler: this.handlePreciseCommand.bind(this)
    });
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
      const isCompound = this.isCompoundCommand(workingTokens);
      this.logConsoleMessage(`[PARSER] isCompoundCommand returned: ${isCompound}`);

      if (isCompound) {
        // Parse as compound command - all operations combined
        this.logConsoleMessage(`[PARSER] Parsing as compound command`);
        const compoundCommand = this.parseCompoundCommand(workingTokens, message);
        commands.push(compoundCommand);
      } else {
        // Parse as separate commands
        this.logConsoleMessage(`[PARSER] Parsing as separate commands`);
        let currentIndex = 0;
        while (currentIndex < workingTokens.length) {
          this.logConsoleMessage(`[PARSER] Parsing command at index ${currentIndex}`);
          const commandResult = this.parseCommand(workingTokens, currentIndex, message);
          this.logConsoleMessage(`[PARSER] parseCommand returned:`, commandResult.command.command);
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
   * Special handling for CONFIGURE commands to avoid conflicts with subcommands
   */
  private isCompoundCommand(tokens: any[]): boolean {
    // Count how many registered commands are in this token sequence
    let commandCount = 0;
    let inConfigureCommand = false;


    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'COMMAND' && this.registry.hasCommand(token.value)) {
        const commandName = token.value.toUpperCase();

        // Skip color names that are incorrectly tokenized as commands
        const colorNames = ['BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'YELLOW',
                           'CYAN', 'MAGENTA', 'ORANGE', 'PURPLE', 'PINK', 'BROWN',
                           'GRAY', 'GREY'];
        if (colorNames.includes(commandName)) {
          continue; // Skip color names
        }

        // Check if this is a CONFIGURE command
        if (commandName === 'CONFIGURE') {
          inConfigureCommand = true;
          commandCount++;
        } else if (inConfigureCommand && this.isConfigureSubcommand(commandName)) {
          // Skip counting subcommands of CONFIGURE as separate commands
          continue;
        } else {
          // Regular command
          commandCount++;
          inConfigureCommand = false;
        }

        if (commandCount > 1) {
          // More than one command means this is a compound command
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a command name is a valid CONFIGURE subcommand
   */
  private isConfigureSubcommand(commandName: string): boolean {
    const configureSubcommands = ['TITLE', 'POS', 'SIZE', 'DOTSIZE', 'BACKCOLOR', 'HIDEXY', 'UPDATE'];
    const colorNames = ['BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'CYAN', 'MAGENTA', 'YELLOW', 'ORANGE', 'GRAY', 'GREY'];

    const upperCommand = commandName.toUpperCase();
    return configureSubcommands.includes(upperCommand) || colorNames.includes(upperCommand);
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
          this.logConsoleMessage(`[COMPOUND] Sub-command: ${commandName} with ${params.length} params: ${params.map(p => p.value).join(', ')}`);
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
          // For CONFIGURE commands, allow certain subcommands as parameters
          if (commandName.toUpperCase() === 'CONFIGURE' && this.isConfigureSubcommand(token.value)) {
            // Treat CONFIGURE subcommands as string parameters
            parameters.push({
              type: 'STRING',
              value: token.value,
              originalText: token.originalText,
              position: token.position
            });
          } else {
            // Stop here - this is the start of the next command
            break;
          }
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

      this.logConsoleMessage(`[PLOT] SET parsed: x=${x}, y=${y}`);

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

      this.logConsoleMessage(`[PLOT] TEXT parsed: size=${size}, style=${styleString}, angle=${angle}, text='${text}'`);

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

      // Parse optional parameters
      // Pascal format: LINE x y {linesize {opacity}}
      // LINE x y lineSize - 3 params: third is lineSize
      // LINE x y lineSize opacity - 4 params: third is lineSize, fourth is opacity
      let lineSize = 1;
      let opacity = 255;

      if (tokens.length === 3 && tokens[2].type === 'NUMBER') {
        // Three parameters: LINE x y lineSize
        const lineSizeValue = Spin2NumericParser.parseCount(tokens[2].value);
        if (lineSizeValue !== null && lineSizeValue >= 1 && lineSizeValue <= 32) {
          lineSize = lineSizeValue;
        } else {
          result.warnings.push(`Invalid line size '${tokens[2].value}', using default: ${lineSize}`);
          this.logParameterWarning(context.originalCommand, 'LINE linesize', tokens[2].value, lineSize);
        }
      } else if (tokens.length >= 4) {
        // Four or more parameters: LINE x y lineSize opacity
        if (tokens[2].type === 'NUMBER') {
          const lineSizeValue = Spin2NumericParser.parseCount(tokens[2].value);
          if (lineSizeValue !== null && lineSizeValue >= 1 && lineSizeValue <= 32) {
            lineSize = lineSizeValue;
          } else {
            result.warnings.push(`Invalid line size '${tokens[2].value}', using default: ${lineSize}`);
            this.logParameterWarning(context.originalCommand, 'LINE linesize', tokens[2].value, lineSize);
          }
        }

        if (tokens[3].type === 'NUMBER') {
          const opacityValue = Spin2NumericParser.parseCount(tokens[3].value);
          if (opacityValue !== null && opacityValue >= 0 && opacityValue <= 255) {
            opacity = opacityValue;
          } else {
            result.warnings.push(`Invalid opacity '${tokens[3].value}', using default: ${opacity}`);
            this.logParameterWarning(context.originalCommand, 'LINE opacity', tokens[3].value, opacity);
          }
        }
      }

      // Create canvas operation
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.DRAW_LINE,
        { x, y, lineSize, opacity },
        true // LINE is deferrable
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];

      this.logConsoleMessage(`[PLOT] LINE parsed: x=${x}, y=${y}, lineSize=${lineSize}, opacity=${opacity}`);

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
          // Apply range clamping based on parameter type
          if (paramName === 'diameter') {
            // Clamp diameter to 1-2048 range
            if (value < 1) {
              params[paramName] = 1;
              result.warnings.push(`Diameter clamped from ${value} to 1`);
            } else if (value > 2048) {
              params[paramName] = 2048;
              result.warnings.push(`Diameter clamped from ${value} to 2048`);
            } else {
              params[paramName] = value;
            }
          } else if (paramName === 'width' || paramName === 'height') {
            // Clamp width/height to reasonable range (1-4096)
            if (value < 1) {
              params[paramName] = 1;
              result.warnings.push(`${paramName} clamped from ${value} to 1`);
            } else if (value > 4096) {
              params[paramName] = 4096;
              result.warnings.push(`${paramName} clamped from ${value} to 4096`);
            } else {
              params[paramName] = value;
            }
          } else {
            params[paramName] = value;
          }
        }
        tokenIndex++;
      }

      // Parse optional lineSize parameter
      let lineSize = commandName === 'DOT' ? 1 : 0; // DOT defaults to 1, others to 0 (filled)
      if (tokenIndex < tokens.length && tokens[tokenIndex].type === 'NUMBER') {
        const lineSizeValue = Spin2NumericParser.parseCount(tokens[tokenIndex].value);
        if (lineSizeValue !== null) {
          // Clamp lineSize to valid range
          if (commandName === 'DOT') {
            // DOT: must be 1-32 (cannot be filled/0)
            if (lineSizeValue < 1) {
              lineSize = 1;
              result.warnings.push(`Line size clamped from ${lineSizeValue} to 1`);
            } else if (lineSizeValue > 32) {
              lineSize = 32;
              result.warnings.push(`Line size clamped from ${lineSizeValue} to 32`);
            } else {
              lineSize = lineSizeValue;
            }
          } else {
            // Other shapes: 0 (filled) or 1-32 (outline)
            if (lineSizeValue < 0) {
              lineSize = 1; // Negative values clamp to 1
              result.warnings.push(`Line size clamped from ${lineSizeValue} to 1`);
            } else if (lineSizeValue === 0) {
              lineSize = 0; // Filled is valid for non-DOT shapes
            } else if (lineSizeValue > 32) {
              lineSize = 32;
              result.warnings.push(`Line size clamped from ${lineSizeValue} to 32`);
            } else {
              lineSize = lineSizeValue;
            }
          }
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
      this.logConsoleMessage(`[PLOT] ${commandName} parsed: ${paramStr}, lineSize=${lineSize}, opacity=${opacity}`);

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
      this.logConsoleMessage(`[PLOT] ORIGIN parsed: x=${x}, y=${y}`);

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
      this.logConsoleMessage(`[PLOT] POLAR parsed: twopi=${twopi}, offset=${offset}`);

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
      this.logConsoleMessage(`[PLOT] LINESIZE parsed: size=${size}`);

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
      this.logConsoleMessage(`[PLOT] OPACITY parsed: level=${level}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`OPACITY command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] OPACITY command execution failed: ${error}`);
    }

    return result;
  }

  // REMOVED: handleClearCommand, handleUpdateCommand, handleCloseCommand, handleSaveCommand
  // These commands are now handled by the base class handleCommonCommand() method


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
      this.logConsoleMessage(`[PLOT] COLOR parsed: ${colorValue}`);

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
      this.logConsoleMessage('[PARSER] Created color operation:', operation.type, '=', CanvasOperationType.SET_COLOR, 'params:', operation.parameters);

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] ${colorName} parsed: brightness=${brightness}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Color command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] Color command execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureCommand(context: CommandContext): CommandResult {
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
        result.errors.push('CONFIGURE command requires an option parameter');
        this.logError(`[PLOT PARSE ERROR] Missing option parameter for CONFIGURE command: ${context.originalCommand}`);
        return result;
      }

      const option = tokens[0].value.toUpperCase();

      switch (option) {
        case 'TITLE':
          return this.handleConfigureTitle(context, tokens.slice(1));
        case 'POS':
          return this.handleConfigurePos(context, tokens.slice(1));
        case 'SIZE':
          return this.handleConfigureSize(context, tokens.slice(1));
        case 'DOTSIZE':
          return this.handleConfigureDotSize(context, tokens.slice(1));
        case 'BACKCOLOR':
          return this.handleConfigureBackColor(context, tokens.slice(1));
        case 'HIDEXY':
          return this.handleConfigureHideXY(context, tokens.slice(1));
        case 'UPDATE':
          return this.handleConfigureUpdate(context, tokens.slice(1));
        default:
          result.success = false;
          result.errors.push(`Unknown CONFIGURE option: ${option}`);
          this.logError(`[PLOT PARSE ERROR] Unknown CONFIGURE option '${option}': ${context.originalCommand}`);
          return result;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE command execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureTitle(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      let title = '';

      if (tokens.length === 0) {
        result.success = false;
        result.errors.push('CONFIGURE TITLE requires a title text');
        this.logError(`[PLOT PARSE ERROR] Missing title text for CONFIGURE TITLE: ${context.originalCommand}`);
        return result;
      }

      // Handle quoted string (single token)
      if (tokens.length === 1 && tokens[0].type === 'STRING') {
        title = tokens[0].value;
      } else {
        // Handle unquoted multi-word title - concatenate all tokens with spaces
        title = tokens.map(token => token.value).join(' ');
      }

      // Validate title length (reasonable limit)
      if (title.length > 200) {
        result.warnings.push(`Title truncated to 200 characters`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE TITLE', title, title.substring(0, 200));
        title = title.substring(0, 200);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'TITLE', title: title },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE TITLE parsed: "${title}"`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE TITLE failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE TITLE execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigurePos(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      if (tokens.length < 2) {
        result.success = false;
        result.errors.push('CONFIGURE POS requires x and y coordinates');
        this.logError(`[PLOT PARSE ERROR] Missing coordinates for CONFIGURE POS: ${context.originalCommand}`);
        return result;
      }

      // Parse X coordinate (supports negative values for multi-monitor)
      const xValue = Spin2NumericParser.parseCoordinate(tokens[0].value);
      if (xValue === null) {
        result.warnings.push(`Invalid x coordinate '${tokens[0].value}', using 0`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE POS x', tokens[0].value, 0);
      }

      // Parse Y coordinate (supports negative values for multi-monitor)
      const yValue = Spin2NumericParser.parseCoordinate(tokens[1].value);
      if (yValue === null) {
        result.warnings.push(`Invalid y coordinate '${tokens[1].value}', using 0`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE POS y', tokens[1].value, 0);
      }

      const x = xValue ?? 0;
      const y = yValue ?? 0;

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'POS', x: x, y: y },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE POS parsed: x=${x}, y=${y}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE POS failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE POS execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureSize(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      if (tokens.length < 2) {
        result.success = false;
        result.errors.push('CONFIGURE SIZE requires width and height');
        this.logError(`[PLOT PARSE ERROR] Missing dimensions for CONFIGURE SIZE: ${context.originalCommand}`);
        return result;
      }

      // Parse width with clamping to 32-2048 range
      let width = 800; // default
      const widthValue = Spin2NumericParser.parseCount(tokens[0].value);
      if (widthValue !== null) {
        width = Math.max(32, Math.min(2048, widthValue));
        if (widthValue !== width) {
          result.warnings.push(`Width ${widthValue} clamped to ${width} (range: 32-2048)`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE SIZE width', tokens[0].value, width);
        }
      } else {
        result.warnings.push(`Invalid width '${tokens[0].value}', using default: ${width}`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE SIZE width', tokens[0].value, width);
      }

      // Parse height with clamping to 32-2048 range
      let height = 600; // default
      const heightValue = Spin2NumericParser.parseCount(tokens[1].value);
      if (heightValue !== null) {
        height = Math.max(32, Math.min(2048, heightValue));
        if (heightValue !== height) {
          result.warnings.push(`Height ${heightValue} clamped to ${height} (range: 32-2048)`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE SIZE height', tokens[1].value, height);
        }
      } else {
        result.warnings.push(`Invalid height '${tokens[1].value}', using default: ${height}`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE SIZE height', tokens[1].value, height);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'SIZE', width: width, height: height },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE SIZE parsed: width=${width}, height=${height}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE SIZE failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE SIZE execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureDotSize(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      if (tokens.length === 0) {
        result.success = false;
        result.errors.push('CONFIGURE DOTSIZE requires size parameter');
        this.logError(`[PLOT PARSE ERROR] Missing size for CONFIGURE DOTSIZE: ${context.originalCommand}`);
        return result;
      }

      // Parse dotsize with clamping to 1-32 range
      let dotSize = 1; // default
      const dotSizeValue = Spin2NumericParser.parseCount(tokens[0].value);
      if (dotSizeValue !== null) {
        dotSize = Math.max(1, Math.min(32, dotSizeValue));
        if (dotSizeValue !== dotSize) {
          result.warnings.push(`Dot size ${dotSizeValue} clamped to ${dotSize} (range: 1-32)`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE DOTSIZE', tokens[0].value, dotSize);
        }
      } else {
        result.warnings.push(`Invalid dot size '${tokens[0].value}', using default: ${dotSize}`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE DOTSIZE', tokens[0].value, dotSize);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'DOTSIZE', dotSize: dotSize },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE DOTSIZE parsed: dotSize=${dotSize}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE DOTSIZE failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE DOTSIZE execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureBackColor(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      if (tokens.length === 0) {
        result.success = false;
        result.errors.push('CONFIGURE BACKCOLOR requires color parameter');
        this.logError(`[PLOT PARSE ERROR] Missing color for CONFIGURE BACKCOLOR: ${context.originalCommand}`);
        return result;
      }

      let color = 'BLACK'; // default
      let brightness = 15; // default full brightness

      // Parse color - can be color name with optional brightness or hex value
      const colorValue = tokens[0].value.toUpperCase();

      // Check if it's a hex color
      if (colorValue.startsWith('$') || colorValue.toLowerCase().startsWith('0x')) {
        const parsedColor = Spin2NumericParser.parseColor(tokens[0].value);
        if (parsedColor !== null) {
          color = `#${parsedColor.toString(16).padStart(6, '0')}`;
        } else {
          result.warnings.push(`Invalid hex color '${tokens[0].value}', using default: BLACK`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE BACKCOLOR color', tokens[0].value, 'BLACK');
        }
      } else {
        // Color name
        const validColors = ['BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'CYAN', 'MAGENTA', 'YELLOW', 'ORANGE', 'GRAY', 'GREY'];
        if (validColors.includes(colorValue)) {
          color = colorValue;

          // Parse optional brightness parameter
          if (tokens.length > 1) {
            const brightnessValue = Spin2NumericParser.parseCount(tokens[1].value);
            if (brightnessValue !== null && brightnessValue >= 0 && brightnessValue <= 15) {
              brightness = brightnessValue;
            } else {
              result.warnings.push(`Invalid brightness '${tokens[1].value}', using default: ${brightness}`);
              this.logParameterWarning(context.originalCommand, 'CONFIGURE BACKCOLOR brightness', tokens[1].value, brightness);
            }
          }
        } else {
          result.warnings.push(`Invalid color name '${colorValue}', using default: BLACK`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE BACKCOLOR color', tokens[0].value, 'BLACK');
        }
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'BACKCOLOR', color: color, brightness: brightness },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE BACKCOLOR parsed: color=${color}, brightness=${brightness}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE BACKCOLOR failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE BACKCOLOR execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureHideXY(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      // HIDEXY is a toggle - no parameters needed, but can accept 0/1 for explicit control
      let hideXY = true; // default is to hide coordinates

      if (tokens.length > 0) {
        const value = Spin2NumericParser.parseCount(tokens[0].value);
        if (value !== null) {
          hideXY = value !== 0; // 0 = show, non-zero = hide
        } else {
          result.warnings.push(`Invalid HIDEXY value '${tokens[0].value}', using default: hide`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE HIDEXY', tokens[0].value, 1);
        }
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'HIDEXY', hideXY: hideXY },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE HIDEXY parsed: hideXY=${hideXY}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE HIDEXY failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE HIDEXY execution failed: ${error}`);
    }

    return result;
  }

  private handleConfigureUpdate(context: CommandContext, tokens: any[]): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      if (tokens.length === 0) {
        result.success = false;
        result.errors.push('CONFIGURE UPDATE requires rate parameter');
        this.logError(`[PLOT PARSE ERROR] Missing rate for CONFIGURE UPDATE: ${context.originalCommand}`);
        return result;
      }

      // Parse update rate with clamping to 1-120 Hz range
      let updateRate = 60; // default
      const rateValue = Spin2NumericParser.parseCount(tokens[0].value);
      if (rateValue !== null) {
        updateRate = Math.max(1, Math.min(120, rateValue));
        if (rateValue !== updateRate) {
          result.warnings.push(`Update rate ${rateValue} clamped to ${updateRate} (range: 1-120 Hz)`);
          this.logParameterWarning(context.originalCommand, 'CONFIGURE UPDATE rate', tokens[0].value, updateRate);
        }
      } else {
        result.warnings.push(`Invalid update rate '${tokens[0].value}', using default: ${updateRate}`);
        this.logParameterWarning(context.originalCommand, 'CONFIGURE UPDATE rate', tokens[0].value, updateRate);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.CONFIGURE_WINDOW,
        { action: 'UPDATE', updateRate: updateRate },
        false // CONFIGURE is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] CONFIGURE UPDATE parsed: updateRate=${updateRate}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`CONFIGURE UPDATE failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CONFIGURE UPDATE execution failed: ${error}`);
    }

    return result;
  }

  private handleColorModeCommand(context: CommandContext): CommandResult {
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
        result.errors.push('COLORMODE command requires mode parameter');
        this.logError(`[PLOT PARSE ERROR] Missing mode parameter for COLORMODE command: ${context.originalCommand}`);
        return result;
      }

      const modeValue = Spin2NumericParser.parseCount(tokens[0].value);
      let mode = 0; // default RGB

      if (modeValue !== null && modeValue >= 0 && modeValue <= 3) {
        mode = modeValue;
      } else {
        result.warnings.push(`Invalid color mode '${tokens[0].value}', using default: RGB (0)`);
        this.logParameterWarning(context.originalCommand, 'COLORMODE mode', tokens[0].value, 0);
      }

      // Map mode number to string for canvas operation
      const modeNames = ['RGB', 'HSV', 'INDEXED', 'GRAYSCALE'];
      const modeName = modeNames[mode];

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_COLOR_MODE,
        { mode: mode, modeName: modeName },
        true // COLORMODE should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] COLORMODE parsed: mode=${mode} (${modeName})`);

    } catch (error) {
      result.success = false;
      result.errors.push(`COLORMODE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] COLORMODE command execution failed: ${error}`);
    }

    return result;
  }

  private handleTextSizeCommand(context: CommandContext): CommandResult {
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
        result.errors.push('TEXTSIZE command requires multiplier parameter');
        this.logError(`[PLOT PARSE ERROR] Missing multiplier parameter for TEXTSIZE command: ${context.originalCommand}`);
        return result;
      }

      const sizeValue = Spin2NumericParser.parseCount(tokens[0].value);
      let textSize = 10; // default

      if (sizeValue !== null) {
        textSize = Math.max(1, Math.min(100, sizeValue));
        if (sizeValue !== textSize) {
          result.warnings.push(`Text size ${sizeValue} clamped to ${textSize} (range: 1-100)`);
          this.logParameterWarning(context.originalCommand, 'TEXTSIZE multiplier', tokens[0].value, textSize);
        }
      } else {
        result.warnings.push(`Invalid text size '${tokens[0].value}', using default: ${textSize}`);
        this.logParameterWarning(context.originalCommand, 'TEXTSIZE multiplier', tokens[0].value, textSize);
      }

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_TEXTSIZE,
        { textSize: textSize },
        true // TEXTSIZE should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] TEXTSIZE parsed: textSize=${textSize}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`TEXTSIZE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] TEXTSIZE command execution failed: ${error}`);
    }

    return result;
  }

  private handleTextStyleCommand(context: CommandContext): CommandResult {
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
        result.errors.push('TEXTSTYLE command requires style parameter');
        this.logError(`[PLOT PARSE ERROR] Missing style parameter for TEXTSTYLE command: ${context.originalCommand}`);
        return result;
      }

      const styleValue = Spin2NumericParser.parseCount(tokens[0].value);
      let textStyle = 0; // default no style

      if (styleValue !== null) {
        textStyle = Math.max(0, Math.min(7, styleValue));
        if (styleValue !== textStyle) {
          result.warnings.push(`Text style ${styleValue} clamped to ${textStyle} (range: 0-7)`);
          this.logParameterWarning(context.originalCommand, 'TEXTSTYLE style', tokens[0].value, textStyle);
        }
      } else {
        result.warnings.push(`Invalid text style '${tokens[0].value}', using default: ${textStyle}`);
        this.logParameterWarning(context.originalCommand, 'TEXTSTYLE style', tokens[0].value, textStyle);
      }

      // Decode bitfield for logging
      const styleFlags = [];
      if (textStyle & 1) styleFlags.push('bold');
      if (textStyle & 2) styleFlags.push('italic');
      if (textStyle & 4) styleFlags.push('underline');
      const styleDescription = styleFlags.length > 0 ? styleFlags.join('+') : 'normal';

      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_TEXTSTYLE,
        {
          textStyle: textStyle,
          bold: !!(textStyle & 1),
          italic: !!(textStyle & 2),
          underline: !!(textStyle & 4)
        },
        true // TEXTSTYLE should be deferrable with drawing operations
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] TEXTSTYLE parsed: style=${textStyle} (${styleDescription})`);

    } catch (error) {
      result.success = false;
      result.errors.push(`TEXTSTYLE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] TEXTSTYLE command execution failed: ${error}`);
    }

    return result;
  }

  // REMOVED: handlePcKeyCommand and handlePcMouseCommand
  // These commands are now handled by the base class handleCommonCommand() method
  // which properly implements TLong transmission to P2

  private handleSpriteDefCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      // Pascal format: SPRITEDEF id xsize ysize pixels... colors...
      // Minimum: id + xsize + ysize + (xsize*ysize pixels) + 256 colors
      if (tokens.length < 3) {
        result.success = false;
        result.errors.push('SPRITEDEF command requires at least sprite ID, width, and height');
        this.logError(`[PLOT PARSE ERROR] Missing parameters for SPRITEDEF command: ${context.originalCommand}`);
        return result;
      }

      // Parse sprite ID (0-255)
      const idValue = Spin2NumericParser.parseInteger(tokens[0].value, false);
      if (idValue === null || idValue < 0 || idValue > 255) {
        result.success = false;
        result.errors.push(`Invalid sprite ID: ${tokens[0].value}. Must be 0-255`);
        this.logError(`[PLOT PARSE ERROR] Invalid sprite ID for SPRITEDEF: ${tokens[0].value}`);
        return result;
      }

      // Parse width (1-32)
      const widthValue = Spin2NumericParser.parseInteger(tokens[1].value, false);
      if (widthValue === null || widthValue < 1 || widthValue > 32) {
        result.success = false;
        result.errors.push(`Invalid sprite width: ${tokens[1].value}. Must be 1-32`);
        this.logError(`[PLOT PARSE ERROR] Invalid sprite width for SPRITEDEF: ${tokens[1].value}`);
        return result;
      }

      // Parse height (1-32)
      const heightValue = Spin2NumericParser.parseInteger(tokens[2].value, false);
      if (heightValue === null || heightValue < 1 || heightValue > 32) {
        result.success = false;
        result.errors.push(`Invalid sprite height: ${tokens[2].value}. Must be 1-32`);
        this.logError(`[PLOT PARSE ERROR] Invalid sprite height for SPRITEDEF: ${tokens[2].value}`);
        return result;
      }

      const expectedPixels = widthValue * heightValue;
      const minimumTokens = 3 + expectedPixels; // id + width + height + pixels

      if (tokens.length < minimumTokens) {
        result.success = false;
        result.errors.push(`SPRITEDEF requires ${expectedPixels} pixel values for ${widthValue}x${heightValue} sprite, found ${tokens.length - 3}`);
        this.logError(`[PLOT PARSE ERROR] Insufficient pixel data for SPRITEDEF: ${context.originalCommand}`);
        return result;
      }

      // Parse pixel indices (xsize * ysize values)
      const pixels: number[] = [];
      for (let i = 0; i < expectedPixels; i++) {
        const tokenIndex = 3 + i;
        const pixelValue = Spin2NumericParser.parseInteger(tokens[tokenIndex].value, false);
        if (pixelValue === null || pixelValue < 0 || pixelValue > 255) {
          result.success = false;
          result.errors.push(`Invalid pixel index at position ${i}: ${tokens[tokenIndex].value}. Must be 0-255`);
          this.logError(`[PLOT PARSE ERROR] Invalid pixel index for SPRITEDEF: ${tokens[tokenIndex].value}`);
          return result;
        }
        pixels.push(pixelValue);
      }

      // Parse color palette (remaining tokens up to 256 colors)
      const colors: number[] = [];
      const colorTokenStart = 3 + expectedPixels;
      const maxColors = Math.min(256, tokens.length - colorTokenStart);

      for (let i = 0; i < maxColors; i++) {
        const tokenIndex = colorTokenStart + i;
        const colorValue = Spin2NumericParser.parseInteger(tokens[tokenIndex].value, true); // Allow hex colors
        if (colorValue === null) {
          result.success = false;
          result.errors.push(`Invalid color value at position ${i}: ${tokens[tokenIndex].value}`);
          this.logError(`[PLOT PARSE ERROR] Invalid color value for SPRITEDEF: ${tokens[tokenIndex].value}`);
          return result;
        }
        colors.push(colorValue & 0xFFFFFF); // Ensure 24-bit RGB
      }

      // Fill remaining colors with black if fewer than 256 provided
      while (colors.length < 256) {
        colors.push(0x000000);
      }

      // Create SPRITEDEF operation with Pascal-compatible data
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.DEFINE_SPRITE || ('DEFINE_SPRITE' as any),
        {
          spriteId: idValue,
          width: widthValue,
          height: heightValue,
          pixels: pixels,
          colors: colors
        },
        false // SPRITEDEF is immediate
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] SPRITEDEF ${idValue} ${widthValue}x${heightValue} parsed: ${pixels.length} pixels, ${maxColors} colors`);

    } catch (error) {
      result.success = false;
      result.errors.push(`SPRITEDEF command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] SPRITEDEF command execution failed: ${error}`);
    }

    return result;
  }

  private handleSpriteCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      const tokens = context.tokens;

      if (tokens.length < 1) {
        result.success = false;
        result.errors.push('SPRITE command requires sprite ID');
        this.logError(`[PLOT PARSE ERROR] Missing sprite ID for SPRITE command: ${context.originalCommand}`);
        return result;
      }

      // Parse sprite ID (0-255)
      const idValue = Spin2NumericParser.parseInteger(tokens[0].value, false);
      if (idValue === null || idValue < 0 || idValue > 255) {
        result.success = false;
        result.errors.push(`Invalid sprite ID: ${tokens[0].value}. Must be 0-255`);
        this.logError(`[PLOT PARSE ERROR] Invalid sprite ID for SPRITE: ${tokens[0].value}`);
        return result;
      }

      // Parse optional orientation (0-359 degrees)
      let orientation = 0;
      if (tokens.length > 1) {
        const orientationValue = Spin2NumericParser.parseInteger(tokens[1].value, false);
        if (orientationValue === null || orientationValue < 0 || orientationValue > 359) {
          result.warnings.push(`Invalid orientation '${tokens[1].value}', using default: ${orientation}`);
          this.logParameterWarning(context.originalCommand, 'SPRITE orientation', tokens[1].value, orientation);
        } else {
          orientation = orientationValue;
        }
      }

      // Parse optional scale (0.1-10.0 multiplier)
      let scale = 1.0;
      if (tokens.length > 2) {
        const scaleValue = Spin2NumericParser.parseFloat(tokens[2].value);
        if (scaleValue === null || scaleValue < 0.1 || scaleValue > 10.0) {
          result.warnings.push(`Invalid scale '${tokens[2].value}', using default: ${scale}`);
          this.logParameterWarning(context.originalCommand, 'SPRITE scale', tokens[2].value, scale);
        } else {
          scale = scaleValue;
        }
      }

      // Parse optional opacity (0-255 alpha value)
      let opacity = 255;
      if (tokens.length > 3) {
        const opacityValue = Spin2NumericParser.parseInteger(tokens[3].value, false);
        if (opacityValue === null || opacityValue < 0 || opacityValue > 255) {
          result.warnings.push(`Invalid opacity '${tokens[3].value}', using default: ${opacity}`);
          this.logParameterWarning(context.originalCommand, 'SPRITE opacity', tokens[3].value, opacity);
        } else {
          opacity = opacityValue;
        }
      }

      // Create SPRITE operation with Pascal format parameters
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.DRAW_SPRITE,
        {
          spriteId: idValue,
          orientation: orientation,
          scale: scale,
          opacity: opacity
        },
        true // SPRITE is deferrable
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] SPRITE ${idValue} orientation=${orientation}° scale=${scale} opacity=${opacity} parsed`);

    } catch (error) {
      result.success = false;
      result.errors.push(`SPRITE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] SPRITE command execution failed: ${error}`);
    }

    return result;
  }

  private handleLayerCommand(context: CommandContext): CommandResult {
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
        result.errors.push('LAYER command requires layer index and filename parameters');
        this.logError(`[PLOT PARSE ERROR] Missing parameters for LAYER command: ${context.originalCommand}`);
        return result;
      }

      // Parse layer index (1-16 per Pascal specification)
      const layerIndexValue = Spin2NumericParser.parseInteger(tokens[0].value, false);
      if (layerIndexValue === null || layerIndexValue < 1 || layerIndexValue > 16) {
        result.success = false;
        result.errors.push(`Invalid layer index: ${tokens[0].value}. Must be 1-16`);
        this.logError(`[PLOT PARSE ERROR] Invalid layer index for LAYER: ${tokens[0].value}`);
        return result;
      }

      const filename = tokens[1].value;
      if (!filename || filename.length === 0) {
        result.success = false;
        result.errors.push('LAYER command requires non-empty filename');
        this.logError(`[PLOT PARSE ERROR] Empty filename for LAYER command: ${context.originalCommand}`);
        return result;
      }

      // Validate file extension (should be .bmp)
      if (!filename.toLowerCase().endsWith('.bmp')) {
        result.success = false;
        result.errors.push(`Invalid file extension for LAYER: ${filename}. Only .bmp extension is supported`);
        this.logError(`[PLOT PARSE ERROR] Invalid file extension for LAYER: ${filename}`);
        return result;
      }

      // Create LAYER operation
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.LOAD_LAYER,
        {
          layerIndex: layerIndexValue,
          filename: filename
        },
        false // LAYER is immediate (needs to load before use)
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] LAYER ${layerIndexValue} "${filename}" parsed`);

    } catch (error) {
      result.success = false;
      result.errors.push(`LAYER command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] LAYER command execution failed: ${error}`);
    }

    return result;
  }

  private handleCropCommand(context: CommandContext): CommandResult {
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
        result.errors.push('CROP command requires layer index and coordinates');
        this.logError(`[PLOT PARSE ERROR] Missing parameters for CROP command: ${context.originalCommand}`);
        return result;
      }

      // Parse layer index (1-16 per Pascal specification)
      const layerValue = Spin2NumericParser.parseInteger(tokens[0].value, false);
      if (layerValue === null || layerValue < 1 || layerValue > 16) {
        result.success = false;
        result.errors.push(`Invalid layer index: ${tokens[0].value}. Must be 1-16`);
        this.logError(`[PLOT PARSE ERROR] Invalid layer index for CROP: ${tokens[0].value}`);
        return result;
      }

      // Check for AUTO mode: CROP layer AUTO x y
      if (tokens.length >= 4 && tokens[1].value.toUpperCase() === 'AUTO') {
        // Parse AUTO positioning mode
        const autoX = Spin2NumericParser.parseCoordinate(tokens[2].value);
        const autoY = Spin2NumericParser.parseCoordinate(tokens[3].value);

        if (autoX === null || autoY === null) {
          result.success = false;
          result.errors.push('CROP AUTO mode requires valid x and y coordinates');
          this.logError(`[PLOT PARSE ERROR] Invalid AUTO coordinates for CROP: ${context.originalCommand}`);
          return result;
        }

        // Create AUTO CROP operation
        const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
          CanvasOperationType.CROP_LAYER,
          {
            layerIndex: layerValue,
            mode: 'AUTO',
            destX: autoX,
            destY: autoY
          },
          true // CROP is deferrable
        );

        result.canvasOperations = [this.convertToCanvasOperation(operation)];
        this.logConsoleMessage(`[PLOT] CROP ${layerValue} AUTO ${autoX} ${autoY} parsed`);

      } else {
        // Parse explicit coordinate mode: CROP layer {left top width height {x y}}
        if (tokens.length < 5) {
          result.success = false;
          result.errors.push('CROP explicit mode requires layer, left, top, width, height parameters');
          this.logError(`[PLOT PARSE ERROR] Missing parameters for explicit CROP: ${context.originalCommand}`);
          return result;
        }

        // Parse left coordinate
        const leftValue = Spin2NumericParser.parseInteger(tokens[1].value, false);
        if (leftValue === null || leftValue < 0) {
          result.success = false;
          result.errors.push(`Invalid left coordinate: ${tokens[1].value}. Must be >= 0`);
          this.logError(`[PLOT PARSE ERROR] Invalid left coordinate for CROP: ${tokens[1].value}`);
          return result;
        }

        // Parse top coordinate
        const topValue = Spin2NumericParser.parseInteger(tokens[2].value, false);
        if (topValue === null || topValue < 0) {
          result.success = false;
          result.errors.push(`Invalid top coordinate: ${tokens[2].value}. Must be >= 0`);
          this.logError(`[PLOT PARSE ERROR] Invalid top coordinate for CROP: ${tokens[2].value}`);
          return result;
        }

        // Parse width
        const widthValue = Spin2NumericParser.parseInteger(tokens[3].value, false);
        if (widthValue === null || widthValue <= 0) {
          result.success = false;
          result.errors.push(`Invalid width: ${tokens[3].value}. Must be > 0`);
          this.logError(`[PLOT PARSE ERROR] Invalid width for CROP: ${tokens[3].value}`);
          return result;
        }

        // Parse height
        const heightValue = Spin2NumericParser.parseInteger(tokens[4].value, false);
        if (heightValue === null || heightValue <= 0) {
          result.success = false;
          result.errors.push(`Invalid height: ${tokens[4].value}. Must be > 0`);
          this.logError(`[PLOT PARSE ERROR] Invalid height for CROP: ${tokens[4].value}`);
          return result;
        }

        // Parse optional destination X coordinate
        let destX = 0;
        if (tokens.length > 5) {
          const xValue = Spin2NumericParser.parseCoordinate(tokens[5].value);
          if (xValue === null) {
            result.warnings.push(`Invalid x coordinate '${tokens[5].value}', using 0`);
            this.logParameterWarning(context.originalCommand, 'CROP x', tokens[5].value, 0);
          } else {
            destX = xValue;
          }
        }

        // Parse optional destination Y coordinate
        let destY = 0;
        if (tokens.length > 6) {
          const yValue = Spin2NumericParser.parseCoordinate(tokens[6].value);
          if (yValue === null) {
            result.warnings.push(`Invalid y coordinate '${tokens[6].value}', using 0`);
            this.logParameterWarning(context.originalCommand, 'CROP y', tokens[6].value, 0);
          } else {
            destY = yValue;
          }
        }

        // Create explicit CROP operation
        const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
          CanvasOperationType.CROP_LAYER,
          {
            layerIndex: layerValue,
            mode: 'EXPLICIT',
            left: leftValue,
            top: topValue,
            width: widthValue,
            height: heightValue,
            destX: destX,
            destY: destY
          },
          true // CROP is deferrable
        );

        result.canvasOperations = [this.convertToCanvasOperation(operation)];
        this.logConsoleMessage(`[PLOT] CROP ${layerValue} ${leftValue} ${topValue} ${widthValue} ${heightValue} ${destX} ${destY} parsed`);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`CROP command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] CROP command execution failed: ${error}`);
    }

    return result;
  }

  private handlePreciseCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      // PRECISE command has no parameters - it's just a toggle
      // Create PRECISE operation for the integrator to handle
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        CanvasOperationType.SET_PRECISION || ('SET_PRECISION' as any),
        {
          toggle: true  // Indicates this is a precision toggle operation
        },
        false // PRECISE is immediate (affects subsequent commands)
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] PRECISE precision toggle parsed`);

    } catch (error) {
      result.success = false;
      result.errors.push(`PRECISE command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] PRECISE command execution failed: ${error}`);
    }

    return result;
  }

  /**
   * Handle LUT command - sets single palette entry for indexed color mode
   * Pascal: LUT index color
   */
  private handleLutCommand(context: CommandContext): CommandResult {
    this.logConsoleMessage(`[LUT HANDLER] handleLutCommand called with context:`, context);
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      this.logConsoleMessage(`[LUT HANDLER] tokens.length = ${context.tokens.length}, tokens:`, context.tokens.map(t => `'${t.value}'(${t.type})`));
      // Validate parameters (expect index and color)
      if (!context.tokens || context.tokens.length < 2) {
        throw new Error('LUT command requires index and color parameters');
      }

      // Parse palette index (first parameter)
      const indexToken = context.tokens[0];
      const index = Spin2NumericParser.parseInteger(indexToken.value);
      if (index === null || index < 0 || index > 255) {
        throw new Error(`Invalid palette index: ${indexToken.value}. Must be 0-255`);
      }

      // Parse color value (second parameter)
      const colorToken = context.tokens[1];
      const colorValue = Spin2NumericParser.parseColor(colorToken.value);
      if (colorValue === null) {
        throw new Error(`Invalid color value: ${colorToken.value}`);
      }

      // Create LUT operation for the integrator to handle
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        'LUT_SET' as any,
        {
          index: index,
          color: colorValue
        },
        false // LUT is immediate (affects subsequent drawing commands)
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] LUT palette[${index}] = 0x${colorValue.toString(16).padStart(6, '0')} parsed`);

    } catch (error) {
      result.success = false;
      result.errors.push(`LUT command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] LUT command execution failed: ${error}. Command: ${context.originalCommand}`);
    }

    return result;
  }

  /**
   * Handle LUTCOLORS command - loads multiple RGB24 color values into consecutive palette entries
   * Pascal: LUTCOLORS color1 color2 ... colorN
   */
  private handleLutColorsCommand(context: CommandContext): CommandResult {
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: []
    };

    try {
      // Validate parameters - need at least one color
      if (!context.tokens || context.tokens.length < 1) {
        throw new Error('LUTCOLORS command requires at least one color parameter');
      }

      const colors: number[] = [];
      const errors: string[] = [];

      // Parse all color values - tokens are just the parameters, not including command
      for (let i = 0; i < context.tokens.length; i++) {
        const colorToken = context.tokens[i];
        const colorValue = Spin2NumericParser.parseColor(colorToken.value);

        if (colorValue !== null) {
          colors.push(colorValue);
        } else {
          errors.push(`Invalid color at position ${i}: ${colorToken.value}`);
        }
      }

      // Check if we have any valid colors
      if (colors.length === 0) {
        throw new Error('No valid colors found in LUTCOLORS command');
      }

      // Warn about invalid colors but continue with valid ones
      if (errors.length > 0) {
        result.warnings.push(`Some colors were invalid and skipped: ${errors.join(', ')}`);
      }

      // Limit to 256 colors maximum
      if (colors.length > 256) {
        result.warnings.push(`Too many colors (${colors.length}), limiting to first 256`);
        colors.splice(256);
      }

      // Create LUTCOLORS operation for the integrator to handle
      const operation: PlotCanvasOperation = PlotOperationFactory.createDrawOperation(
        'LUT_COLORS' as any,
        {
          colors: colors
        },
        false // LUTCOLORS is immediate (affects subsequent drawing commands)
      );

      result.canvasOperations = [this.convertToCanvasOperation(operation)];
      this.logConsoleMessage(`[PLOT] LUTCOLORS ${colors.length} colors loaded to palette`);

    } catch (error) {
      result.success = false;
      result.errors.push(`LUTCOLORS command failed: ${error}`);
      this.logError(`[PLOT PARSE ERROR] LUTCOLORS command execution failed: ${error}. Command: ${context.originalCommand}`);
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
    this.logConsoleMessage(message);
  }

  /**
   * Convert PlotCanvasOperation to CanvasOperation for interface compatibility
   */
  private convertToCanvasOperation(plotOp: PlotCanvasOperation): any {
    // Return the PlotCanvasOperation as-is since it has all the needed info
    // The integrator knows how to handle PlotCanvasOperation directly
    this.logConsoleMessage('[PARSER] convertToCanvasOperation returning:', plotOp.type, plotOp.parameters);
    return plotOp;
  }
}