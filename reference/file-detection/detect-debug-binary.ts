#!/usr/bin/env npx tsx
/**
 * PNut-TS Binary Debug Mode Detector
 *
 * Standalone utility to detect if a .bin/.binf file was compiled with debug mode.
 * This is useful for external downloaders/flashers that need to know if the binary
 * requires debug-compatible hardware (10MHz+ crystal clocking).
 *
 * Usage: npx tsx detect-debug-binary.ts [options] <binary-file>
 *
 * Exit codes:
 *   0 = Non-debug binary
 *   1 = Debug binary detected
 *   2 = Error (file not found, invalid file, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Result interface for binary analysis
 */
interface BinaryAnalysisResult {
  /** True if binary was compiled with debug mode enabled */
  hasDebugger: boolean;
  /** True if binary contains flash loader (is .binf file) */
  hasFlashLoader: boolean;
  /** True if binary is PASM2 mode (no interpreter) */
  isPasm2Mode: boolean;
  /** Total binary size in bytes */
  binarySize: number;
  /** Estimated application size (excluding debugger/interpreter/flash loader) */
  applicationSize: number;
  /** Binary layout components detected */
  components: string[];
}

/**
 * Known signatures for different binary components
 */
const SIGNATURES = {
  // First 16 bytes of Spin2_debugger.obj (v43)
  DEBUGGER_V43: new Uint8Array([0x50, 0xf8, 0x08, 0xfc, 0x51, 0x04, 0x08, 0xfc,
                                0x41, 0xa2, 0x60, 0xfd, 0x51, 0x6a, 0x10, 0xfc]),

  // Known interpreter signatures (first few bytes of Spin2_interpreter.obj)
  INTERPRETER_V43: new Uint8Array([0x00, 0x1a, 0x60, 0xfd, 0x1f, 0x18, 0x60, 0xfd])
};

/**
 * Component size constants
 */
const COMPONENT_SIZES = {
  DEBUGGER_BINARY_SIZE: 2932,       // Actual Spin2_debugger.obj file size
  FLASH_LOADER_SIZE: 0x0400,        // 1KB fixed flash loader section
  FLASH_APP_OFFSET: 0x0400          // Application starts at 1KB in flash files
};

/**
 * Quick check to determine if a binary was compiled with debug mode
 */
function isDebugBinary(binaryPath: string): boolean {
  try {
    if (!fs.existsSync(binaryPath)) {
      return false;
    }

    const binaryData = fs.readFileSync(binaryPath);
    const isFlashFile = path.extname(binaryPath).toLowerCase() === '.binf';

    // Determine analysis offset (skip flash loader if present)
    const analysisOffset = isFlashFile ? COMPONENT_SIZES.FLASH_APP_OFFSET : 0;

    // Check for debugger signature
    if (binaryData.length >= analysisOffset + SIGNATURES.DEBUGGER_V43.length) {
      const headerBytes = binaryData.subarray(analysisOffset, analysisOffset + SIGNATURES.DEBUGGER_V43.length);
      return arraysEqual(headerBytes, SIGNATURES.DEBUGGER_V43);
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Full binary analysis
 */
function analyzeBinary(binaryPath: string): BinaryAnalysisResult {
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary file not found: ${binaryPath}`);
  }

  const binaryData = fs.readFileSync(binaryPath);
  const binarySize = binaryData.length;
  const isFlashFile = path.extname(binaryPath).toLowerCase() === '.binf';

  const result: BinaryAnalysisResult = {
    hasDebugger: false,
    hasFlashLoader: isFlashFile,
    isPasm2Mode: false,
    binarySize,
    applicationSize: binarySize,
    components: []
  };

  // Check for flash loader
  let analysisOffset = 0;
  if (isFlashFile) {
    result.components.push('Flash Loader (1KB)');
    analysisOffset = COMPONENT_SIZES.FLASH_APP_OFFSET;
    result.applicationSize = binarySize - COMPONENT_SIZES.FLASH_LOADER_SIZE;
  }

  // Check for debugger signature at analysis offset
  if (binarySize >= analysisOffset + SIGNATURES.DEBUGGER_V43.length) {
    const headerBytes = binaryData.subarray(analysisOffset, analysisOffset + SIGNATURES.DEBUGGER_V43.length);

    if (arraysEqual(headerBytes, SIGNATURES.DEBUGGER_V43)) {
      result.hasDebugger = true;
      result.components.push('Debugger + Debug Data');

      // Estimate application size
      result.applicationSize = binarySize - COMPONENT_SIZES.DEBUGGER_BINARY_SIZE - (isFlashFile ? COMPONENT_SIZES.FLASH_LOADER_SIZE : 0);
      result.components.push('Application (size estimated)');

      return result; // Early return for debug binaries
    }
  }

  // Check for interpreter vs PASM2 mode
  if (binarySize >= analysisOffset + SIGNATURES.INTERPRETER_V43.length) {
    const interpreterBytes = binaryData.subarray(analysisOffset, analysisOffset + SIGNATURES.INTERPRETER_V43.length);

    if (arraysEqual(interpreterBytes, SIGNATURES.INTERPRETER_V43)) {
      result.components.push('SPIN2 Interpreter');
      result.isPasm2Mode = false;
    } else {
      result.isPasm2Mode = true;
      result.components.push('PASM2 Code (no interpreter)');
    }
  }

  return result;
}

/**
 * Format analysis results for display
 */
function formatAnalysisResult(result: BinaryAnalysisResult): string {
  const lines = [
    `Binary Analysis Results:`,
    `  Total Size: ${result.binarySize} bytes`,
    `  Debug Mode: ${result.hasDebugger ? 'YES' : 'NO'}`,
    `  Flash Mode: ${result.hasFlashLoader ? 'YES (.binf)' : 'NO (.bin)'}`,
    `  Mode: ${result.isPasm2Mode ? 'PASM2' : 'SPIN2'}`,
    `  Application Size: ${result.applicationSize} bytes`,
    `  Components: ${result.components.join(', ')}`
  ];
  return lines.join('\n');
}

/**
 * Compare two Uint8Array objects for equality
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
PNut-TS Binary Debug Mode Detector

Usage: npx tsx detect-debug-binary.ts [options] <binary-file>

Options:
  --detailed, -d    Show detailed analysis
  --quiet, -q       Only output debug/non-debug result
  --help, -h        Show this help

Examples:
  npx tsx detect-debug-binary.ts myprogram.bin          # Basic check
  npx tsx detect-debug-binary.ts -d myprogram.bin       # Detailed analysis
  npx tsx detect-debug-binary.ts -q myprogram.bin       # Just result

Exit Codes:
  0 = Non-debug binary
  1 = Debug binary detected
  2 = Error (file not found, etc.)

Detection Method:
  Debug binaries start with Spin2_debugger.obj signature:
  [50 f8 08 fc 51 04 08 fc 41 a2 60 fd 51 6a 10 fc]

  This is useful for external downloaders/flashers to determine if the
  binary requires debug-compatible hardware (10MHz+ crystal clocking).
`);
}

/**
 * Main CLI function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  let filePath = '';
  let detailed = false;
  let quiet = false;

  // Parse arguments
  for (const arg of args) {
    if (arg === '--detailed' || arg === '-d') {
      detailed = true;
    } else if (arg === '--quiet' || arg === '-q') {
      quiet = true;
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error('Error: No binary file specified');
    process.exit(2);
  }

  try {
    if (detailed) {
      // Show full analysis
      const result = analyzeBinary(filePath);
      console.log(formatAnalysisResult(result));
      process.exit(result.hasDebugger ? 1 : 0);
    } else {
      // Basic or quiet check
      const hasDebug = isDebugBinary(filePath);

      if (!quiet) {
        console.log(`${filePath}: ${hasDebug ? 'DEBUG' : 'NON-DEBUG'}`);
      } else {
        console.log(hasDebug ? 'DEBUG' : 'NON-DEBUG');
      }

      process.exit(hasDebug ? 1 : 0);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}