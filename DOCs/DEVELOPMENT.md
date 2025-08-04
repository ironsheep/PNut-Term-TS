# Development Guide

This guide contains common development commands and scenarios for working with PNut-Term-TS.

## Quick Command Reference

### Build Commands
- `npm run build` - Full build pipeline (TypeScript → esbuild → date insertion → minification)
- `npm run buildnew` - Build without date insertion
- `tsc` - TypeScript compilation only (outputs to `./dist`)
- `tsc --noEmit` - Type check without building (useful for quick validation)
- `npm run minify` - Minify the built JavaScript using Terser

### Test Commands

**Basic Testing:**
- `npm test` - Run all tests (includes automatic build via pretest)
- `npm test -- tests/specific-file.test.ts` - Run a specific test file
- `npm test -- --testNamePattern="pattern"` - Run tests matching a pattern
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:nobuild` - Run tests without building

**Coverage Commands:**
- `npm run test:coverage` - **Default: Sequential coverage** (recommended for reliability)
- `npm run test:coverage:parallel` - Parallel coverage (faster but may timeout)
- `npm run test:coverage:throttled` - Throttled coverage (2 workers + extra memory)

**Resource Management:**
- `npm run test:sequential` - Run tests sequentially (prevents resource conflicts)
- `npm run test:limited` - Limited to 2 workers
- `npm run test:throttled` - Memory limits + reduced workers + leak detection

### Development Tools
- `npm run clean` - Remove build artifacts (`./dist`, `./release`, `./prebuilds`, `./fonts`)
- `npm run help` - Build and show help output
- `npm run start` - Run the built application
- `node dist/pnut-term-ts.min.js` - Direct execution

### Platform Packaging
- `npm run packageLnx` - Linux package build
- `npm run packageMac` - macOS package build  
- `npm run packageWin` - Windows package build

## Common Development Scenarios

### Adding a New Debug Window Type

1. **Create the window class**:
   ```typescript
   // src/classes/debugNewWindow.ts
   export class DebugNewWindow extends DebugWindowBase {
     constructor(ctx: Context) { 
       super(ctx); 
     }
     
     closeDebugWindow(): void { 
       // Cleanup logic
     }
     
     updateContent(lineParts: string[]): void { 
       // Process debug commands
     }
   }
   ```

2. **Add to debug display types**:
   - Update `DebugDisplayType` enum in `src/classes/shared/debugStatements.ts`

3. **Register in main window factory**:
   - Add case in `MainWindow` class for creating your window type

4. **Create tests**:
   - Add test file: `tests/debugNewWindow.test.ts`
   - Follow existing test patterns

5. **Update documentation**:
   - Add to implementation tracking table in CLAUDE.md
   - Update test-status-summary.md when tests are complete

### Debugging Serial Communication Issues

1. **Enable verbose logging**:
   ```bash
   node dist/pnut-term-ts.min.js --verbose
   ```

2. **Linux USB permissions**:
   ```bash
   # Add user to dialout group
   sudo usermod -a -G dialout $USER
   # Logout and login for changes to take effect
   ```

3. **Specify exact device**:
   ```bash
   node dist/pnut-term-ts.min.js --port /dev/ttyUSB0
   ```

4. **Monitor log files**:
   - Check `LOGs/` directory for timestamped traffic logs
   - Each download creates a new log file

### Working with Pascal Source

The Pascal reference implementation is located at `/pascal-source/` (root filesystem, not workspace).

1. **Key files for reference**:
   - `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` - Main implementation
   - `/pascal-source/P2_PNut_Public/P2 Spin2 Documentation v51-250425.pdf` - Complete spec

2. **Testing with Pascal binaries**:
   - Use files in `/pascal-source/P2_PNut_Public/DEBUG-TESTING/`
   - Example: `DEBUG_BITMAP_*.bin` for bitmap window testing

3. **Comparing implementations**:
   - Line counts in CLAUDE.md help estimate complexity
   - Use PDF documentation for exact command specifications

### Running Tests Efficiently

#### Quick test health check:
```bash
# Count test files
./node_modules/.bin/jest --listTests | wc -l

# Run and see summary
./node_modules/.bin/jest 2>&1 | tail -10
```

#### Debug a specific test:
```bash
# Run in Node debug mode
node --inspect-brk ./node_modules/.bin/jest tests/debugLogicWin.test.ts --runInBand

# Then attach with Chrome DevTools or VS Code debugger
```

#### Clear Jest cache if tests misbehave:
```bash
./node_modules/.bin/jest --clearCache
```

## Code Style and Formatting

- **Prettier**: Configured via `.prettierrc.json`
  - Line width: 120 characters
  - Single quotes
  - Trailing comma: none
  - Tab width: 2 spaces

- **TypeScript**: Strict mode enabled
  - Target: ES2020
  - Module: CommonJS
  - Source maps generated

## Performance Considerations

- Debug windows use HTML5 Canvas for rendering
- Real-time data requires efficient algorithms
- Avoid blocking the event loop during serial communication
- Use `OffscreenCanvas` for complex rendering (see PlotWindow)
- Packed data processing is optimized for streaming

## Troubleshooting

### Tests won't run
1. Ensure build is complete: `npm run build`
2. Check for TypeScript errors: `tsc --noEmit`
3. Clear Jest cache: `./node_modules/.bin/jest --clearCache`

### Serial port issues
- Windows: May need to install drivers for PropPlug
- macOS: Check System Preferences > Security for blocked software
- Linux: Ensure user is in `dialout` group

### Memory issues during tests
Use throttled test commands:
```bash
npm run test:throttled
# or
npm run test:sequential
```

### Coverage execution issues
The Electron-based test suite with 800+ tests can experience resource conflicts:

**✅ Recommended (default):**
```bash
npm run test:coverage  # Sequential execution - reliable
```

**⚡ Alternative (faster but risky):**
```bash
npm run test:coverage:parallel  # May timeout under resource pressure
```

**Why sequential is default:** Our comprehensive testing showed that parallel execution can cause timeout and resource conflicts with the large Electron-based test suite, while sequential execution provides 100% reliability with only modest time increase (~90-120 seconds total).