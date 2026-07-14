/** @format */

/**
 * Contract test for the unified process exit-code map (src/utils/exitCodes.ts).
 * These codes are part of the CLI contract — a launching script branches on
 * them — so they must NOT change silently and must be IDENTICAL across headed
 * and headless modes. This test is the guard.
 */

import { ExitCode, SHUTDOWN_DRAIN_TIMEOUT_MS } from '../src/utils/exitCodes';

describe('Unified exit-code map (headed == headless)', () => {
  it('pins each documented code to its value', () => {
    expect(ExitCode.OK).toBe(0);
    expect(ExitCode.PortError).toBe(1);
    expect(ExitCode.UsageError).toBe(2);
    expect(ExitCode.DownloadFailed).toBe(3);
    expect(ExitCode.RunTimeout).toBe(124);
    expect(ExitCode.FlushTimeout).toBe(125);
  });

  it('keeps "you invoked me wrong" (2) distinct from "the port failed" (1)', () => {
    // A launching script must be able to tell a typo in its own command line
    // from a hardware/port failure — they call for completely different
    // responses (fix the script vs. check the cable).
    expect(ExitCode.UsageError).not.toBe(ExitCode.PortError);
  });

  it('keeps "run timed out" (124) distinct from "flush did not finish" (125)', () => {
    // The whole point: a script can tell a run-budget timeout from a
    // shutdown-drain timeout (the truncation-risk signal).
    expect(ExitCode.RunTimeout).not.toBe(ExitCode.FlushTimeout);
  });

  it('uses a generous, sub-capture drain window (10s)', () => {
    expect(SHUTDOWN_DRAIN_TIMEOUT_MS).toBe(10_000);
  });
});
