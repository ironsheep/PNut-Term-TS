/** @format */

// src/utils/usbSerialProxy.ts
//
// [#31] Main-thread stand-in for UsbSerial. Forks an Electron UtilityProcess (serialIoHost)
// that OWNS the port in its own process — required because @serialport's native poller binds to
// uv_default_loop(), so it can only run correctly on a process's own main loop, NOT a
// worker_threads Worker (which crashes). The utility process drains the driver off the main
// process's loop and forwards every chunk; this proxy re-emits them as 'data' so MainWindow's
// existing handleSerialRx path is unchanged.
//
// Presents the consumed UsbSerial surface: async methods are RPC'd to the host and return a
// Promise; synchronous getters are served from a cache the host keeps fresh; the EventEmitter
// 'data' surface is preserved. This is the production serial path (always used).

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import type { Context } from './context';
import { UsbSerial } from './usb.serial';

const ENABLE_CONSOLE_LOG = false; // handshake play-by-play (genuine errors stay ungated below)

interface ChecksumStatus {
  verified: boolean;
  valid: boolean;
  response: string;
}

export class UsbSerialProxy extends EventEmitter {
  private child: any;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private outbox: any[] = []; // calls buffered until the host says 'hello' + we've sent init
  private hostReady = false; // host has constructed UsbSerial ('ready')
  private helloSeen = false;

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

  constructor(ctx: Context, deviceNode: string) {
    super();
    this.cached.currentBaudRate = UsbSerial.desiredCommsBaudRate;

    // utilityProcess is only available in the Electron main process.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { utilityProcess } = require('electron');
    const hostPath = UsbSerialProxy.resolveHostPath();
    if (ENABLE_CONSOLE_LOG) console.log(`[SERIAL-PROXY] forking serial utility process: ${hostPath}`);

    const initMessage = {
      kind: 'init',
      deviceNode,
      baudRate: UsbSerial.desiredCommsBaudRate,
      runEnvironment: {
        loggingEnabled: (ctx as any).runEnvironment?.loggingEnabled,
        rtsOverride: (ctx as any).runEnvironment?.rtsOverride,
        resetOnConnection: (ctx as any).runEnvironment?.resetOnConnection,
        matchVendorOnly: (ctx as any).runEnvironment?.matchVendorOnly
      }
    };

    this.child = utilityProcess.fork(hostPath, [], { stdio: 'inherit', serviceName: 'pnut-serial-io' });

    this.child.on('message', (msg: any) => this.onMessage(ctx, initMessage, msg));
    this.child.on('exit', (code: number) => {
      if (code !== 0) console.error(`[SERIAL-PROXY] serial utility process exited code=${code}`);
      for (const [, p] of this.pending) p.reject(new Error('serial utility process exited'));
      this.pending.clear();
    });
  }

  private static resolveHostPath(): string {
    const candidates = [
      path.join(__dirname, 'workers/serialIoHost.bundled.js'),
      path.join(__dirname, '../workers/serialIoHost.bundled.js'),
      path.join(__dirname, '../../workers/serialIoHost.bundled.js'),
      path.join(process.cwd(), 'dist/workers/serialIoHost.bundled.js'),
      path.join(__dirname, 'workers/serialIoHost.js'),
      path.join(process.cwd(), 'dist/workers/serialIoHost.js')
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  }

  private onMessage(ctx: Context, initMessage: any, msg: any): void {
    switch (msg?.kind) {
      case 'hello':
        // Host's listener is attached — now it's safe to send init, then flush buffered calls.
        this.helloSeen = true;
        if (ENABLE_CONSOLE_LOG)
          console.log(`[SERIAL-PROXY] hello recv → sending init + flushing ${this.outbox.length} buffered call(s)`);
        this.child.postMessage(initMessage);
        for (const m of this.outbox) this.child.postMessage(m);
        this.outbox = [];
        break;
      case 'ready':
        this.hostReady = true;
        if (ENABLE_CONSOLE_LOG) console.log('[SERIAL-PROXY] serial host READY — port hosted in a dedicated process');
        break;
      case 'result': {
        if (ENABLE_CONSOLE_LOG) console.log(`[SERIAL-PROXY] result id=${msg.id} ok=${msg.ok}`);
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.value);
          else p.reject(new Error(msg.error));
        } else {
          console.warn(`[SERIAL-PROXY] result id=${msg.id} had NO pending promise (id mismatch?)`);
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
          /* ignore */
        }
        break;
      case 'fatal':
        console.error(`[SERIAL-PROXY] serial host FATAL: ${msg.error}`);
        this.emit('error', new Error(msg.error));
        break;
    }
  }

  private send(message: any): void {
    if (ENABLE_CONSOLE_LOG && message?.kind === 'call') {
      console.log(`[SERIAL-PROXY] ${this.helloSeen ? 'send' : 'buffer'} call ${message.method} id=${message.id}`);
    }
    if (this.helloSeen) this.child.postMessage(message);
    else this.outbox.push(message); // buffer until host listener is up (avoids lost messages)
  }

  private call(method: string, ...args: any[]): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ kind: 'call', id, method, args });
    });
  }

  private fire(method: string, ...args: any[]): void {
    this.send({ kind: 'call', id: 0, method, args });
  }

  // --- async methods (RPC to the host) ---
  public changeBaudRate(baud: number): Promise<void> {
    this.cached.currentBaudRate = baud;
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
      /* host may already be gone */
    }
    try {
      this.child.kill();
    } catch {
      /* ignore */
    }
  }

  // --- synchronous setters (fire-and-forget; FIFO keeps ordering) ---
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

  // --- synchronous getters (served from host-pushed cache) ---
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
