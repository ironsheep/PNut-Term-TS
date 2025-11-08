# Worker Thread Extraction - Architecture Design

## Problem Statement

**Current bottleneck:**
- Message extraction takes 5-6ms synchronously
- USB packets arrive every ~4ms at 2 Mbps
- Event loop blocked → can't receive next packet → 44% message loss

**Goal:** Move extraction to Worker Thread so main thread stays responsive.

---

## Architecture Overview

```
Main Thread:                           Worker Thread:
┌─────────────────┐                   ┌──────────────────┐
│ USB 'data'      │                   │ extractMessages()│
│    ↓            │                   │    ↓             │
│ receiveData()   │                   │ Pattern Match    │
│    ↓ (<0.5ms)   │                   │    ↓             │
│ CircularBuffer  │←─── SHARED ───────│ Read from Buffer │
│ (SharedArrayBuf)│                   │    ↓             │
│    ↓            │                   │ Create Messages  │
│ Return to loop  │                   │    ↓             │
└─────────────────┘                   │ postMessage()    │
         ↑                             └──────────────────┘
         │                                      │
         └──────── Extracted Messages ──────────┘
                  (via Worker IPC)
```

---

## Implementation Plan

### Phase 1: Shared CircularBuffer

**File:** `src/classes/shared/sharedCircularBuffer.ts`

```typescript
export class SharedCircularBuffer {
  private buffer: Uint8Array;          // Backed by SharedArrayBuffer
  private sharedState: Int32Array;     // [head, tail, isEmpty] in SharedArrayBuffer

  constructor(size: number = 1048576) {
    // Create shared buffer for data
    const sharedBuffer = new SharedArrayBuffer(size);
    this.buffer = new Uint8Array(sharedBuffer);

    // Create shared state (head, tail, isEmpty flag)
    const stateBuffer = new SharedArrayBuffer(12); // 3 x Int32
    this.sharedState = new Int32Array(stateBuffer);
    // [0] = head, [1] = tail, [2] = isEmpty (0=false, 1=true)

    this.sharedState[2] = 1; // Initially empty
  }

  // Main thread writes
  public appendAtTail(data: Uint8Array): boolean {
    const available = this.getAvailableSpace();
    if (data.length > available) {
      return false; // Overflow
    }

    const tail = Atomics.load(this.sharedState, 1);
    const spaceAtEnd = this.buffer.length - tail;

    if (data.length <= spaceAtEnd) {
      this.buffer.set(data, tail);
      Atomics.store(this.sharedState, 1, (tail + data.length) % this.buffer.length);
    } else {
      // Wraparound
      this.buffer.set(data.subarray(0, spaceAtEnd), tail);
      this.buffer.set(data.subarray(spaceAtEnd), 0);
      Atomics.store(this.sharedState, 1, data.length - spaceAtEnd);
    }

    Atomics.store(this.sharedState, 2, 0); // Not empty
    return true;
  }

  // Worker thread reads
  public next(): { status: string; value?: number } {
    const head = Atomics.load(this.sharedState, 0);
    const tail = Atomics.load(this.sharedState, 1);
    const isEmpty = Atomics.load(this.sharedState, 2);

    if (isEmpty === 1) {
      return { status: 'EMPTY' };
    }

    const value = this.buffer[head];
    const newHead = (head + 1) % this.buffer.length;
    Atomics.store(this.sharedState, 0, newHead);

    if (newHead === tail) {
      Atomics.store(this.sharedState, 2, 1); // Now empty
    }

    return { status: 'DATA', value };
  }

  // Get transferable objects for Worker
  public getTransferables() {
    return {
      buffer: this.buffer.buffer,
      state: this.sharedState.buffer
    };
  }
}
```

---

### Phase 2: Extraction Worker

**File:** `src/workers/extractionWorker.ts`

```typescript
import { parentPort } from 'worker_threads';
import { SharedCircularBuffer } from '../classes/shared/sharedCircularBuffer';
import { MessageExtractor } from '../classes/shared/messageExtractor';

if (!parentPort) {
  throw new Error('Must be run as Worker Thread');
}

let buffer: SharedCircularBuffer | null = null;
let extractor: MessageExtractor | null = null;

parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'init':
      // Receive shared buffers from main
      buffer = SharedCircularBuffer.fromTransferables(msg.buffer, msg.state);
      extractor = new MessageExtractor(buffer);
      parentPort!.postMessage({ type: 'ready' });
      break;

    case 'extract':
      // Main thread signals: "data available, please extract"
      if (extractor && buffer) {
        const messages = [];

        // Extract up to 100 messages or until no more complete messages
        for (let i = 0; i < 100; i++) {
          const message = extractor.extractNextMessage();
          if (!message) break;

          messages.push({
            type: message.type,
            data: Array.from(message.data), // Convert Uint8Array to plain array
            timestamp: message.timestamp,
            confidence: message.confidence
          });
        }

        // Send extracted messages back to main
        if (messages.length > 0) {
          parentPort!.postMessage({
            type: 'messages',
            messages
          });
        }

        // If more data available, schedule another extraction
        if (buffer.hasData()) {
          setImmediate(() => {
            parentPort!.postMessage({ type: 'extractMore' });
          });
        }
      }
      break;

    case 'shutdown':
      process.exit(0);
      break;
  }
});
```

---

### Phase 3: Main Thread Integration

**File:** `src/classes/shared/serialReceiver.ts`

```typescript
import { Worker } from 'worker_threads';
import { SharedCircularBuffer } from './sharedCircularBuffer';

export class SerialReceiver extends EventEmitter {
  private buffer: SharedCircularBuffer;
  private extractionWorker: Worker;

  constructor() {
    super();

    // Create shared circular buffer
    this.buffer = new SharedCircularBuffer(1024 * 1024); // 1MB

    // Create extraction worker
    this.extractionWorker = new Worker('./dist/workers/extractionWorker.js');

    // Send shared buffers to worker
    const transferables = this.buffer.getTransferables();
    this.extractionWorker.postMessage({
      type: 'init',
      buffer: transferables.buffer,
      state: transferables.state
    });

    // Listen for extracted messages
    this.extractionWorker.on('message', (msg) => {
      if (msg.type === 'messages') {
        // Emit extracted messages to router
        msg.messages.forEach((message: any) => {
          this.emit('messageExtracted', {
            ...message,
            data: new Uint8Array(message.data) // Convert back to Uint8Array
          });
        });
      } else if (msg.type === 'extractMore') {
        // Worker found more data, trigger another extraction
        this.extractionWorker.postMessage({ type: 'extract' });
      }
    });
  }

  public receiveData(data: Buffer): void {
    const dataCopy = new Uint8Array(Buffer.from(data));

    // Write to shared buffer (~0.1ms)
    const written = this.buffer.appendAtTail(dataCopy);

    if (!written) {
      console.error('[SerialReceiver] Buffer overflow!');
      this.emit('bufferOverflow');
      return;
    }

    // Signal worker: data available
    this.extractionWorker.postMessage({ type: 'extract' });

    // Return immediately - event loop free for next USB packet!
  }
}
```

---

## Performance Analysis

### Main Thread Hot Path

**receiveData() execution:**
1. Copy Buffer: 0.1ms (already doing this)
2. Append to SharedCircularBuffer: 0.1ms (bulk .set())
3. postMessage to Worker: <0.01ms (tiny message)
4. **Total: ~0.2ms** ✅

**Before:** 5-6ms (blocked event loop)
**After:** 0.2ms (95% reduction!)

### Worker Thread (Async)

**extractMessages() execution:**
- Still takes 5-6ms
- But doesn't block main thread
- Can fall behind temporarily
- CircularBuffer (1MB) acts as queue

**Buffering capacity:**
- 1MB buffer = ~1000 packets
- At 2 Mbps: ~4 seconds of buffering
- Extraction processes ~200 msg/sec slower than arrival
- Buffer slowly fills but has huge headroom

---

## Trade-offs

### ✅ Pros
- Main thread stays responsive (<0.2ms per USB packet)
- No more event loop blocking
- 1MB buffer provides massive headroom
- Clean architectural separation

### ⚠️ Cons
- IPC overhead for returning messages (~0.1ms per message)
- Messages arrive slightly delayed (extracting in background)
- More complex error handling
- SharedArrayBuffer browser compatibility (but we're Electron/Node)

### 💰 Memory Cost
- SharedArrayBuffer: 1MB (same as current buffer)
- Worker Thread: ~2-3MB overhead
- Message copying for IPC: Small arrays only
- **Total: ~4-5MB** (acceptable for desktop app)

---

## Migration Strategy

### Step 1: Implement SharedCircularBuffer
- New file, doesn't break existing code
- Can test in isolation

### Step 2: Create Worker
- Extraction logic moves to worker
- Test with hsv16Reproduction.test.ts

### Step 3: Update SerialReceiver
- Switch from CircularBuffer to SharedCircularBuffer
- Wire up Worker communication

### Step 4: Update Router
- Receive messages from 'messageExtracted' events
- No other changes needed (same message format)

### Step 5: Test & Validate
- Run HSV16 test: expect 65,539/65,539 ✅
- Run external hardware test
- Monitor for issues

---

## Rollback Plan

If Worker Thread approach has issues:
- Keep SharedCircularBuffer
- Move extraction back to main thread
- At least we have optimized buffer operations

Git commit boundaries:
1. Commit SharedCircularBuffer alone
2. Commit Worker implementation
3. Commit SerialReceiver integration

Can revert any step independently.

---

## Next Steps

1. Implement `SharedCircularBuffer` class
2. Create extraction worker
3. Wire up SerialReceiver
4. Test with hsv16Reproduction.test.ts
5. Build and test externally

Estimated time: 2-3 hours of implementation + testing
