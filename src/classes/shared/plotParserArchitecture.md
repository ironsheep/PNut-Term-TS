# PLOT Parser Architecture Blueprint

## Overview

This document defines the new PLOT command parser architecture that eliminates all lookahead parsing (`nextPartIsNumeric()`) in favor of deterministic tokenization and command registry pattern.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    DebugPlotWindow                          │
│                  (Main Window Class)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                PlotCommandParser                           │
│              (Main Parser Class)                           │
│  • parse(message: string): ParsedCommand[]                 │
│  • executeCommands(commands: ParsedCommand[]): Result[]    │
│  • Integrates with debug logger                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
┌───────────────┐ ┌──────────┐ ┌─────────────────┐
│ PlotTokenizer │ │ Registry │ │ PlotErrorHandler│
│               │ │          │ │                 │
│ • tokenize()  │ │ • get    │ │ • logError()    │
│ • validate()  │ │ • validate│ │ • applyRecovery│
└───────────────┘ └──────────┘ └─────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
┌──────────────┐ ┌─────────┐ ┌─────────────┐
│ CONFIGURE    │ │ UPDATE  │ │ DRAWING     │
│ Commands     │ │Commands │ │ Commands    │
│              │ │         │ │             │
│ • TITLE      │ │• COLMODE│ │ • TEXT      │
│ • POS        │ │• TXTSIZE│ │ • LINE      │
│ • SIZE       │ │• TXTST  │ │ • CIRCLE    │
│ • DOTSIZE    │ │• PC_KEY │ │ • DOT       │
│ • BACKCOLOR  │ │• PC_MOUSE│ │ • BOX      │
│ • HIDEXY     │ │         │ │ • OVAL      │
│ • UPDATE     │ │         │ │ • SET       │
└──────────────┘ └─────────┘ └─────────────┘
```

## Token Flow (Eliminates Lookahead)

### Old Approach (BROKEN)
```typescript
// FRAGILE: Uses lookahead to guess intent
if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
  // Maybe it's a parameter? Maybe it's text content?
  // Ambiguous! Can fail on "TEXT '123 Main St'"
}
```

### New Approach (DETERMINISTIC)
```typescript
// ROBUST: Deterministic tokenization first
const tokens = tokenizer.tokenize(message);
// tokens = [
//   { type: 'COMMAND', value: 'TEXT' },
//   { type: 'NUMBER', value: '12' },      // size parameter
//   { type: 'STRING', value: "'Hello'" }   // text content - clearly delimited
// ]

const command = registry.getCommand(tokens[0].value);
const validation = registry.validateParameters(command, tokens.slice(1));
```

## Key Architectural Principles

### 1. Token-First Parsing
- **Input**: Raw command string
- **Step 1**: Tokenize into typed tokens (COMMAND, NUMBER, STRING, DELIMITER)
- **Step 2**: Identify command and extract parameters
- **Step 3**: Validate parameters against command definition
- **Step 4**: Execute with error recovery

### 2. Command Registry Pattern
```typescript
// Commands are registered with explicit parameter definitions
registry.registerCommand({
  name: 'TEXT',
  parameters: [
    { name: 'size', type: 'number', required: false, defaultValue: 10 },
    { name: 'style', type: 'number', required: false, defaultValue: 1 },
    { name: 'angle', type: 'number', required: false, defaultValue: 0 },
    { name: 'text', type: 'string', required: true }
  ],
  handler: handleTextCommand
});
```

### 3. Error Recovery Without Lookahead
```typescript
// Instead of guessing what comes next, handle errors gracefully
if (parameter.isValid) {
  useParameter(parameter.convertedValue);
} else {
  errorHandler.logError(error);
  useDefaultValue(parameter.defaultValue);
  // Continue parsing without breaking
}
```

## Critical Fixes

### TEXT Command Disambiguation
**Problem**: `TEXT size style angle 'text'` vs `TEXT 'text'` - ambiguous parameter parsing

**Solution**:
```typescript
// Tokenizer handles quotes properly
const tokens = tokenizer.tokenize("TEXT 12 4 90 'Hello World'");
// Result: [COMMAND:TEXT, NUMBER:12, NUMBER:4, NUMBER:90, STRING:'Hello World']

// Registry validates against definition
const validation = registry.validateParameters('TEXT', [12, 4, 90, 'Hello World']);
// Result: All valid, maps to size=12, style=4, angle=90, text='Hello World'
```

### CONFIGURE Command Missing Issue
**Problem**: CONFIGURE commands parsed in display spec but not available at runtime

**Solution**:
```typescript
// Register runtime CONFIGURE commands
registry.registerCommand({
  name: 'CONFIGURE',
  subcommands: {
    'TITLE': { parameters: [{ name: 'title', type: 'string', required: true }] },
    'POS': { parameters: [
      { name: 'x', type: 'coordinate', required: true },
      { name: 'y', type: 'coordinate', required: true }
    ]},
    'SIZE': { parameters: [
      { name: 'width', type: 'number', required: true, range: { min: 32, max: 2048 }},
      { name: 'height', type: 'number', required: true, range: { min: 32, max: 2048 }}
    ]}
  }
});
```

## Integration Points

### 1. Debug Logger Integration
```typescript
class PlotCommandParser {
  private errorHandler: PlotErrorHandler;

  constructor(private context: Context) {
    this.errorHandler = new PlotErrorHandler();
    this.errorHandler.initializeDebugLogger(context);
  }

  private handleParseError(error: PlotError): void {
    // Automatically logs to debug logger with [PLOT PARSE ERROR] prefix
    this.errorHandler.logError(error);
  }
}
```

### 2. Canvas Operation Abstraction
```typescript
// Commands produce canvas operations instead of direct canvas calls
interface CanvasOperation {
  type: 'DRAW_TEXT' | 'DRAW_LINE' | 'SET_CURSOR' | 'CONFIGURE_WINDOW';
  parameters: Record<string, any>;
}

// Executor applies operations to actual canvas
class CanvasOperationExecutor {
  execute(operation: CanvasOperation, plotWindow: DebugPlotWindow): void {
    switch (operation.type) {
      case 'DRAW_TEXT':
        plotWindow.drawText(operation.parameters);
        break;
      // ...
    }
  }
}
```

### 3. State Management
```typescript
// Parser maintains command context without side effects
interface ParserState {
  currentPosition: Position;
  currentColor: string;
  textSize: number;
  lineWidth: number;
  opacity: number;
  coordinateMode: 'CARTESIAN' | 'POLAR';
}

// State changes are explicit operations
const operation: CanvasOperation = {
  type: 'SET_CURSOR',
  parameters: { x: 100, y: 200 }
};
```

## Performance Benefits

### Eliminated Complexity
- **Before**: O(n²) lookahead scanning across command string
- **After**: O(n) single-pass tokenization + O(1) command lookup

### Memory Efficiency
- **Before**: String parsing creates temporary arrays and substring operations
- **After**: Structured tokens with minimal allocations

### Error Reporting
- **Before**: Generic "parsing failed" with no context
- **After**: Specific error location, suggested fixes, and graceful recovery

## Migration Strategy

### Phase 1: Foundation (Current Task)
1. ✅ Create interfaces and architecture
2. ✅ Implement tokenizer
3. ✅ Create command registry
4. ✅ Design error handling

### Phase 2: Command Migration
1. Implement core PlotCommandParser class
2. Migrate TEXT command as proof-of-concept
3. Migrate all 27 existing commands
4. Replace old parser in DebugPlotWindow

### Phase 3: New Commands
1. Add missing CONFIGURE commands
2. Add missing UPDATE commands
3. Comprehensive testing

### Phase 4: Optimization
1. Performance tuning
2. Memory optimization
3. Advanced error recovery

## Success Metrics

### Parser Robustness
- ✅ Zero `nextPartIsNumeric()` calls
- ✅ 100% deterministic token classification
- ✅ Comprehensive error recovery

### Command Coverage
- ✅ All 27 existing commands migrated
- ✅ All CONFIGURE commands implemented
- ✅ All UPDATE commands implemented

### Error Handling
- ✅ All parse errors logged to debug logger
- ✅ Specific error messages with suggestions
- ✅ Graceful degradation on invalid input

### Performance
- ✅ Parsing time < 10ms per command
- ✅ Memory usage < 100MB for typical workload
- ✅ 60fps rendering maintained

## File Structure

```
src/classes/shared/
├── plotCommandInterfaces.ts     # Core type definitions
├── plotCommandRegistry.ts       # Command registration system
├── plotErrorHandler.ts          # Error handling and logging
├── plotTokenizer.ts            # Deterministic tokenization
├── plotCommandParser.ts        # Main parser implementation
└── plotCommands/
    ├── configureCommands.ts    # CONFIGURE command handlers
    ├── updateCommands.ts       # UPDATE command handlers
    └── drawingCommands.ts      # Drawing command handlers
```

This architecture eliminates ALL lookahead parsing while providing better error reporting, performance, and maintainability than the current fragile string-scanning approach.