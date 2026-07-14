/** @format */

/**
 * Process exit codes — IDENTICAL across headed (Electron GUI) and headless
 * modes, so a launching script can branch on `$?` the same way regardless of
 * how PNut-Term-TS was run.
 *
 *   0   OK              Clean exit. ALL precious data (window SAVEs, the debug
 *                       log, and any active recording) was fully flushed.
 *                       Covers normal quit, SIGINT/SIGTERM, and an
 *                       end-session marker / DEBUG_END_SESSION sentinel.
 *   1   PORT_ERROR      Serial port open / I/O failure.
 *   2   USAGE_ERROR     Bad command line: unknown option, missing or malformed
 *                       option value, mutually-exclusive or misapplied flags, a
 *                       download file that does not exist. NOTHING RAN — no
 *                       hardware was touched, no download attempted, no window
 *                       opened. Kept distinct from 1 so a script can tell "you
 *                       invoked me wrong" from "the serial port failed".
 *                       (2 is the long-standing shell convention for a usage
 *                       error; it is also what most GNU tools return.)
 *   3   DOWNLOAD_FAILED Binary download to the P2 failed.
 *   124 RUN_TIMEOUT     Overall run timeout elapsed (the `--timeout` budget).
 *   125 FLUSH_TIMEOUT   Shutdown drain exceeded its window: one or more SAVEs /
 *                       log / recording flushes may be INCOMPLETE. This is the
 *                       "your output may be truncated" signal — distinct from
 *                       124 so a script can tell "run timed out" from "a save
 *                       didn't finish flushing".
 */
export enum ExitCode {
  OK = 0,
  PortError = 1,
  UsageError = 2,
  DownloadFailed = 3,
  RunTimeout = 124,
  FlushTimeout = 125
}

/**
 * Best-effort drain window (ms) for in-flight saves / logs / recording on
 * shutdown. Window captures start immediately and complete in well under a
 * second, so 10 s is far beyond any realistic capture — precious data is given
 * every chance to finish. If it is exceeded we exit FlushTimeout rather than
 * hang. A user who force-quits sooner has accepted the loss.
 */
export const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;
