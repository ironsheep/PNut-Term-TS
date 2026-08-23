/** @format */

/**
 * END-TO-END exit-code contract test: spawns the REAL built CLI and asserts on
 * the code the SHELL actually sees ($?).
 *
 * This is the test that was missing. `exitCodes.test.ts` pinned the enum's
 * values and passed happily for months while the contract was completely inert:
 * the entry point called `cliTool.run()` and DISCARDED its promise, so every
 * invocation — including "Aborted!" — handed the shell a 0. An enum can only
 * prove the numbers are spelled right; only spawning the process can prove they
 * ever arrive. So we spawn the process.
 *
 * Every case here aborts or prints and exits. NOTHING in this file opens a
 * serial port, downloads to a P2, or launches the GUI — the tests are safe to
 * run with or without hardware attached, and give the same answer either way.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { ExitCode } from '../src/utils/exitCodes';

const CLI: string = path.join(__dirname, '..', 'dist', 'pnut-term-ts.js');

/** Run the built CLI with args; resolve with what the shell would see in $?. */
function runCli(args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output: string = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === null) {
        reject(new Error(`CLI died on signal ${signal}`));
        return;
      }
      resolve({ code, output });
    });
  });
}

describe('CLI exit codes reach the shell (the G3 contract)', () => {
  jest.setTimeout(45_000);

  beforeAll(() => {
    if (!fs.existsSync(CLI)) {
      throw new Error(`Built CLI not found at ${CLI} — run "npm run build" before this suite.`);
    }
  });

  describe('a bad command line exits UsageError (2) and runs NOTHING', () => {
    it.each([
      ['unknown option', ['--bogus']],
      ['excess positional argument', ['somejunk']],
      ['--timeout with a non-numeric value', ['--headless', '--timeout', 'abc']],
      ['--timeout with a trailing-garbage value', ['--headless', '--timeout', '60s']],
      ['--timeout zero', ['--headless', '--timeout', '0']],
      ['--timeout without --headless', ['--timeout', '60']],
      ['--baud with a non-numeric value', ['-b', 'notanumber']],
      ['--baud with a trailing-garbage value', ['-b', '115200abc']],
      ['--debugbaud (deprecated alias) with a non-numeric value', ['--debugbaud', 'notanumber']],
      ['--baud and --debugbaud disagreeing', ['-b', '115200', '--debugbaud', '921600']],
      ['--downloadbaud with a non-numeric value', ['--downloadbaud', 'notanumber']],
      ['--downloadbaud below the loader auto-baud floor', ['--downloadbaud', '2400']],
      ['--downloadbaud above the loader auto-baud ceiling', ['--downloadbaud', '4000000']],
      ['--baud below the serial floor', ['-b', '115']],
      ['--baud above the sane ceiling', ['-b', '25000000']],
      ['-r and -f together', ['-r', 'a.bin', '-f', 'b.bin']],
      ['a download file that does not exist', ['-r', '/nonexistent/nope.bin']],
      ['an empty --end-marker phrase', ['--headless', '--end-marker', '']],
      ['--end-marker without --headless or --exit-on-end-session', ['--end-marker', 'FOO']]
    ])('%s → 2', async (_label: string, args: string[]) => {
      const { code } = await runCli(args);
      expect(code).toBe(ExitCode.UsageError);
    });

    it('the two rates keep DIFFERENT ranges — 3 Mbaud is legal serial, illegal download', async () => {
      // Not an inconsistency: 2,000,000 is the boot ROM's auto-baud ceiling, while the
      // DEBUG rate comes off a smart pin bounded only by the clock. A source carrying
      // DEBUG_BAUD = 3_000_000 is legal and we adopt it from a binary, so the typed
      // value must be legal too — otherwise the same number is legal or illegal
      // depending only on where it came from.
      const { code: serialOk } = await runCli(['-b', '3000000', '-p', 'nosuchdevice']);
      expect(serialOk).not.toBe(ExitCode.UsageError);

      const { code: downloadBad, output } = await runCli(['--downloadbaud', '3000000']);
      expect(downloadBad).toBe(ExitCode.UsageError);
      expect(output).toMatch(/9600-2000000/);
    });

    it('warns — but does NOT refuse — above the verified rate, and claims nothing about loss', async () => {
      // 2,000,000 is the edge of our EVIDENCE, not of our capability. The warning must
      // say the behavior is unmeasured; asserting data WILL be lost would be as unfounded
      // as asserting it will not. Refusing is also wrong: the user's P2 may genuinely be
      // transmitting there, and a refusal gives them nothing instead of degraded output.
      const { code, output } = await runCli(['-b', '3000000', '-p', 'nosuchdevice']);
      expect(code).not.toBe(ExitCode.UsageError);
      expect(output).toMatch(/UNMEASURED/);
      expect(output).toMatch(/2000000/);
      expect(output).not.toMatch(/will drop|expect drop|guaranteed/i);
    });

    it('says nothing at or below the verified rate', async () => {
      const { output } = await runCli(['-b', '2000000', '-p', 'nosuchdevice']);
      expect(output).not.toMatch(/UNMEASURED/);
    });

    it('--baud names the serial range when the value is out of it', async () => {
      const { code, output } = await runCli(['-b', '115']);
      expect(code).toBe(ExitCode.UsageError);
      expect(output).toMatch(/300-20000000/);
    });

    it('--downloadbaud names the loader range when the value is out of it', async () => {
      // The range is the P2 serial loader's auto-baud window, not a taste: outside it
      // the chip cannot lock on and the download simply never completes, silently.
      const { code, output } = await runCli(['--downloadbaud', '4000000']);
      expect(code).toBe(ExitCode.UsageError);
      expect(output).toMatch(/9600-2000000/);
    });

    it('accepts a download baud inside the loader range', async () => {
      // Well-formed command line, no hardware: must fail on the PORT, not on usage.
      const { code } = await runCli(['--downloadbaud', '115200', '-p', 'nosuchdevice']);
      expect(code).not.toBe(ExitCode.UsageError);
    });

    it('--debugbaud still works and reports under the name the user typed', async () => {
      const { code, output } = await runCli(['--debugbaud', 'bad']);
      expect(code).toBe(ExitCode.UsageError);
      expect(output).toMatch(/Invalid --debugbaud value/);
      expect(output).not.toMatch(/Invalid --baud value/);
    });

    it('never announces a download it is about to abort', async () => {
      // A bad baud alongside a PERFECTLY GOOD -r file: we must not print
      // "Downloading [...]" and then abort on the other parameter.
      const goodBin: string = path.join(__dirname, 'fixtures', 'cli-exit-probe.bin');
      fs.mkdirSync(path.dirname(goodBin), { recursive: true });
      fs.writeFileSync(goodBin, Buffer.alloc(4));
      try {
        const { code, output } = await runCli(['-r', goodBin, '-b', 'bad']);
        expect(code).toBe(ExitCode.UsageError);
        expect(output).not.toMatch(/Downloading/i);
      } finally {
        fs.rmSync(goodBin, { force: true });
      }
    });

    it('reports EVERY bad parameter in one run, not just the first', async () => {
      const { code, output } = await runCli(['-b', 'bad', '--timeout', '60', '-r', 'a.bin', '-f', 'b.bin']);
      expect(code).toBe(ExitCode.UsageError);
      expect(output).toMatch(/Invalid --baud value/);
      expect(output).toMatch(/--timeout requires --headless/);
      expect(output).toMatch(/only one of FLASH .* or RAM/);
    });

    it('still reports the failure under --quiet (quiet suppresses chatter, not errors)', async () => {
      const { code, output } = await runCli(['--quiet', '-b', 'bad']);
      expect(code).toBe(ExitCode.UsageError);
      expect(output).toMatch(/Invalid --baud value/);
    });
  });

  describe('a good command line against absent hardware exits PortError (1)', () => {
    it('names a device that is not attached → 1, not 2', async () => {
      // The command line is well-formed; the world just doesn't have this
      // device. That distinction is the whole reason UsageError is not 1.
      const { code } = await runCli(['-p', 'NO_SUCH_PROPPLUG_XYZZY']);
      expect(code).toBe(ExitCode.PortError);
    });

    it('a bad command line OUTRANKS absent hardware (2 beats 1)', async () => {
      const { code } = await runCli(['-p', 'NO_SUCH_PROPPLUG_XYZZY', '-b', 'bad']);
      expect(code).toBe(ExitCode.UsageError);
    });
  });

  describe('output-and-stop invocations exit OK (0)', () => {
    it('--help → 0', async () => {
      const { code, output } = await runCli(['--help']);
      expect(code).toBe(ExitCode.OK);
      expect(output).toMatch(/--headless/);
    });

    it('--version → 0', async () => {
      const { code } = await runCli(['--version']);
      expect(code).toBe(ExitCode.OK);
    });

    it('--dvcnodes → 0', async () => {
      const { code } = await runCli(['--dvcnodes']);
      expect(code).toBe(ExitCode.OK);
    });
  });
});
