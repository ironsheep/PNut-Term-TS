# Testing Framework Integration - PNut-Term-TS

## Console Log Capture for Testing

### Capturing Component Logging:
```typescript
// Test setup - capture console output
const originalConsoleLog = console.log;
const logCapture: string[] = [];
console.log = (...args) => {
  logCapture.push(args.join(' '));
  originalConsoleLog(...args);
};

// After test - restore and analyze
console.log = originalConsoleLog;
expect(logCapture).toContain('[MessageExtractor] CLASSIFIED: DEBUGGER_80BYTE');
```

### Message Routing Validation:
```typescript
// Test message routing through log analysis
expect(logCapture.filter(log => log.includes('[DEBUG LOGGER]'))).toHaveLength(expectedDebugLogCount);
expect(logCapture.filter(log => log.includes('[MAIN CONSOLE]'))).toHaveLength(expectedConsoleCount);
```

## Byte-Perfect Testing Integration

### MessageExtractor Testing Pattern:
```typescript
describe('MessageExtractor', () => {
  it('should classify binary packets correctly', () => {
    // 1. Feed complete known data with 0x01 COG ID
    const binaryPacket = new Uint8Array([0x01, 0x00, 0x00, 0x00, /* 80 bytes total */]);
    buffer.appendAtTail(binaryPacket);
    
    // 2. Extract and capture logs
    extractor.extractMessages();
    
    // 3. Verify classification through logging
    expect(logCapture).toContain('[MessageExtractor] CLASSIFIED: DEBUGGER_80BYTE');
    expect(logCapture).not.toContain('TERMINAL_OUTPUT (fallback)');
    
    // 4. Byte accounting validation
    const extracted = outputQueue.dequeue();
    expect(extracted.data.length).toBe(binaryPacket.length);
    expect(Array.from(extracted.data)).toEqual(Array.from(binaryPacket));
  });
});
```

### WindowRouter Testing Pattern:
```typescript
describe('WindowRouter', () => {
  it('should route COG messages to correct destination', () => {
    // Setup log capture
    setupLogCapture();
    
    // Send COG message through router
    const cogMessage = { type: MessageType.COG_MESSAGE, data: cogData };
    router.routeMessage(cogMessage);
    
    // Verify routing decision in logs
    expect(logCapture).toContain('Routing COG_MESSAGE to main console');
    expect(logCapture).not.toContain('Routing COG_MESSAGE to Debug Logger');
  });
});
```

### Debug Logger Testing Pattern:
```typescript
describe('DebugLogger', () => {
  it('should format binary data correctly', () => {
    const binaryData = new Uint8Array([0x01, 0x02, 0x03, /* ... */]);
    
    logger.processTypedMessage(MessageType.DEBUGGER_80BYTE, binaryData);
    
    // Capture formatted output
    const formattedOutput = logger.getLastFormattedMessage();
    expect(formattedOutput).toMatch(/Cog 1 \$01 \$02 \$03/);
    expect(formattedOutput).not.toContain('���'); // No garbled characters
  });
});
```

## Integration Testing Patterns

### Full Message Flow Testing:
```typescript
describe('Message Flow Integration', () => {
  it('should process P2 hardware data end-to-end', () => {
    // Realistic P2 data sequence
    const p2Data = new Uint8Array([
      // COG message
      0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, 0x49, 0x4E, /* ... */,
      // Binary debugger packet  
      0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, /* ... */
    ]);
    
    // Process through entire stack
    serialReceiver.processData(p2Data);
    
    // Verify each stage through logging
    expect(logCapture).toContain('[SerialReceiver] Received');
    expect(logCapture).toContain('[MessageExtractor] CLASSIFIED: COG_MESSAGE');
    expect(logCapture).toContain('[MessageExtractor] CLASSIFIED: DEBUGGER_80BYTE');
    expect(logCapture).toContain('[WindowRouter] Routing COG_MESSAGE');
    expect(logCapture).toContain('[WindowRouter] Routing DEBUGGER_80BYTE');
    
    // Verify destinations
    expect(mainConsoleOutput).toContain('Cog0  INIT');
    expect(debugLoggerOutput).toContain('Cog 1 $01 $00 $00');
  });
});
```

## Ground Zero Recovery Testing

### Baseline Validation:
```typescript
describe('System Baseline', () => {
  it('should have clean message boundaries', () => {
    const testData = getKnownGoodP2Data();
    
    processData(testData);
    
    // Verify no hex 0A at message starts
    const extractedMessages = getAllExtractedMessages();
    extractedMessages.forEach(msg => {
      expect(msg.data[0]).not.toBe(0x0A); // No leading line feeds
    });
  });
});
```

## Component Instrumentation

### Adding Test-Friendly Logging:
```typescript
// In component classes - add test-friendly logging
private logForTesting(message: string): void {
  console.log(`[${this.constructor.name}] ${message}`);
}

// Usage in methods
public classifyMessage(data: Uint8Array): MessageType {
  const result = this.performClassification(data);
  this.logForTesting(`CLASSIFIED: ${result} - ${data.length} bytes`);
  return result;
}
```

## Test Coverage Requirements

### Minimum Test Coverage Per Component:
- **MessageExtractor**: All message types, boundary conditions, malformed data
- **WindowRouter**: All routing destinations, registration/unregistration
- **Display Components**: All message types, formatting, error conditions  
- **CircularBuffer**: Byte accounting, position management, edge cases
- **Integration**: End-to-end message flow, realistic P2 data patterns

---

**Document Version:** 1.0  
**Date:** 2025-08-23  
**Status:** REFERENCE - Testing patterns specific to PNut-Term-TS architecture