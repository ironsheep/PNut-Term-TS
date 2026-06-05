/** @format */

/**
 * MIDI create-time config parsing — [9win §7] (task #9)
 *
 * parseMidiDeclaration was a stub that dropped every directive except the display
 * name; TITLE/POS/SIZE/RANGE/CHANNEL/COLOR only took effect if re-sent in the update
 * phase. It now mirrors Pascal MIDI_Configure (DebugDisplayUnit.pas:2492) at creation:
 *   SIZE  -> KeyValWithin(MidiSize, 1, 50)
 *   RANGE -> first := Within(val,0,127); last := Within(val,first,127)
 *   CHANNEL -> KeyValWithin(MidiChannel, 0, 15)
 *   COLOR -> KeyColor(vColor[0]) then KeyColor(vColor[1])  (RGBI8X directive system)
 *   POS   -> hasExplicitPosition (suppresses auto-placement)
 * KeyValWithin CLAMPS into range (Pascal Within), it does not reject.
 */
import { DebugMidiWindow } from '../src/classes/debugMidiWin';

const parse = (s: string) => DebugMidiWindow.parseMidiDeclaration(s.split(' '));

describe('MIDI create-time config parsing [9win §7]', () => {
  it('parses the full directive set from the creation line', () => {
    const [ok, spec] = parse('`MIDI m SIZE 6 RANGE 36 84 CHANNEL 1 COLOR YELLOW BLUE');
    expect(ok).toBe(true);
    expect(spec.displayName).toBe('m');
    expect(spec.keySize).toBe(6);
    expect(spec.keyRange).toEqual({ first: 36, last: 84 });
    expect(spec.channel).toBe(1);
    // COLOR resolves via RGBI8X (Pascal KeyColor): YELLOW=0xffff09, BLUE=0x0909ff.
    expect(spec.keyColors.white).toBe(0xffff09);
    expect(spec.keyColors.black).toBe(0x0909ff);
  });

  it('uses Pascal defaults when no directives are given', () => {
    const [ok, spec] = parse('`MIDI m');
    expect(ok).toBe(true);
    expect(spec.keySize).toBe(4);
    expect(spec.keyRange).toEqual({ first: 21, last: 108 });
    expect(spec.channel).toBe(0);
    expect(spec.keyColors.white).toBe(0x00ffff); // clCyan
    expect(spec.keyColors.black).toBe(0xff00ff); // clMagenta
    expect(spec.hasExplicitPosition).toBe(false);
  });

  it('honors POS at creation (suppresses auto-placement)', () => {
    const [, spec] = parse('`MIDI m POS 100 200');
    expect(spec.hasExplicitPosition).toBe(true);
    expect(spec.position).toEqual({ x: 100, y: 200 });
  });

  it('clamps out-of-range params per Pascal Within (does not reject)', () => {
    const [, hi] = parse('`MIDI m SIZE 99 RANGE 200 300 CHANNEL 99');
    expect(hi.keySize).toBe(50); // Within(99,1,50)
    expect(hi.keyRange).toEqual({ first: 127, last: 127 }); // first->127, last->Within(300,127,127)
    expect(hi.channel).toBe(15); // Within(99,0,15)

    const [, lo] = parse('`MIDI m SIZE 0');
    expect(lo.keySize).toBe(1); // Within(0,1,50)
  });

  it('RANGE with a single value sets last := first (Pascal)', () => {
    const [, spec] = parse('`MIDI m RANGE 50');
    expect(spec.keyRange).toEqual({ first: 50, last: 50 });
  });

  it('a directive after the name does not clobber the display name', () => {
    const [, spec] = parse('`MIDI synth CHANNEL 9');
    expect(spec.displayName).toBe('synth');
    expect(spec.channel).toBe(9);
  });
});
