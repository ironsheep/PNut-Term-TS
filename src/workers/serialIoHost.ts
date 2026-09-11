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

/**
 * Read the state the proxy serves from its cache. Returns undefined mid-teardown.
 *
 * This snapshot RIDES THE RESULT MESSAGE (see handleCall) rather than following it as a
 * separate 'state' post. Ordering is the whole point: main resolves the RPC promise when it
 * handles 'result', and the awaiting continuation runs as a MICROTASK — before the next port
 * message is ever delivered. So a trailing 'state' post is always applied one beat too late,
 * and every synchronous getter on the proxy reads the PRE-call value at exactly the moment a
 * caller asks for the POST-call one.
 *
 * That is not theoretical: it is the defect this comment was written for. Downloader.download()
 * does `await port.download(...)` and then immediately `port.getChecksumStatus()`. On the GUI
 * path (UsbSerialProxy) it therefore read the snapshot taken back during deviceIsPropellerV2 —
 * verified:false, always — and reported "P2 checksum verification did not complete (no . or !
 * received)" on downloads the P2 had in fact verified and was already running. Headless never
 * showed it, because headless holds a real UsbSerial and its getter is the live field.
 */
function snapshotState(): any | undefined {
  if (!serial) return undefined;
  try {
    return {
      currentBaudRate: serial.getCurrentBaudRate(),
      downloadBaudRate: serial.getDownloadBaudRate(),
      checksumStatus: serial.getChecksumStatus(),
      isDownloading: serial.isDownloading()
    };
  } catch {
    /* getters unavailable mid-teardown — ignore */
    return undefined;
  }
}

function pushState(): void {
  const state = snapshotState();
  if (state) post({ kind: 'state', state });
}

/**
 * Self-reported CPU + throughput sampling for THIS process, behind --diag-serial.
 *
 * Why the app measures itself rather than asking someone to read Task Manager: on Windows every
 * one of our processes is `electron.exe` (main, each renderer, GPU, and this serial host), so a
 * human reading a process list cannot reliably tell which row is the serial reader — the one
 * number that matters when judging whether the read pump is expensive. process.cpuUsage() is
 * scoped to this process by construction, so it cannot be attributed to the wrong one, and it
 * lands in the same log as the traffic it is explaining.
 *
 * Emits one line per interval: CPU percent of a core since the last sample, plus bytes forwarded
 * and the observed rate over the same window. Idle intervals are skipped so a quiet session does
 * not fill the log — silence in this series means "nothing happening", which is itself the
 * baseline reading.
 */
const CPU_SAMPLE_MS = 5000;
let bytesSinceSample = 0;
let cpuSampleTimer: any = null;

function startCpuSampling(): void {
  if (cpuSampleTimer) return;
  let lastCpu = process.cpuUsage();
  let lastAt = Date.now();
  let idleReported = false;
  cpuSampleTimer = setInterval(() => {
    const nowCpu = process.cpuUsage(lastCpu);
    const nowAt = Date.now();
    const elapsedMs = nowAt - lastAt;
    lastCpu = process.cpuUsage();
    lastAt = nowAt;
    const bytes = bytesSinceSample;
    bytesSinceSample = 0;
    if (elapsedMs <= 0) return;
    // cpuUsage() is microseconds of CPU time; as a share of one core over the window:
    const cpuPct = ((nowCpu.user + nowCpu.system) / 1000 / elapsedMs) * 100;
    const kbPerSec = bytes / 1024 / (elapsedMs / 1000);
    if (bytes === 0) {
      // Report the idle baseline ONCE per quiet stretch — enough to prove the pump backs off,
      // without a heartbeat every 5s for the whole session.
      if (idleReported) return;
      idleReported = true;
      post({ kind: 'log', args: [`[WIN-SYNC] cpu idle: ${cpuPct.toFixed(1)}% of a core, 0 bytes in ${elapsedMs}ms`] });
      return;
    }
    idleReported = false;
    post({
      kind: 'log',
      args: [
        `[WIN-SYNC] cpu ${cpuPct.toFixed(1)}% of a core | ${bytes} bytes in ${elapsedMs}ms (${kbPerSec.toFixed(1)} KB/s)`
      ]
    });
  }, CPU_SAMPLE_MS);
  // Never a reason to keep this process alive — same rule as the read pump's own timers.
  if (typeof cpuSampleTimer?.unref === 'function') cpuSampleTimer.unref();
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
      bytesSinceSample += data.length;
      post({ kind: 'data', data: copy }, [copy.buffer]);
    });
    if (init.runEnvironment?.serialDiagnostics) {
      startCpuSampling();
    }
    post({ kind: 'ready' });
  } catch (e: any) {
    console.error(`[HOST] init FAILED: ${e?.message ?? e}`);
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
    // State rides WITH the result — see snapshotState(). A separate post would land after the
    // caller's await has already read the cache.
    if (msg.id) post({ kind: 'result', id: msg.id, ok: true, value, state: snapshotState() });
    else pushState(); // fire-and-forget call: no result to ride on
  } catch (e: any) {
    console.error(`[HOST] call ${msg.method} id=${msg.id} REJECTED: ${e?.message ?? e}`);
    // A rejected call still moved state (a download that threw partway still cleared
    // isDownloading), and the caller's catch block reads the same getters.
    if (msg.id) post({ kind: 'result', id: msg.id, ok: false, error: e?.message ?? String(e), state: snapshotState() });
    else pushState();
  }
}

port.on('message', (event: any) => {
  // UtilityProcess delivers a MessageEvent ({data, ports}); be tolerant of a raw payload too.
  const msg = event && Object.prototype.hasOwnProperty.call(event, 'data') ? event.data : event;
  if (!msg) return;
  if (msg.kind === 'init') handleInit(msg);
  // handleCall() catches its own call failures, but posting the reply can still throw
  // (a torn-down port) — and a rejection here has no awaiter, so it would take the whole
  // serial host process down with it. Report and keep serving.
  else if (msg.kind === 'call')
    handleCall(msg).catch((e: any) => {
      console.error(`[HOST] call ${msg.method} id=${msg.id} handler FAILED: ${e?.message ?? e}`);
      if (msg.id) post({ kind: 'result', id: msg.id, ok: false, error: e?.message ?? String(e) });
    });
});

// Announce readiness to receive 'init' (main waits for this so no message is sent before our
// listener is attached).
post({ kind: 'hello' });
