/** @format */

// src/utils/usbSerialProxy.ts
//
// [#31] Main-thread stand-in for UsbSerial. Spawns the serialIoWorker (which OWNS the port
// off the main loop) and presents the exact subset of the UsbSerial interface that
// MainWindow / Downloader / InputForwarder consume:
//   - async methods are marshalled to the worker as RPC and return a Promise;
//   - synchronous getters are served from a local cache the worker keeps fresh;
//   - the EventEmitter 'data' surface is preserved (only emitted in download mode — in run
//     mode the worker writes the ring directly, so the main thread never sees raw bytes).
//
// Behind the --serial-worker (PNUT_SERIAL_WORKER=1) flag; default path remains main-thread
// UsbSerial, so a worker problem can never brick an otherwise-good build.

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import type { Context } from './context';
import { UsbSerial } from './usb.serial';
import type { SharedBufferTransferables } from '../classes/shared/sharedCircularBuffer';

const ENABLE_CONSOLE_LOG = true; // loud during bring-up / HW validation

interface ChecksumStatus {
  verified: boolean;
  valid: boolean;
  response: string;
}

export class UsbSerialProxy extends EventEmitter {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  private cached: {
    currentBaudRate: number;
    downloadBaudRate: number;
    checksumStatus: ChecksumStatus;
    isDownloading: boolean;
  } = {
    currentBaudRate: 0,
    downloadBaudRate: 0,
    checksumStatus: { verified: false, valid: false, response: '' },
    isDownloading: false
  };

  constructor(ctx: Context, deviceNode: string, ring: SharedBufferTransferables) {
    super();
    this.cached.currentBaudRate = UsbSerial.desiredCommsBaudRate;

    const workerPath = UsbSerialProxy.resolveWorkerPath();
    if (ENABLE_CONSOLE_LOG) console.log(`[SERIAL-PROXY] launching serial worker: ${workerPath}`);

    this.worker = new Worker(workerPath, {
      workerData: {
        ring,
        deviceNode,
        baudRate: UsbSerial.desiredCommsBaudRate,
        runEnvironment: {
          loggingEnabled: (ctx as any).runEnvironment?.loggingEnabled,
          rtsOverride: (ctx as any).runEnvironment?.rtsOverride,
          resetOnConnection: (ctx as any).runEnvironment?.resetOnConnection,
          matchVendorOnly: (ctx as any).runEnvironment?.matchVendorOnly
        }
      }
    });

    this.worker.on('message', (msg: any) => this.onMessage(ctx, msg));
    this.worker.on('error', (err: Error) => {
      console.error(`[SERIAL-PROXY] worker error: ${err.message}`);
      this.emit('error', err);
    });
    this.worker.on('exit', (code: number) => {
      if (code !== 0) console.error(`[SERIAL-PROXY] serial worker exited code=${code}`);
      for (const [, p] of this.pending) p.reject(new Error('serial worker exited'));
      this.pending.clear();
    });
  }

  private static resolveWorkerPath(): string {
    const candidates = [
      path.join(__dirname, 'workers/serialIoWorker.bundled.js'),
      path.join(__dirname, '../workers/serialIoWorker.bundled.js'),
      path.join(__dirname, '../../workers/serialIoWorker.bundled.js'),
      path.join(process.cwd(), 'dist/workers/serialIoWorker.bundled.js'),
      path.join(__dirname, 'workers/serialIoWorker.js'),
      path.join(process.cwd(), 'dist/workers/serialIoWorker.js')
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  }

  private onMessage(ctx: Context, msg: any): void {
    switch (msg?.kind) {
      case 'result': {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.value);
          else p.reject(new Error(msg.error));
        }
        break;
      }
      case 'data':
        this.emit('data', Buffer.from(msg.data));
        break;
      case 'state':
        Object.assign(this.cached, msg.state);
        break;
      case 'log':
        try {
          (ctx as any).logger?.forceLogMessage?.((msg.args || []).join(' '));
        } catch {
          /* ignore log forwarding failures */
        }
        break;
      case 'ready':
        if (ENABLE_CONSOLE_LOG) console.log('[SERIAL-PROXY] serial worker READY — port hosted off the main loop');
        break;
      case 'fatal':
        console.error(`[SERIAL-PROXY] serial worker FATAL: ${msg.error}`);
        this.emit('error', new Error(msg.error));
        break;
    }
  }

  private call(method: string, ...args: any[]): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ kind: 'call', id, method, args });
    });
  }

  private fire(method: string, ...args: any[]): void {
    // id===0 → no reply expected. FIFO message ordering preserves call order.
    this.worker.postMessage({ kind: 'call', id: 0, method, args });
  }

  // --- async methods (RPC to the worker) ---
  public changeBaudRate(baud: number): Promise<void> {
    this.cached.currentBaudRate = baud; // optimistic; worker confirms via state
    return this.call('changeBaudRate', baud);
  }
  public clearGarbageBytes(discardMs?: number): Promise<number> {
    return this.call('clearGarbageBytes', discardMs);
  }
  public drain(): Promise<void> {
    return this.call('drain');
  }
  public flushReceiveBuffer(): Promise<void> {
    return this.call('flushReceiveBuffer');
  }
  public setDTR(value: boolean): Promise<void> {
    return this.call('setDTR', value);
  }
  public setRTS(value: boolean): Promise<void> {
    return this.call('setRTS', value);
  }
  public toggleDTR(): Promise<void> {
    return this.call('toggleDTR');
  }
  public toggleRTS(): Promise<void> {
    return this.call('toggleRTS');
  }
  public waitForPortOpen(): Promise<boolean> {
    return this.call('waitForPortOpen');
  }
  public write(value: string | Buffer): Promise<void> {
    return this.call('write', value);
  }
  public deviceIsPropellerV2(): Promise<boolean> {
    return this.call('deviceIsPropellerV2');
  }
  public download(uint8Bytes: Uint8Array, needsP2ChecksumVerify: boolean): Promise<void> {
    return this.call('download', uint8Bytes, needsP2ChecksumVerify);
  }
  public downloadNoCheck(uint8Bytes: Uint8Array): Promise<void> {
    return this.call('downloadNoCheck', uint8Bytes);
  }

  public async close(): Promise<void> {
    try {
      await this.call('close');
    } catch {
      /* worker may already be gone */
    }
    try {
      await this.worker.terminate();
    } catch {
      /* ignore */
    }
  }

  // --- synchronous setters (fire-and-forget; FIFO keeps ordering with later calls) ---
  public setShuttingDown(value: boolean): void {
    this.fire('setShuttingDown', value);
  }
  public setIgnoreFrontTraffic(value: boolean): void {
    this.fire('setIgnoreFrontTraffic', value);
  }
  public setDownloadBaudRate(baud: number): void {
    this.cached.downloadBaudRate = baud;
    this.fire('setDownloadBaudRate', baud);
  }

  // --- synchronous getters (served from worker-pushed cache) ---
  public getCurrentBaudRate(): number {
    return this.cached.currentBaudRate;
  }
  public getDownloadBaudRate(): number {
    return this.cached.downloadBaudRate;
  }
  public getChecksumStatus(): ChecksumStatus {
    return this.cached.checksumStatus;
  }
  public isDownloading(): boolean {
    return this.cached.isDownloading;
  }
}
