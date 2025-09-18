# PLOT Command Reference

## Overview

This document provides a comprehensive technical reference for the PLOT window command system in PNut-Term-TS. The PLOT parser implements 27 commands across 5 major categories, providing full compatibility with P2 DEBUG PLOT functionality.

## Architecture Overview

### PlotCommandParser
- **Location**: `src/classes/shared/plotCommandParser.ts`
- **Purpose**: Deterministic tokenizer and command parser for PLOT commands
- **Design**: Command registration pattern with handler methods
- **Error Handling**: Comprehensive validation with detailed error messages

### Command Registration Pattern
```typescript
this.registerCommand({
  name: 'COMMAND_NAME',
  parameters: [
    { name: 'param1', type: 'number', required: true, range: { min: 0, max: 255 } },
    { name: 'param2', type: 'string', required: false }
  ],
  handler: this.handleCommandName.bind(this)
});
```

## Command Categories

### 1. Window Configuration (CONFIGURE group)
Commands that control window appearance and behavior.

#### CONFIGURE TITLE
- **Syntax**: `CONFIGURE TITLE "text"` or `CONFIGURE TITLE text`
- **Parameters**:
  - `text`: Window title (quoted strings support spaces)
- **Implementation**: `handleConfigureCommand()` → `handleConfigureTitle()`
- **Canvas Operation**: `CONFIGURE_TITLE`
- **Error Cases**: None (accepts any text)

#### CONFIGURE POS
- **Syntax**: `CONFIGURE POS x y`
- **Parameters**:
  - `x`: Horizontal position (supports negative for multi-monitor)
  - `y`: Vertical position (supports negative for multi-monitor)
- **Implementation**: `handleConfigureCommand()` → `handleConfigurePos()`
- **Canvas Operation**: `CONFIGURE_POS`
- **Error Cases**: Missing x or y coordinates

#### CONFIGURE SIZE
- **Syntax**: `CONFIGURE SIZE width height`
- **Parameters**:
  - `width`: Canvas width (32-2048 pixels, auto-clamped)
  - `height`: Canvas height (32-2048 pixels, auto-clamped)
- **Implementation**: `handleConfigureCommand()` → `handleConfigureSize()`
- **Canvas Operation**: `CONFIGURE_SIZE`
- **Error Cases**: Missing width or height

#### CONFIGURE DOTSIZE
- **Syntax**: `CONFIGURE DOTSIZE size`
- **Parameters**:
  - `size`: Default dot size (1-32 pixels, auto-clamped)
- **Implementation**: `handleConfigureCommand()` → `handleConfigureDotSize()`
- **Canvas Operation**: `CONFIGURE_DOTSIZE`
- **Error Cases**: Missing size parameter

#### CONFIGURE BACKCOLOR
- **Syntax**: `CONFIGURE BACKCOLOR color`
- **Parameters**:
  - `color`: Background color (name, hex, or RGB)
- **Implementation**: `handleConfigureCommand()` → `handleConfigureBackColor()`
- **Canvas Operation**: `CONFIGURE_BACKCOLOR`
- **Error Cases**: Invalid color format

#### CONFIGURE HIDEXY
- **Syntax**: `CONFIGURE HIDEXY flag`
- **Parameters**:
  - `flag`: 0 (show coordinates) or 1 (hide coordinates)
- **Implementation**: `handleConfigureCommand()` → `handleConfigureHideXY()`
- **Canvas Operation**: `CONFIGURE_HIDEXY`
- **Error Cases**: Missing flag parameter

#### CONFIGURE UPDATE
- **Syntax**: `CONFIGURE UPDATE rate`
- **Parameters**:
  - `rate`: Display refresh rate (1-120 Hz, auto-clamped)
- **Implementation**: `handleConfigureCommand()` → `handleConfigureUpdate()`
- **Canvas Operation**: `CONFIGURE_UPDATE`
- **Error Cases**: Missing rate parameter

### 2. Rendering Control (UPDATE group)
Commands that affect how subsequent drawing operations are rendered.

#### COLORMODE
- **Syntax**: `COLORMODE mode`
- **Parameters**:
  - `mode`: Color interpretation mode (0-3, auto-clamped)
    - 0: RGB mode (default)
    - 1: HSV mode
    - 2: Indexed palette mode
    - 3: Grayscale mode
- **Implementation**: `handleColorModeCommand()`
- **Canvas Operation**: `SET_COLORMODE`
- **Error Cases**: Missing mode parameter

#### TEXTSIZE
- **Syntax**: `TEXTSIZE multiplier`
- **Parameters**:
  - `multiplier`: Text size multiplier (1-100, auto-clamped)
- **Implementation**: `handleTextSizeCommand()`
- **Canvas Operation**: `SET_TEXTSIZE`
- **Error Cases**: Missing multiplier parameter

#### TEXTSTYLE
- **Syntax**: `TEXTSTYLE flags`
- **Parameters**:
  - `flags`: Style bitfield (0-7)
    - Bit 0: Bold
    - Bit 1: Italic
    - Bit 2: Underline
- **Implementation**: `handleTextStyleCommand()`
- **Canvas Operation**: `SET_TEXTSTYLE`
- **Error Cases**: Missing flags parameter

### 3. Basic Drawing Commands
Commands that create graphical elements on the canvas.

#### DOT
- **Syntax**: `DOT [lineSize] [opacity]`
- **Parameters**:
  - `lineSize`: Dot size (1-32 pixels, default: 1, auto-clamped)
  - `opacity`: Transparency (0-255, default: 255, auto-clamped)
- **Implementation**: `handleShapeCommand()`
- **Canvas Operation**: `DRAW_DOT`
- **Error Cases**: None (all parameters optional)

#### LINE
- **Syntax**: `LINE x y [lineSize] [opacity]`
- **Parameters**:
  - `x`: Target X coordinate (required)
  - `y`: Target Y coordinate (required)
  - `lineSize`: Line thickness (1-32 pixels, default: 1, auto-clamped)
  - `opacity`: Transparency (0-255, default: 255, auto-clamped)
- **Implementation**: `handleShapeCommand()`
- **Canvas Operation**: `DRAW_LINE`
- **Error Cases**: Missing x or y coordinates

#### CIRCLE
- **Syntax**: `CIRCLE diameter [lineSize] [opacity]`
- **Parameters**:
  - `diameter`: Circle diameter (1-2048 pixels, required, auto-clamped)
  - `lineSize`: Line thickness (1-32 pixels, default: 1, auto-clamped)
  - `opacity`: Transparency (0-255, default: 255, auto-clamped)
- **Implementation**: `handleShapeCommand()`
- **Canvas Operation**: `DRAW_CIRCLE`
- **Error Cases**: Missing diameter parameter

#### BOX
- **Syntax**: `BOX width height [lineSize] [opacity]`
- **Parameters**:
  - `width`: Rectangle width (required)
  - `height`: Rectangle height (required)
  - `lineSize`: Line thickness (1-32 pixels, default: 1, auto-clamped)
  - `opacity`: Transparency (0-255, default: 255, auto-clamped)
- **Implementation**: `handleShapeCommand()`
- **Canvas Operation**: `DRAW_BOX`
- **Error Cases**: Missing width or height

#### OVAL
- **Syntax**: `OVAL width height [lineSize] [opacity]`
- **Parameters**:
  - `width`: Ellipse width (required)
  - `height`: Ellipse height (required)
  - `lineSize`: Line thickness (1-32 pixels, default: 1, auto-clamped)
  - `opacity`: Transparency (0-255, default: 255, auto-clamped)
- **Implementation**: `handleShapeCommand()`
- **Canvas Operation**: `DRAW_OVAL`
- **Error Cases**: Missing width or height

#### TEXT
- **Syntax**: Multiple forms supported:
  - `TEXT "string"`
  - `TEXT size "string"`
  - `TEXT size style "string"`
  - `TEXT size style angle "string"`
- **Parameters**:
  - `size`: Font size multiplier (1-100, auto-clamped, default: current TEXTSIZE)
  - `style`: Style bitfield (0-7, default: current TEXTSTYLE)
  - `angle`: Rotation angle in degrees (default: 0)
  - `string`: Text to display (quoted string required)
- **Implementation**: `handleTextCommand()`
- **Canvas Operation**: `DRAW_TEXT`
- **Error Cases**: Missing or malformed string parameter

### 4. Interactive Commands
Commands that capture user input and return data to P2.

#### PC_KEY
- **Syntax**: `PC_KEY`
- **Parameters**: None
- **Implementation**: `handlePcKeyCommand()`
- **Canvas Operation**: `PC_KEY`
- **Behavior**:
  - Returns last pressed key code
  - Consumes key from buffer (one-shot reading)
  - Returns 0 if no key available
  - Non-blocking operation

#### PC_MOUSE
- **Syntax**: `PC_MOUSE`
- **Parameters**: None
- **Implementation**: `handlePcMouseCommand()`
- **Canvas Operation**: `PC_MOUSE`
- **Behavior**:
  - Returns 32-bit encoded mouse state:
    - Bits 0-11: X position (0-4095)
    - Bits 12-23: Y position (0-4095)
    - Bits 24-26: Button states (left/middle/right)
    - Bit 31: Mouse over canvas flag

### 5. Sprite and Layer System
Commands for reusable graphics and external bitmap integration.

#### SPRITEDEF
- **Syntax**: `SPRITEDEF id width height pixelData`
- **Parameters**:
  - `id`: Sprite ID (0-255, required)
  - `width`: Sprite width (1-32 pixels, required, auto-clamped)
  - `height`: Sprite height (1-32 pixels, required, auto-clamped)
  - `pixelData`: Hex pixel data string (required, format: $RRGGBBRRGGBB...)
- **Implementation**: `handleSpriteDefCommand()`
- **Canvas Operation**: `DEFINE_SPRITE`
- **Error Cases**:
  - Missing parameters
  - Invalid hex data format
  - Insufficient pixel data for dimensions

#### SPRITE
- **Syntax**: `SPRITE id [x] [y] [opacity]`
- **Parameters**:
  - `id`: Sprite ID (0-255, required)
  - `x`: X coordinate (default: current position)
  - `y`: Y coordinate (default: current position)
  - `opacity`: Transparency (0-255, default: 255, auto-clamped)
- **Implementation**: `handleSpriteCommand()`
- **Canvas Operation**: `DRAW_SPRITE`
- **Error Cases**:
  - Missing sprite ID
  - Undefined sprite ID

#### LAYER
- **Syntax**: `LAYER id filename`
- **Parameters**:
  - `id`: Layer ID (0-7, required)
  - `filename`: Bitmap filename (required, must end in .bmp)
- **Implementation**: `handleLayerCommand()`
- **Canvas Operation**: `LOAD_LAYER`
- **Error Cases**:
  - Missing parameters
  - Invalid file extension (not .bmp)
  - File not found in project directory
  - File read errors

#### CROP
- **Syntax**: Two forms supported:
  - `CROP layerId left top width height [x] [y]`
  - `CROP layerId` (draws entire layer)
- **Parameters**:
  - `layerId`: Layer ID (0-7, required)
  - `left`: Source left coordinate (default: 0)
  - `top`: Source top coordinate (default: 0)
  - `width`: Source width (default: layer width)
  - `height`: Source height (default: layer height)
  - `x`: Target X coordinate (default: current position)
  - `y`: Target Y coordinate (default: current position)
- **Implementation**: `handleCropCommand()`
- **Canvas Operation**: `CROP_LAYER`
- **Error Cases**:
  - Missing layer ID
  - Undefined layer ID
  - Invalid crop coordinates

### 6. Color Commands
Predefined color constants that can be used as commands.

#### Color Constants (16 supported)
- **BLACK**, **WHITE**, **RED**, **GREEN**, **BLUE**, **CYAN**, **MAGENTA**, **YELLOW**
- **ORANGE**, **PINK**, **AQUA**, **LIME**, **SILVER**, **GRAY**, **MAROON**, **NAVY**
- **Implementation**: `handleColorCommand()`
- **Canvas Operation**: `SET_COLOR`
- **Behavior**: Sets current drawing color for subsequent operations

## Tokenizer Design

### PlotTokenizer
- **Location**: `src/classes/shared/plotTokenizer.ts`
- **Purpose**: Deterministic string tokenization for PLOT commands
- **Features**:
  - Quoted string support with escape sequences
  - Hex number parsing ($RRGGBB, 0xRRGGBB)
  - Decimal/integer parsing
  - Whitespace normalization
  - Error position tracking

### Token Types
```typescript
interface PlotToken {
  type: 'COMMAND' | 'NUMBER' | 'STRING' | 'HEX' | 'IDENTIFIER';
  value: string;
  numericValue?: number;
  position: number;
}
```

## Error Handling Philosophy

### Validation Strategy
1. **Parameter Presence**: Required parameters must be provided
2. **Type Validation**: Numbers vs strings vs identifiers
3. **Range Clamping**: Numeric values auto-clamped to valid ranges
4. **Graceful Degradation**: Invalid values use defaults when possible
5. **Comprehensive Logging**: All errors reported to Debug Logger

### Error Message Format
```
[PLOT PARSE ERROR] <command>: <specific error description>
```

Examples:
- `[PLOT PARSE ERROR] LINE: Missing required Y coordinate`
- `[PLOT PARSE ERROR] SPRITEDEF: Invalid hex pixel data format`
- `[PLOT PARSE ERROR] LAYER: Bitmap file not found: background.bmp`

## Performance Characteristics

### Command Processing
- **Target**: <10ms per command
- **Measurement**: PlotPerformanceMonitor integration
- **Bottlenecks**: Complex sprite operations, large bitmap loading

### Memory Management
- **Sprite Storage**: Efficient bitmap caching (256 sprites max)
- **Layer Storage**: External bitmap loading (8 layers max)
- **Cleanup**: Automatic resource management on window close

### Canvas Operations
- **Double Buffering**: Smooth rendering with back buffer
- **Batch Processing**: Operations queued and executed efficiently
- **Frame Rate**: Target 60fps sustained performance

## Extension Points

### Adding New Commands
1. **Register Command**: Add to constructor with parameters and handler
2. **Implement Handler**: Create handler method following naming pattern
3. **Canvas Operation**: Add operation type to enum if needed
4. **Integration**: Update integrator if new operation type required
5. **Testing**: Add comprehensive tests for new command
6. **Documentation**: Update this reference and user guide

### Handler Pattern
```typescript
private handleNewCommand(tokens: PlotToken[]): PlotCommand {
  const command = this.createCommand('NEWCOMMAND', tokens);

  // Parameter validation
  const param1 = this.extractRequiredParameter(tokens, 0, 'parameter1');
  const param2 = this.extractOptionalParameter(tokens, 1, 'parameter2', defaultValue);

  // Range validation/clamping
  const clampedParam = this.clampValue(param1, min, max);

  // Create canvas operation
  const operation = this.convertToCanvasOperation('NEW_OPERATION', {
    param1: clampedParam,
    param2: param2
  });

  command.canvasOperations = [operation];
  return command;
}
```

## Testing Strategy

### Test Coverage
- **Unit Tests**: Individual command parsing and validation
- **Integration Tests**: Command sequences and state management
- **Performance Tests**: Stress testing and benchmarking
- **Regression Tests**: All 27 commands comprehensive coverage

### Test Files
- `tests/plotDrawingCommands.test.ts` - Basic drawing commands
- `tests/plotRegressionSuite.test.ts` - Full command coverage
- `tests/plotPerformance.test.ts` - Performance benchmarking

## Migration Notes

### Pascal to TypeScript Differences
1. **Error Handling**: More comprehensive validation and reporting
2. **Parameter Clamping**: Automatic range clamping vs Pascal rejection
3. **File Loading**: Node.js filesystem vs Pascal file handling
4. **Coordinate System**: Consistent canvas coordinates
5. **Performance Monitoring**: Real-time metrics not available in Pascal

### Compatibility Considerations
- **Command Syntax**: Fully compatible with P2 DEBUG PLOT
- **Parameter Ranges**: Maintained Pascal behavior where possible
- **Error Messages**: Enhanced but still clear and actionable
- **File Paths**: Relative to executable directory (same as Pascal)

## Debugging Tips

### Development Tools
1. **Performance Overlay**: Real-time metrics in PLOT window
2. **Debug Logger**: Comprehensive parsing and error messages
3. **Console Logging**: Detailed execution flow (development builds)
4. **Test Suite**: Automated validation of all commands

### Common Issues
- **File Loading**: Ensure .bmp files in correct directory
- **Sprite Definitions**: Define sprites before using with SPRITE
- **Parameter Types**: Check number vs string parameter requirements
- **Coordinate Ranges**: Verify coordinates within canvas bounds

This reference provides the complete technical foundation for understanding, maintaining, and extending the PLOT command system in PNut-Term-TS.