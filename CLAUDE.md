# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan & Review

### Before Starting Work
- Always start in plan mode to create a comprehensive plan
- Write the plan to ./tasks/TASK_NAME.md with detailed implementation steps and reasoning
- Research any external dependencies or latest packages if needed (use Task tool)
- Keep plans focused on MVP - don't over-engineer
- Present the plan for review and wait for approval before proceeding
- After approval, create a detailed todo list with paragraph-length descriptions that incorporate all feedback

### Todo List Format
- **Always write comprehensive paragraph descriptions** for each todo item
- Include: specific steps, file references, context, and expected outcomes
- Reference Pascal source files or documentation where relevant
- Add time estimates and priority levels
- Never use brief bullet points - be thorough and explicit

### While Implementing
- Update the plan document as work progresses
- After completing each task, document what was changed in detail
- Include enough information for another engineer to understand and continue the work
- **Maintain compaction-ready state**: Always keep work in a committable state with clear documentation
- **When user warns about compaction**: 
  - Immediately save current state to a CURRENT_STATE_BEFORE_COMPACT.md file
  - Document: completed tasks, in-progress work, next steps, and key context
  - Confirm when ready for compaction
- **Best resume instructions**: Tell user to ask "show me the current todo list and read CURRENT_STATE_BEFORE_COMPACT.md" to restore context

## Quick Reference - Pascal Source Location

**IMPORTANT**: The Pascal reference source is located at `/pascal-source/` in the root filesystem, NOT in the workspace.

**Key Pascal Files**:
- `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` - Core debug display implementation
- `/pascal-source/P2_PNut_Public/DebugUnit.pas` - Window management
- `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` - Debugger functionality

**Documentation PDFs**:
- `/pascal-source/P2_PNut_Public/P2 Spin2 Documentation v51-250425.pdf` - Complete Spin2 reference
- `/pascal-source/P2_PNut_Public/MouseComamnds.pdf` - PC_KEY and PC_MOUSE specifications
- `/pascal-source/P2_PNut_Public/debugStatements.pdf` - Debug display command reference

## Project Overview

PNut-Term-TS is a cross-platform debug terminal for Parallax Propeller2 microcontrollers, built as an Electron application with TypeScript. It recreates Chip's Debug listener with multiplatform support, combining PST (Propeller Serial Terminal) functionality with downloader capabilities and comprehensive debug display support.

This is part of the P2 Multi-platform Development Environment:
1. VSCode Spin2 Extension (editing P1/P2 code)
2. PNut-TS compiler (multiplatform PNut compiler in TypeScript)
3. PNut-Term-TS (this tool) - terminal replacement with download and debug support

## Quick Command Reference

### Essential Commands
- `npm run build` - Full build pipeline
- `npm test` - Run all tests (includes build)
- `npm run test:coverage` - Generate coverage reports (sequential for reliability)
- `npm run clean` - Clean build artifacts
- `tsc --noEmit` - Quick type check
- Main executable: `dist/pnut-term-ts.min.js`

### Claude Helper Scripts
Located in `scripts/claude/` directory:
- `run-all-tests.sh` - Runs all test files individually with detailed pass/fail reporting
- `test-runner.sh` - Runs a single test file (pass filename as argument)
- `check_tests.sh` - Quick check of recently fixed test files

### Jest/NPM Test Command Gotcha
**IMPORTANT**: When running npm test with shell redirection, always use `--` to separate npm args:
```bash
# WRONG - Jest will interpret "2" as part of test pattern
npm test tests/file.test.ts 2>&1 | grep something

# CORRECT - Use -- to separate npm arguments
npm test -- tests/file.test.ts 2>&1 | grep something
```
Without `--`, Jest treats everything after the filename as test name patterns to match.

### Documentation References
- **Development Guide**: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) - Commands, scenarios, troubleshooting
- **Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - System design, data flow, components
- **Build System**: [`docs/BUILD-SYSTEM.md`](docs/BUILD-SYSTEM.md) - Build pipeline, configuration
- **Test Status**: [`docs/TEST-STATUS.md`](docs/TEST-STATUS.md) - Current test suite status

## High-Level Architecture

The application uses a class-based architecture with Electron for cross-platform GUI:

**Core Structure**:
- Entry point: `src/pnut-term-ts.ts` (CLI interface)
- Window management: `MainWindow` class with factory pattern
- Debug windows: All extend `DebugWindowBase`
- Hardware communication: `UsbSerial` and `Downloader` classes
- Shared utilities in `src/classes/shared/`

**Debug Display Implementation Status**:
- ✅ Complete: Terminal, Logic, Scope, Plot, Bitmap, MIDI
- ❌ Not implemented: Scope_XY, FFT, Spectro, Debugger

For detailed architecture information, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Pascal Source References

The Pascal reference implementation and documentation are located at `/pascal-source/` (root filesystem):

**Essential Documentation**:
- `/pascal-source/P2_PNut_Public/P2 Spin2 Documentation v51-250425.pdf` - Complete Spin2 reference
- `/pascal-source/P2_PNut_Public/MouseComamnds.pdf` - PC_KEY and PC_MOUSE specifications  
- `/pascal-source/P2_PNut_Public/debugStatements.pdf` - Debug command reference

**Test Files**: `/pascal-source/P2_PNut_Public/DEBUG-TESTING/` contains test programs and binaries

## Debug Window Implementation Status

**Key Pascal Source Files**:
- `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` - Core debug display (~50k lines)
- `/pascal-source/P2_PNut_Public/DebugUnit.pas` - Window management
- `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` - Debugger functionality (~8.5k lines)

**Implementation Progress** (7/10 windows complete - 70%):

| Window | TypeScript Class | Status | Notes |
|--------|------------------|--------|-------|
| Logic | `DebugLogicWindow` | ✅ Complete | Full trigger support |
| Scope | `DebugScopeWindow` | ✅ Complete | Auto/manual triggers |
| Plot | `DebugPlotWindow` | ✅ Complete | Double buffering, layers, sprites |
| Terminal | `DebugTermWindow` | ✅ Complete | ~70% test coverage, no ANSI |
| Bitmap | `DebugBitmapWindow` | ✅ Complete | All trace patterns |
| MIDI | `DebugMidiWindow` | ✅ Complete | Piano keyboard display |
| Scope XY | Not Implemented | ❌ Missing | XY plotting mode |
| FFT | Not Implemented | ❌ Missing | Frequency analysis |
| Spectro | Not Implemented | ❌ Missing | Time-frequency display |
| Debugger | Not Implemented | ❌ Missing | Breakpoint debugging |

## Pascal Translation Notes

For detailed Pascal translation guidance and implementation patterns, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Key Translation Resources**:
- `src/classes/shared/debugStatements.ts` - TypeScript constants and interfaces
- `src/classes/debugColor.ts` - Color system implementation
- `src/classes/shared/packedDataProcessor.ts` - Packed data handling

## Key Shared Components

**Data Processing**:
- `src/classes/shared/spin2NumericParser.ts` - All Spin2 numeric formats
- `src/classes/shared/packedDataProcessor.ts` - 12 packed data modes with ALT/SIGNED modifiers
- `src/classes/shared/debugInputConstants.ts` - PC_KEY/PC_MOUSE definitions
- `src/classes/shared/tracePatternProcessor.ts` - Bitmap trace patterns

**Rendering Support**:
- `src/classes/shared/canvasRenderer.ts` - HTML5 Canvas operations
- `src/classes/shared/layerManager.ts` - Bitmap layer management
- `src/classes/shared/spriteManager.ts` - Sprite transformations

## Input Support

All debug windows support PC_KEY and PC_MOUSE commands for input forwarding to P2 devices:

- **Base Integration**: `InputForwarder` class in `DebugWindowBase`
- **Mouse Features**: Coordinate transformation, wheel debouncing, visual feedback
- **Window-Specific**: Each window type implements custom coordinate systems
- **Logic/Scope Windows**: Show coordinate tooltips and crosshairs (Pascal parity)

## Technical Debt

**See [`docs/TECHNICAL-DEBT.md`](docs/TECHNICAL-DEBT.md) for comprehensive technical debt tracking.**

Quick commands to find inline debt markers:
```bash
grep -r "TECH-DEBT" src/
grep -r "TODO" src/
grep -r "FIXME" src/
```

**Key Requirements**:
- Preserve unparsed debug strings for error logging
- Include full command context in error messages
- Fix brittle test mocks and InputForwarder crashes

## Testing

**Test Status**: See [`docs/TEST-STATUS.md`](docs/TEST-STATUS.md) for current test suite status and known issues.

**Quick Commands**:
```bash
npm test                                    # Run all tests
npm run test:sequential                     # All tests sequential (for resource management)
npm run test:coverage                       # Coverage reports (sequential execution)
npm test -- tests/specific.test.ts          # Run specific test
npm test -- --testNamePattern="pattern"     # Run by pattern
```

For complete testing guidance including coverage options, see [`DOCs/DEVELOPMENT.md`](DOCs/DEVELOPMENT.md).