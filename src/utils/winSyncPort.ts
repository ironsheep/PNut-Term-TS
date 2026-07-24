// winSyncPort.ts
//
// SYNCHRONOUS Windows COM port — the ONE handle the P2 uses on Windows.
//
// WHY THIS EXISTS: node-serialport opens the Windows COM handle with FILE_FLAG_OVERLAPPED.
// The P2 DTR reset blips the USB device (FTDI re-enumeration) and that overlapped handle does
// NOT survive it — the post-reset Prop_Chk write fails "GetOverlappedResult: Invalid handle"
// (HW-confirmed v0.10.2 → v0.10.6, even with NO read in flight, which falsified the
// pending-read theory). Both proven-good downloaders open a SYNCHRONOUS handle instead:
// PNut/SerialUnit.pas (FILE_ATTRIBUTE_NORMAL) and SpinTools/jSSC. v0.10.10 proved the
// synchronous koffi handle downloads correctly on real hardware (Prop_Ver G → checksum '.').
//
// WHAT CHANGED IN v0.11.0: this used to be download-only (`winSyncSerial.ts`), and the app
// then CLOSED it and reopened node-serialport for the 2 Mbaud debug stream. That handoff was
// silent on hardware — node-serialport's open() trips DTR between CreateFile and SetCommState
// (before hupcl:false → DTR_CONTROL_DISABLE applies), which re-resets the P2 back into its
// silent ROM loader. Rather than harden the seam, the seam is GONE: this class now carries the
// debug stream too, so Windows has exactly ONE handle for the whole session — open at startup,
// through reset → detect → image → checksum → 2 Mbaud stream → exit. Same as macOS/Linux,
// which never had a handoff to begin with.
//
// SHAPE: this deliberately presents the node-serialport SerialPort surface UsbSerial already
// consumes (open/close/write/drain/flush/update/set/get/pause/resume + 'data'/'error'/'open'
// events). That is what lets ONE protocol implementation in usb.serial.ts — the same detect,
// the same base64 image framing, the same checksum wait that macOS and Linux certify — drive
// both transports. There is no Windows-only copy of the P2 protocol any more.
//
// CONCURRENCY NOTE (load-bearing): on a synchronous (non-overlapped) handle Windows serializes
// I/O on the file object, so a pending ReadFile blocks a concurrent WriteFile. That is why
// Pascal stops its read thread around writes (SerialUnit.pas SerialThreadStop/Start). We get
// that for free: koffi's synchronous calls block the single JS thread, so the read pump and a
// write can never overlap — the pump's ReadFile has always returned before any other JS runs.
// It also returns immediately (ReadIntervalTimeout=MAXDWORD), so the blocking window is
// microseconds, not a timeout period. No lock is needed; do not add one, and do not switch the
// pump to koffi's async calls without adding one.

import { EventEmitter } from 'events';

/** The subset of the node-serialport SerialPort surface UsbSerial actually consumes. */
export interface ISerialPort {
  readonly path: string;
  readonly baudRate: number;
  readonly isOpen: boolean;
  open(cb: (err?: Error | null) => void): void;
  close(cb: (err?: Error | null) => void): void;
  write(data: string | Buffer | Uint8Array, cb: (err?: Error | null) => void): void;
  drain(cb: (err?: Error | null) => void): void;
  flush(cb: (err?: Error | null) => void): void;
  update(options: { baudRate: number }, cb: (err?: Error | null) => void): void;
  set(options: { dtr?: boolean; rts?: boolean }, cb: (err?: Error | null) => void): void;
  get(cb: (err: Error | null, status?: { cts: boolean; dsr: boolean; dcd: boolean }) => void): void;
  pause(): void;
  resume(): void;
  on(event: string, listener: (...args: any[]) => void): any;
  removeListener(event: string, listener: (...args: any[]) => void): any;
  removeAllListeners(event?: string): any;
  listeners(event: string): any[];
}

export interface SyncLogger {
  diag: (msg: string) => void; // --diag-serial channel detail
  sys: (msg: string) => void; // always-live run narrative
}

export interface WinSyncPortOptions {
  path: string;
  baudRate: number;
}

// ---- Win32 constants ----
const GENERIC_READ = 0x80000000;
const GENERIC_WRITE = 0x40000000;
const OPEN_EXISTING = 3;
const FILE_ATTRIBUTE_NORMAL = 0x80;
const MAXDWORD = 0xffffffff;

// EscapeCommFunction codes
const SETRTS = 3;
const CLRRTS = 4;
const SETDTR = 5;
const CLRDTR = 6;

// PurgeComm flags
const PURGE_TXABORT = 0x0001;
const PURGE_RXABORT = 0x0002;
const PURGE_TXCLEAR = 0x0004;
const PURGE_RXCLEAR = 0x0008;

// GetCommModemStatus bits
const MS_CTS_ON = 0x0010;
const MS_DSR_ON = 0x0020;
const MS_RLSD_ON = 0x0080;

const INVALID_HANDLE = 0xffffffffffffffffn;
const NULL_HANDLE = 0n;

// Open retry: a COM port held by a not-yet-exited previous run reports ACCESS_DENIED and frees
// up within a moment. Bounded, and only retried for that one error code.
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_ACCESS_DENIED = 5;
const OPEN_ATTEMPTS = 3;
const OPEN_RETRY_MS = 300;

/** Turn a CreateFileW GetLastError into something a user can act on. */
function describeOpenError(gle: number): string {
  switch (gle) {
    case ERROR_FILE_NOT_FOUND:
      return 'no such COM port — is the Prop Plug plugged in, and is this the port -n reported?';
    case ERROR_ACCESS_DENIED:
      return 'port already in use — another program (or a previous run of this app that has not exited) holds it';
    default:
      return 'unexpected — see the Win32 System Error Codes for this value';
  }
}

const DCB_SIZE = 28; // sizeof(DCB) on Win32/Win64
const TIMEOUTS_SIZE = 20; // sizeof(COMMTIMEOUTS): 5 DWORDs

// Read pump tuning.
//
// 2 Mbaud 8N1 = 200 KB/s = ~200 bytes/ms, so a 64 KB read buffer absorbs a ~300ms stall and a
// 4ms idle poll leaves ~800 bytes waiting — both far inside the margin. The pump only idles
// when the P2 is quiet; the moment a read returns bytes it yields with setImmediate and reads
// again, so a live 2 Mbaud stream is drained as fast as the loop can turn. Busy-ish polling is
// acceptable here ONLY because [#31] already moved serial ownership into a UtilityProcess that
// does no rendering — this must never be run on the main process's loop.
const READ_BUF_SIZE = 64 * 1024;
const POLL_IDLE_START_MS = 1;
const POLL_IDLE_MAX_MS = 4;
// Driver-side RX/TX queue request. The real backstop against a stalled pump is the driver's own
// buffer, so ask for a generous one rather than accepting the default (often 4 KB).
const DRIVER_QUEUE_BYTES = 64 * 1024;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// The pump's own waits must NOT hold the process open.
//
// A read pump is a service, never a reason to stay alive: it has a timer pending at every
// instant, so an un-unref'd timer keeps libuv's loop alive forever and the process cannot exit
// on its own. That presents as "the app locked up" on quit AND poisons the NEXT run — a serial
// process that never exits keeps the COM port claimed, so the next launch gets ACCESS_DENIED
// from CreateFileW. unref() lets the loop drain and the process exit whenever nothing else is
// keeping it up; the pump simply stops being scheduled at that point, which is what we want.
const sleepUnref = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const t: any = setTimeout(resolve, ms);
    if (typeof t?.unref === 'function') t.unref();
  });
const immediateUnref = (): Promise<void> =>
  new Promise((resolve) => {
    const i: any = setImmediate(resolve);
    if (typeof i?.unref === 'function') i.unref();
  });

// ---- lazily-bound kernel32 surface ----
interface Kernel32 {
  CreateFileW: (...a: any[]) => any;
  BuildCommDCBW: (...a: any[]) => number;
  SetCommState: (...a: any[]) => number;
  GetCommState: (...a: any[]) => number;
  SetCommTimeouts: (...a: any[]) => number;
  SetupComm: (...a: any[]) => number;
  EscapeCommFunction: (...a: any[]) => number;
  GetCommModemStatus: (...a: any[]) => number;
  PurgeComm: (...a: any[]) => number;
  WriteFile: (...a: any[]) => number;
  ReadFile: (...a: any[]) => number;
  FlushFileBuffers: (...a: any[]) => number;
  CloseHandle: (...a: any[]) => number;
  GetLastError: () => number;
}

let k32: Kernel32 | null = null;
let koffiLoadError: string = '';
let platformOverrideForTest: string | null = null;

/**
 * TEST SEAM — inject a fake kernel32 (and pretend to be win32) so the read pump, the flowing-
 * mode gate and the pause/resume semantics can be exercised off-Windows. Inert in production:
 * nothing calls it, and passing null restores the real loader. Kept because the pump is the
 * only genuinely new algorithm here and would otherwise be hardware-only.
 */
export function __setKernel32ForTesting(fake: Partial<Kernel32> | null, platform?: string): void {
  k32 = fake as Kernel32 | null;
  koffiLoadError = '';
  platformOverrideForTest = fake ? (platform ?? 'win32') : null;
}

function currentPlatform(): string {
  return platformOverrideForTest ?? process.platform;
}

function loadKernel32(): Kernel32 | null {
  if (k32) return k32;
  if (koffiLoadError) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi');
    const lib = koffi.load('kernel32.dll');
    // HANDLE is a 64-bit pointer on Win64; declaring it 'uint64' lets us hold it as a BigInt
    // and pass it straight back in — no opaque-pointer juggling. Win32-only, so 64-bit is safe
    // (we ship win32-x64 and win32-arm64, never ia32).
    k32 = {
      CreateFileW: lib.func('CreateFileW', 'uint64', ['void *', 'uint32', 'uint32', 'void *', 'uint32', 'uint32', 'void *']),
      BuildCommDCBW: lib.func('BuildCommDCBW', 'int', ['void *', 'void *']),
      SetCommState: lib.func('SetCommState', 'int', ['uint64', 'void *']),
      GetCommState: lib.func('GetCommState', 'int', ['uint64', 'void *']),
      SetCommTimeouts: lib.func('SetCommTimeouts', 'int', ['uint64', 'void *']),
      SetupComm: lib.func('SetupComm', 'int', ['uint64', 'uint32', 'uint32']),
      EscapeCommFunction: lib.func('EscapeCommFunction', 'int', ['uint64', 'uint32']),
      GetCommModemStatus: lib.func('GetCommModemStatus', 'int', ['uint64', 'void *']),
      PurgeComm: lib.func('PurgeComm', 'int', ['uint64', 'uint32']),
      WriteFile: lib.func('WriteFile', 'int', ['uint64', 'void *', 'uint32', 'void *', 'void *']),
      ReadFile: lib.func('ReadFile', 'int', ['uint64', 'void *', 'uint32', 'void *', 'void *']),
      FlushFileBuffers: lib.func('FlushFileBuffers', 'int', ['uint64']),
      CloseHandle: lib.func('CloseHandle', 'int', ['uint64']),
      GetLastError: lib.func('GetLastError', 'uint32', [])
    };
    return k32;
  } catch (err: any) {
    koffiLoadError = err?.message ?? String(err);
    return null;
  }
}

/** Widen a NUL-terminated UTF-16LE buffer for a Win32 wide-string argument. */
function wide(s: string): Buffer {
  return Buffer.from(s + ' ', 'utf16le');
}

export class WinSyncPort extends EventEmitter {
  private handle: bigint = NULL_HANDLE;
  private readonly _path: string;
  private _baudRate: number;
  private readonly log: SyncLogger;

  // read-pump state
  private pumpRunning = false;
  private paused = false;
  private readonly readBuf: Buffer = Buffer.allocUnsafe(READ_BUF_SIZE);

  constructor(options: WinSyncPortOptions, log: SyncLogger) {
    super();
    this._path = options.path;
    this._baudRate = options.baudRate;
    this.log = log;
  }

  /** True when this transport can be used at all (win32 + koffi/kernel32 loadable). */
  public static isAvailable(): boolean {
    return currentPlatform() === 'win32' && loadKernel32() !== null;
  }

  /** Why isAvailable() said no — for the capability-gate message. */
  public static unavailableReason(): string {
    if (currentPlatform() !== 'win32') return `not win32 (${currentPlatform()})`;
    return koffiLoadError || 'koffi/kernel32 unavailable';
  }

  public get path(): string {
    return this._path;
  }

  public get baudRate(): number {
    return this._baudRate;
  }

  public get isOpen(): boolean {
    return this.handle !== NULL_HANDLE && this.handle !== INVALID_HANDLE;
  }

  // ---------------------------------------------------------------------------
  //  SerialPort-shaped surface
  // ---------------------------------------------------------------------------

  /**
   * Open the COM port SYNCHRONOUSLY (FILE_ATTRIBUTE_NORMAL), mirroring SerialUnit.pas OpenComm:
   * BuildCommDCBW("baud,n,8,1") → SetCommState → non-blocking read timeouts. Then start the
   * read pump so the stream is live from the first byte.
   */
  public open(cb: (err?: Error | null) => void): void {
    const api = loadKernel32();
    if (!api) {
      const msg = `[WIN-SYNC] kernel32 unavailable: ${WinSyncPort.unavailableReason()}`;
      this.log.sys(msg);
      cb(new Error(msg));
      return;
    }
    // "\\.\COM10" form is required for COM >= 10 and harmless for low ports.
    const devicePath = `\\\\.\\${this._path}`;
    // ALWAYS-LIVE: name the attempt BEFORE it happens. A failed open used to report only
    // through the callback, which UsbSerial.handleSerialError swallows into _latestError behind
    // gated logging — so the app went quiet with nothing in the log to say why (v0.11.0, HW).
    // Every exit from this method now leaves a line behind.
    this.log.sys(`[WIN-SYNC] opening ${devicePath} @ ${this._baudRate} (synchronous handle)`);

    let ret: any = 0;
    let gle = 0;
    for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt++) {
      ret = api.CreateFileW(
        wide(devicePath),
        GENERIC_READ | GENERIC_WRITE,
        0, // no sharing — exclusive, like Pascal (share mode 0)
        null,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL, // SYNCHRONOUS — no FILE_FLAG_OVERLAPPED (the whole point)
        null
      );
      this.handle = BigInt.asUintN(64, BigInt(ret));
      if (this.isOpen) break;
      gle = api.GetLastError();
      this.handle = NULL_HANDLE;
      // ERROR_ACCESS_DENIED here means the COM port is still held by someone — most often a
      // previous run of this app that has not finished exiting, or a terminal left open. The
      // driver releases it a moment later, so a bounded retry turns a hard failure into a blip.
      // Anything else (no such port, device unplugged) will not improve with waiting.
      if (gle !== ERROR_ACCESS_DENIED || attempt === OPEN_ATTEMPTS) break;
      this.log.sys(`[WIN-SYNC] ${devicePath} busy (ACCESS_DENIED) — retry ${attempt}/${OPEN_ATTEMPTS - 1} in ${OPEN_RETRY_MS}ms`);
      const until = Date.now() + OPEN_RETRY_MS;
      while (Date.now() < until) {
        /* deliberate short spin: open() is synchronous by contract (the caller passes a
           callback but does not await), so we cannot yield to the loop here. Bounded and
           only on the already-failing path. */
      }
    }

    if (!this.isOpen) {
      const msg = `[WIN-SYNC] CANNOT OPEN ${devicePath} — GetLastError=${gle} (${describeOpenError(gle)})`;
      this.log.sys(msg);
      cb(new Error(msg));
      return;
    }
    this.log.diag(`[WIN-SYNC] opened ${devicePath} synchronous handle=0x${this.handle.toString(16)}`);

    if (!this.applyState(this._baudRate)) {
      this.closeHandle();
      cb(new Error(`[WIN-SYNC] could not configure ${devicePath} at ${this._baudRate} baud`));
      return;
    }
    // Ask the driver for a generous RX/TX queue — the backstop if the pump is ever starved.
    if (!api.SetupComm(this.handle, DRIVER_QUEUE_BYTES, DRIVER_QUEUE_BYTES)) {
      this.log.diag(`[WIN-SYNC] SetupComm(${DRIVER_QUEUE_BYTES}) declined — GetLastError=${api.GetLastError()} (using driver default)`);
    }
    this.log.diag(`[WIN-SYNC] DCB set ${this._baudRate},n,8,1 + non-blocking read timeouts`);

    this.startPump();
    cb(null);
    process.nextTick(() => this.emit('open'));
  }

  public close(cb: (err?: Error | null) => void): void {
    this.pumpRunning = false; // the loop observes this and exits on its next turn
    this.closeHandle();
    cb(null);
    process.nextTick(() => this.emit('close'));
  }

  /** Blocking write. WriteFile on a synchronous handle returns once the driver has the data. */
  public write(data: string | Buffer | Uint8Array, cb: (err?: Error | null) => void): void {
    const api = loadKernel32();
    if (!api || !this.isOpen) {
      cb(new Error('[WIN-SYNC] write on closed handle'));
      return;
    }
    // NOTE: a Buffer that crossed a process boundary arrives as a plain Uint8Array (structured
    // clone drops the prototype), so normalize on "is it a string?" rather than Buffer.isBuffer.
    const buf: Buffer =
      typeof data === 'string' ? Buffer.from(data, 'latin1') : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (buf.length === 0) {
      cb(null);
      return;
    }
    const written = Buffer.alloc(4);
    const ok = api.WriteFile(this.handle, buf, buf.length, written, null);
    if (!ok) {
      cb(new Error(`[WIN-SYNC] WriteFile failed (${buf.length} bytes) — GetLastError=${api.GetLastError()}`));
      return;
    }
    const n = written.readUInt32LE(0);
    if (n !== buf.length) {
      this.log.sys(`[WIN-SYNC] WARNING: WriteFile wrote ${n}/${buf.length} bytes (partial)`);
    }
    cb(null);
  }

  /**
   * Wait for queued TX to reach the wire. The P2 handshake is timing-sensitive (Prop_Chk then a
   * 17ms window), so this is a real FlushFileBuffers, not a no-op.
   */
  public drain(cb: (err?: Error | null) => void): void {
    const api = loadKernel32();
    if (api && this.isOpen) api.FlushFileBuffers(this.handle);
    cb(null);
  }

  /** Discard buffered RX and TX — PurgeComm, the Win32 analog of node-serialport's flush(). */
  public flush(cb: (err?: Error | null) => void): void {
    const api = loadKernel32();
    if (api && this.isOpen) {
      api.PurgeComm(this.handle, PURGE_RXABORT | PURGE_RXCLEAR | PURGE_TXABORT | PURGE_TXCLEAR);
    }
    cb(null);
  }

  /** Change baud in place — re-apply the DCB. No reopen, so nothing can trip the reset line. */
  public update(options: { baudRate: number }, cb: (err?: Error | null) => void): void {
    if (!this.isOpen) {
      cb(new Error('[WIN-SYNC] update on closed handle'));
      return;
    }
    if (!this.applyState(options.baudRate)) {
      cb(new Error(`[WIN-SYNC] SetCommState failed for baud ${options.baudRate}`));
      return;
    }
    this._baudRate = options.baudRate;
    cb(null);
  }

  /**
   * Drive the control lines. Semantics match node-serialport: `true` = ASSERT (the line the
   * Prop Plug turns into its 17us reset pulse), `false` = de-assert / idle.
   */
  public set(options: { dtr?: boolean; rts?: boolean }, cb: (err?: Error | null) => void): void {
    const api = loadKernel32();
    if (!api || !this.isOpen) {
      cb(new Error('[WIN-SYNC] set() on closed handle'));
      return;
    }
    try {
      if (options.dtr !== undefined) {
        const fn = options.dtr ? SETDTR : CLRDTR;
        if (!api.EscapeCommFunction(this.handle, fn)) {
          cb(new Error(`[WIN-SYNC] EscapeCommFunction(DTR=${options.dtr}) failed — GetLastError=${api.GetLastError()}`));
          return;
        }
      }
      if (options.rts !== undefined) {
        const fn = options.rts ? SETRTS : CLRRTS;
        if (!api.EscapeCommFunction(this.handle, fn)) {
          cb(new Error(`[WIN-SYNC] EscapeCommFunction(RTS=${options.rts}) failed — GetLastError=${api.GetLastError()}`));
          return;
        }
      }
      cb(null);
    } catch (e: any) {
      cb(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Modem-status lines — a live device asserts DSR. */
  public get(cb: (err: Error | null, status?: { cts: boolean; dsr: boolean; dcd: boolean }) => void): void {
    const api = loadKernel32();
    if (!api || !this.isOpen) {
      cb(new Error('[WIN-SYNC] get() on closed handle'));
      return;
    }
    const stat = Buffer.alloc(4);
    if (!api.GetCommModemStatus(this.handle, stat)) {
      cb(new Error(`[WIN-SYNC] GetCommModemStatus failed — GetLastError=${api.GetLastError()}`));
      return;
    }
    const v = stat.readUInt32LE(0);
    cb(null, { cts: !!(v & MS_CTS_ON), dsr: !!(v & MS_DSR_ON), dcd: !!(v & MS_RLSD_ON) });
  }

  /**
   * Stop / restart delivery. Unlike node-serialport's pause() — which does NOT stop the native
   * overlapped read, the falsified v0.10.3 fix — this genuinely stops reading, so the P2 reset
   * pulse happens with no read in flight, exactly as PNut's SerialThreadStop does.
   */
  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    if (this.isOpen) this.startPump();
  }

  // ---------------------------------------------------------------------------
  //  internals
  // ---------------------------------------------------------------------------

  /** BuildCommDCBW + SetCommState + SetCommTimeouts. Faithful to Pascal OpenComm. */
  private applyState(baud: number): boolean {
    const api = loadKernel32();
    if (!api) return false;

    const dcb = Buffer.alloc(DCB_SIZE);
    // BuildCommDCBW fills BaudRate/ByteSize/Parity/StopBits/flags from "baud,n,8,1".
    if (!api.BuildCommDCBW(wide(`${baud},n,8,1`), dcb)) {
      this.log.sys(`[WIN-SYNC] BuildCommDCBW FAILED — GetLastError=${api.GetLastError()}`);
      return false;
    }
    dcb.writeUInt32LE(DCB_SIZE, 0); // DCBlength — required by SetCommState
    // FORCE the critical fields directly — BuildCommDCBW can mis-parse a high/non-standard baud
    // (e.g. 2000000) even when it returns success, leaving the P2 unable to autobaud → silent.
    dcb.writeUInt32LE(baud, 4); // BaudRate
    // flags dword (offset 8): bit0 fBinary=1 (required by Win32); fParity=0; fDtrControl=0
    // (DISABLE) and fRtsControl=0 (DISABLE) so the OPEN does not auto-assert DTR (= P2 reset).
    // We drive DTR explicitly via EscapeCommFunction. (Pascal uses Flags:=0; we keep fBinary=1.)
    dcb.writeUInt32LE(0x1, 8);
    // DCB byte fields live at 18/19/20 (after wReserved@12, XonLim@14, XoffLim@16 — three WORDs).
    // A prior +2 offset error wrote ByteSize into StopBits, yielding StopBits=8 (only 0/1/2 valid)
    // → SetCommState rejected the DCB with ERROR_INVALID_PARAMETER (87). HW-confirmed v0.10.8.
    dcb.writeUInt8(8, 18); // ByteSize = 8
    dcb.writeUInt8(0, 19); // Parity = NOPARITY
    dcb.writeUInt8(0, 20); // StopBits = ONESTOPBIT
    if (!api.SetCommState(this.handle, dcb)) {
      this.log.sys(`[WIN-SYNC] SetCommState FAILED — GetLastError=${api.GetLastError()}`);
      return false;
    }
    // Read the DCB back so a log PROVES the baud/params the driver actually applied (a wrong
    // baud here = the P2 cannot autobaud the Prop_Chk and stays silent).
    const back = Buffer.alloc(DCB_SIZE);
    back.writeUInt32LE(DCB_SIZE, 0);
    if (api.GetCommState(this.handle, back)) {
      this.log.diag(
        `[WIN-SYNC] DCB readback: baud=${back.readUInt32LE(4)} byteSize=${back.readUInt8(18)} parity=${back.readUInt8(19)} stopBits=${back.readUInt8(20)} flags=0x${back.readUInt32LE(8).toString(16)}`
      );
    }

    const timeouts = Buffer.alloc(TIMEOUTS_SIZE);
    timeouts.writeUInt32LE(MAXDWORD, 0); // ReadIntervalTimeout=MAXDWORD → ReadFile returns immediately
    // remaining fields 0 → total read/write timeouts disabled (non-blocking read, blocking write)
    if (!api.SetCommTimeouts(this.handle, timeouts)) {
      this.log.sys(`[WIN-SYNC] SetCommTimeouts FAILED — GetLastError=${api.GetLastError()}`);
      return false;
    }
    return true;
  }

  private closeHandle(): void {
    const api = loadKernel32();
    if (api && this.isOpen) {
      api.CloseHandle(this.handle);
      this.log.diag(`[WIN-SYNC] closed handle=0x${this.handle.toString(16)}`);
    }
    this.handle = NULL_HANDLE;
  }

  private startPump(): void {
    if (this.pumpRunning || !this.isOpen) return;
    this.pumpRunning = true;
    void this.pumpLoop();
  }

  /**
   * The read pump — the analog of PNut's SerialThread and of node-serialport's native reader.
   *
   * Delivery is gated on there being a 'data' listener, mirroring node-serialport's flowing-mode
   * semantics: with no consumer we simply stop calling ReadFile, so bytes stay queued in the
   * driver rather than being read and dropped. That matters for clearGarbageBytes(), which
   * swaps the 'data' handler out and back.
   */
  private async pumpLoop(): Promise<void> {
    let idleMs = 0;
    while (this.pumpRunning && this.isOpen) {
      if (this.paused || this.listenerCount('data') === 0) {
        await sleepUnref(POLL_IDLE_MAX_MS);
        continue;
      }
      let n = 0;
      try {
        n = this.readOnce();
      } catch (e: any) {
        if (this.pumpRunning) this.emit('error', e instanceof Error ? e : new Error(String(e)));
        break;
      }
      if (n > 0) {
        const chunk = Buffer.allocUnsafe(n);
        this.readBuf.copy(chunk, 0, 0, n);
        this.emit('data', chunk);
        idleMs = 0;
        await immediateUnref(); // yield the loop, then read again straight away
      } else {
        idleMs = idleMs === 0 ? POLL_IDLE_START_MS : Math.min(idleMs * 2, POLL_IDLE_MAX_MS);
        await sleepUnref(idleMs);
      }
    }
    this.pumpRunning = false;
  }

  /** One non-blocking ReadFile into the shared buffer. Returns the byte count (0 = nothing). */
  private readOnce(): number {
    const api = loadKernel32();
    if (!api || !this.isOpen) return 0;
    const nRead = Buffer.alloc(4);
    const ok = api.ReadFile(this.handle, this.readBuf, READ_BUF_SIZE, nRead, null);
    if (!ok) {
      throw new Error(`[WIN-SYNC] ReadFile failed — GetLastError=${api.GetLastError()}`);
    }
    return nRead.readUInt32LE(0);
  }
}
