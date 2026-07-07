/** @format */

// src/workers/extractionWorker.ts

import { parentPort } from 'worker_threads';
import { SharedCircularBuffer } from '../classes/shared/sharedCircularBuffer';
import { SharedMessagePool } from '../classes/shared/sharedMessagePool';
import { ExtractionCore } from '../classes/shared/extractionCore';

/**
 * Extraction Worker — thin `worker_threads` transport shell around ExtractionCore.
 *
 * This worker owns ONLY the cross-thread transport:
 * 1. Receives SharedCircularBuffer and SharedMessagePool from the main thread.
 * 2. Constructs an ExtractionCore over them (all framing + classification +
 *    the single-step debugger Phase-3 raw-passthrough live in the core now).
 * 3. Runs the autonomous loop: pump the core, emit periodic RX stats, repeat.
 * 4. Forwards control signals (debuggerPhase3Done, debuggerPhase3Size, clear) to
 *    the core.
 *
 * The framing logic was lifted VERBATIM into `ExtractionCore` (a
 * behavior-preserving code-move) so the same engine can be driven in-process by
 * tests — the worker module throws at import without a parentPort, and the
 * worker-thread + SAB round-trip does not deliver under Jest. See
 * `src/classes/shared/extractionCore.ts`.
 */

// More defensive check - in some environments parentPort might exist but be undefined
if (typeof parentPort === 'undefined' || !parentPort) {
  console.error('[ExtractionWorker] ERROR: parentPort is not available - not running as Worker Thread');
  throw new Error('ExtractionWorker must be run as Worker Thread');
}

const ENABLE_CONSOLE_LOG: boolean = false;

function logConsoleMessage(...args: any[]): void {
  if (ENABLE_CONSOLE_LOG) {
    console.log('[ExtractionWorker]', ...args);
  }
}

// Worker state
let buffer: SharedCircularBuffer | null = null;
let messagePool: SharedMessagePool | null = null;
let core: ExtractionCore | null = null;

// [#30] Periodic RX stats (gated by main via the 'init' msg from PNUT_RX_STATS=1). When on, the
// worker logs extraction count, backpressure activations, and a true pool-occupancy SAB scan
// once per second so an HW run can confirm backpressure engaged with zero loss.
let rxStatsEnabled: boolean = false;
let lastRxStatsTime: number = 0;

/**
 * [#30] Emit periodic RX stats (≤ once/second) so an HW run can confirm backpressure engaged
 * with zero loss. poolUsed is a true SHARED-metadata scan (local free counters are unreliable
 * across threads). Gated by rxStatsEnabled (PNUT_RX_STATS=1 on main).
 */
function maybeLogRxStats(): void {
  if (!rxStatsEnabled || !messagePool || !core) return;
  const now = Date.now();
  if (now - lastRxStatsTime < 1000) return;
  const poolUsed = messagePool.countUsedSlots();
  console.error(
    `[RX-STATS] extracted/s=${core.takeExtractedSinceStats()} total=${core.getExtractionCount()} ` +
      `poolBackpressureEvents=${core.getPoolBackpressureEvents()} poolUsed=${poolUsed} ` +
      `stashed=${core.hasStash() ? 1 : 0}`
  );
  lastRxStatsTime = now;
}

/**
 * Autonomous extraction loop. Continuously pumps the core (boundary detection +
 * classification + emit) and emits periodic RX stats, yielding to the event loop
 * between ticks.
 */
function autonomousLoop(): void {
  if (core) {
    core.pump();
  }

  // [#30] Periodic RX stats (self-throttled to ≤1/sec; no-op unless PNUT_RX_STATS=1).
  maybeLogRxStats();

  // Yield to event loop and continue monitoring
  setImmediate(autonomousLoop);
}

/**
 * Handle messages from main thread
 */
parentPort.on('message', (msg: any) => {
  switch (msg.type) {
    case 'init':
      // Receive SharedCircularBuffer and SharedMessagePool from main thread
      try {
        buffer = SharedCircularBuffer.fromTransferables({
          dataBuffer: msg.dataBuffer,
          stateBuffer: msg.stateBuffer,
          size: msg.size
        });

        messagePool = SharedMessagePool.fromTransferables({
          metadataBuffer: msg.metadataBuffer,
          dataBuffer: msg.poolDataBuffer,
          maxSlots: msg.maxSlots,
          maxMessageSize: msg.maxMessageSize
        });

        // All framing + classification + debugger Phase-3 passthrough lives in
        // the core; the worker just hands it the SAB buffer/pool and an emit that
        // forwards each extracted message's poolId to main for routing.
        core = new ExtractionCore(buffer, messagePool, (poolId: number) => {
          parentPort!.postMessage({ type: 'message', poolId });
        }, { enableConsoleLog: ENABLE_CONSOLE_LOG });

        // [#30] Gate periodic RX backpressure stats (main passes this from PNUT_RX_STATS=1).
        rxStatsEnabled = msg.rxStats === true;

        logConsoleMessage('Initialized with SharedCircularBuffer and SharedMessagePool');

        // Start autonomous extraction loop
        logConsoleMessage('Starting autonomous extraction loop');
        autonomousLoop();

        parentPort!.postMessage({
          type: 'ready'
        });
      } catch (error) {
        parentPort!.postMessage({
          type: 'error',
          error: `Init failed: ${error}`
        });
      }
      break;

    case 'debuggerPhase3Done':
      // The renderer's structural parser reported Phase 3 complete. No-op under
      // the per-cog demux (the core self-delimits each break); kept for wiring.
      if (core) core.onPhase3Done();
      break;

    case 'debuggerPhase3Size':
      // Per-break Phase-3 fixed-size hint (§3) relayed from a debugger window's
      // renderer: lets the core's per-cog demux delimit cog `cogId`'s Phase-3.
      if (core) core.signalDebuggerPhase3Size(msg.cogId, msg.size);
      break;

    case 'debuggerReset':
      // DTR/RTS reset (§4): abandon every in-flight per-cog debug exchange and
      // return to awaitingPhase1 so the post-reboot first Phase-1 frames cleanly.
      // Scoped to debug state — does NOT clear the streaming ring.
      if (core) core.resetDebuggerFraming();
      break;

    case 'clear':
      // [#30] Main cleared the ring (DTR-reset / resync) — drop any stashed pre-reset message so
      // it isn't emitted after the boundary, and abandon any in-flight debug exchange. The ring
      // itself was already reset on the main side.
      if (core) core.onClear();
      logConsoleMessage('Cleared stashed message on buffer clear');
      break;

    case 'shutdown':
      logConsoleMessage('Shutting down');
      process.exit(0);
      break;

    default:
      logConsoleMessage(`Unknown message type: ${msg.type}`);
  }
});

// Signal that worker is loaded
try {
  parentPort.postMessage({
    type: 'loaded'
  });

  logConsoleMessage('Worker loaded and ready');
} catch (error) {
  console.error('[ExtractionWorker] Failed to send loaded message:', error);
}
