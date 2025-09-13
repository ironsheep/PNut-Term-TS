# P2 Bootloader Protocol Repair Implementation Plan

**Version**: 1.0  
**Date**: 2025-09-11  
**Priority**: Critical - Download reliability depends on protocol compliance  
**Estimated Effort**: 16-24 hours across 3-4 development sessions  

## Executive Summary

The current P2 serial download implementation has several critical protocol violations that prevent proper checksum verification and may cause silent download failures. This plan addresses complete protocol compliance with the P2 Serial Downloader specification.

## Critical Issues Identified

### 1. Protocol Command Violations
- **Issue**: Using `> Prop_Txt 0 0 0 0\r` instead of `Prop_Txt ~\r`
- **Impact**: Invalid commands, potential P2 rejection
- **Files**: `src/utils/usb.serial.ts:194, 219, 407, 434`

### 2. Checksum Verification Disabled
- **Issue**: `needsP2ChecksumVerify = false` hardcoded
- **Impact**: Download failures go undetected
- **Files**: `src/classes/downloader.ts:28`

### 3. Incorrect Termination Sequence
- **Issue**: Sending `?` instead of `~` terminator, wrong response handling
- **Impact**: P2 cannot validate checksums properly
- **Files**: `src/utils/usb.serial.ts:255, 266`

### 4. Missing Response Parsing
- **Issue**: No proper handling of P2 `.` (success) vs `?` (error) responses
- **Impact**: Cannot detect download/checksum failures
- **Files**: `src/utils/usb.serial.ts:252-264`

## Implementation Plan

### Phase 1: Protocol Command Compliance (4-6 hours)

#### 1.1 Fix Base64 Download Command
**File**: `src/utils/usb.serial.ts`
**Lines to change**: 194, 219

**EXACT CHANGES**:
1. **Line 194**: Replace `'> Prop_Txt 0 0 0 0'` with `'Prop_Txt ~'`
2. **Line 219**: Replace `'> Prop_Txt 0 0 0 0'` with `'Prop_Txt ~'`

**Before**:
```typescript
const requestStartDownload: string = '> Prop_Txt 0 0 0 0';
```

**After**:
```typescript
const requestStartDownload: string = 'Prop_Txt ~';
```

#### 1.2 Fix P2 Detection Command
**File**: `src/utils/usb.serial.ts`
**Lines to change**: 407, 434

**EXACT CHANGES**:
1. **Line 407**: Replace `'> Prop_Chk 0 0 0 0'` with `'Prop_Chk'`
2. **Line 434**: Replace `'> Prop_Chk 0 0 0 0'` with `'Prop_Chk'`

**Before**:
```typescript
const requestPropType: string = '> Prop_Chk 0 0 0 0';
```

**After**:
```typescript
const requestPropType: string = 'Prop_Chk';
```

#### 1.3 Fix Termination Sequence
**File**: `src/utils/usb.serial.ts`
**Line to change**: 255

**EXACT CHANGE**:
Replace `this.write('?');` with `await this.write('~');`

**Before**:
```typescript
this.write('?'); // removed AWAIT to allow read to happen earlier
```

**After**:
```typescript
await this.write('~'); // Proper P2 protocol terminator
```

### Phase 2: Response Handling Implementation (6-8 hours)

#### 2.1 Implement P2 Response Parser
**File**: `src/utils/usb.serial.ts`
**Location**: Add new methods after line 659 (before `public logMessage`)

**EXACT CODE TO ADD**:

```typescript
/**
 * Wait for P2 response after sending command/data
 * @param timeoutMs Timeout in milliseconds (default 2000)
 * @returns Raw response string from P2
 */
private async waitForP2Response(timeoutMs: number = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    let responseBuffer = '';
    let timeoutId: NodeJS.Timeout;
    
    const dataHandler = (data: Buffer) => {
      responseBuffer += data.toString('utf8');
      
      // Check for complete response patterns
      if (responseBuffer.includes('.') || responseBuffer.includes('?') || responseBuffer.includes('> ')) {
        clearTimeout(timeoutId);
        this._serialPort.removeListener('data', dataHandler);
        resolve(responseBuffer);
      }
    };
    
    timeoutId = setTimeout(() => {
      this._serialPort.removeListener('data', dataHandler);
      reject(new Error(`P2 response timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    this._serialPort.on('data', dataHandler);
  });
}

/**
 * Parse P2 response according to protocol specification
 * @param response Raw response from P2
 * @returns Parsed response type
 */
private parseP2Response(response: string): 'success' | 'error' | 'prompt' | 'unknown' {
  // Clean response of whitespace/control chars
  const cleaned = response.trim();
  
  if (cleaned.includes('.')) {
    return 'success';  // Command succeeded
  } else if (cleaned.includes('?')) {
    return 'error';    // Command failed/checksum error
  } else if (cleaned.includes('> ')) {
    return 'prompt';   // Ready for next command
  } else {
    this.logMessage(`Unknown P2 response: [${cleaned}]`);
    return 'unknown';
  }
}
```

#### 2.2 Integrate Response Handling in Download
**File**: `src/utils/usb.serial.ts`
**Location**: Replace lines 252-267 (entire `if (needsP2CheckumVerify)` block)

**EXACT REPLACEMENT**:
```typescript
        if (needsP2CheckumVerify) {
          // Send proper terminator and wait for P2 response
          await this.write('~'); // Proper P2 protocol terminator
          
          try {
            const response = await this.waitForP2Response(3000); // 3 second timeout
            const result = this.parseP2Response(response);
            
            if (result === 'error') {
              throw new Error('P2 checksum validation failed - program rejected');
            } else if (result === 'success') {
              this.logMessage('Download successful - P2 checksum verified');
              this._downloadChecksumGood = true;
            } else {
              throw new Error(`Unexpected P2 response: ${response}`);
            }
          } catch (error) {
            this.logMessage(`P2 response error: ${error.message}`);
            throw error;
          }
        } else {
          await this.write('~'); // Always send proper terminator
        }
```

### Phase 3: Checksum Verification Integration (4-6 hours)

#### 3.1 Enable Checksum Verification
**File**: `src/classes/downloader.ts`
**Line to change**: 28

**EXACT CHANGE**:
Replace `const needsP2ChecksumVerify: boolean = false;` 
with `let needsP2ChecksumVerify: boolean = false;`

**Before**:
```typescript
const needsP2ChecksumVerify: boolean = false;
```

**After**:
```typescript
let needsP2ChecksumVerify: boolean = false;
```

#### 3.2 Uncomment and Fix RAM Checksum Code
**File**: `src/classes/downloader.ts`
**Lines to change**: 34-48 (uncomment the commented block)

**EXACT CHANGES**:
1. **Remove the `/*` at line 34**
2. **Remove the `//*/` at line 47**
3. **Fix the else clause structure**

**Before** (lines 34-48):
```typescript
        //writeBinaryFile(binaryImage, `${binaryFilespec}fext`);
        /*
        } else {
        // not flashing append a checksum then ask P2 for verification
        //
        // don't enable verify until we get it working
        needsP2ChecksumVerify = true;
        const tmpImage = new ObjectImage('temp-image');
        tmpImage.adopt(binaryImage);
        tmpImage.padToLong();
        //const imageSum = 0xdeadf00d; //  TESTING
        const imageSum = tmpImage.loadRamChecksum();
        tmpImage.appendLong(imageSum);
        binaryImage = tmpImage.rawUint8Array.subarray(0, tmpImage.offset);
        //*/
```

**After** (lines 34-47):
```typescript
        //writeBinaryFile(binaryImage, `${binaryFilespec}fext`);
      } else {
        // RAM download - append checksum for P2 verification
        needsP2ChecksumVerify = true;
        const tmpImage = new ObjectImage('temp-image');
        tmpImage.adopt(binaryImage);
        tmpImage.padToLong();
        const imageSum = tmpImage.loadRamChecksum();
        tmpImage.appendLong(imageSum);
        binaryImage = tmpImage.rawUint8Array.subarray(0, tmpImage.offset);
        this.logMessage(`  -- RAM download with checksum verification enabled`);
```

#### 3.3 Add Program Header Validation Method
**File**: `src/classes/downloader.ts`
**Location**: Add after line 148 (after `moveObjectUp` method)

**EXACT CODE TO ADD**:
```typescript
  /**
   * Validate P2 program header structure
   * @param binaryImage Binary data to validate
   * @returns true if valid P2 program format
   */
  private validateProgramHeader(binaryImage: Uint8Array): boolean {
    if (binaryImage.length < 12) {
      this.logMessage('Program too small - missing header');
      return false;
    }

    // Check for 'Prop' signature at offset 0 (0x50726F70)
    const propSignature = new Uint32Array(binaryImage.slice(0, 4).buffer)[0];
    if (propSignature !== 0x706F7250) { // 'porP' in little-endian
      this.logMessage(`Invalid signature: expected 0x706F7250, got 0x${propSignature.toString(16)}`);
      return false;
    }

    // Basic structure validation passed
    this.logMessage('Program header validation passed');
    return true;
  }
```

### Phase 4: Error Handling & Recovery (2-4 hours)

#### 4.1 Implement Robust Error Recovery
```typescript
private async downloadWithRetry(data: Uint8Array, maxRetries: number = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.downloadAttempt(data);
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) throw error;
      this.logMessage(`Download attempt ${attempt} failed, retrying...`);
      await this.resetP2Connection();
    }
  }
}
```

#### 4.2 Add Connection State Management
```typescript
private async resetP2Connection(): Promise<void> {
  // Perform DTR/RTS reset
  // Clear buffers
  // Re-establish P2 communication
}
```

## Testing Strategy

### Phase 1 Testing: Protocol Command Verification
**After completing Phase 1 changes, run these specific tests:**

#### Test 1: P2 Detection Command
**File**: Create `tests/p2-protocol-commands.test.ts`
```typescript
describe('P2 Protocol Commands', () => {
  test('should send correct Prop_Chk command', async () => {
    // Mock serial port
    const mockWrite = jest.fn();
    // Verify exact command: "Prop_Chk\r" (no parameters)
    expect(mockWrite).toHaveBeenCalledWith('Prop_Chk\r');
  });

  test('should send correct Prop_Txt command', async () => {
    // Mock serial port  
    const mockWrite = jest.fn();
    // Verify exact command: "Prop_Txt ~\r" (not "Prop_Txt 0 0 0 0\r")
    expect(mockWrite).toHaveBeenCalledWith('Prop_Txt ~\r');
  });
});
```

#### Manual Test 1: Command Format Verification
1. **Connect P2 board**
2. **Open serial terminal** (PuTTY/screen at 115200)
3. **Reset P2** (should see "> " prompt)
4. **Type exactly**: `Prop_Chk` + Enter
5. **Expected response**: `Prop_Ver Au\r\n.\r\n> `
6. **If different response**: Command format still wrong

### Phase 2 Testing: Response Handling Verification
**After completing Phase 2 changes, run these tests:**

#### Test 2: Response Parser Unit Tests
**File**: `tests/p2-response-parser.test.ts`
```typescript
describe('P2 Response Parser', () => {
  test('should parse success response', () => {
    const result = parser.parseP2Response('.\r\n');
    expect(result).toBe('success');
  });

  test('should parse error response', () => {
    const result = parser.parseP2Response('?\r\n');
    expect(result).toBe('error');
  });

  test('should parse prompt response', () => {
    const result = parser.parseP2Response('> ');
    expect(result).toBe('prompt');
  });
});
```

#### Manual Test 2: Response Timing
1. **Send**: `Prop_Chk\r`
2. **Measure response time**: Should be <100ms
3. **Verify exact response**: `Prop_Ver Au\r\n.\r\n> `
4. **Test timeout**: Wait >3 seconds, verify timeout error

### Phase 3 Testing: Checksum Verification
**After completing Phase 3 changes, run these tests:**

#### Test 3: Checksum Generation
**File**: `tests/p2-checksum.test.ts`
```typescript
describe('P2 Checksum', () => {
  test('should generate correct checksum for known binary', () => {
    // Use test binary with known checksum
    const testBinary = new Uint8Array([/* known test data */]);
    const checksum = image.loadRamChecksum();
    expect(checksum).toBe(EXPECTED_CHECKSUM);
  });
});
```

#### Manual Test 3: End-to-End Download
1. **Prepare test binary**: Simple P2 program with known checksum
2. **Download to RAM**: Use downloadToRAM() function
3. **Verify logs**: Should show "P2 checksum verified"
4. **Test corrupted binary**: Modify 1 byte, should fail with error

### Full Integration Testing Protocol

#### Test Suite: Complete Download Flow
**File**: `tests/integration/download-flow.test.ts`
```typescript
describe('Download Integration', () => {
  test('should complete RAM download with checksum', async () => {
    // Load test binary
    // Execute download
    // Verify success response from P2
    // Check all logs for correct protocol
  });

  test('should detect checksum failure', async () => {
    // Load corrupted binary
    // Execute download
    // Verify error response from P2
    // Check error handling
  });
});
```

### Hardware Validation Checklist
**Before marking any phase complete:**

- [ ] **P2 responds to new command format** (not old format)
- [ ] **Response parsing detects success/error correctly**
- [ ] **Known-good binaries download and execute**
- [ ] **Corrupted binaries are rejected by P2**
- [ ] **Error messages are clear and actionable**
- [ ] **Performance is not degraded**

### Testing Data Files Needed
Create these test files in `tests/fixtures/`:
- `valid-p2-program.bin` - Known working P2 binary
- `corrupted-program.bin` - Same binary with 1 byte changed
- `minimal-program.bin` - Smallest valid P2 program
- `large-program.bin` - Near maximum size program

## Implementation Sequence

### Session 1 (4-6 hours): Protocol Fixes
- [ ] Fix command formats (`Prop_Txt ~`, `Prop_Chk`)
- [ ] Fix termination sequence (`~` instead of `?`)
- [ ] Update command parameter handling
- [ ] Test basic protocol compliance

### Session 2 (6-8 hours): Response Handling
- [ ] Implement P2 response parser
- [ ] Add response waiting/timeout logic
- [ ] Integrate response handling in download flow
- [ ] Test response parsing with P2 hardware

### Session 3 (4-6 hours): Checksum Integration
- [ ] Enable checksum verification for RAM downloads
- [ ] Uncomment and fix checksum generation code
- [ ] Add program header validation
- [ ] Test end-to-end checksum validation

### Session 4 (2-4 hours): Polish & Testing
- [ ] Add error recovery mechanisms
- [ ] Comprehensive testing with real P2
- [ ] Performance optimization
- [ ] Documentation updates

## Risk Mitigation

### Backup Strategy
- Create branch before changes: `git checkout -b fix/p2-protocol-compliance`
- Preserve current working implementation
- Enable feature flags for gradual rollout

### Testing Approach
- Test each phase independently
- Maintain fallback to old implementation
- Extensive logging during development
- Real hardware validation at each phase

## Success Criteria

- [ ] All P2 protocol commands match specification exactly
- [ ] Checksum verification works reliably for RAM downloads
- [ ] Download failures are detected and reported properly
- [ ] Error recovery works for temporary communication issues
- [ ] Performance is maintained or improved
- [ ] Full test coverage for protocol implementation

## File Change Summary

| File | Changes | Impact |
|------|---------|--------|
| `src/utils/usb.serial.ts` | Major - protocol commands, response handling | High |
| `src/classes/downloader.ts` | Medium - checksum enablement, validation | Medium |
| `tests/*.test.ts` | New - protocol compliance tests | Low |
| `DOCs/` | Documentation updates | Low |

## Dependencies

- **Hardware**: P2 development board for testing
- **Tools**: PNut or PropellerIDE for comparison testing
- **Knowledge**: P2 Serial Downloader Protocol Specification v1.0

## Post-Implementation

### Documentation Updates
- Update `DOCs/project-specific/USB-SERIAL-DOWNLOAD-INTEGRATION-PLAN.md`
- Create protocol compliance verification checklist
- Update user guides with improved error handling

### Monitoring
- Add telemetry for download success/failure rates
- Monitor checksum validation statistics
- Track error recovery effectiveness

---

**Next Steps**: Review plan with team, assign implementation sessions, create development branch.