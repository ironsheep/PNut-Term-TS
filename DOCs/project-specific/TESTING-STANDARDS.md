# Testing Standards - PNut-Term-TS

## CRITICAL RULE: Perfect Data = Perfect Validation

### Byte-Perfect Testing Standard

**When you have 100% of the actual bytes, you MUST validate 100% of the actual bytes.**

#### NEVER:
- Count messages/strings instead of validating bytes
- Use approximations like "length > 5" 
- Assume "close enough" is acceptable
- Allow ANY unaccounted bytes

#### ALWAYS:
- **Account for every single input byte**
- **Verify each byte appears in exactly one output message**
- **Check byte-by-byte content correctness** 
- **Validate exact message boundaries**
- **Ensure zero injection/corruption possibilities**

### Test Validation Requirements

#### 1. Byte Accounting
```typescript
const totalInputBytes = inputData.reduce((sum, chunk) => sum + chunk.length, 0);
const totalOutputBytes = extractedMessages.reduce((sum, msg) => sum + msg.data.length, 0);
expect(totalOutputBytes).toBe(totalInputBytes); // ZERO tolerance for missing bytes
```

#### 2. Message Content Validation
```typescript
// Compare extracted message against expected byte-for-byte
const expectedMessage = new Uint8Array([0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, ...]);
expect(Array.from(extractedMessage.data)).toEqual(Array.from(expectedMessage));
```

#### 3. Message Boundary Validation
```typescript
// Each message must end with complete terminator
expect(message.data[message.data.length - 2]).toBe(0x0D); // CR
expect(message.data[message.data.length - 1]).toBe(0x0A); // LF
```

#### 4. Classification Validation
```typescript
// Verify correct message type assignment
expect(debuggerPackets.length).toBe(1); // Exact count required
expect(debuggerPackets[0].data[0]).toBe(0x01); // Exact content required
expect(terminalOutput.length).toBe(0); // Zero tolerance for misclassification
```

### Process Failure Prevention

**This standard exists because:**
- Weak tests allowed broken systems to reach manual testing
- Human time was wasted on bugs that automated tests should catch
- False confidence from passing tests masked fundamental failures

**The test must fail LOUD and fail FAST when:**
- Any byte is missing, duplicated, or misplaced
- Any message is misclassified
- Any boundary is incorrect
- Any injection or corruption occurs

### Golden Rule
**NEVER let a human test a system that hasn't passed byte-perfect automated validation.**

Tests are the quality gate that protects human time and ensures only working systems reach manual validation.