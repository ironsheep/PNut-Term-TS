/** @format */

// src/workers/serialIoWorker.ts
//
// [#31] Serial I/O worker. Hosts the SerialPort OFF the Electron main loop so that
// display/render work on the main thread can never starve the driver (root-cause fix for
// the 2 Mbaud byte-injection/torn-read corruption — see
// DOCs/project-specific/SERIAL-RX-CORRUPTION-DIAGNOSTIC.md).
//
// Receive routing:
//   - run mode (default): incoming bytes are written straight to the SharedArrayBuffer ring
//     that the extraction worker reads. The main thread is entirely out of the receive path.
//   - download mode: while UsbSerial.isDownloading() is true, raw bytes are forwarded to main
//     so the existing Downloader protocol logic runs unchanged.
//
// Control plane: the main-thread UsbSerialProxy marshals UsbSerial method calls as RPC
// messages ({kind:'call', id, method, args}); results come back as {kind:'result', ...}.
// Getter state (baud / checksum / downloading) is pushed to the proxy as {kind:'state'}.

import { parentPort, workerData } from 'worker_threads';
import { UsbSerial } from '../utils/usb.serial';
import { SharedCircularBuffer } from '../classes/shared/sharedCircularBuffer';

interface SerialWorkerInit {
  ring: { dataBuffer: SharedArrayBuffer; stateBuffer: SharedArrayBuffer; size: number };
  deviceNode: string;
  baudRate: number;
  downloadBaudRate?: number;
  runEnvironment: Record<string, any>;
}

const port = parentPort!;
const init = workerData as SerialWorkerInit;

// Writer view over the SHARED ring buffers (extraction worker is the reader → SPSC).
const ring = SharedCircularBuffer.fromTransferables(init.ring);

// Minimal Context stub: logger forwards every call to main; runEnvironment carries only the
// flags UsbSerial actually reads (loggingEnabled / rtsOverride / resetOnConnection /
// matchVendorOnly). A Proxy makes ANY logger method name a safe no-throw forward.
const loggerStub: any = new Proxy(
  {},
  { get: () => (...args: any[]) => port.postMessage({ kind: 'log', args: args.map(String) }) }
);
const ctxStub: any = { runEnvironment: init.runEnvironment, logger: loggerStub };

// UsbSerial reads the static desiredCommsBaudRate at construction — set it first.
UsbSerial.setCommBaudRate(init.baudRate);

let serial: UsbSerial;
try {
  serial = new UsbSerial(ctxStub, init.deviceNode);
} catch (e: any) {
  port.postMessage({ kind: 'fatal', error: `UsbSerial construct failed: ${e?.message ?? e}` });
  throw e;
}
if (init.downloadBaudRate) {
  try {
    serial.setDownloadBaudRate(init.downloadBaudRate);
  } catch {
    /* non-fatal */
  }
}

// Hot path: route each received chunk. appendAtTail copies synchronously, so the serialport
// buffer is never held past this call.
serial.on('data', (data: Buffer) => {
  if (serial.isDownloading()) {
    const copy = new Uint8Array(data.length);
    copy.set(data);
    port.postMessage({ kind: 'data', data: copy }, [copy.buffer]);
  } else {
    ring.appendAtTail(data);
  }
});

function pushState(): void {
  try {
    port.postMessage({
      kind: 'state',
      state: {
        currentBaudRate: serial.getCurrentBaudRate(),
        downloadBaudRate: serial.getDownloadBaudRate(),
        checksumStatus: serial.getChecksumStatus(),
        isDownloading: serial.isDownloading()
      }
    });
  } catch {
    /* getters may be unavailable mid-teardown — ignore */
  }
}

// RPC dispatch: invoke the named UsbSerial method and reply (id===0 means fire-and-forget).
port.on('message', async (msg: any) => {
  if (msg?.kind !== 'call') return;
  try {
    const fn = (serial as any)[msg.method];
    if (typeof fn !== 'function') throw new Error(`serial worker: unknown method '${msg.method}'`);
    const value = await fn.apply(serial, msg.args || []);
    if (msg.id) port.postMessage({ kind: 'result', id: msg.id, ok: true, value });
  } catch (e: any) {
    if (msg.id) port.postMessage({ kind: 'result', id: msg.id, ok: false, error: e?.message ?? String(e) });
  } finally {
    pushState();
  }
});

port.postMessage({ kind: 'ready' });
