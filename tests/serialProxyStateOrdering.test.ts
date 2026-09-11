/** @format */

/**
 * The stale-cache defect: a verified download reported as unverified (v1.0.6, GUI only).
 *
 * SYMPTOM (Stephen, on hardware): the P2 downloads and RUNS, and the log still says
 *
 *     [DOWNLOAD FAILED] test_bench_t0.bin failed to download to RAM:
 *     P2 checksum verification did not complete (no . or ! received) - download unverified
 *
 * CAUSE — not the latch, which works. The GUI does not hold a UsbSerial at all: the port
 * lives in a UtilityProcess (serialIoHost) and MainWindow holds a UsbSerialProxy whose
 * synchronous getters are served from a cache the host pushes. The host used to post the
 * RPC reply and THEN post the new state as a separate message:
 *
 *     if (msg.id) post({ kind: 'result', ... });   // resolves the caller's promise
 *     finally { pushState(); }                     // ...one message later
 *
 * Main resolves the promise while handling 'result', and the awaiting continuation runs as
 * a MICROTASK — which drains before the next port message is ever delivered. So the trailing
 * 'state' always lands too late. Downloader.download() does exactly:
 *
 *     await this.serialPort.download(binaryImage, needsP2ChecksumVerify);
 *     const checksumStatus = this.serialPort.getChecksumStatus();   // <-- reads the PRE-call cache
 *
 * ...and therefore read the snapshot taken back during deviceIsPropellerV2 — verified:false,
 * deterministically, on every GUI download. v1.0.6 made that branch fail loudly (correctly:
 * an unverified CRC must not report success), which turned a silent staleness into a false
 * failure on a download that was fine.
 *
 * Why 185/185 missed it: every checksum test drives Downloader against a stub port whose
 * getChecksumStatus() is a live jest.fn(). The cache is the proxy's, and no test crossed it.
 * Headless is unaffected — it holds a real UsbSerial, whose getter reads the live field.
 *
 * FIX: the state snapshot RIDES the result message, and the proxy applies it BEFORE settling
 * the promise. Then "await an RPC, read a getter" observes the post-call value, which is what
 * every caller already assumes.
 *
 * These tests pin both halves of that contract plus the ordering fact underneath it.
 */

jest.mock('serialport', () => ({
  __esModule: true,
  SerialPort: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    open: jest.fn(),
    write: jest.fn(),
    isOpen: false
  }))
}));

/** The fake UtilityProcess handle the proxy talks to. */
class FakeChild {
  public readonly sent: any[] = [];
  private handlers = new Map<string, (arg: any) => void>();
  public on(event: string, cb: (arg: any) => void): void {
    this.handlers.set(event, cb);
  }
  public postMessage(msg: any): void {
    this.sent.push(msg);
  }
  public kill(): void {
    /* no-op */
  }
  /** Deliver one message from the "host" to the proxy, as the real port would. */
  public deliver(msg: any): void {
    this.handlers.get('message')?.(msg);
  }
  public lastCall(method: string): any {
    return [...this.sent].reverse().find((m) => m?.kind === 'call' && m.method === method);
  }
}

let child: FakeChild;

jest.mock('electron', () => ({
  __esModule: true,
  utilityProcess: { fork: () => child }
}));

import { UsbSerialProxy } from '../src/utils/usbSerialProxy';

function makeContext(): any {
  return {
    runEnvironment: { loggingEnabled: false },
    logger: { forceLogMessage: jest.fn(), logMessage: jest.fn() }
  };
}

/** A proxy already past the hello/ready handshake, so calls go out immediately. */
function makeReadyProxy(): UsbSerialProxy {
  child = new FakeChild();
  const proxy = new UsbSerialProxy(makeContext(), '/dev/ttyUSB0');
  child.deliver({ kind: 'hello' });
  child.deliver({ kind: 'ready' });
  return proxy;
}

const VERIFIED = { verified: true, valid: true, response: '.' };

describe('UsbSerialProxy — cached state must be current the instant an RPC resolves', () => {
  afterEach(() => jest.clearAllMocks());

  it('applies the state riding the result BEFORE the caller resumes — the defect fixed here', async () => {
    const proxy = makeReadyProxy();

    const pending = proxy.download(new Uint8Array(64), true);
    const call = child.lastCall('download');
    expect(call).toBeDefined();

    // The host replies the way it does now: verdict attached to the reply itself.
    child.deliver({
      kind: 'result',
      id: call.id,
      ok: true,
      value: undefined,
      state: { checksumStatus: VERIFIED, isDownloading: false, currentBaudRate: 2_000_000, downloadBaudRate: 921_600 }
    });

    await pending;

    // This is the exact read Downloader.download() performs on the next line.
    expect(proxy.getChecksumStatus()).toEqual(VERIFIED);
    expect(proxy.isDownloading()).toBe(false);
    expect(proxy.getCurrentBaudRate()).toBe(2_000_000);
    expect(proxy.getDownloadBaudRate()).toBe(921_600);
  });

  it('REGRESSION PIN: state posted as a SEPARATE later message is invisible to the awaiting caller', async () => {
    const proxy = makeReadyProxy();

    const pending = proxy.download(new Uint8Array(64), true);
    const call = child.lastCall('download');

    // The OLD host shape: reply first, state second. Faithfully reproduced — the separate
    // post is queued as a later port message, i.e. a macrotask.
    child.deliver({ kind: 'result', id: call.id, ok: true, value: undefined });
    setTimeout(() => child.deliver({ kind: 'state', state: { checksumStatus: VERIFIED } }), 0);

    await pending;

    // The caller resumes here, one microtask after the resolve — and the '.' verdict the P2
    // really sent has not been applied yet. This is the false "download unverified".
    expect(proxy.getChecksumStatus().verified).toBe(false);

    // It does arrive... after the caller has already made its decision.
    await new Promise((r) => setTimeout(r, 1));
    expect(proxy.getChecksumStatus()).toEqual(VERIFIED);
  });

  it('applies the state riding a REJECTED result too — the catch block reads the same getters', async () => {
    const proxy = makeReadyProxy();

    const pending = proxy.download(new Uint8Array(64), true);
    const call = child.lastCall('download');

    child.deliver({
      kind: 'result',
      id: call.id,
      ok: false,
      error: 'port vanished',
      state: { checksumStatus: { verified: false, valid: false, response: '' }, isDownloading: false }
    });

    await expect(pending).rejects.toThrow('port vanished');
    // A download that threw partway still cleared isDownloading in its finally; the caller
    // must not be told a download is still in flight.
    expect(proxy.isDownloading()).toBe(false);
  });

  it('still honours a standalone state push (unsolicited host updates keep working)', () => {
    const proxy = makeReadyProxy();

    child.deliver({ kind: 'state', state: { currentBaudRate: 115_200 } });

    expect(proxy.getCurrentBaudRate()).toBe(115_200);
  });

  it('leaves the cache untouched when a result carries no state', async () => {
    const proxy = makeReadyProxy();

    child.deliver({ kind: 'state', state: { checksumStatus: VERIFIED } });
    const pending = proxy.waitForPortOpen();
    const call = child.lastCall('waitForPortOpen');
    child.deliver({ kind: 'result', id: call.id, ok: true, value: true });

    await expect(pending).resolves.toBe(true);
    // A stateless reply (host mid-teardown, where the getters throw) must not clobber
    // what we already knew.
    expect(proxy.getChecksumStatus()).toEqual(VERIFIED);
  });
});
