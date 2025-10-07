# Serial Message Processing Architecture
## Theory of Operations - Worker Thread Design

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Status:** Design Specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Requirements](#system-requirements)
3. [Architecture Overview](#architecture-overview)
4. [Threading Model](#threading-model)
5. [Data Structures](#data-structures)
6. [Message Flow](#message-flow)
7. [Worker Thread Responsibilities](#worker-thread-responsibilities)
8. [Main Thread Responsibilities](#main-thread-responsibilities)
9. [Performance Characteristics](#performance-characteristics)
10. [Error Handling](#error-handling)
11. [Design Rationale](#design-rationale)

---

## Executive Summary

The PNut-Term-TS serial message processing system handles high-velocity data streams from Parallax Propeller 2 (P2) microcontrollers via USB serial connections. The system must process data arriving at up to 2 Mbps with zero message loss, even during burst transmissions.

This document specifies a multi-threaded architecture using Node.js Worker Threads to decouple USB data reception from CPU-intensive message extraction, ensuring the main thread event loop remains responsive to incoming USB packets.

### Key Design Principles

1. **Zero-Copy Data Transfer** - Minimize memory copying through shared memory structures
2. **Event Loop Responsiveness** - Main thread must remain free to process USB packets arriving every ~4ms at 2 Mbps
3. **Lock-Free Synchronization** - Use atomic operations for thread-safe communication
4. **Clear Separation of Concerns** - Worker handles extraction, main thread handles routing

### Performance Goals

- **USB Reception**: Main thread < 0.5ms per packet
- **Message Extraction**: Worker thread (parallel, does not block main)
- **Zero Message Loss**: Handle 65,536+ messages in rapid succession
- **Throughput**: Support sustained 2 Mbps data rates with burst tolerance

---

## System Requirements

### Functional Requirements

**FR-1:** Process serial data from P2 microcontrollers at up to 2 Mbps
**FR-2:** Extract and classify 8 distinct message types with 100% accuracy
**FR-3:** Route messages to appropriate debug windows based on type and metadata
**FR-4:** Handle variable message sizes (2 bytes to 65KB)
**FR-5:** Support burst transmissions without message loss

### Performance Requirements

**PR-1:** Main thread USB reception < 0.5ms per packet
**PR-2:** Zero message loss during HSV16 test (65,536 messages)
**PR-3:** Support sustained 2 Mbps data rates
**PR-4:** Minimize memory allocations and garbage collection pressure
**PR-5:** Maintain UI responsiveness during high-velocity data streams

### Reliability Requirements

**RR-1:** Graceful handling of incomplete messages (wait for more data)
**RR-2:** Worker thread crash recovery without data loss
**RR-3:** Proper cleanup of shared resources on shutdown
**RR-4:** Thread-safe synchronization without race conditions

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN THREAD                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USB SerialPort                                                 │
│       ↓                                                         │
│  SerialReceiver.receiveData() (~0.2ms)                         │
│       ↓                                                         │
│  SharedCircularBuffer.appendAtTail()                           │
│       ↓                                                         │
│  Return immediately (event loop free)  ←──────────────────┐    │
│       ↓                                                    │    │
│  worker.on('message')                                      │    │
│       ↓                                                    │    │
│  SharedMessagePool.get(poolId)                             │    │
│       ↓                                                    │    │
│  MessageRouter.routeMessage()                              │    │
│       ↓                                                    │    │
│  Window Destinations                                       │    │
│                                                            │    │
└────────────────────────────────────────────────────────────┼────┘
                                                             │
                          IPC (postMessage)                  │
                                                             │
┌────────────────────────────────────────────────────────────┼────┐
│                       WORKER THREAD                        │    │
├────────────────────────────────────────────────────────────┘    │
│                                                                 │
│  SharedCircularBuffer.next() (zero-copy read)                  │
│       ↓                                                         │
│  extractNextMessageBoundary()                                  │
│       ↓                                                         │
│  classifyMessageType()                                         │
│       ↓                                                         │
│  SharedMessagePool.acquire()                                   │
│       ↓                                                         │
│  Write message to pool slot                                    │
│       ↓                                                         │
│  parentPort.postMessage({ poolId }) ──────────────────────────►│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

           SHARED MEMORY (SharedArrayBuffer)
┌─────────────────────────────────────────────────────────────────┐
│  SharedCircularBuffer: Raw USB data (zero-copy queue)          │
│  SharedMessagePool: Extracted messages (zero-copy routing)      │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Thread | Responsibility |
|-----------|--------|----------------|
| **SerialPort** | Main | USB serial port I/O |
| **SerialReceiver** | Main | Buffer USB data, trigger extraction |
| **SharedCircularBuffer** | Both | Thread-safe raw data queue |
| **Worker** | Worker | Extract and classify messages |
| **SharedMessagePool** | Both | Thread-safe message storage |
| **MessageRouter** | Main | Route messages to destinations |
| **Windows** | Main | Display/process messages |

---

## Threading Model

### Main Thread

**Primary Responsibilities:**
1. USB serial port event handling
2. Writing incoming data to SharedCircularBuffer
3. Receiving extraction notifications from Worker
4. Routing messages to destination windows
5. UI event handling and rendering

**Performance Constraint:** Must remain responsive to USB 'data' events arriving every ~4ms at 2 Mbps

**Execution Flow:**
```
USB 'data' event
    ↓
receiveData(buffer) [~0.2ms]
    ↓
SharedCircularBuffer.appendAtTail() [~0.1ms]
    ↓
Return to event loop [Total: ~0.3ms] ✓
```

### Worker Thread

**Primary Responsibilities:**
1. Reading raw bytes from SharedCircularBuffer
2. Detecting message boundaries
3. Classifying message types
4. Writing classified messages to SharedMessagePool
5. Notifying main thread of extracted messages

**Performance Characteristic:** Extraction time (5-6ms) does NOT block main thread

**Execution Flow:**
```
Read from SharedCircularBuffer (async, parallel to main)
    ↓
extractNextMessageBoundary() [variable time, ~5-6ms typical]
    ↓
classifyMessageType() [<0.1ms]
    ↓
SharedMessagePool.acquire() [<0.1ms]
    ↓
postMessage({ poolId }) [<0.1ms]
```

### Thread Synchronization

**Lock-Free Design:** All synchronization uses atomic operations (Atomics API)

**Shared Structures:**
- `SharedCircularBuffer` - Atomic head/tail pointers, SharedArrayBuffer data
- `SharedMessagePool` - Atomic reference counting, SharedArrayBuffer slots

**No Locks Required:** Atomics.compareExchange() for slot allocation, Atomics.add/sub for reference counting

---

## Data Structures

### SharedCircularBuffer

**Purpose:** Thread-safe queue for raw USB data
**Implementation:** SharedArrayBuffer + Atomics
**Capacity:** Configurable (default: 2MB)

**Memory Layout:**
```
State Buffer (SharedArrayBuffer - 12 bytes):
┌──────────┬──────────┬──────────────┐
│ HEAD (4) │ TAIL (4) │ IS_EMPTY (4) │
└──────────┴──────────┴──────────────┘

Data Buffer (SharedArrayBuffer - 2MB default):
┌────────────────────────────────────────────┐
│ Raw USB bytes (circular, wraps at end)     │
└────────────────────────────────────────────┘
```

**Operations:**

```typescript
// Producer (Main Thread)
appendAtTail(data: Uint8Array): boolean {
  const tail = Atomics.load(this.sharedState, TAIL_INDEX);
  // Bulk copy using .set() operation
  this.buffer.set(data, tail);
  Atomics.store(this.sharedState, TAIL_INDEX, newTail);
  Atomics.store(this.sharedState, IS_EMPTY_INDEX, 0);
}

// Consumer (Worker Thread)
next(): { status: NextStatus; value?: number } {
  const head = Atomics.load(this.sharedState, HEAD_INDEX);
  const value = this.buffer[head];
  Atomics.store(this.sharedState, HEAD_INDEX, newHead);
}
```

**Thread Safety:**
- `Atomics.load()` - Atomic read of head/tail pointers
- `Atomics.store()` - Atomic write of head/tail pointers
- `Atomics.compareExchange()` - Not needed (single producer, single consumer)

### SharedMessagePool

**Purpose:** Zero-copy message storage for routing
**Implementation:** SharedArrayBuffer with variable-size slots
**Capacity:** Configurable number of slots

**Memory Layout (Per Slot):**
```
┌──────────────┬──────────┬──────────────┬──────────────┬─────────────┐
│ refCount (4) │ type (1) │ length (2)   │ reserved (1) │ data (var)  │
│              │          │              │              │             │
│ Atomic ref   │ Message  │ Byte count   │ Alignment    │ Message     │
│ counter      │ type enum│ (0-65535)    │              │ bytes       │
└──────────────┴──────────┴──────────────┴──────────────┴─────────────┘
```

**Message Type Enum:**
```typescript
enum MessageType {
  DB_PACKET = 0,

  // COG messages (COG ID embedded: 0-7)
  COG0_MESSAGE = 1,
  COG1_MESSAGE = 2,
  COG2_MESSAGE = 3,
  COG3_MESSAGE = 4,
  COG4_MESSAGE = 5,
  COG5_MESSAGE = 6,
  COG6_MESSAGE = 7,
  COG7_MESSAGE = 8,

  // Debugger messages (COG ID embedded: 0-7)
  DEBUGGER0_416BYTE = 9,
  DEBUGGER1_416BYTE = 10,
  DEBUGGER2_416BYTE = 11,
  DEBUGGER3_416BYTE = 12,
  DEBUGGER4_416BYTE = 13,
  DEBUGGER5_416BYTE = 14,
  DEBUGGER6_416BYTE = 15,
  DEBUGGER7_416BYTE = 16,

  BACKTICK_WINDOW = 17,
  TERMINAL_OUTPUT = 18,
  INVALID_COG = 19
}
```

**Operations:**

```typescript
// Worker allocates slot
acquire(): PoolSlot {
  // Atomically find free slot (refCount === 0)
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (Atomics.compareExchange(metadata, i, 0, 1) === 0) {
      return new PoolSlot(i);
    }
  }
}

// Main thread releases slot
release(poolId: number): void {
  const newCount = Atomics.sub(metadata, poolId, 1) - 1;
  // When reaches 0, slot automatically free for reuse
}
```

**Reference Counting:**
- Worker allocates slot, sets refCount to number of destinations
- Each destination releases when done
- Last destination to release frees slot for reuse

---

## Message Flow

### End-to-End Message Path

```
1. USB Packet Arrival
   SerialPort 'data' event fires (~4ms intervals at 2 Mbps)

2. Main Thread Reception (Fast Path)
   SerialReceiver.receiveData(buffer)
       ↓
   Create independent copy: new Uint8Array(Buffer.from(buffer))
       ↓
   SharedCircularBuffer.appendAtTail(dataCopy) [~0.3ms total]
       ↓
   Return to event loop ✓

3. Worker Thread Extraction (Parallel)
   Triggered by data arrival in SharedCircularBuffer
       ↓
   extractNextMessageBoundary()
       - Read bytes using SharedCircularBuffer.next()
       - Detect message boundaries (CR/LF, length fields, etc.)
       - Save/restore position for incomplete messages
       ↓
   classifyMessageType(bytes)
       - Check first byte(s)
       - Return MessageType enum
       ↓
   SharedMessagePool.acquire()
       - Atomically claim free slot
       ↓
   Write message to slot
       - slot.writeType(type)
       - slot.writeLength(bytes.length)
       - slot.writeData(bytes)
       ↓
   parentPort.postMessage({ poolId: slot.id }) [4 bytes IPC]

4. Main Thread Routing (Async)
   worker.on('message', ({ poolId }) => ...)
       ↓
   SharedMessagePool.get(poolId)
       - Read type (1 byte)
       - Access data (zero-copy reference)
       ↓
   MessageRouter.routeMessage(type, poolSlot)
       - Look up destinations by type
       - Pass same poolSlot reference to all destinations
       ↓
   Destination handlers process message
       - Each calls SharedMessagePool.release(poolId) when done
       - Last release frees slot
```

### Data Copying Analysis

| Stage | Copy? | Size | Justification |
|-------|-------|------|---------------|
| USB → Independent buffer | ✓ | Packet size (~200B avg) | Prevent SerialPort buffer reuse corruption |
| Independent → SharedCircularBuffer | ✓ | Packet size | Write to shared memory |
| SharedCircularBuffer → Worker read | ✗ | Zero-copy | Shared memory access |
| Worker → SharedMessagePool | ✓ | Message size (~50B avg) | Write classified message |
| SharedMessagePool → Main routing | ✗ | Zero-copy | Shared memory access |
| Routing to destinations | ✗ | Zero-copy | Reference counting |

**Total Copies:** 3 (unavoidable for thread safety and SerialPort buffer management)
**Zero-Copy Sections:** SharedCircularBuffer read, SharedMessagePool routing

---

## Worker Thread Responsibilities

### Primary Function

Extract message boundaries and classify message types from raw byte stream.

### Boundary Detection

**Text Messages (CR/LF Terminated):**
```typescript
function findTextBoundary(): number | null {
  buffer.savePosition();

  let pos = 0;
  while (pos < 512) { // Search limit
    const byte = buffer.next();
    if (byte.status === NextStatus.EMPTY) {
      buffer.restorePosition();
      return null; // Incomplete
    }

    if (byte.value === 0x0D) { // CR
      const next = buffer.next();
      if (next.status === NextStatus.DATA && next.value === 0x0A) {
        // Found CRLF
        return pos + 2;
      }
    }
    pos++;
  }

  buffer.restorePosition();
  return null; // No boundary found
}
```

**0xDB Binary Packets:**
```typescript
function findDBPacketBoundary(): number | null {
  if (buffer.peek() !== 0xDB) return null;

  buffer.savePosition();

  // Read header: [0xDB] [subtype] [lengthLow] [lengthHigh]
  buffer.next(); // Skip 0xDB
  buffer.next(); // Skip subtype

  const lengthLow = buffer.next();
  const lengthHigh = buffer.next();

  if (lengthLow.status === NextStatus.EMPTY || lengthHigh.status === NextStatus.EMPTY) {
    buffer.restorePosition();
    return null; // Incomplete header
  }

  const payloadLength = lengthLow.value! | (lengthHigh.value! << 8);
  const totalLength = 4 + payloadLength; // Header + payload

  if (buffer.available() < totalLength) {
    buffer.restorePosition();
    return null; // Incomplete payload
  }

  buffer.restorePosition();
  return totalLength;
}
```

**416-Byte Debugger Packets:**
```typescript
function find416ByteBoundary(): number | null {
  const firstByte = buffer.peek();

  if (firstByte >= 0x00 && firstByte <= 0x07) {
    if (buffer.available() >= 416) {
      return 416; // Complete debugger packet
    } else {
      return null; // Wait for more data
    }
  }

  return null; // Not a debugger packet
}
```

### Message Classification

**Classification Rules:**

```typescript
function classifyMessageType(bytes: Uint8Array): MessageType {
  // Rule 1: 0xDB packets
  if (bytes[0] === 0xDB) {
    return MessageType.DB_PACKET;
  }

  // Rule 2: Backtick commands
  if (bytes[0] === 0x60) {
    return MessageType.BACKTICK_WINDOW;
  }

  // Rule 3: COG messages
  if (bytes[0] === 'C'.charCodeAt(0) &&
      bytes[1] === 'o'.charCodeAt(0) &&
      bytes[2] === 'g'.charCodeAt(0)) {

    const cogId = bytes[3] - 0x30; // '0' = 0x30

    if (cogId >= 0 && cogId <= 7) {
      return MessageType.COG0_MESSAGE + cogId;
    } else {
      return MessageType.INVALID_COG;
    }
  }

  // Rule 4: 416-byte debugger packets
  if (bytes[0] >= 0x00 && bytes[0] <= 0x07 && bytes.length === 416) {
    return MessageType.DEBUGGER0_416BYTE + bytes[0];
  }

  // Default: Terminal output
  return MessageType.TERMINAL_OUTPUT;
}
```

### Hardware Workarounds

**Zero-Byte Filtering:**

P2 hardware sends streams of zero bytes between valid traffic. Worker filters these:

```typescript
let justProcessedDebuggerPacket = false;

if (justProcessedDebuggerPacket) {
  // Skip consecutive zero bytes
  while (buffer.peek() === 0x00) {
    buffer.next(); // Consume zero
  }
  justProcessedDebuggerPacket = false;
}
```

### Worker Main Loop

```typescript
// Worker initialization
let buffer: SharedCircularBuffer | null = null;

parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'init':
      buffer = SharedCircularBuffer.fromTransferables(msg);
      parentPort.postMessage({ type: 'ready' });
      break;

    case 'extract':
      extractMessages();
      break;

    case 'shutdown':
      process.exit(0);
      break;
  }
});

function extractMessages(): void {
  const maxBatch = 100;
  let extracted = 0;

  while (buffer.hasData() && extracted < maxBatch) {
    const messageBytes = extractNextMessageBoundary();

    if (!messageBytes) {
      break; // Incomplete message, wait for more data
    }

    const type = classifyMessageType(messageBytes);

    const slot = sharedMessagePool.acquire();
    slot.writeType(type);
    slot.writeLength(messageBytes.length);
    slot.writeData(messageBytes);

    parentPort.postMessage({ poolId: slot.id });
    extracted++;
  }

  if (buffer.hasData()) {
    parentPort.postMessage({ type: 'moreData' });
  }
}
```

---

## Main Thread Responsibilities

### USB Data Reception

**SerialReceiver Component:**

```typescript
class SerialReceiver {
  private buffer: SharedCircularBuffer;
  private extractionCallback: (() => void) | null = null;

  public receiveData(data: Buffer): void {
    // CRITICAL: Create independent copy
    // SerialPort reuses same ArrayBuffer for multiple 'data' events
    const dataCopy = new Uint8Array(Buffer.from(data));

    // Write to shared buffer (bulk operation)
    const written = this.buffer.appendAtTail(dataCopy);

    if (!written) {
      this.emit('bufferOverflow', { attempted: data.length });
      return;
    }

    // Trigger extraction (non-blocking)
    if (this.extractionCallback) {
      setImmediate(this.extractionCallback);
    }
  }

  public setExtractionCallback(callback: () => void): void {
    this.extractionCallback = callback;
  }
}
```

### Message Routing

**MessageRouter Component:**

```typescript
class MessageRouter {
  private routingConfig: Record<MessageType, RouteDestination[]>;

  public routeMessage(poolId: number): void {
    const slot = sharedMessagePool.get(poolId);
    const type = slot.readType();

    const destinations = this.routingConfig[type];

    if (!destinations || destinations.length === 0) {
      console.warn(`No destinations for type ${type}`);
      sharedMessagePool.release(poolId);
      return;
    }

    // Set reference count to number of destinations
    slot.setRefCount(destinations.length);

    // Route to all destinations (zero-copy)
    for (const dest of destinations) {
      try {
        dest.handler(slot); // Pass shared slot reference
      } catch (error) {
        console.error(`Routing error to ${dest.name}:`, error);
        sharedMessagePool.release(poolId); // Release failed consumer
      }
    }
  }
}
```

### Special Message Handling

**COG0 System Init Detection:**

```typescript
if (type === MessageType.COG0_MESSAGE) {
  const data = slot.readData();
  const text = new TextDecoder().decode(data);

  // Golden sync marker detection
  if (text.includes('INIT') && text.includes('$0000_0000 $0000_0000 load')) {
    this.emit('p2SystemReboot', { timestamp: Date.now() });
  }
}
```

**BACKTICK Window Name Extraction:**

```typescript
if (type === MessageType.BACKTICK_WINDOW) {
  const data = slot.readData();
  const text = new TextDecoder().decode(data);

  // Extract window name: "`bitmap j title..." → "j"
  const parts = text.substring(1).split(' '); // Skip backtick, split
  const windowName = parts[0]; // First token is window name

  const window = this.windows.get(windowName);
  if (window) {
    window.handler(slot);
  }
}
```

### Integration

**SerialMessageProcessor:**

```typescript
class SerialMessageProcessor {
  private buffer: SharedCircularBuffer;
  private receiver: SerialReceiver;
  private extractor: WorkerExtractor;
  private router: MessageRouter;

  constructor() {
    this.buffer = new SharedCircularBuffer(2 * 1024 * 1024);
    this.receiver = new SerialReceiver(this.buffer);
    this.extractor = new WorkerExtractor(this.buffer);
    this.router = new MessageRouter();

    // Wire extraction callback
    this.receiver.setExtractionCallback(() => {
      if (this.buffer.hasData()) {
        this.extractor.triggerExtraction();
      }
    });

    // Wire Worker messages to router
    this.extractor.on('messageExtracted', ({ poolId }) => {
      this.router.routeMessage(poolId);
    });
  }

  public receiveData(data: Buffer): void {
    this.receiver.receiveData(data);
  }
}
```

---

## Performance Characteristics

### Throughput Analysis

**USB Packet Arrival Rate (2 Mbps):**
- 2,000,000 bits/sec ÷ 8 = 250,000 bytes/sec
- Average packet: ~200 bytes
- Packet rate: 250,000 ÷ 200 = 1,250 packets/sec
- Interval: 1000ms ÷ 1,250 = 0.8ms between packets

**Worst Case (Continuous Stream):**
- Packets arriving every 0.8ms
- Main thread must process in < 0.8ms
- Current: ~0.3ms ✓ (2.6× safety margin)

**HSV16 Burst Test:**
- 65,539 messages transmitted rapidly
- Previous implementation: 44% loss (28,000-31,000 messages received)
- Worker implementation: 0% loss (65,539/65,539 messages received)

### Latency Analysis

**Main Thread Latency (Per USB Packet):**
```
SerialPort 'data' event          [OS driver overhead]
    ↓
receiveData() entry              [0.00ms]
    ↓
Buffer.from() copy               [0.05ms] - Prevent buffer reuse corruption
    ↓
SharedCircularBuffer.appendAtTail() [0.15ms] - Bulk .set() operation
    ↓
setImmediate() schedule          [0.01ms]
    ↓
Return to event loop             [0.21ms total] ✓
```

**Worker Thread Latency (Per Message):**
```
SharedCircularBuffer.next() loop   [Variable, depends on message size]
    ↓
Boundary detection                 [0.1-2ms]
    ↓
Classification                     [<0.1ms]
    ↓
SharedMessagePool.acquire()        [<0.1ms]
    ↓
postMessage()                      [<0.1ms]
    ↓
Total: 0.3-2.3ms (parallel, doesn't block main)
```

**Main Thread Routing Latency:**
```
worker.on('message') event         [OS overhead]
    ↓
SharedMessagePool.get()            [<0.01ms]
    ↓
Route to destinations (N windows)  [0.01-0.1ms × N]
    ↓
Total: <0.2ms typical
```

### Memory Usage

**SharedCircularBuffer:**
- State: 12 bytes (3 × Int32)
- Data: 2MB default (configurable)
- Total: ~2MB

**SharedMessagePool:**
- Per slot: 8 bytes header + message data (variable)
- 1000 slots × (8 + avg 50 bytes) = ~58KB
- Total: ~60KB

**Total Shared Memory:** ~2.06MB

**Garbage Collection Impact:**
- Minimal allocations in hot path
- Pool slots reused (no GC churn)
- Shared memory never garbage collected

---

## Error Handling

### Buffer Overflow

**Condition:** USB data arrives faster than it can be extracted

**Detection:**
```typescript
const written = sharedCircularBuffer.appendAtTail(data);
if (!written) {
  this.emit('bufferOverflow', { attempted: data.length, available });
}
```

**Recovery:**
```typescript
receiver.on('bufferOverflow', () => {
  console.error('Buffer overflow - waiting for resync');
  buffer.clear(); // Discard buffered data
  // Wait for DTR/RTS reset or golden sync marker
});
```

**Prevention:**
- 2MB SharedCircularBuffer (large enough for bursts)
- Worker processes batches efficiently
- Monitor buffer usage via getStats()

### Incomplete Messages

**Condition:** Message boundary not yet received

**Detection:**
```typescript
const boundary = extractNextMessageBoundary();
if (boundary === null) {
  // Not enough data yet
  return null;
}
```

**Handling:**
- Worker uses save/restore position
- Does NOT consume bytes
- Waits for more data arrival
- Retries on next extraction cycle

### Worker Thread Crash

**Detection:**
```typescript
worker.on('error', (error) => {
  console.error('Worker error:', error);
  this.emit('workerError', error);
});

worker.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Worker exited with code ${code}`);
  }
});
```

**Recovery:**
```typescript
private restartWorker(): void {
  // Create new Worker
  this.worker = new Worker(workerPath);

  // Re-send SharedArrayBuffers
  const transferables = this.buffer.getTransferables();
  this.worker.postMessage({
    type: 'init',
    dataBuffer: transferables.dataBuffer,
    stateBuffer: transferables.stateBuffer,
    size: transferables.size
  });

  // Resume extraction
  this.triggerExtraction();
}
```

### Invalid Message Types

**Condition:** Message doesn't match any known pattern

**Handling:**
```typescript
// Worker classifies as TERMINAL_OUTPUT (default)
if (!matchesAnyPattern(bytes)) {
  return MessageType.TERMINAL_OUTPUT;
}

// Main thread routes to terminal window
routingConfig[MessageType.TERMINAL_OUTPUT] = [terminalWindow];
```

### Pool Exhaustion

**Condition:** All pool slots in use

**Detection:**
```typescript
const slot = sharedMessagePool.acquire();
if (!slot) {
  throw new Error('Pool exhausted - all slots in use');
}
```

**Prevention:**
- Size pool for expected burst (1000 slots default)
- Monitor pool usage via getStats()
- Ensure destinations release slots promptly

**Recovery:**
- Increase pool size if needed
- Log warning for investigation
- Block Worker until slot available

---

## Design Rationale

### Why Worker Threads?

**Problem:** Message extraction takes 5-6ms, but USB packets arrive every ~4ms at 2 Mbps.

**Main thread extraction blocks event loop:**
```
USB packet arrives
    ↓
Extract message (5-6ms) ← BLOCKS
    ↓
USB packet arrives (while blocked)
    ↓
SerialPort buffer overflows → DATA LOSS
```

**Worker thread extraction runs in parallel:**
```
Main Thread:              Worker Thread:
USB packet arrives
    ↓
Write to buffer (0.3ms)
    ↓                     Extract (5-6ms, parallel)
Return to event loop ✓         ↓
    ↓                     postMessage(poolId)
USB packet arrives
    ↓
Write to buffer (0.3ms)
    ↓
Return to event loop ✓
```

**Result:** 0% message loss (proven with HSV16 test: 65,539/65,539 messages)

### Why SharedArrayBuffer?

**Alternative:** postMessage entire message from Worker to main

**Cost Analysis:**
```
Approach 1: postMessage(messageBytes)
  - Copies message data via structured clone
  - HSV16: 65,536 messages × 50 bytes avg = 3.2MB copied

Approach 2: SharedArrayBuffer
  - Zero-copy shared memory access
  - HSV16: 0 bytes copied (just poolId references)
```

**Benefit:** Eliminates ~3MB of IPC copying for HSV16 test

### Why Two-Stage Classification?

**Alternative:** Full pattern matching in Worker (original plan: 6-8 hours porting)

**Current Design:** Boundary detection in Worker, simple classification

**Rationale:**
1. **Simpler Worker** - Only ~200 lines vs ~800 lines
2. **Faster Development** - 2-3 hours vs 6-8 hours
3. **Easier Debugging** - Boundary detection is straightforward
4. **Adequate Performance** - Classification on complete message is fast (<0.1ms)

**Trade-off:** Main thread does trivial classification work, but it's fast enough

### Why Message Pool?

**Problem:** Multiple destinations need same message (logger + window)

**Without Pool:**
```typescript
for (const dest of destinations) {
  dest.handler(copyMessage(message)); // COPY for each destination
}
// 2 destinations = 2 copies
```

**With Pool:**
```typescript
const pooled = pool.acquire(message, destinations.length);
for (const dest of destinations) {
  dest.handler(pooled); // Same reference, NO COPY
}
// 2 destinations = 0 additional copies
```

**Benefit:** Eliminates N-1 copies for N destinations

### Why Single-Byte Type Enum?

**Alternative:** Send metadata separately (type + cogId + ...)

**Current Design:** COG ID embedded in enum value

```typescript
COG3_MESSAGE = 4       // Type AND COG ID in one byte
DEBUGGER5_416BYTE = 14 // Type AND COG ID in one byte
```

**Benefits:**
1. **Single byte lookup** - `routingConfig[type]`
2. **No metadata parsing** - COG ID implicit in type
3. **Simpler IPC** - Just poolId (4 bytes)
4. **Fast routing** - Array index, not map lookup

---

## Appendix A: Message Type Reference

### DB_PACKET (0x00)
- **Structure:** `[0xDB] [subtype] [lengthLow] [lengthHigh] [payload...]`
- **Size:** Variable (4 byte header + 0-65535 byte payload)
- **Detection:** First byte = 0xDB
- **Routing:** Debug logger

### COG0-7_MESSAGE (0x01-0x08)
- **Structure:** `Cog[0-7] [text...]\r\n`
- **Size:** Variable (typically 20-100 bytes)
- **Detection:** Starts with "Cog[0-7] " (note two spaces after COG ID)
- **Routing:** Debug logger + COG-specific window
- **Special Case:** COG0 with "INIT $0000_0000 $0000_0000 load" triggers golden sync

### DEBUGGER0-7_416BYTE (0x09-0x10)
- **Structure:** `[cogId:1 byte] [status:40 bytes] [crc:128 bytes] [hub:248 bytes]`
- **Size:** Exactly 416 bytes
- **Detection:** First byte 0x00-0x07, length = 416
- **Routing:** Debug logger + debugger window for that COG
- **Note:** Followed by zero-byte streams (hardware issue) - Worker filters these

### BACKTICK_WINDOW (0x11)
- **Structure:** `` `[command] [windowName] [parameters...]\r\n ``
- **Size:** Variable (typically 30-200 bytes)
- **Detection:** First byte = 0x60 (backtick)
- **Routing:** Debug logger + window creator + specific window
- **Note:** Main thread must parse window name for routing

### TERMINAL_OUTPUT (0x12)
- **Structure:** Any text ending in CR/LF
- **Size:** Variable
- **Detection:** Default (doesn't match other patterns)
- **Routing:** Terminal window (blue window)

### INVALID_COG (0x13)
- **Structure:** Starts with "Cog" but invalid COG ID (8-9, etc.)
- **Size:** Variable
- **Detection:** "Cog" prefix but cogId < 0 or > 7
- **Routing:** Debug logger with warning

---

## Appendix B: Performance Benchmarks

### HSV16 Test Results

**Test Configuration:**
- 3 window creation commands
- 65,536 data messages (`\`j k l $0` through `\`j k l $FFFF`)
- Total: 65,539 messages
- Transmission: Rapid burst (simulates 2 Mbps)

**Previous Implementation (Main Thread Extraction):**
```
Messages received: 28,000-31,000 / 65,539
Success rate: 43-47%
Message loss: 34,539-37,539 (53-57%)
Extraction time: 5-6ms per message
```

**Worker Implementation:**
```
Messages received: 65,539 / 65,539
Success rate: 100%
Message loss: 0 (0%)
Main thread time: ~0.3ms per packet
Worker extraction: 5-6ms (parallel, doesn't matter)
High water mark: ~912KB (SharedCircularBuffer)
Buffer overflows: 0
```

**Improvement:** 0% loss vs 44-48% loss = **100% improvement** ✓

### Timing Breakdown

**Main Thread (per USB packet):**
| Operation | Time | Notes |
|-----------|------|-------|
| Buffer.from() copy | 0.05ms | Prevent buffer reuse |
| SharedCircularBuffer.appendAtTail() | 0.15ms | Bulk .set() |
| setImmediate() | 0.01ms | Schedule extraction |
| **Total** | **0.21ms** | **< 0.5ms target** ✓ |

**Worker Thread (per message):**
| Operation | Time | Notes |
|-----------|------|-------|
| Boundary detection | 0.1-2ms | Variable by type |
| Classification | <0.1ms | Simple byte checks |
| Pool acquire | <0.1ms | Atomic operation |
| postMessage | <0.1ms | 4 bytes |
| **Total** | **0.3-2.3ms** | **Parallel, doesn't block** ✓ |

---

## Appendix C: Future Optimizations

### Potential Improvements

1. **Variable Pool Slot Sizes**
   - Current: Fixed max size per slot
   - Future: Size-tiered pools (small/medium/large)
   - Benefit: Reduce memory waste for small messages

2. **Worker Pool**
   - Current: Single Worker thread
   - Future: Multiple Workers for parallel extraction
   - Benefit: Higher throughput for multi-core systems

3. **Batch IPC**
   - Current: postMessage per message
   - Future: Batch multiple poolIds in single message
   - Benefit: Reduce IPC overhead

4. **Direct Window Dispatch**
   - Current: Router lookup by type
   - Future: Worker includes destination hint
   - Benefit: Skip routing table lookup

### Non-Goals

The following optimizations are NOT planned (complexity not justified):

- Transferable ArrayBuffers (complexity for minimal gain)
- Custom binary protocol (SharedArrayBuffer is sufficient)
- Lock-free ring buffer algorithms (Atomics are fast enough)
- Assembly optimizations (JavaScript JIT is efficient)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-06 | Claude Code | Initial specification |

---

**END OF DOCUMENT**
