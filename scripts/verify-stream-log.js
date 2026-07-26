#!/usr/bin/env node
/**
 * verify-stream-log.js — turn a captured bench run into a PASS/FAIL verdict.
 *
 *   node scripts/claude/verify-stream-log.js <debug_*.log> [usb-traffic_*.log]
 *
 * WHY THIS EXISTS: "it looked fine" is not evidence. stress01_stream.spin2 emits a
 * monotonically increasing sequence number on every line, so stream integrity becomes
 * arithmetic — a gap is loss, a repeat is duplication, and neither can hide the way a
 * corrupted bitmap can. This reads the log and says which happened.
 *
 * Reads (all optional except the debug log):
 *   debug log        — SEQ lines (gate 4 integrity), KEY echoes (gate 5), cpu samples (gate 6)
 *   usb-traffic log  — per-chunk timestamps + byte counts (gate 4 throughput, gate 5 round-trip)
 *                      Works with either --usb-counts-only or the full hex dump.
 *
 * Deliberately platform-agnostic: the same harness judges macOS and Linux captures, which is
 * what makes it a regression asset rather than a one-off for this Windows arc.
 */

const fs = require('fs');

// P2 DEBUG's decimal formatter inserts UNDERSCORE digit separators once a value gets large
// ("1_000", "190_281"). A plain \d+ stops at the underscore and reads "SEQ 1_000" as "SEQ 1",
// which manufactures a flood of phantom duplicates and hides real loss behind them. Match the
// separators and strip them before comparing.
const RE_SEQ = /\bSEQ ([\d_]+)/g;
const RE_KEY = /\bKEY ([\d_]+) AT ([\d_]+)/g;
const RE_COMPLETE = /STRESS COMPLETE ([\d_]+) lines/;
const num = (s) => Number(String(s).replace(/_/g, ''));
const RE_CPU = /\[WIN-SYNC\] cpu (?:idle: )?([\d.]+)% of a core(?:[^|]*\|\s*(\d+) bytes in (\d+)ms \(([\d.]+) KB\/s\))?/g;
// Both USB log shapes carry the same two facts we need: instant and byte count.
const RE_USB = /\[USB (RECV|SEND) ([\d\-T:.]+)\] (?:Received|Sent) (\d+) bytes/g;

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function readOrDie(p) {
  if (!fs.existsSync(p)) die(`no such file: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function parseInstant(s) {
  // "2026-07-25T12:44:49.593" (local, no zone) — Date.parse handles this as local time.
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

// ---------------------------------------------------------------- gate 4: integrity
function checkIntegrity(debugText) {
  const seqs = [];
  let m;
  RE_SEQ.lastIndex = 0;
  while ((m = RE_SEQ.exec(debugText)) !== null) seqs.push(num(m[1]));

  if (!seqs.length) {
    return { ran: false, reason: 'no SEQ lines found — was stress01_stream.bin the program that ran?' };
  }

  const gaps = [];
  const dupes = [];
  const outOfOrder = [];
  for (let i = 1; i < seqs.length; i++) {
    const d = seqs[i] - seqs[i - 1];
    if (d === 1) continue;
    if (d === 0) dupes.push(seqs[i]);
    else if (d < 0) outOfOrder.push({ at: i, prev: seqs[i - 1], cur: seqs[i] });
    else gaps.push({ afterSeq: seqs[i - 1], missing: d - 1, resumeSeq: seqs[i] });
  }

  const first = seqs[0];
  const last = seqs[seqs.length - 1];
  const expected = last - first + 1;
  const missingTotal = gaps.reduce((a, g) => a + g.missing, 0);

  const completeMatch = debugText.match(RE_COMPLETE);
  const claimedLines = completeMatch ? num(completeMatch[1]) : null;

  return {
    ran: true,
    first,
    last,
    received: seqs.length,
    expected,
    missingTotal,
    gaps,
    dupes,
    outOfOrder,
    claimedLines,
    sawCompletion: Boolean(completeMatch),
    sawEndMarker: /DEBUG_END_SESSION/.test(debugText)
  };
}

// ---------------------------------------------------------------- gate 4: throughput
function checkThroughput(usbText) {
  if (!usbText) return null;
  const rx = [];
  const tx = [];
  let m;
  RE_USB.lastIndex = 0;
  while ((m = RE_USB.exec(usbText)) !== null) {
    const at = parseInstant(m[2]);
    if (at === null) continue;
    (m[1] === 'RECV' ? rx : tx).push({ at, bytes: Number(m[3]) });
  }
  if (rx.length < 2) return { rx, tx, insufficient: true };

  const totalBytes = rx.reduce((a, c) => a + c.bytes, 0);
  const spanMs = rx[rx.length - 1].at - rx[0].at;
  const gaps = [];
  for (let i = 1; i < rx.length; i++) gaps.push(rx[i].at - rx[i - 1].at);
  const sizes = rx.map((c) => c.bytes).sort((a, b) => a - b);
  const sortedGaps = [...gaps].sort((a, b) => a - b);

  return {
    rx,
    tx,
    chunks: rx.length,
    totalBytes,
    spanMs,
    kbPerSec: spanMs > 0 ? totalBytes / 1024 / (spanMs / 1000) : 0,
    medianChunk: pct(sizes, 50),
    maxChunk: sizes[sizes.length - 1],
    medianGapMs: pct(sortedGaps, 50),
    p99GapMs: pct(sortedGaps, 99),
    maxGapMs: sortedGaps[sortedGaps.length - 1]
  };
}

// ---------------------------------------------------------------- gate 5: round-trip
function checkRoundTrip(debugText, thr) {
  const echoes = [];
  let m;
  RE_KEY.lastIndex = 0;
  while ((m = RE_KEY.exec(debugText)) !== null) echoes.push({ key: num(m[1]), atSeq: num(m[2]) });
  if (!echoes.length) return { echoes, measured: false };

  // Pair each host TX with the next RX that follows it. Coarse but honest: it bounds the
  // round trip from above, which is the direction that matters for "did a write get stuck
  // behind a read".
  const rtts = [];
  if (thr && thr.tx && thr.tx.length && thr.rx && thr.rx.length) {
    for (const t of thr.tx) {
      const next = thr.rx.find((r) => r.at >= t.at);
      if (next) rtts.push(next.at - t.at);
    }
  }
  const sorted = [...rtts].sort((a, b) => a - b);
  return {
    echoes,
    measured: rtts.length > 0,
    samples: rtts.length,
    medianMs: pct(sorted, 50),
    maxMs: sorted.length ? sorted[sorted.length - 1] : 0
  };
}

// ---------------------------------------------------------------- gate 6: cpu
function checkCpu(debugText) {
  const streaming = [];
  const idle = [];
  let m;
  RE_CPU.lastIndex = 0;
  while ((m = RE_CPU.exec(debugText)) !== null) {
    const cpu = Number(m[1]);
    if (m[2] === undefined) idle.push(cpu);
    else streaming.push({ cpu, bytes: Number(m[2]), ms: Number(m[3]), kbPerSec: Number(m[4]) });
  }
  return { streaming, idle };
}

// ---------------------------------------------------------------- report
function main() {
  const [debugPath, usbPath] = process.argv.slice(2);
  if (!debugPath) die('usage: verify-stream-log.js <debug_*.log> [usb-traffic_*.log]');

  const debugText = readOrDie(debugPath);
  const usbText = usbPath ? readOrDie(usbPath) : null;

  const integrity = checkIntegrity(debugText);
  const thr = checkThroughput(usbText);
  const rt = checkRoundTrip(debugText, thr);
  const cpu = checkCpu(debugText);

  const fails = [];
  const notes = [];

  console.log('='.repeat(72));
  console.log('STREAM VERIFICATION');
  console.log('='.repeat(72));

  // --- gate 4a: integrity
  console.log('\nGATE 4a — stream integrity');
  if (!integrity.ran) {
    console.log(`  ✗ ${integrity.reason}`);
    fails.push('no stream found');
  } else {
    console.log(`  sequence range : ${integrity.first} .. ${integrity.last}`);
    console.log(`  lines received : ${integrity.received}`);
    console.log(`  lines expected : ${integrity.expected} (from the range actually seen)`);
    if (integrity.claimedLines !== null) {
      console.log(`  program claims : ${integrity.claimedLines} lines emitted`);
      if (integrity.last + 1 !== integrity.claimedLines) {
        // Truncation at the END is invisible to gap analysis — only the program's own
        // completion count can reveal it.
        console.log(`  ✗ TRUNCATED TAIL: program emitted ${integrity.claimedLines}, log ends at ${integrity.last + 1}`);
        fails.push('truncated tail');
      }
    } else if (!integrity.sawCompletion) {
      console.log('  ! no STRESS COMPLETE line — run ended early (killed? timeout? crash?)');
      notes.push('run did not reach its own completion line');
    }
    if (integrity.missingTotal === 0 && !integrity.dupes.length && !integrity.outOfOrder.length) {
      console.log('  ✓ no gaps, no duplicates, strictly increasing');
    }
    if (integrity.missingTotal > 0) {
      const lossPct = (integrity.missingTotal / integrity.expected) * 100;
      console.log(`  ✗ MISSING ${integrity.missingTotal} lines (${lossPct.toFixed(4)}%) across ${integrity.gaps.length} gap(s)`);
      for (const g of integrity.gaps.slice(0, 10)) {
        console.log(`      gap after SEQ ${g.afterSeq}: ${g.missing} missing, resumes at ${g.resumeSeq}`);
      }
      if (integrity.gaps.length > 10) console.log(`      ... and ${integrity.gaps.length - 10} more`);
      fails.push(`${integrity.missingTotal} lines lost`);
    }
    if (integrity.dupes.length) {
      console.log(`  ✗ ${integrity.dupes.length} DUPLICATE line(s) — first at SEQ ${integrity.dupes[0]}`);
      fails.push('duplicate delivery');
    }
    if (integrity.outOfOrder.length) {
      console.log(`  ✗ ${integrity.outOfOrder.length} OUT-OF-ORDER transition(s)`);
      fails.push('out of order');
    }
  }

  // --- gate 4b: throughput
  console.log('\nGATE 4b — sustained throughput');
  if (!thr) {
    console.log('  – no usb-traffic log supplied (rerun with -u --usb-counts-only for this section)');
  } else if (thr.insufficient) {
    console.log('  – too few USB chunks to measure');
  } else {
    console.log(`  chunks         : ${thr.chunks}`);
    console.log(`  bytes          : ${thr.totalBytes} over ${thr.spanMs}ms`);
    console.log(`  sustained rate : ${thr.kbPerSec.toFixed(1)} KB/s  (2 Mbaud ceiling ≈ 200 KB/s)`);
    console.log(`  chunk size     : median ${thr.medianChunk} B, max ${thr.maxChunk} B`);
    console.log(`  inter-chunk gap: median ${thr.medianGapMs}ms, p99 ${thr.p99GapMs}ms, max ${thr.maxGapMs}ms`);
    // A pump that is keeping up returns small chunks often. One that is falling behind shows
    // chunks climbing toward the 64KB buffer AND widening gaps.
    if (thr.maxChunk >= 60 * 1024) {
      console.log('  ! chunks approaching the 64KB read buffer — the pump may be behind the driver');
      notes.push('chunk sizes near buffer ceiling');
    }
    if (thr.maxGapMs > 250) {
      console.log(`  ! a ${thr.maxGapMs}ms gap between chunks — investigate if unexplained`);
      notes.push(`max inter-chunk gap ${thr.maxGapMs}ms`);
    }
  }

  // --- gate 5
  console.log('\nGATE 5 — keystroke round-trip under load');
  if (!rt.echoes.length) {
    console.log('  – no KEY echoes (no keys pressed, or the PLOT window lacked focus) — gate 5 UNMEASURED');
    notes.push('gate 5 unmeasured');
  } else {
    console.log(`  keys echoed    : ${rt.echoes.length} (${rt.echoes.map((e) => e.key).join(', ')})`);
    console.log('  ✓ every keystroke arrived intact and in order while the stream ran');
    if (rt.measured) {
      console.log(`  round-trip     : median ${rt.medianMs}ms, max ${rt.maxMs}ms over ${rt.samples} sample(s)`);
      if (rt.maxMs > 250) {
        console.log('  ! a write appears to have waited on the reader — the serialization hazard');
        notes.push(`round-trip max ${rt.maxMs}ms`);
      }
    } else {
      console.log('  round-trip     : not measurable (no TX entries in the usb log)');
    }
  }

  // --- gate 6
  console.log('\nGATE 6 — CPU cost of the serial process');
  if (!cpu.streaming.length && !cpu.idle.length) {
    console.log('  – no cpu samples (rerun with --diag-serial) — gate 6 UNMEASURED');
    notes.push('gate 6 unmeasured');
  } else {
    if (cpu.streaming.length) {
      const vals = cpu.streaming.map((s) => s.cpu).sort((a, b) => a - b);
      console.log(`  streaming      : median ${pct(vals, 50).toFixed(1)}%, max ${vals[vals.length - 1].toFixed(1)}% of a core (${cpu.streaming.length} samples)`);
    }
    if (cpu.idle.length) {
      const vals = cpu.idle.sort((a, b) => a - b);
      console.log(`  idle           : ${vals.map((v) => v.toFixed(1) + '%').join(', ')} of a core`);
      if (vals[vals.length - 1] > 5) {
        console.log('  ! idle CPU is not near zero — the poll backoff may not be engaging');
        notes.push('idle CPU high');
      }
    }
  }

  // --- verdict
  console.log('\n' + '='.repeat(72));
  if (fails.length) {
    console.log(`VERDICT: FAIL — ${fails.join('; ')}`);
    console.log('='.repeat(72));
    process.exit(1);
  }
  console.log('VERDICT: PASS — stream intact' + (notes.length ? ` (with notes: ${notes.join('; ')})` : ''));
  console.log('='.repeat(72));
  process.exit(0);
}

main();
