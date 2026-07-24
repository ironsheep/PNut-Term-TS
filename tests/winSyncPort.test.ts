/** @format */

// winSyncPort.test.ts
//
// Covers the ONE genuinely new algorithm in the Windows single-handle transport: the read pump.
// Everything else in WinSyncPort is a thin kernel32 call that only means anything on Windows,
// but the pump's semantics (flowing-mode gate, byte-exact copy-out, pause/resume, idle backoff,
// error surfacing) are pure control flow and MUST hold or the 2 Mbaud debug stream loses bytes.
//
// The fake kernel32 below stands in for the driver: `queue` is what the P2 has "sent", and each
// ReadFile drains up to the caller's buffer size from it — the same contract the real
// ReadIntervalTimeout=MAXDWORD handle has (return immediately with whatever is buffered).

import { WinSyncPort, __setKernel32ForTesting } from '../src/utils/winSyncPort';

const noopLogger = { diag: (): void => {}, sys: (): void => {} };

interface FakeK32 {
  queue: number[];
  reads: number[]; // byte count returned by each ReadFile call, in order
  writes: Buffer[];
  escapes: number[];
  purges: number;
  flushes: number;
  api: any;
}

function makeFakeKernel32(opts: { failReadAfter?: number } = {}): FakeK32 {
  const state: FakeK32 = { queue: [], reads: [], writes: [], escapes: [], purges: 0, flushes: 0, api: null };
  let readCalls = 0;
  state.api = {
    CreateFileW: () => 0x1234n,
    BuildCommDCBW: () => 1,
    SetCommState: () => 1,
    GetCommState: () => 1,
    SetCommTimeouts: () => 1,
    SetupComm: () => 1,
    EscapeCommFunction: (_h: bigint, fn: number) => {
      state.escapes.push(fn);
      return 1;
    },
    GetCommModemStatus: (_h: bigint, buf: Buffer) => {
      buf.writeUInt32LE(0x0010 | 0x0020, 0); // CTS + DSR asserted
      return 1;
    },
    PurgeComm: () => {
      state.purges++;
      return 1;
    },
    WriteFile: (_h: bigint, buf: Buffer, len: number, written: Buffer) => {
      state.writes.push(Buffer.from(buf.subarray(0, len)));
      written.writeUInt32LE(len, 0);
      return 1;
    },
    ReadFile: (_h: bigint, buf: Buffer, maxLen: number, nRead: Buffer) => {
      readCalls++;
      if (opts.failReadAfter !== undefined && readCalls > opts.failReadAfter) return 0; // failure
      const take = Math.min(maxLen, state.queue.length);
      for (let i = 0; i < take; i++) buf.writeUInt8(state.queue[i], i);
      state.queue.splice(0, take);
      nRead.writeUInt32LE(take, 0);
      state.reads.push(take);
      return 1;
    },
    FlushFileBuffers: () => {
      state.flushes++;
      return 1;
    },
    CloseHandle: () => 1,
    GetLastError: () => 87
  };
  return state;
}

function openPort(): Promise<WinSyncPort> {
  const port = new WinSyncPort({ path: 'COM6', baudRate: 2000000 }, noopLogger);
  return new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve(port)));
  });
}

/** Collect everything the port emits as 'data' until `expected` bytes have arrived (or timeout). */
function collect(port: WinSyncPort, expected: number, timeoutMs = 1000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const timer = setTimeout(() => {
      port.removeListener('data', onData);
      reject(new Error(`timed out with ${total}/${expected} bytes`));
    }, timeoutMs);
    const onData = (d: Buffer): void => {
      chunks.push(d);
      total += d.length;
      if (total >= expected) {
        clearTimeout(timer);
        port.removeListener('data', onData);
        resolve(Buffer.concat(chunks));
      }
    };
    port.on('data', onData);
  });
}

describe('WinSyncPort — Windows single-handle transport', () => {
  let fake: FakeK32;

  beforeEach(() => {
    fake = makeFakeKernel32();
    __setKernel32ForTesting(fake.api, 'win32');
  });

  afterEach(() => {
    __setKernel32ForTesting(null);
  });

  describe('capability gate', () => {
    it('is unavailable off-Windows and names the reason', () => {
      __setKernel32ForTesting(null);
      // Real platform here is linux (the dev container / CI), so the gate must decline.
      expect(WinSyncPort.isAvailable()).toBe(false);
      expect(WinSyncPort.unavailableReason()).toContain(process.platform);
    });

    it('is available when win32 + kernel32 both load', () => {
      expect(WinSyncPort.isAvailable()).toBe(true);
    });
  });

  describe('read pump', () => {
    it('delivers every queued byte, byte-for-byte, in order', async () => {
      const port = await openPort();
      const payload = Array.from({ length: 5000 }, (_, i) => i & 0xff);
      fake.queue.push(...payload);

      const got = await collect(port, payload.length);

      // BYTE-PERFECT: not a length check — every byte, exact order (TESTING-STANDARDS).
      expect(got.length).toBe(payload.length);
      expect(Array.from(got)).toEqual(payload);
      port.close(() => {});
    });

    it('splits a burst larger than one read into chunks that still reassemble exactly', async () => {
      const port = await openPort();
      // Two full buffers plus a remainder — forces multiple ReadFile turns.
      const payload = Array.from({ length: 64 * 1024 * 2 + 777 }, (_, i) => (i * 7) & 0xff);
      // push in slices: a single spread of 131k args overflows the call stack (harness limit)
      for (let i = 0; i < payload.length; i += 4096) fake.queue.push(...payload.slice(i, i + 4096));

      const got = await collect(port, payload.length, 5000);

      expect(Array.from(got)).toEqual(payload);
      expect(fake.reads.filter((n) => n > 0).length).toBeGreaterThan(1); // genuinely multi-read
      port.close(() => {});
    });

    it('does NOT read while no data consumer is attached (flowing-mode gate)', async () => {
      const port = await openPort();
      fake.queue.push(1, 2, 3);

      await new Promise((r) => setTimeout(r, 50));
      // No 'data' listener → bytes must stay queued in the "driver", not be read and dropped.
      // This is what makes clearGarbageBytes()'s handler swap safe.
      expect(fake.queue).toEqual([1, 2, 3]);

      const got = await collect(port, 3);
      expect(Array.from(got)).toEqual([1, 2, 3]);
      port.close(() => {});
    });

    it('pause() stops reading and resume() picks up every byte that arrived meanwhile', async () => {
      const port = await openPort();
      const seen: number[] = [];
      port.on('data', (d: Buffer) => seen.push(...Array.from(d)));
      await new Promise((r) => setTimeout(r, 20));

      port.pause();
      fake.queue.push(10, 11, 12);
      await new Promise((r) => setTimeout(r, 50));
      // The reset pulse happens in exactly this window — nothing may be read here.
      expect(seen).toEqual([]);
      expect(fake.queue).toEqual([10, 11, 12]);

      port.resume();
      await new Promise((r) => setTimeout(r, 50));
      expect(seen).toEqual([10, 11, 12]); // no loss across the quiesce
      port.close(() => {});
    });

    it('emits an error (and stops) when ReadFile fails', async () => {
      __setKernel32ForTesting(makeFakeKernel32({ failReadAfter: 0 }).api, 'win32');
      const port = await openPort();
      const err = await new Promise<Error>((resolve) => {
        port.on('error', resolve);
        port.on('data', () => {});
      });
      expect(err.message).toContain('ReadFile failed');
      port.close(() => {});
    });

    it('stops reading once closed', async () => {
      const port = await openPort();
      port.on('data', () => {});
      await new Promise((r) => setTimeout(r, 20));
      const before = fake.reads.length;
      await new Promise<void>((r) => port.close(() => r()));
      await new Promise((r) => setTimeout(r, 50));
      expect(fake.reads.length).toBeLessThanOrEqual(before + 1); // at most the in-flight turn
      expect(port.isOpen).toBe(false);
    });
  });

  describe('control surface', () => {
    it('write() passes the exact bytes through and drain() flushes the driver', async () => {
      const port = await openPort();
      await new Promise<void>((r) => port.write('> Prop_Chk 0 0 0 0 ', () => r()));
      await new Promise<void>((r) => port.drain(() => r()));

      expect(fake.writes.length).toBe(1);
      expect(fake.writes[0].toString('latin1')).toBe('> Prop_Chk 0 0 0 0 ');
      expect(fake.flushes).toBe(1);
      port.close(() => {});
    });

    it('write() handles a Uint8Array that lost its Buffer prototype crossing a process boundary', async () => {
      const port = await openPort();
      const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      await new Promise<void>((r) => port.write(raw, () => r()));
      expect(Array.from(fake.writes[0])).toEqual([0xde, 0xad, 0xbe, 0xef]);
      port.close(() => {});
    });

    it('set() maps assert/de-assert to the right EscapeCommFunction codes', async () => {
      const port = await openPort();
      await new Promise<void>((r) => port.set({ dtr: true }, () => r())); // assert = reset pulse
      await new Promise<void>((r) => port.set({ dtr: false }, () => r()));
      await new Promise<void>((r) => port.set({ rts: true }, () => r()));
      await new Promise<void>((r) => port.set({ rts: false }, () => r()));
      expect(fake.escapes).toEqual([5, 6, 3, 4]); // SETDTR, CLRDTR, SETRTS, CLRRTS
      port.close(() => {});
    });

    it('update() changes baud in place without closing the handle', async () => {
      const port = await openPort();
      expect(port.baudRate).toBe(2000000);
      await new Promise<void>((r) => port.update({ baudRate: 115200 }, () => r()));
      expect(port.baudRate).toBe(115200);
      expect(port.isOpen).toBe(true); // the handle survived — nothing to trip the reset line
      port.close(() => {});
    });

    it('get() reports the modem lines', async () => {
      const port = await openPort();
      const status = await new Promise<any>((resolve, reject) =>
        port.get((err, s) => (err ? reject(err) : resolve(s)))
      );
      expect(status).toEqual({ cts: true, dsr: true, dcd: false });
      port.close(() => {});
    });

    it('flush() purges the driver buffers', async () => {
      const port = await openPort();
      await new Promise<void>((r) => port.flush(() => r()));
      expect(fake.purges).toBe(1);
      port.close(() => {});
    });
  });
});
