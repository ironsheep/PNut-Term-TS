# Testing Standards for PNut-Term-TS

## CRITICAL: Byte-Perfect Validation Required

**When testing with complete known data, validate EVERY SINGLE BYTE.**

### Template for Byte-Perfect Tests

```typescript
describe('Message Processing', () => {
  it('should extract messages with perfect byte accuracy', () => {
    // 1. Feed complete known data
    const inputData = new Uint8Array([/* complete known bytes */]);
    buffer.appendAtTail(inputData);
    
    // 2. Extract all messages
    extractor.extractMessages();
    const extracted = [];
    let message;
    while ((message = outputQueue.dequeue())) {
      extracted.push(message);
    }
    
    // 3. BYTE ACCOUNTING: Every input byte must be extracted
    const totalInputBytes = inputData.length;
    const totalExtractedBytes = extracted.reduce((sum, msg) => sum + msg.data.length, 0);
    expect(totalExtractedBytes).toBe(totalInputBytes);
    
    // 4. MESSAGE CONTENT: Byte-by-byte validation
    expect(Array.from(extracted[0].data)).toEqual([0x43, 0x6F, 0x67, 0x30, /* etc */]);
    
    // 5. MESSAGE BOUNDARIES: Exact termination validation
    const lastMsg = extracted[extracted.length - 1];
    expect(lastMsg.data[lastMsg.data.length - 2]).toBe(0x0D);
    expect(lastMsg.data[lastMsg.data.length - 1]).toBe(0x0A);
    
    // 6. CLASSIFICATION: Exact type and count validation
    const cogMessages = extracted.filter(m => m.type === MessageType.COG_MESSAGE);
    const debuggerPackets = extracted.filter(m => m.type === MessageType.DEBUGGER_80BYTE);
    expect(cogMessages.length).toBe(/* exact expected count */);
    expect(debuggerPackets.length).toBe(/* exact expected count */);
    expect(debuggerPackets[0].data[0]).toBe(0x01); // Exact first byte
  });
});
```

### RED FLAGS - Test Patterns to AVOID

❌ **Counting without validation:**
```typescript
expect(messages.length).toBeGreaterThan(5); // WRONG - no content validation
```

❌ **Approximate validation:**
```typescript
expect(message.includes("Cog0")); // WRONG - could miss injection/corruption
```

❌ **Incomplete boundary checks:**
```typescript
expect(message.endsWith("\n")); // WRONG - missing CR check
```

### GREEN PATTERNS - Correct Test Patterns

✅ **Complete byte validation:**
```typescript
expect(Array.from(message.data)).toEqual([0x43, 0x6F, ...]); // RIGHT
```

✅ **Exact accounting:**
```typescript
expect(totalExtracted).toBe(totalInput); // RIGHT - zero tolerance
```

✅ **Precise boundary validation:**
```typescript
expect(message.data[message.data.length - 2]).toBe(0x0D); // RIGHT - exact CR
expect(message.data[message.data.length - 1]).toBe(0x0A); // RIGHT - exact LF
```

## Remember: Perfect Data = Perfect Validation
**No shortcuts. No approximations. Every byte matters.**