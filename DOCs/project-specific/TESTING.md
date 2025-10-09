# Testing Guide for PNut-Term-TS

This document explains how to run the comprehensive test suite for the PNut-Term-TS debug window system.

## Prerequisites

Ensure you have the project dependencies installed:

```bash
npm install
```

## Test Commands

The project includes several npm scripts for running tests:

### Basic Test Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs when files change)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output (shows all test names)
npm run test:verbose
```

### Advanced Test Commands

```bash
# Run specific test file
npm test -- --testPathPattern=debugColor.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="trigger"

# Run tests in a specific directory
npm test -- tests/

# Run tests with debugging output
npm test -- --verbose --no-silent

# Run a single test suite
npm test -- --testPathPattern=packedDataProcessor.test.ts
```

## Test Structure

The test suite is organized in the `/tests` directory:

```
tests/
├── canvasRenderer.test.ts          # Canvas rendering operations
├── colorCommand.test.ts            # COLOR command implementation
├── debugColor.test.ts              # Color system and brightness
├── displaySpecParser.test.ts       # Common keyword parsing
├── integrationTests.test.ts        # Full system integration
├── logicTrigger.test.ts           # Logic window trigger system
├── packedDataIntegration.test.ts   # Cross-window packed data
├── packedDataProcessor.test.ts     # Packed data unpacking
├── scopeTrigger.test.ts           # Scope window trigger system
├── spacingDirective.test.ts       # SPACING directive fix
└── triggerProcessor.test.ts       # Trigger processor classes
```

## Test Categories

### Unit Tests
- **Shared Classes**: Test individual utility classes in isolation
- **Color System**: Validate RGB/hex parsing and brightness scaling
- **Packed Data**: Verify unpacking of all 13 data modes (longs/words/bytes 1-16bit)
- **Canvas Operations**: Mock HTML5 canvas operations

### Integration Tests
- **Cross-Window Consistency**: Ensure Logic and Scope windows behave identically
- **Feature Combinations**: Test packed data + triggers + colors together
- **Real-World Scenarios**: Simulate P2 microcontroller debug data streams
- **Performance**: Validate memory usage and streaming performance

### System Tests
- **Build Verification**: Ensure all TypeScript compiles without errors
- **Visual Indicators**: Test trigger status displays and position markers
- **Command Parsing**: Validate debug string parsing and error handling

## Coverage Reports

To generate and view test coverage:

```bash
# Generate coverage report
npm run test:coverage

# View coverage report (opens in browser)
open coverage/lcov-report/index.html
```

Coverage includes:
- Line coverage for all shared classes
- Branch coverage for conditional logic
- Function coverage for all exported methods
- Statement coverage for error handling

## Debugging Tests

### Running Individual Tests

```bash
# Run a specific test file with detailed output
npm test -- --testPathPattern=triggerProcessor.test.ts --verbose

# Run specific test within a file
npm test -- --testNamePattern="Logic Window Trigger System"

# Run tests with additional debugging
npm test -- --no-silent --verbose
```

### Common Issues

1. **Import Errors**: Ensure TypeScript compilation succeeds with `npm run build`
2. **Mock Issues**: Check that HTML canvas contexts are properly mocked
3. **Timing Issues**: Some tests have 30-second timeouts for complex operations

## Test Configuration

The test suite uses Jest with TypeScript support:

- **Configuration**: `jest.config.js`
- **TypeScript**: Uses `ts-jest` preset
- **Environment**: Node.js environment for all tests
- **Timeout**: 30 seconds for complex integration tests

## Continuous Integration

The test suite is designed to run in CI environments:

```bash
# CI-friendly test run (no watch mode, exit on completion)
npm test -- --ci --coverage --watchAll=false
```

## Test Data

Tests use realistic debug string examples:

```typescript
// Logic analyzer with SPI monitoring
'`LOGIC SPI_Monitor longs_8bit SAMPLES 32 TRIGGER %11110000 %10100000'

// Scope with ADC channels and auto-trigger
'`SCOPE ADC_Monitor'
"'Voltage' AUTO 200 100 %1111 GREEN"
"'Current' -50 50 150 50 %1111 YELLOW"

// Color commands with brightness
'`LOGIC test1 COLOR CYAN 12 GRAY 6'
```

## Performance Benchmarks

Integration tests validate:
- **Memory Usage**: < 1MB for 8 simultaneous windows
- **Sample Rate**: 1MHz real-time data processing
- **Latency**: < 16ms display updates (60 FPS)
- **Trigger Response**: < 1ms for pattern detection

Run performance tests:

```bash
npm test -- --testPathPattern=integrationTests.test.ts
```

## Contributing

When adding new tests:

1. Follow the existing naming convention: `*.test.ts`
2. Use descriptive test names that explain the expected behavior
3. Include both positive and negative test cases
4. Add realistic test data that matches P2 debug scenarios
5. Update this README if adding new test categories

## Troubleshooting

### Common Test Failures

1. **Case Sensitivity**: Color hex values should use `.toLowerCase()` for comparison
2. **Timing**: Use `async/await` for operations that might take time
3. **Mocking**: Ensure canvas contexts and DOM elements are properly mocked
4. **Type Errors**: Run `npm run build` to catch TypeScript issues before testing

### Getting Help

- Check Jest documentation: https://jestjs.io/docs/getting-started
- Review test files for examples of proper mocking and assertions
- Run tests with `--verbose` flag for detailed output
- Use `--no-silent` to see console.log output from tests