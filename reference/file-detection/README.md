# PNut-TS External Tools

This directory contains standalone utilities for working with PNut-TS compiled binaries. These tools are separate from the compiler itself and are intended for external use.

## detect-debug-binary.ts

**Purpose**: Detect if a `.bin` or `.binf` file was compiled with debug mode enabled.

**Usage**:
```bash
# Basic check
npx tsx tools/detect-debug-binary.ts myprogram.bin

# Detailed analysis
npx tsx tools/detect-debug-binary.ts -d myprogram.bin

# Quiet mode (just result)
npx tsx tools/detect-debug-binary.ts -q myprogram.bin
```

**Exit Codes**:
- `0` = Non-debug binary
- `1` = Debug binary detected
- `2` = Error (file not found, etc.)

**Use Case**: External downloaders/flashers can use this to determine if a binary requires debug-compatible hardware (10MHz+ crystal clocking).

**Detection Method**: Looks for the Spin2_debugger.obj signature at the beginning of the binary file:
```
[50 f8 08 fc 51 04 08 fc 41 a2 60 fd 51 6a 10 fc]
```

## binaryAnalyzer.ts

**Purpose**: TypeScript module providing programmatic binary analysis functions.

**Functions**:
- `isDebugBinary(filePath)` - Quick boolean check
- `analyzeBinary(filePath)` - Full analysis with component detection
- `formatAnalysisResult(result)` - Human-readable output formatting

**Example**:
```typescript
import { isDebugBinary, analyzeBinary } from './tools/binaryAnalyzer';

const hasDebug = isDebugBinary('myprogram.bin');
const analysis = analyzeBinary('myprogram.bin');
console.log(`Debug mode: ${analysis.hasDebugger}`);
```

---

These tools are completely self-contained and do not depend on PNut-TS compiler internals.