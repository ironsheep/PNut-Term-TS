/** @format */

/**
 * Multi-cog FIRST-CONTACT regression (CERT PASS 1 blocker, fixed post-0.9.89).
 *
 * The 0.9.89 §2 worker demux mis-framed the very first debugger break when the
 * ROM's "CogN  INIT …" banner and the binary Phase-1 arrived CONTIGUOUSLY in one
 * USB burst — exactly what a PASM program that breaks on its first instruction
 * (test12_multicog) produces. Two interlocking flaws:
 *
 *   1. step-1b Phase-1 framing was gated behind `inDebugSession`, but that flag
 *      only armed AFTER the first Phase-1 emitted (chicken-and-egg) → the first
 *      Phase-1 was never framed at first contact.
 *   2. `findTextBoundary` would not split the banner from the trailing binary,
 *      because the byte after "load\r\n" is 0x00 (a cog-0 Phase-1 header) which
 *      `looksLikeTextLineStart` rejects → it swallowed the banner and 82 bytes of
 *      the Phase-1 up to a lone CR in the register data → a 121-byte "Cog0 …" +
 *      binary blob → mis-classified as a COG message → "ROUTING ERROR: Binary data
 *      in COG message", no debugger window.
 *
 * The PRIMARY case below replays the EXACT 495 bytes captured on hardware
 * (tests/fixtures/debugger/first-contact-test12.bin, from
 * usb-traffic_260707-124834.log) — banner + a real 456-byte Phase-1 that carries a
 * lone 0x0D at offset 81 (the byte that triggered the swallow). It drives the REAL
 * worker (ExtractionCore). Before the fix this frames ZERO Phase-1 packets (the
 * bytes become one COG-message blob); after the fix it frames exactly one cog-0
 * Phase-1. The synthetic cases carry an equivalent embedded CR so they have the
 * same teeth for the later-cog / end-to-end paths.
 *
 * The fix arms `inDebugSession` from the ROM banner (head peek) and lets
 * findTextBoundary treat a post-terminator 0x00-0x07 as a boundary while in a
 * debug session.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  makeWorkerHarness,
  buildWorkerPhase1,
  buildWorkerPhase3,
  phase3TotalLen,
  type Emission
} from './shared/debuggerMultiCog';

/** The exact 495-byte first-contact burst captured on HW (banner + Phase-1). */
const HW_FIRST_CONTACT = new Uint8Array(
  readFileSync(join(__dirname, 'fixtures/debugger/first-contact-test12.bin'))
);

/** The P2 debug ROM's cog-init banner: "CogN  INIT …load\r\n" (TWO spaces). */
function cogInitBanner(cog: number): Uint8Array {
  const s = `Cog${cog}  INIT $0000_0000 $0000_0000 load\r\n`;
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/**
 * A synthetic Phase-1 that, like real register data, carries a lone CR followed by
 * a printable byte in its data region. This is what lets findTextBoundary swallow
 * (banner + partial-Phase-1 → a COG blob) when the fix is absent — so the
 * synthetic cases fail without the fix, exactly as the HW bytes do.
 */
function phase1WithEmbeddedCr(cog: number): Uint8Array {
  const p1 = buildWorkerPhase1(cog);
  p1[81] = 0x0d; // lone CR (matches the HW capture's offset)
  p1[82] = 0x40; // '@' — a printable "valid text start" that arms the CR-only EOL
  return p1;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

const p1Of = (em: Emission[], cog: number): Emission[] =>
  em.filter((e) => e.kind === 'p1' && e.cog === cog);

describe('debugger first-contact framing (multi-cog §2 regression)', () => {
  it('frames the first Phase-1 from the EXACT hardware first-contact bytes (test12)', () => {
    const h = makeWorkerHarness();
    h.feed(HW_FIRST_CONTACT);
    const em = h.pump();

    const framed = p1Of(em, 0);
    expect(framed).toHaveLength(1); // was 0 before the fix (121-byte COG blob → routing error)
    expect(framed[0].bytes.length).toBe(456);
    expect(Array.from(framed[0].bytes.slice(0, 4))).toEqual([0, 0, 0, 0]); // cog-0 LONG header
    // The framed packet is exactly the 456 bytes after the 39-byte banner.
    expect(Array.from(framed[0].bytes)).toEqual(Array.from(HW_FIRST_CONTACT.slice(39)));
  });

  it('frames a full first-contact exchange end-to-end (banner + Phase-1 + Phase-3)', () => {
    const h = makeWorkerHarness();
    const fixed = 320;
    const masks = [0x03, 0, 0, 0, 0, 0, 0, 0]; // a multi-bit smart-pin tail
    const p3 = buildWorkerPhase3(fixed, { masks });

    // Exact framing: the worker frames the Phase-1, then delimits the Phase-3 by the
    // relayed FIXED size + the self-describing smart-pin tail. Relay the size (as the
    // controller would), drain fully, collect every cog-0 Phase-3 byte; the total
    // equals the exact delimited payload.
    h.feed(concat(cogInitBanner(0), phase1WithEmbeddedCr(0), p3));
    h.hint(0, fixed);
    for (let i = 0; i < 8 && h.pump().length; i++) { /* drain banner + Phase-1 + Phase-3 */ }

    expect(p1Of(h.emissions, 0)).toHaveLength(1);
    const p3Bytes = h.emissions.filter((e) => e.kind === 'p3' && e.cog === 0);
    const total = p3Bytes.reduce((n, e) => n + e.bytes.length, 0);
    expect(total).toBe(phase3TotalLen(fixed, masks));
  });

  it('frames a later cog\'s first Phase-1 at first contact (cog 1 after a cog 0 exchange)', () => {
    const h = makeWorkerHarness();
    const fixed = 256;

    // Cog 0 exchange first (arms the session), fully drained, then break-complete
    // relayed (done) so the worker returns to awaitingPhase1 — exactly the lockstep
    // gap before the next cog can break.
    h.feed(concat(cogInitBanner(0), phase1WithEmbeddedCr(0), buildWorkerPhase3(fixed)));
    h.hint(0, fixed);
    for (let i = 0; i < 8 && h.pump().length; i++) { /* drain cog-0 exchange */ }
    h.done(0);

    // Cog 1 now breaks — its own banner + Phase-1, contiguous.
    h.feed(concat(cogInitBanner(1), phase1WithEmbeddedCr(1)));
    const em = h.pump();

    const framed = p1Of(em, 1);
    expect(framed).toHaveLength(1);
    expect(Array.from(framed[0].bytes.slice(0, 4))).toEqual([1, 0, 0, 0]); // cog-1 header
    expect(p1Of(em, 0)).toHaveLength(0); // no cross-tag onto cog 0
  });

  it('still frames when the banner and Phase-1 arrive in SEPARATE chunks (v0.9.88 timing)', () => {
    const h = makeWorkerHarness();

    h.feed(cogInitBanner(0));
    h.advance(60); // let the banner settle past the idle timeout, as a real boot does
    h.pump();

    h.feed(phase1WithEmbeddedCr(0));
    const em = h.pump();

    expect(p1Of(em, 0)).toHaveLength(1);
  });
});
