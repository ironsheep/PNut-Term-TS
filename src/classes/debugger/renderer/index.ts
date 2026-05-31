/** @format */

/**
 * Renderer-side entry point for the single-step debugger bundle.
 *
 * Runs inside the Electron BrowserWindow. The bundle owns the full
 * debugger UI: state, protocol (Phase 1/2/3), rendering (22 panels),
 * and keyboard/mouse interaction. Main process only forwards bytes in/out
 * via typed IPC — see `../shared/ipc.ts`.
 */

import { ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  MainToRendererMessage,
  RendererToMainMessage
} from '../shared/ipc';
import { DebuggerState } from './DebuggerState';
import { DebuggerController } from './DebuggerController';
import { DebuggerRenderer } from './DebuggerRenderer';
import { DebuggerInteraction } from './DebuggerInteraction';
import { BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX } from '../shared/constants';

function sendToMain(message: RendererToMainMessage): void {
  ipcRenderer.send(IPC_CHANNELS.rendererToMain, message);
}

function log(level: 'debug' | 'info' | 'warn' | 'error', msg: string): void {
  sendToMain({ kind: 'log', level, msg });
}

/**
 * Visible per-window diagnostic, written to the HTML status bar so we can see
 * bundle progress even when DevTools isn't open and the canvas hasn't painted.
 */
function setStatus(msg: string): void {
  const el = document.getElementById('status-bar');
  if (el) el.textContent = msg;
}

class DebuggerApp {
  private state: DebuggerState;
  private controller: DebuggerController;
  private renderer: DebuggerRenderer;
  private interaction: DebuggerInteraction;

  constructor(canvas: HTMLCanvasElement, cogId: number, debugBaud: number) {
    this.state = new DebuggerState(cogId, debugBaud);
    this.controller = new DebuggerController(this.state, {
      sendPhase2: (bytes) => sendToMain({ kind: 'phase2', bytes }),
      requestRender: () => this.render(),
      onBreakpointTimeout: () => this.render(),
      onPhase3Complete: () => sendToMain({ kind: 'phase3Complete' })
    });
    this.renderer = new DebuggerRenderer(canvas, this.state);
    this.interaction = new DebuggerInteraction(canvas, this.state, this.renderer, this.controller, {
      onCogBrkRequest: (mask) => sendToMain({ kind: 'setCogBrk', mask })
    });
    // Initial paint.
    this.render();
  }

  public handlePhase1(bytes: Uint8Array): void {
    try { this.controller.processPhase1(bytes); }
    catch (e) { log('error', `processPhase1: ${e instanceof Error ? e.message : e}`); }
  }

  public handlePhase3(bytes: Uint8Array): void {
    try { this.controller.processPhase3(bytes); }
    catch (e) { log('error', `processPhase3: ${e instanceof Error ? e.message : e}`); }
  }

  public handleReset(): void {
    this.controller.reset();
    this.render();
  }

  public handleCogBrkBroadcast(mask: number): void {
    this.controller.orCogBrk(mask);
  }

  private render(): void {
    try { this.renderer.render(); }
    catch (e) { log('error', `render: ${e instanceof Error ? e.message : e}`); }
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

let app: DebuggerApp | null = null;

function handleFromMain(_e: Electron.IpcRendererEvent, message: MainToRendererMessage): void {
  switch (message.kind) {
    case 'initialize': {
      setStatus(`Cog ${message.cogId} — initializing`);
      const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
      if (!canvas) { log('error', 'canvas element not found on initialize'); setStatus(`Cog ${message.cogId} — ERROR: canvas missing`); return; }
      try {
        app = new DebuggerApp(canvas, message.cogId, message.debugBaud);
      } catch (e) {
        const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
        log('error', `DebuggerApp ctor failed: ${msg}`);
        setStatus(`Cog ${message.cogId} — ERROR: ${e instanceof Error ? e.message : e}`);
        return;
      }
      sendToMain({ kind: 'ready' });
      setStatus(`Cog ${message.cogId} — awaiting first break`);
      log('info', `DebuggerApp initialized for cog ${message.cogId}`);
      break;
    }
    case 'phase1':
      setStatus(`Cog ${message.bytes[0]} — phase1 (${message.bytes.length}B)`);
      app?.handlePhase1(message.bytes);
      break;
    case 'phase3': app?.handlePhase3(message.bytes); break;
    case 'reset': app?.handleReset(); break;
    case 'cogBrkBroadcast': app?.handleCogBrkBroadcast(message.mask); break;
    default: {
      const _e: never = message;
      void _e;
    }
  }
}

ipcRenderer.on(IPC_CHANNELS.mainToRenderer, handleFromMain);

function sizeCanvas(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  canvas.width = BITMAP_WIDTH_PX;
  canvas.height = BITMAP_HEIGHT_PX;
  // CSS scales to fit; keep internal resolution Pascal-exact.
  canvas.style.width = '100%';
  canvas.style.height = 'calc(100vh - 20px)';
  canvas.style.imageRendering = 'pixelated';
}

window.addEventListener('DOMContentLoaded', () => {
  sizeCanvas();
  setStatus('bundle: DOM ready, awaiting initialize');
  log('info', 'debugger bundle DOMContentLoaded');
});
