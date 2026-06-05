/** @format */

// [9win §14] TERM window residual parity vs Pascal TERM_Update / TERM config
// (DebugDisplayUnit.pas). Exercises the static config parser parseTermDeclaration() and
// the private instance methods (processMessageAsync / handleRuntimeColorToken /
// processDisplayCommand) against prototype-stub `this` objects — no BrowserWindow needed.
//
// Covers the §14 deliverables:
//   1. Update-phase named colors (BLACK..GRAY) + BACKCOLOR set runtime fg/bg (Pascal :2232-2239)
//   2. SET column/row (2/3) consume their param token, no double-dispatch (Pascal KeyValWithin)
//   3. Default font 10pt (Pascal FontSize = 10)
//   4. CR+LF (13 10) -> a single newline; the trailing 10 is consumed (Pascal :2298-2302)
//   5. SIZE / TEXTSIZE clamp out-of-range instead of aborting the parse (Pascal KeyValWithin)

import { DebugTermWindow } from '../src/classes/debugTermWin';
import { DebugColor } from '../src/classes/shared/debugColor';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../src/utils/usb.serial', () => ({ UsbSerial: jest.fn() }));
jest.mock('jimp', () => ({ Jimp: {}, MIME_PNG: 'image/png' }));

const proto = DebugTermWindow.prototype as any;

describe('[9win §14] TERM config: default font + SIZE/TEXTSIZE clamp', () => {
  it('default font is 10pt (Pascal FontSize = 10, was 12)', () => {
    const [ok, spec] = DebugTermWindow.parseTermDeclaration(['`TERM', 'MyTerm']);
    expect(ok).toBe(true);
    expect(spec.font.textSizePts).toBe(10);
  });

  it('SIZE clamps out-of-range columns/rows instead of aborting', () => {
    const [ok, spec] = DebugTermWindow.parseTermDeclaration(['`TERM', 'MyTerm', 'SIZE', '0', '999']);
    expect(ok).toBe(true); // not aborted
    expect(spec.size.columns).toBe(1); // clamped low
    expect(spec.size.rows).toBe(256); // clamped high
  });

  it('TEXTSIZE below 6 clamps to 6 (does not abort)', () => {
    const [ok, spec] = DebugTermWindow.parseTermDeclaration(['`TERM', 'MyTerm', 'TEXTSIZE', '3']);
    expect(ok).toBe(true);
    expect(spec.font.textSizePts).toBe(6);
  });

  it('TEXTSIZE above 200 clamps to 200', () => {
    const [ok, spec] = DebugTermWindow.parseTermDeclaration(['`TERM', 'MyTerm', 'TEXTSIZE', '250']);
    expect(ok).toBe(true);
    expect(spec.font.textSizePts).toBe(200);
  });
});

describe('[9win §14] runtime named colors + BACKCOLOR (Pascal :2232-2239)', () => {
  function colorStub(): any {
    return { currentFgOverride: null, currentBgOverride: null, handleRuntimeColorToken: proto.handleRuntimeColorToken };
  }

  it('a named color sets the text foreground (consumes 0 extra tokens)', () => {
    const stub = colorStub();
    const consumed = proto.handleRuntimeColorToken.call(stub, ['RED'], 0);
    expect(consumed).toBe(0);
    expect(stub.currentFgOverride).toBe(new DebugColor('RED', 8).rgbString);
    expect(stub.currentBgOverride).toBeNull();
  });

  it('a named color consumes an optional brightness', () => {
    const stub = colorStub();
    const consumed = proto.handleRuntimeColorToken.call(stub, ['RED', '5'], 0);
    expect(consumed).toBe(1);
    expect(stub.currentFgOverride).toBe(new DebugColor('RED', 5).rgbString);
  });

  it('a second color sets the background (fg + bg pair)', () => {
    const stub = colorStub();
    const consumed = proto.handleRuntimeColorToken.call(stub, ['RED', 'WHITE'], 0);
    expect(consumed).toBe(1);
    expect(stub.currentFgOverride).toBe(new DebugColor('RED', 8).rgbString);
    expect(stub.currentBgOverride).toBe(new DebugColor('WHITE', 8).rgbString);
  });

  it('BACKCOLOR sets only the background', () => {
    const stub = colorStub();
    const consumed = proto.handleRuntimeColorToken.call(stub, ['BACKCOLOR', 'BLUE'], 0);
    expect(consumed).toBe(1);
    expect(stub.currentFgOverride).toBeNull();
    expect(stub.currentBgOverride).toBe(new DebugColor('BLUE', 8).rgbString);
  });

  it('a non-color token is not handled (returns -1)', () => {
    const stub = colorStub();
    expect(proto.handleRuntimeColorToken.call(stub, ['FOOBAR'], 0)).toBe(-1);
  });

  it('selecting a color combo (codes 4-7) clears the runtime override', () => {
    const stub: any = {
      selectedCombo: 2,
      currentFgOverride: '#abcdef',
      currentBgOverride: '#123456',
      cursorPosition: { x: 0, y: 0 },
      logMessage: () => {}
    };
    proto.processDisplayCommand.call(stub, '4');
    expect(stub.selectedCombo).toBe(0);
    expect(stub.currentFgOverride).toBeNull();
    expect(stub.currentBgOverride).toBeNull();
  });
});

describe('[9win §14] TERM dispatch: SET col/row consume + CR/LF merge', () => {
  function dispatchStub(): any {
    return {
      handleCommonCommand: async () => false,
      updateTermDisplay: jest.fn(),
      handleRuntimeColorToken: proto.handleRuntimeColorToken,
      logMessage: () => {},
      currentFgOverride: null,
      currentBgOverride: null
    };
  }

  it('SET column (2 n) dispatches once with the param and consumes it (no double-dispatch)', async () => {
    const stub = dispatchStub();
    await proto.processMessageAsync.call(stub, ['2', '5']);
    const calls = stub.updateTermDisplay.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toEqual(['2 5']); // NOT ['2 5', '2'] and NOT a stray '5'
  });

  it('SET row (3 n) likewise consumes its parameter', async () => {
    const stub = dispatchStub();
    await proto.processMessageAsync.call(stub, ['3', '12']);
    const calls = stub.updateTermDisplay.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toEqual(['3 12']);
  });

  it('CR+LF (13 10) yields a single newline — the trailing 10 is consumed', async () => {
    const stub = dispatchStub();
    await proto.processMessageAsync.call(stub, ['13', '10', "'A'"]);
    const calls = stub.updateTermDisplay.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toEqual(['13', "'A'"]); // the standalone '10' is NOT dispatched
  });

  it('a standalone LF (10) still produces a newline', async () => {
    const stub = dispatchStub();
    await proto.processMessageAsync.call(stub, ['10']);
    const calls = stub.updateTermDisplay.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toEqual(['10']);
  });

  it('a runtime named color in the stream sets the override (not "unknown directive")', async () => {
    const stub = dispatchStub();
    await proto.processMessageAsync.call(stub, ['RED', "'A'"]);
    expect(stub.currentFgOverride).toBe(new DebugColor('RED', 8).rgbString);
    const calls = stub.updateTermDisplay.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toEqual(["'A'"]); // RED consumed as a color, 'A' printed
  });
});
