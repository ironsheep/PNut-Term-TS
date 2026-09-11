/** @format */

/**
 * The host half of the stale-cache contract — see serialProxyStateOrdering.test.ts for the
 * defect narrative (a verified download reported as "download unverified" on the GUI path).
 *
 * The proxy can only apply a post-call snapshot if the host actually sends one WITH the reply.
 * The old host posted the reply and then pushed state separately in a `finally`, which is one
 * port message too late for the awaiting caller. These tests pin that the reply carries it.
 */

/** The UsbSerial stand-in the host will construct; its getters are what get snapshotted. */
const serialState = {
  currentBaudRate: 2_000_000,
  downloadBaudRate: 921_600,
  checksumStatus: { verified: false, valid: false, response: '' },
  isDownloading: false
};

const mockDownload = jest.fn();

jest.mock('../src/utils/usb.serial', () => ({
  __esModule: true,
  UsbSerial: Object.assign(
    jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      getCurrentBaudRate: () => serialState.currentBaudRate,
      getDownloadBaudRate: () => serialState.downloadBaudRate,
      getChecksumStatus: () => serialState.checksumStatus,
      isDownloading: () => serialState.isDownloading,
      setDownloadBaudRate: jest.fn(),
      download: (...args: any[]) => mockDownload(...args)
    })),
    { setCommBaudRate: jest.fn() }
  )
}));

/** Stands in for process.parentPort (the MessagePortMain back to main). */
class FakeParentPort {
  public readonly posted: any[] = [];
  private handler: ((event: any) => void) | undefined;
  public on(event: string, cb: (e: any) => void): void {
    if (event === 'message') this.handler = cb;
  }
  public postMessage(msg: any): void {
    this.posted.push(msg);
  }
  public send(msg: any): void {
    // Real delivery wraps the payload in a MessageEvent.
    this.handler?.({ data: msg });
  }
  public results(): any[] {
    return this.posted.filter((m) => m?.kind === 'result');
  }
}

let parentPort: FakeParentPort;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  serialState.checksumStatus = { verified: false, valid: false, response: '' };
  serialState.isDownloading = false;
  parentPort = new FakeParentPort();
  (process as any).parentPort = parentPort;
  require('../src/workers/serialIoHost');
  parentPort.send({ kind: 'init', deviceNode: '/dev/ttyUSB0', baudRate: 2_000_000, runEnvironment: {} });
});

afterEach(() => {
  delete (process as any).parentPort;
});

/** Let the host's async handleCall settle. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('serialIoHost — the RPC reply carries the post-call state', () => {
  it('attaches the state the call produced to the result message', async () => {
    // The download is what flips the verdict, exactly as UsbSerial.download() does.
    mockDownload.mockImplementation(async () => {
      serialState.checksumStatus = { verified: true, valid: true, response: '.' };
    });

    parentPort.send({ kind: 'call', id: 7, method: 'download', args: [new Uint8Array(4), true] });
    await settle();

    const result = parentPort.results().find((m) => m.id === 7);
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    // THE POINT: the verdict is in the reply, not in a message that follows it.
    expect(result.state.checksumStatus).toEqual({ verified: true, valid: true, response: '.' });
    expect(result.state.isDownloading).toBe(false);
  });

  it('attaches state to a REJECTED result as well', async () => {
    mockDownload.mockImplementation(async () => {
      serialState.isDownloading = false;
      throw new Error('port vanished');
    });
    serialState.isDownloading = true;

    parentPort.send({ kind: 'call', id: 8, method: 'download', args: [new Uint8Array(4), true] });
    await settle();

    const result = parentPort.results().find((m) => m.id === 8);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/port vanished/);
    expect(result.state.isDownloading).toBe(false);
  });

  it('falls back to a standalone push for a fire-and-forget call (no id to ride on)', async () => {
    parentPort.send({ kind: 'call', method: 'setShuttingDown', args: [true] });
    await settle();

    expect(parentPort.results()).toHaveLength(0);
    expect(parentPort.posted.some((m) => m?.kind === 'state')).toBe(true);
  });
});
