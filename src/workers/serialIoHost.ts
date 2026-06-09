/** @format */

// src/workers/serialIoHost.ts
//
// [#31] Electron UtilityProcess that OWNS the SerialPort in its OWN process. Required because
// @serialport/bindings-cpp hardcodes uv_default_loop() for its fd poller (poller.cpp:25), so a
// worker_threads Worker can't host it — the native Poller::onData fires on the MAIN process's
// loop against the worker's V8 isolate → SIGSEGV. In a UtilityProcess, uv_default_loop() IS
// this process's own loop, which does no rendering, so the poller runs correctly and the driver
// is serviced regardless of main-thread render load.
//
// This process drains the port and forwards EVERY received chunk to main (transferable), where
// the existing MainWindow.handleSerialRx path feeds the ring/extractor exactly as before
// (downloads included). Control is an RPC of UsbSerial method calls.

import { UsbSerial } from '../utils/usb.serial';

// In a UtilityProcess, process.parentPort is the MessagePortMain back to the main process.
const port: any = (process as any).parentPort;

let serial: UsbSerial | null = null;

function post(msg: any, transfer?: any[]): void {
  if (transfer && transfer.length) port.postMessage(msg, transfer);
  else port.postMessage(msg);
}

function makeContextStub(runEnvironment: Record<string, any>): any {
  // logger forwards any method call to main; runEnvironment carries the flags UsbSerial reads.
  const logger = new Proxy(
    {},
    { get: () => (...args: any[]) => post({ kind: 'log', args: args.map(String) }) }
  );
  return { runEnvironment, logger };
}

function pushState(): void {
  if (!serial) return;
  try {
    post({
      kind: 'state',
      state: {
        currentBaudRate: serial.getCurrentBaudRate(),
        downloadBaudRate: serial.getDownloadBaudRate(),
        checksumStatus: serial.getChecksumStatus(),
        isDownloading: serial.isDownloading()
      }
    });
  } catch {
    /* getters unavailable mid-teardown — ignore */
  }
}

function handleInit(init: any): void {
  try {
    UsbSerial.setCommBaudRate(init.baudRate);
    serial = new UsbSerial(makeContextStub(init.runEnvironment || {}), init.deviceNode);
    if (init.downloadBaudRate) {
      try {
        serial.setDownloadBaudRate(init.downloadBaudRate);
      } catch {
        /* non-fatal */
      }
    }
    // Forward every chunk to main. appendAtTail-equivalent (ring write) happens on main via
    // handleSerialRx; here we copy out of the serialport buffer immediately and transfer it.
    serial.on('data', (data: Buffer) => {
      const copy = new Uint8Array(data.length);
      copy.set(data);
      post({ kind: 'data', data: copy }, [copy.buffer]);
    });
    post({ kind: 'ready' });
  } catch (e: any) {
    post({ kind: 'fatal', error: `UsbSerial construct failed: ${e?.message ?? e}` });
  }
}

async function handleCall(msg: any): Promise<void> {
  if (!serial) {
    if (msg.id) post({ kind: 'result', id: msg.id, ok: false, error: 'serial not initialized' });
    return;
  }
  try {
    const fn = (serial as any)[msg.method];
    if (typeof fn !== 'function') throw new Error(`serial host: unknown method '${msg.method}'`);
    const value = await fn.apply(serial, msg.args || []);
    if (msg.id) post({ kind: 'result', id: msg.id, ok: true, value });
  } catch (e: any) {
    if (msg.id) post({ kind: 'result', id: msg.id, ok: false, error: e?.message ?? String(e) });
  } finally {
    pushState();
  }
}

port.on('message', (event: any) => {
  // UtilityProcess delivers a MessageEvent ({data, ports}); be tolerant of a raw payload too.
  const msg = event && Object.prototype.hasOwnProperty.call(event, 'data') ? event.data : event;
  if (!msg) return;
  if (msg.kind === 'init') handleInit(msg);
  else if (msg.kind === 'call') void handleCall(msg);
});

// Announce readiness to receive 'init' (main waits for this so no message is sent before our
// listener is attached).
post({ kind: 'hello' });
