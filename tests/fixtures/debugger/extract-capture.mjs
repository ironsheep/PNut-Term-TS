/** @format */

/**
 * extract-capture.mjs — provenance generator for the committed debugger replay
 * fixture (sprint dbg-comms-reframe §1).
 *
 * Parses a PNut-Term-TS "USB Traffic Log" (the `[USB RECV …] Received N bytes`
 * + `NNNN: $hh …` hex-dump format) into two committed artifacts:
 *
 *   capture.bin     — the raw RX byte stream, all USB chunks concatenated in
 *                     arrival order (this is what the P2 actually sent the host).
 *   manifest.json   — { source, totalBytes, chunkCount, chunkLengths[] } so the
 *                     replay harness can re-feed the stream at the ORIGINAL USB
 *                     chunk boundaries that triggered the Phase-3 desync.
 *
 * The source log lives under REF-NO-COMMIT/ (gitignored, hardware-capture only),
 * so it is NOT present on every machine — the committed .bin/.json ARE the durable
 * artifacts; this script documents exactly how they were produced and lets us
 * regenerate them on a machine that has the capture.
 *
 * Robustness: each hex row declares its byte offset (0000, 0010, …). We take
 * EXACTLY min(16, N - offset) `$hh` tokens from the left of each row, so an ascii
 * tail containing a `$` (e.g. "… load $0000") can never be miscounted as data.
 *
 * Usage:
 *   node tests/fixtures/debugger/extract-capture.mjs \
 *     REF-NO-COMMIT/logs/usb-traffic_260622-142138.log
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = process.argv[2] ?? 'REF-NO-COMMIT/logs/usb-traffic_260622-142138.log';

const text = readFileSync(srcPath, 'utf8');
const lines = text.split(/\r?\n/);

const RECV_RE = /Received\s+(\d+)\s+bytes/;
// Host→P2 Phase-2 replies are logged as "[USB SEND …] Sent N bytes" blocks
// interleaved between RECV chunks. They are NOT part of the P2→host RX stream
// (the harness's controller generates Phase-2 itself), so we flush the current
// RECV chunk and skip the SEND hex rows until the next "Received".
const SEND_RE = /\bSent\s+\d+\s+bytes/;
const ROW_RE = /^\s*([0-9A-Fa-f]{3,4}):\s*(.*)$/;
const BYTE_RE = /\$([0-9A-Fa-f]{2})/g;

const SENT_RE = /Sent\s+(\d+)\s+bytes/;

/** @type {number[][]} one byte[] per RX USB chunk, in arrival order */
const chunks = [];
/** @type {number[][]} one byte[] per host→P2 SEND block — the real Phase-2 replies. */
const sends = [];
let cur = null; // { expected, bytes: number[], sink: 'rx'|'tx' }

const flush = () => {
  if (!cur) return;
  if (cur.bytes.length !== cur.expected) {
    throw new Error(
      `${cur.sink} block #${cur.sink === 'rx' ? chunks.length : sends.length}: ` +
        `parsed ${cur.bytes.length} bytes but header said ${cur.expected}`
    );
  }
  (cur.sink === 'rx' ? chunks : sends).push(cur.bytes);
  cur = null;
};

for (const line of lines) {
  const recv = RECV_RE.exec(line);
  if (recv) {
    flush();
    cur = { expected: Number(recv[1]), bytes: [], sink: 'rx' };
    continue;
  }
  if (SEND_RE.test(line)) {
    flush(); // RECV chunk before this SEND is complete
    const sent = SENT_RE.exec(line);
    // Capture the host→P2 Phase-2 reply bytes (reference for the harness cross-check).
    cur = sent ? { expected: Number(sent[1]), bytes: [], sink: 'tx' } : null;
    continue;
  }
  if (!cur) continue;
  const row = ROW_RE.exec(line);
  if (!row) continue; // e.g. the "[USB RECV HEX/ASCII]:" marker line
  const offset = parseInt(row[1], 16);
  const want = Math.min(16, cur.expected - offset);
  if (want <= 0) continue;
  BYTE_RE.lastIndex = 0;
  let taken = 0;
  let m;
  while (taken < want && (m = BYTE_RE.exec(row[2])) !== null) {
    cur.bytes.push(parseInt(m[1], 16));
    taken++;
  }
  if (taken !== want) {
    throw new Error(
      `chunk #${chunks.length} row @${row[1]}: wanted ${want} bytes, found ${taken}`
    );
  }
}
flush();

const chunkLengths = chunks.map((c) => c.length);
const totalBytes = chunkLengths.reduce((a, b) => a + b, 0);
const flat = Uint8Array.from(chunks.flat());

writeFileSync(join(here, 'capture.bin'), flat);
writeFileSync(
  join(here, 'manifest.json'),
  JSON.stringify(
    {
      source: srcPath.replace(/^.*\//, ''),
      description:
        'Single-step debugger break session: 19 breaks. Raw RX byte stream + ' +
        'ordered USB chunk lengths, for the §1 replay harness.',
      totalBytes,
      chunkCount: chunks.length,
      chunkLengths,
      // Host→P2 Phase-2 replies captured from the [USB SEND] blocks, hex strings.
      // These are the REAL wire bytes the host sent; the replay harness builds its
      // own Phase-2 from the controller and cross-checks against these for parity.
      phase2Sends: sends.map((b) => b.map((x) => x.toString(16).padStart(2, '0')).join(''))
    },
    null,
    2
  ) + '\n'
);

const histogram = {};
for (const n of chunkLengths) histogram[n] = (histogram[n] ?? 0) + 1;
console.log(
  `wrote capture.bin (${totalBytes} bytes) + manifest.json ` +
    `(${chunks.length} chunks, ${sends.length} phase2 sends). chunk-size histogram:`,
  histogram
);
if (sends.length) {
  console.log(`first phase2 send (${sends[0].length}B): ${manifestPhase2Preview(sends[0])}`);
}
function manifestPhase2Preview(b) {
  return b.map((x) => x.toString(16).padStart(2, '0')).join(' ');
}
