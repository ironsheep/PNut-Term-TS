/** @format */

// [9win §16] MIDI window residual parity vs Pascal MIDI_Configure / MIDI_Update / MIDI_DrawKey
// (DebugDisplayUnit.pas). Exercises the shared PianoKeyboardLayout geometry against an
// independent reimplementation of the Pascal key-layout algorithm pinned to the CORRECT tweak
// table, and the private MIDI state machine (processMidiByte) against a prototype-stub `this`.
//
// Covers the §16 deliverables:
//   1. Keyboard geometry matches Pascal for all 12 notes — the tweak table had drifted from F#
//      onward (F#/G/G#/A/A#/B were -3/15/1/19/7/25, must be -4/14/0/18/4/23) (:2535-2547)
//   2. Note-off stores velocity as -val (DebugDisplayUnit.pas:2636), not 0
//   (UPDATE-is-a-no-op is covered in debugMidiWin.test.ts.)

import { PianoKeyboardLayout } from '../src/classes/shared/pianoKeyboardLayout';
import { DebugMidiWindow } from '../src/classes/debugMidiWin';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../src/utils/usb.serial', () => ({ UsbSerial: jest.fn() }));
jest.mock('jimp', () => ({ Jimp: {}, MIME_PNG: 'image/png' }));

// Independent reference implementation of the Pascal MIDI_Configure key layout, pinned to the
// CORRECT tweak table (DebugDisplayUnit.pas:2535-2547). If the shared layout's tweak table or
// geometry drifts, the per-key comparison below fails.
const PASCAL_TWEAK = [10, -2, 16, 2, 22, 9, -4, 14, 0, 18, 4, 23];
const PASCAL_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

function refKey(keySize: number, i: number, runningX: { x: number }) {
  const note = i % 12;
  const isBlack = PASCAL_BLACK[note];
  const tweak = PASCAL_TWEAK[note];
  let left: number;
  let right: number;
  let bottom: number;
  let numX: number;
  if (isBlack) {
    left = runningX.x - Math.floor((keySize * (10 - tweak) + 16) / 32);
    right = left + Math.floor((keySize * 20) / 32);
    bottom = keySize * 4;
    numX = Math.floor((left + right + 1) / 2);
  } else {
    left = runningX.x;
    right = left + keySize;
    bottom = keySize * 6;
    numX = runningX.x + Math.floor((keySize * tweak + 16) / 32);
    runningX.x += keySize;
  }
  return { isBlack, left, right, bottom, numX };
}

describe('[9win §16] piano-keyboard geometry matches Pascal across key sizes', () => {
  // MidiKeySize = 8 + size*4; size range 1..50 -> keySize 12..208. Sample several.
  const keySizes = [12, 24, 36, 60, 100, 208];

  for (const keySize of keySizes) {
    it(`keySize ${keySize}: all 128 keys match the Pascal layout`, () => {
      const { keys } = PianoKeyboardLayout.calculateLayout(keySize, 0, 127);
      const running = { x: Math.floor(keySize / 6) }; // Pascal: x := border
      for (let i = 0; i <= 127; i++) {
        const expected = refKey(keySize, i, running);
        expect(keys.get(i)).toEqual(expected);
      }
    });
  }

  it('the specific notes that had drifted (F#/G/G#/A/A#/B) now match Pascal', () => {
    // At keySize 60 the corrected tweaks produce different geometry than the old table.
    const keySize = 60;
    const { keys } = PianoKeyboardLayout.calculateLayout(keySize, 0, 127);
    const running = { x: Math.floor(keySize / 6) };
    const expected = new Map<number, any>();
    for (let i = 0; i <= 11; i++) expected.set(i, refKey(keySize, i, running));
    // F#(6) and G#(8) and A#(10) are black — their left/right come straight from the tweak.
    expect(keys.get(6)).toEqual(expected.get(6));
    expect(keys.get(8)).toEqual(expected.get(8));
    expect(keys.get(10)).toEqual(expected.get(10));
    // G(7), A(9), B(11) are white — their note-label numX comes from the tweak.
    expect(keys.get(7)!.numX).toBe(expected.get(7).numX);
    expect(keys.get(9)!.numX).toBe(expected.get(9).numX);
    expect(keys.get(11)!.numX).toBe(expected.get(11).numX);
  });
});

describe('[9win §16] MIDI note-off stores velocity as -val', () => {
  const proto = DebugMidiWindow.prototype as any;

  function midiStub() {
    return {
      midiState: 0,
      midiNote: 0,
      midiChannel: 0,
      midiVelocity: new Array(128).fill(0),
      logMessage: () => {},
      // processMidiByte now schedules draws through flushDraw (renderChain) so a SAVE can await the
      // in-flight render before capturing. [MIDI lit-chord-not-captured: SAVE must await the draw]
      flushDraw: () => {}
    };
  }

  it('note-on stores +velocity, note-off stores -velocity (Pascal :2629/:2636)', () => {
    const s = midiStub();
    // Note-on: 0x90 (channel 0), note 60, velocity 100
    [0x90, 60, 100].forEach((b) => proto.processMidiByte.call(s, b & 0xff));
    expect(s.midiVelocity[60]).toBe(100);

    // Note-off: 0x80 (channel 0), note 60, velocity 40 -> stored as -40
    [0x80, 60, 40].forEach((b) => proto.processMidiByte.call(s, b & 0xff));
    expect(s.midiVelocity[60]).toBe(-40);
  });

  it('a note-off velocity of 0 stays 0 (negative zero is not positive)', () => {
    const s = midiStub();
    [0x90, 64, 80].forEach((b) => proto.processMidiByte.call(s, b & 0xff));
    [0x80, 64, 0].forEach((b) => proto.processMidiByte.call(s, b & 0xff));
    expect(s.midiVelocity[64]).toBe(-0);
    expect(s.midiVelocity[64] > 0).toBe(false); // renders as "no velocity bar"
  });
});
