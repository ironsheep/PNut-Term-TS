/**
 * PC_MOUSE / PC_KEY capture wiring — [9win LD-2/LD-3] (task #23)
 *
 * Regression guard for the root parity break: the base enableMouseInput /
 * enableKeyboardInput renderer injections forwarded input via
 * `window.electronAPI.*`, but electronAPI is never defined in these windows
 * (no preload; nodeIntegration:true / contextIsolation:false), so the guarded
 * calls silently no-op'd and PC_MOUSE/PC_KEY captured nothing for every
 * base-path window. The injections must forward via ipcRenderer.send(...) on
 * the channels the base IPC receiver already listens for.
 */
import { DebugWindowBase } from '../src/classes/debugWindowBase';
import { DebugTermWindow } from '../src/classes/debugTermWin';

const proto = DebugWindowBase.prototype as any;

/** Capture the JS injected by enable{Mouse,Keyboard}Input off the prototype. */
function captureInjection(method: 'enableMouseInput' | 'enableKeyboardInput'): string {
  let injected = '';
  const ctx: any = {
    getCanvasId: () => 'test-canvas',
    logMessageBase: () => {},
    inputForwarder: { startPolling: () => {} },
    // setupMouseEventHandlers is private; stub it so the keyboard path can call it.
    setupMouseEventHandlers: () => {},
    debugWindow: {
      webContents: {
        on: () => {},
        executeJavaScript: (js: string) => {
          injected = js;
          return Promise.resolve();
        }
      }
    }
  };
  proto[method].call(ctx);
  return injected;
}

describe('PC input capture wiring [9win LD-2]', () => {
  describe('enableMouseInput', () => {
    const js = captureInjection('enableMouseInput');

    it('forwards via ipcRenderer.send on the mouse-event channel', () => {
      expect(js).toContain("require('electron')");
      expect(js).toContain("ipcRenderer.send('mouse-event'");
    });

    it('does NOT use the never-defined window.electronAPI', () => {
      expect(js).not.toContain('electronAPI');
    });

    it('guards against duplicate initialisation', () => {
      expect(js).toContain('__mouseInputInitialized');
    });

    it('attaches the full set of handlers (move/down/up/wheel/leave)', () => {
      for (const ev of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'mouseleave']) {
        expect(js).toContain(`'${ev}'`);
      }
    });
  });

  describe('enableKeyboardInput', () => {
    const js = captureInjection('enableKeyboardInput');

    it('forwards via ipcRenderer.send on the key-event channel', () => {
      expect(js).toContain("require('electron')");
      expect(js).toContain("ipcRenderer.send('key-event'");
    });

    it('does NOT use the never-defined window.electronAPI', () => {
      expect(js).not.toContain('electronAPI');
    });

    it('guards against duplicate keydown listeners', () => {
      expect(js).toContain('__keyboardInputInitialized');
    });
  });
});

describe('TERM canvas id [9win LD-4]', () => {
  it('getCanvasId() returns the real visible-canvas element id, not a phantom', () => {
    // The base mouse injection does getElementById(getCanvasId()); it must match
    // the rendered <canvas id="text-area"> or TERM captures no mouse events.
    const id = (DebugTermWindow.prototype as any).getCanvasId.call({});
    expect(id).toBe('text-area');
    expect(id).not.toBe('terminal-canvas');
  });
});
