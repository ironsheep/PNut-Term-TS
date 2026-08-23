#!/usr/bin/env node
/* eslint-disable no-console */
/** @format */

// src/pnut-term-ts.ts
'use strict';
import { Command, CommanderError, Option, type OptionValues } from 'commander';
import { MAX_SANE_BAUD, MAX_VALIDATED_BAUD } from './utils/p2DebugHeader';

// TWO rates, TWO ranges, because two different pieces of hardware set the limits.
//
// DOWNLOAD baud is consumed by the P2 boot ROM, which auto-bauds across this window
// (P2 Silicon Doc, serial loader). Outside it the chip cannot lock on to us at all,
// and the failure is silent — the download simply never completes.
const MIN_LOADER_BAUD = 9600;
const MAX_LOADER_BAUD = 2000000;

// SERIAL baud is produced by an async-TX smart pin (bit period = clkfreq/baud), so it
// is NOT capped at the loader's 2,000,000 — a source carrying DEBUG_BAUD = 3_000_000
// is legal and we already adopt it when read from a binary. The ceiling is therefore
// shared with that path (see p2DebugHeader.MAX_SANE_BAUD) so the same number can never
// be legal from a binary and illegal from the keyboard.
//
// The floor is ours, and it is a REACHABILITY bound — not a taste, and not a claim
// about standards. This app configures 8N1 and ONLY 8N1 (usb.serial.ts, and
// winSyncPort's `${baud},n,8,1` DCB string); no framing control is exposed anywhere.
// Every historic rate below 300 needs framing we cannot produce: 110-baud Teletype is
// 8N2, and the 75 / 50 / 45.45 Baudot rates are 5-bit ITA2. So 300 is NOT "the lowest
// standard rate" — it is the Bell 103 modem rate, and 110/75/50 all predate it — it is
// the lowest rate this app could actually hold a conversation at. Below it there is
// nothing for us to reach.
//
// It also sits far below anything this tool realistically sees (the P2 loader's own
// auto-baud floor is 9600; the Preferences dropdown stops at 115200), so it cannot
// reject a legitimate use: the slow legacy devices a plain serial terminal might
// attach to — 300 / 1200 / 2400 — all stay legal.
//
// NOT claimed: that this catches typos. It catches only the extreme ones (115, 96).
// `--baud 1152`, `11520`, `960` and `9216` are all above the floor and pass straight
// through. Covering that class would need a "not a standard rate, did you mean…?"
// WARNING, which is a separate decision and deliberately not made here.
const MIN_SERIAL_BAUD = 300;
import { Context } from './utils/context';
import { ExitCode } from './utils/exitCodes';
import os from 'os';
import path from 'path';
import { exec, spawn } from 'child_process';
import { UsbSerial, DeviceInfo } from './utils/usb.serial';
import { Context as ContextType, PropPlugEntry } from './utils/context';
import * as fs from 'fs';
// No Electron imports - this is pure Node.js CLI
// Electron UI will be launched via electron-main.ts if needed

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

// NOTEs re-stdio in js/ts
// REF https://blog.logrocket.com/using-stdout-stdin-stderr-node-js/

// expose our installation path
// REF: https://stackoverflow.com/questions/32944714/best-way-to-find-the-location-of-a-specific-file-within-a-node-dependency
// can then get by:
//  var assets = require('foo');
//  fs.readFile(assets.root + '/bar.png', function(){/*whatever*/});
export const root: string = __dirname;

/**
 * Finds the first string in the array that contains the specified substring.
 * @param array The array of strings to search.
 * @param substring The substring to search for.
 * @returns The first string that contains the substring, or undefined if no match is found.
 */
function findMatch(array: string[], substring: string): boolean {
  const foundString: string | undefined = array.find((element) => element.includes(substring));
  let foundStatus: boolean = false;
  if (foundString !== undefined) {
    foundStatus = true;
  }
  return foundStatus;
}
export class DebugTerminalInTypeScript {
  private readonly program = new Command();
  //static isTesting: boolean = false;
  private version: string = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;
  private argsArray: string[] = [];
  private context: Context;
  private shouldAbort: boolean = false;
  // Validation errors are ACCUMULATED, never exited on. A bad command line
  // reports EVERY problem it has in one run — a user fixing one typo at a time
  // across five invocations is a defect of this tool, not of their typing.
  // Usage errors (the command line itself is wrong) are kept separate from
  // environment errors (the command line is fine, the hardware/port is not)
  // because they exit with different codes — see abortExitCode().
  private usageErrorCount: number = 0;
  private environmentErrorCount: number = 0;
  private pendingErrors: string[] = [];
  private inContainer: boolean = false;
  private requiresFilename: boolean = false;
  private initialCwd: string = '';
  private initialDirname: string = '';
  private startupDirectory: string = '';
  private deviceInfoList: DeviceInfo[] = []; // Full device info for PropPlug tracking

  constructor(argsOverride?: string[]) {
    //console.log(`PNut-Term-TS: argsOverride=[${argsOverride}]`);
    if (argsOverride !== undefined) {
      this.argsArray = argsOverride;
      //DebugTerminalInTypeScript.isTesting = true;
    }

    this.inContainer = findMatch(process.argv, 'workspace');

    process.stdout.on('error', (error: Error) => {
      console.error(`PNut-Term-TS: An error occurred on stdout: "${error.message}", Aborting.`);
      process.exit(1);
    });

    process.stderr.on('error', (error: Error) => {
      console.error(`PNut-Term-TS: An error occurred on stderr: "${error.message}", Aborting.`);
      process.exit(1);
    });

    process.stdout.on('close', () => {
      console.log('PNut-Term-TS: stdout was closed');
    });

    process.stderr.on('close', () => {
      console.log('PNut-Term-TS: stderr was closed');
    });

    // Capture startup directory BEFORE Electron initialization
    // For packaged Electron apps, __dirname points to .../app/dist
    // We need to go up to the directory containing the .app bundle
    // For CLI/headless mode, use process.cwd() (user's current working directory)
    this.startupDirectory = process.cwd();
    this.initialCwd = this.startupDirectory;
    this.initialDirname = __dirname;

    // If running from packaged app IN GUI MODE, use bundle parent directory
    // GUI mode: process.cwd() is unreliable (could be / or ~ when launched via Finder)
    // CLI mode (ELECTRON_RUN_AS_NODE=1): process.cwd() is correct (user's directory)
    const isRunningAsNodeCLI = process.env.ELECTRON_RUN_AS_NODE === '1';
    if (__dirname.includes('PNut-Term-TS.app') && !isRunningAsNodeCLI) {
      // GUI mode from packaged app - use bundle parent directory
      const appIndex = __dirname.indexOf('PNut-Term-TS.app');
      this.startupDirectory = __dirname.substring(0, appIndex);
    }
    // Otherwise, keep process.cwd() - the user's launch directory
    // This is correct for CLI, headless mode, and development

    this.context = new Context(this.startupDirectory);

    // Set startup directory for all logging systems
    const { RouterLogger } = require('./classes/shared/routerLogger');
    RouterLogger.setStartupDirectory(this.startupDirectory);

    if (!this.inContainer) {
      // --------------------------------------------------
      // configure some electron settings (attempt to kill startup errors)
      /*
      [44304:1221/152545.141736:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.143624:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.163527:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.164527:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.183297:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.185617:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.203657:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.204444:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.225301:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.226560:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.246903:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.249938:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.269487:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.270695:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.291861:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.293733:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.313563:ERROR:network_service_instance_impl.cc(613)] Network service crashed, restarting service.
      [44304:1221/152545.314664:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=5
      [44304:1221/152545.314705:FATAL:gpu_data_manager_impl_private.cc(423)] GPU process isn't usable. Goodbye.
      Trace/BPT trap: 5
      */
      // Electron-specific initialization has been moved to electron-main.ts
      // This file is now a pure Node.js CLI
    }
  }

  public setArgs(runArgs: string[]) {
    //console.log('runArgs: %o', runArgs);
    this.argsArray = runArgs;
    //DebugTerminalInTypeScript.isTesting = true;
  }

  /**
   * Resolve a download target filename. P2 executables are always `.bin`, so a
   * name supplied with NO extension gets `.bin` appended (e.g. `myTop` →
   * `myTop.bin`); a name that already carries any extension is used verbatim.
   * The caller's fs.existsSync check then reports a clear not-found error on the
   * resolved (.bin) name if the file is absent.
   */
  private resolveBinFilename(name: string): string {
    return path.extname(name) === '' ? `${name}.bin` : name;
  }

  /**
   * Record a USAGE error: the command line itself is wrong (unknown option, bad
   * value, misapplied/conflicting flags, missing download file). Held rather
   * than printed so that validation runs to completion and the user is shown
   * ALL of their mistakes at once (and so the errors appear together, after the
   * sign-on banner, instead of scattered through startup output). Nothing runs
   * afterwards — see the validation gates in run().
   */
  private usageError(message: string): void {
    this.pendingErrors.push(message);
    this.usageErrorCount++;
    this.shouldAbort = true;
  }

  /**
   * Record an ENVIRONMENT error: the command line is well-formed but the world
   * isn't cooperating (USB enumeration failed, the requested device isn't
   * attached). Distinct from a usage error because it exits PortError, not
   * UsageError — the user typed a valid command; the hardware said no.
   */
  private environmentError(message: string): void {
    this.pendingErrors.push(message);
    this.environmentErrorCount++;
    this.shouldAbort = true;
  }

  /**
   * The exit code for an aborted run. A bad command line outranks a bad
   * environment: if the invocation was malformed we never made a legitimate
   * attempt at the hardware, so "you invoked me wrong" is the more truthful
   * answer to give the shell.
   */
  private abortExitCode(): ExitCode {
    if (this.usageErrorCount > 0) {
      return ExitCode.UsageError;
    }
    if (this.environmentErrorCount > 0) {
      return ExitCode.PortError;
    }
    return ExitCode.OK;
  }

  /**
   * Report every error we collected, announce the abort, and hand back the code
   * the shell will see. Errors are ALWAYS reported — even under --quiet, which
   * suppresses chatter, not failures.
   */
  private abort(quiet: boolean): ExitCode {
    for (const message of this.pendingErrors) {
      this.context.logger.errorMsg(message);
    }
    this.pendingErrors = [];
    if (!quiet) {
      this.context.logger.progressMsg('Aborted!');
    }
    return this.abortExitCode();
  }

  /**
   * Strictly parse an option value that must be a positive whole number.
   *
   * Deliberately stricter than parseInt(), which is the wrong tool for
   * validating user input: parseInt('abc') is NaN (and NaN silently defeats
   * every `<= 0` guard, because every comparison with NaN is false), while
   * parseInt('60s') is 60 — it accepts garbage by ignoring the tail. Returns
   * null for ANYTHING that is not a run of digits with a positive value, so the
   * caller reports a usage error instead of running with a wrong or absent value.
   */
  private parsePositiveInt(raw: string): number | null {
    const text: string = String(raw).trim();
    if (!/^\d+$/.test(text)) {
      return null;
    }
    const value: number = parseInt(text, 10);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  public async run(): Promise<number> {
    // ensure we know early if we are running in developer mode
    if (process.env.PNUT_DEVELOP_MODE) {
      this.context.runEnvironment.developerModeEnabled = true;
    }
    // now setup and process arguments
    this.program
      .configureOutput({
        // Visibly override write routines as example!
        writeOut: (str) => process.stdout.write(this.prefixName(str)),
        writeErr: (str) => process.stderr.write(this.prefixName(str)),
        // Highlight errors in color.
        outputError: (str, write) => write(this.errorColor(str))
      })
      .name('pnut-term-ts')
      .version(`v${this.version}`, '-V, --version', 'Output the version number')
      //.version(`v${this.version}`)
      .usage('[options]')
      .description(`PNut Terminal TS - v${this.version}`)
      .option('-f, --flash <fileSpec>', 'Download to FLASH and run')
      .option('-r, --ram <fileSpec>', 'Download to RAM and run')
      // ONE rate serves BOTH roles after a download: the DEBUG output the P2
      // transmits AND plain serial-terminal traffic. It is one UART, so there is
      // only ever one number. The old name (--debugbaud) described only half of
      // what it does and read as irrelevant to anyone using this as a terminal —
      // who has no binary to read the rate from and for whom this flag is the
      // ONLY way to set it. Kept as a hidden alias; a shipped flag is never broken.
      .addOption(
        new Option(
          '-b, --baud <rate>',
          'Serial baud rate for DEBUG output and terminal traffic (300-20000000, default: read from the binary being downloaded, else 2000000)'
        )
      )
      .addOption(new Option('--debugbaud <rate>', 'Deprecated alias for --baud').hideHelp())
      // The OTHER rate: what we talk to the P2 BOOT LOADER at during -r/-f. The loader
      // auto-bauds 9600..2,000,000, so 2,000,000 is the ceiling of the supported range,
      // not a requirement — an adapter that cannot hold it previously had no way out.
      .option(
        '--downloadbaud <rate>',
        'Baud rate used to download to the P2 (9600-2000000, default: 2000000)'
      )
      .option(
        '-p, --plug <dvcNode>',
        'Receive serial data from Propeller attached to <dvcNode> (auto-detects if only one USB serial device)'
      )
      .option('-n, --dvcnodes', 'List available USB serial device (n)odes (use with -m to list all FTDI devices)')
      .option('-d, --debug', 'Output Term-TS Debug messages')
      .option('-v, --verbose', 'Output Term-TS Verbose messages')
      .option('-q, --quiet', 'Quiet mode (suppress Term-TS banner and non-error text)')
      .option('-m, --match-vendor-only', 'Match any FTDI device (VID 0x0403), ignore product ID')
      .option('--ide', 'IDE mode - minimal UI for VSCode/IDE integration')
      // NOT "(requires --ide)" as this once claimed: the RTS override is honored
      // in standalone mode too (see the rtsOverride handling below), and the help
      // text was telling users a restriction that does not exist.
      .option('--rts', 'Use RTS instead of DTR for device reset')
      .option('-u, --log-usb-trfc', 'Enable USB traffic logging (timestamped log file)')
      // Throughput captures need timestamps + sizes, not payload. The hex dump inflates a
      // capture ~6x, which makes a sustained 2 Mbaud run unusable as evidence.
      .option('--usb-counts-only', 'With -u: log RX timestamps and byte counts only (no hex dump) — for throughput captures')
      // Deliberately NOT folded into -d/--debug: that flag is common enough that channel
      // internals would ride along into ordinary runs. This is a troubleshooting tool for
      // the serial channel itself.
      .option('--diag-serial', 'Log serial-channel troubleshooting detail (P2 download handshake steps)')
      .option('--console-mode', 'Running with console output - adds delay before close')
      .option('--headless', 'Run without GUI windows (file logging only, for CI/AI agents)')
      // No parseInt coercion here: parseInt('abc') yields NaN, which then slips
      // through every numeric guard. The raw string is validated strictly below.
      .option('--timeout <seconds>', 'Exit after specified seconds (headless mode only)')
      .option('--end-marker [phrase]', 'Exit when phrase seen in output (default: END_SESSION or DEBUG_END_SESSION)')
      .option(
        '--exit-on-end-session',
        'Headed batch mode: exit the app (draining in-flight saves/logs) on the end-session marker / DEBUG_END_SESSION'
      );

    this.program.addHelpText('beforeAll', `$-`);

    this.program.addHelpText(
      'afterAll',
      `$-
      Examples:
         $ pnut-term-ts                                          # auto-detects and uses USB serial device (if only one connected)
         $ pnut-term-ts -p P9cektn7                              # run using PropPlug on /dev/tty.usbserial-P9cektn7
         $ pnut-term-ts -r myTopfile.bin                         # download to RAM (auto-detects single USB device)
         $ pnut-term-ts -r myTopfile                             # ".bin" assumed when no extension given (→ myTopfile.bin)
         $ pnut-term-ts -r myTopfile.bin -p P9cektn7             # download myTopfile.bin to RAM and run
         $ pnut-term-ts --ide                                    # IDE mode (auto-detects single USB device)
         $ pnut-term-ts --ide -p P9cektn7                        # IDE mode for VSCode integration
         $ pnut-term-ts --ide --rts -p P9cektn7                  # IDE mode using RTS instead of DTR for device reset
         $ pnut-term-ts -u -p P9cektn7                           # Enable USB traffic logging (timestamped log file)

      Headless Mode (for CI/AI agents):
         $ pnut-term-ts --headless -p P9cektn7                   # Run without GUI, log to file, exit on Ctrl+C
         $ pnut-term-ts --headless -r test.bin --end-marker      # Download, run until END_SESSION or DEBUG_END_SESSION
         $ pnut-term-ts --headless -r test.bin --timeout 60      # Download, run for 60 seconds then exit
         $ pnut-term-ts --headless --end-marker "TEST_DONE"      # Exit when custom phrase seen in output

      Headed batch mode (render windows, then auto-exit — e.g. dump bitmaps per file):
         $ pnut-term-ts -r gen.bin --exit-on-end-session         # Open windows, exit on DEBUG_END_SESSION (drains saves first)
         $ pnut-term-ts -r gen.bin --exit-on-end-session --end-marker "BATCH_DONE"  # ...exit on a custom phrase

      Device Selection:
         When only one USB serial device is connected, it will be automatically selected.
         Use -p option to specify a device when multiple are connected.
         Use -n option to list all available USB serial devices.

      Device Control:
         DTR (Data Terminal Ready): Used by Parallax PropPlug devices
         RTS (Request To Send): Used by some non-Parallax devices

         In standalone mode: Use DTR/RTS toggle buttons in the toolbar
         In IDE mode: VSCode SPIN2 extension controls DTR/RTS via --rts flag
         `
    );

    //this.program.showHelpAfterError('(add --help for additional information)');

    this.program.exitOverride(); // throw instead of exit

    // condition our logger
    this.context.logger.setProgramName(this.program.name());

    // Add custom version action to include startup directory
    this.program.action(() => {
      // This won't be called for version, but we need it for the default command
    });

    // Override version command to include startup directory
    const originalArgs = process.argv;
    if (originalArgs.includes('-V') || originalArgs.includes('--version')) {
      console.log(`v${this.version}`);
      console.log(`Startup Directory: ${this.context.currentFolder}`);
      process.exit(0);
    }

    // Combine process.argv with the modified this.argsArray
    const testArgsInterp = this.argsArray.length === 0 ? '[]' : this.argsArray.join(', ');

    const combinedArgs: string[] = process.argv;
    try {
      this.program.parse(combinedArgs);
    } catch (error: unknown) {
      // exitOverride() makes commander THROW instead of exiting, so every
      // outcome of parsing lands here — including the successful ones.
      // Commander marks the difference with exitCode: 0 for output-and-stop
      // (--help, --version), non-zero for a genuinely bad command line
      // (unknown option, missing option value, excess arguments).
      if (error instanceof CommanderError && error.exitCode === 0) {
        // --help / --version: commander has already written its output. Not a
        // failure — fall through so the existing help/banner path runs.
        this.context.logger.logMessage(``); // blank line so the prompt isn't jammed against the output
      } else {
        // A bad command line. Commander has already reported the specific
        // problem via outputError(); we add the hint and STOP. Previously this
        // path fell through and the app ran anyway on a command line we had
        // just declared invalid.
        if (error instanceof CommanderError) {
          this.context.logger.logMessage(``);
          this.context.logger.logMessage(`  (See --help for available options)\n`);
        } else {
          this.context.logger.errorMsg(`Could not parse the command line: ${error}`);
        }
        return ExitCode.UsageError;
      }
    }

    const options: OptionValues = this.program.opts();

    const showingHelp: boolean =
      this.program.args.includes('--help') || this.program.args.includes('-h') || combinedArgs.includes('--help');

    if (options.debug) {
      options.quiet = false;
    } else {
      options.debug = false; // force better value for later debug display
    }

    if (options.verbose) {
      options.quiet = false;
    } else {
      options.verbose = false; // force better value for later debug display
    }

    // Store IDE mode flag in context for UI adaptation
    if (options.ide) {
      this.context.runEnvironment.ideMode = true;
    }

    // Store RTS override flag (works in both standalone and IDE modes)
    // This overrides any per-device controlLine setting
    if (options.rts) {
      this.context.runEnvironment.rtsOverride = true;
      this.context.runEnvironment.controlLine = 'RTS'; // Override per-device setting
      const modeText = options.ide ? 'IDE mode' : 'standalone mode';
      this.context.logger.verboseMsg(`RTS control line enabled for ${modeText} (overrides per-device setting)`);
    }

    // Store match-vendor-only flag for USB device filtering
    if (options.matchVendorOnly) {
      this.context.runEnvironment.matchVendorOnly = true;
      this.context.logger.verboseMsg(`USB device matching: Any FTDI device (VID 0x0403), ignoring product ID`);
    }

    // Store the serial baud rate if specified on the command line. --baud is the
    // name; --debugbaud is the retained deprecated alias. Giving BOTH with
    // different values is a usage error rather than a silent pick — the user
    // clearly believes they are two different settings, and they are not.
    if (options.baud !== undefined && options.debugbaud !== undefined && options.baud !== options.debugbaud) {
      this.usageError(
        `Conflicting --baud (${options.baud}) and --debugbaud (${options.debugbaud}): they are the same setting — pass only --baud`
      );
    }
    const baudFlagName: string = options.baud !== undefined ? '--baud' : '--debugbaud';
    const baudFlagValue: string | undefined = options.baud !== undefined ? options.baud : options.debugbaud;
    if (baudFlagValue !== undefined) {
      const baudRate: number | null = this.parsePositiveInt(baudFlagValue);
      if (baudRate === null) {
        this.usageError(`Invalid ${baudFlagName} value: "${baudFlagValue}" (expected a positive whole number of bits/sec)`);
      } else if (baudRate < MIN_SERIAL_BAUD || baudRate > MAX_SANE_BAUD) {
        this.usageError(
          `Invalid ${baudFlagName} value: ${baudRate} is outside the supported serial range ` +
            `(${MIN_SERIAL_BAUD}-${MAX_SANE_BAUD})`
        );
      } else {
        this.context.runEnvironment.debugBaudrate = baudRate;
        this.context.runEnvironment.debugBaudRateFromCLI = true;
        this.context.logger.verboseMsg(`Serial baud rate set to ${baudRate}`);
        // Above our evidence, not above our capability — say exactly that. Claiming
        // data WILL be lost would be as unfounded as claiming it will not be.
        if (baudRate > MAX_VALIDATED_BAUD) {
          this.context.logger.warningMsg(
            `${baudRate} is above the highest rate this app has been verified to carry (${MAX_VALIDATED_BAUD}). ` +
              `Behavior above that rate is UNMEASURED — it may carry the stream fine, or it may drop data. ` +
              `Please report what you observe.`
          );
        }
      }
    }

    // Store the DOWNLOAD baud rate if specified. Range-checked against the P2 serial
    // loader's auto-baud window (9600..2,000,000, P2 Silicon Doc) rather than merely
    // "positive": outside it the P2 cannot lock on at all, and the failure is silent —
    // the download just never completes. Better to reject the number than the run.
    if (options.downloadbaud !== undefined) {
      const rate: number | null = this.parsePositiveInt(options.downloadbaud);
      if (rate === null) {
        this.usageError(`Invalid --downloadbaud value: "${options.downloadbaud}" (expected a positive whole number of bits/sec)`);
      } else if (rate < MIN_LOADER_BAUD || rate > MAX_LOADER_BAUD) {
        this.usageError(
          `Invalid --downloadbaud value: ${rate} is outside the P2 boot loader's auto-baud range ` +
            `(${MIN_LOADER_BAUD}-${MAX_LOADER_BAUD})`
        );
      } else {
        this.context.runEnvironment.downloadBaudrate = rate;
        this.context.runEnvironment.downloadBaudRateFromCLI = true;
        this.context.logger.verboseMsg(`Download baud rate set to ${rate}`);
      }
    }

    // Store headless mode options (for CI/AI agent automation)
    // An explicit --end-marker must carry a usable phrase. An empty string would
    // match every byte of output and end the run instantly, which is never what
    // anyone means by it.
    if (typeof options.endMarker === 'string' && options.endMarker.trim().length === 0) {
      this.usageError('Invalid --end-marker value: the phrase cannot be empty');
    }

    if (options.headless) {
      this.context.runEnvironment.headlessMode = true;
      this.context.logger.verboseMsg('Headless mode enabled (no GUI windows)');

      // Timeout option (only valid with --headless)
      if (options.timeout !== undefined) {
        const timeoutSeconds: number | null = this.parsePositiveInt(options.timeout);
        if (timeoutSeconds === null) {
          this.usageError(
            `Invalid --timeout value: "${options.timeout}" (expected a positive whole number of seconds)`
          );
        } else {
          this.context.runEnvironment.headlessTimeout = timeoutSeconds;
          this.context.logger.verboseMsg(`Headless timeout set to ${timeoutSeconds} seconds`);
        }
      }

      // End-marker option. In headless, end-marker detection always exits.
      // --exit-on-end-session is redundant here (headless ALWAYS exits on the
      // marker) but is honored rather than ignored: asking for end-session exit
      // arms the default markers even when --end-marker was not given.
      const wantsMarkers: boolean = options.endMarker !== undefined || options.exitOnEndSession === true;
      if (wantsMarkers) {
        // No value → both defaults (DEBUG_END_SESSION = PNut/Windows, END_SESSION = other tools).
        const em = options.endMarker;
        const markers = em === undefined || em === true ? ['END_SESSION', 'DEBUG_END_SESSION'] : [em as string];
        this.context.runEnvironment.headlessEndMarker = markers;
        this.context.logger.verboseMsg(`Headless end-marker(s) set to: ${markers.map((m) => `"${m}"`).join(', ')}`);
      }
    } else {
      // ── Headed mode ──
      // --timeout remains headless-only.
      if (options.timeout !== undefined) {
        this.usageError('--timeout requires --headless');
      }
      // --exit-on-end-session enables headed batch termination on the
      // end-session marker / DEBUG_END_SESSION sentinel. It also unlocks
      // --end-marker in headed mode (shared marker list with headless).
      if (options.exitOnEndSession) {
        const em = options.endMarker;
        const markers = em === undefined || em === true ? ['END_SESSION', 'DEBUG_END_SESSION'] : [em as string];
        this.context.runEnvironment.exitOnEndSession = true;
        this.context.runEnvironment.headlessEndMarker = markers;
        this.context.logger.verboseMsg(
          `Exit-on-end-session enabled; marker(s): ${markers.map((m) => `"${m}"`).join(', ')}`
        );
      } else if (options.endMarker !== undefined) {
        this.usageError('--end-marker requires --headless or --exit-on-end-session');
      }
    }

    if (!options.quiet) {
      const signOnCompiler: string = "Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC.";
      this.context.logger.forceLogMessage(`* ${signOnCompiler}`);
      const signOnVersion: string = `Version ${this.version}, {buildDateHere}`;
      this.context.logger.forceLogMessage(`* ${signOnVersion}`);
      this.context.logger.forceLogMessage(''); // blank line...
    }

    if (options.verbose) {
      this.context.logger.enabledVerbose();
    }

    if (options.debug) {
      this.context.logger.enabledDebug();
    }

    if ((!showingHelp && !options.quiet) || (showingHelp && options.verbose)) {
      let commandLine: string = `pnut-term-ts ${combinedArgs.slice(1).join(' ')}`;
      this.context.logger.debugMsg(`* ${commandLine}`);
      this.context.logger.debugMsg(
        `** process.argv=[${process.argv.join(', ')}], this.argsArray=[${testArgsInterp}] inContainer=[${
          this.inContainer
        }]`
      );
      if (options.debug) {
        console.log('- -------------------------------- -');
        console.log('arguments: %o', this.program.args);
        console.log('combArguments: %o', combinedArgs);
        console.log('options: %o', this.program.opts());
        console.log('- -------------------------------- -');
      }
    }

    if (this.context.runEnvironment.developerModeEnabled) {
      this.context.logger.verboseMsg('PNUT_DEVELOP_MODE is enabled');
    }

    const showingNodeList: boolean = options.dvcnodes;

    if (showingNodeList) {
      this.context.logger.debugMsg('* Device node listing requested (-n/--dvcnodes)');
    }

    if (options.flash && options.ram) {
      this.usageError('Please use only one of FLASH (-f) or RAM (-r) options!');
    }

    // Store USB traffic logging flag
    // NOTE: Path will be created in MainWindow (Electron process), not here (CLI process)
    if (options.usbCountsOnly) {
      this.context.runEnvironment.usbTrafficCountsOnly = true;
    }
    if (options.logUsbTrfc) {
      this.context.runEnvironment.usbTrafficLogging = true;
      this.context.logger.progressMsg(`Logging USB traffic`);
    }

    if (options.diagSerial) {
      this.context.runEnvironment.serialDiagnostics = true;
      this.context.logger.progressMsg(`Logging serial-channel diagnostics`);
    }

    // The "Downloading [...]" announcement is HELD until validation passes: we
    // must never tell the user we are downloading and then abort on some other
    // bad parameter.
    let pendingDownloadMsg: string | null = null;

    if (options.flash && !options.ram) {
      this.context.actions.writeFlash = true;
      this.requiresFilename = true;
      this.context.actions.binFilename = this.resolveBinFilename(options.flash);

      // Check if the file exists before proceeding
      if (!fs.existsSync(this.context.actions.binFilename)) {
        this.usageError(
          `File not found for FLASH download: ${this.context.actions.binFilename}\n  Please check the file path and try again.`
        );
      } else {
        pendingDownloadMsg = `Downloading [${this.context.actions.binFilename}] to FLASH`;
      }
    }

    if (options.ram && !options.flash) {
      this.context.actions.writeRAM = true;
      this.requiresFilename = true;
      this.context.actions.binFilename = this.resolveBinFilename(options.ram);

      // Check if the file exists before proceeding
      if (!fs.existsSync(this.context.actions.binFilename)) {
        this.usageError(
          `File not found for RAM download: ${this.context.actions.binFilename}\n  Please check the file path and try again.`
        );
      } else {
        pendingDownloadMsg = `Downloading [${this.context.actions.binFilename}] to RAM`;
      }
    }

    // ── COMMAND-LINE VALIDATION GATE ────────────────────────────────────────
    // Every command-line parameter has now been checked. If ANY of them was
    // invalid we stop RIGHT HERE — before enumerating USB hardware, before
    // resetting a device, before downloading anything, before opening a window.
    // A bad command line runs nothing at all.
    if (this.usageErrorCount > 0) {
      return this.abort(options.quiet);
    }

    // Command line is good — now it is honest to say what we are about to do.
    if (pendingDownloadMsg !== null) {
      this.context.logger.progressMsg(pendingDownloadMsg);
    }

    // Show verbose environment info (always show for verbose mode, regardless of shouldAbort)
    if ((options.verbose || options.debug) && !options.quiet) {
      this.context.logger.verboseMsg(''); // blank line
      let enclosingFolder: string = '';
      let removePrefix: string = '';
      if (this.inContainer) {
        enclosingFolder = path.dirname(this.context.currentFolder);
        removePrefix = enclosingFolder;
      } else {
        enclosingFolder = path.dirname(process.argv[0]);
      }

      //enclosingFolder = path.dirname(enclosingFolder);
      this.context.logger.verboseMsg(`wkg dir [${enclosingFolder}]`);
      this.context.logger.verboseMsg(`ext dir [~${this.context.extensionFolder.replace(removePrefix, '')}]`);
      this.context.logger.verboseMsg(`lib dir [~${this.context.libraryFolder.replace(removePrefix, '')}]`);
      this.context.logger.verboseMsg(''); // blank line

      // Show startup directories
      this.context.logger.verboseMsg(`[STARTUP] process.cwd() = ${this.initialCwd}`);
      this.context.logger.verboseMsg(`[STARTUP] __dirname = ${this.initialDirname}`);
      if (__dirname.includes('PNut-Term-TS.app')) {
        this.context.logger.verboseMsg(`[STARTUP] Detected packaged app, using directory: ${this.startupDirectory}`);
      } else {
        this.context.logger.verboseMsg(`[STARTUP] Using __dirname as working directory: ${this.startupDirectory}`);
      }

      const result = await this.runCommand('node -v');
      if (result.value !== null) {
        this.context.logger.verboseMsg(`Node version: ${result.value} (external)`);
      } else {
        // fake this for now...
        this.context.logger.verboseMsg(`Node version: v18.5.0 (built-in)`);
      }
      this.context.logger.verboseMsg(''); // blank line
    }

    if (!showingHelp) {
      this.context.logger.debugMsg('* Enumerating USB serial devices...');
      try {
        await this.loadUsbPortsFound();
        this.context.logger.debugMsg(
          `* Enumeration complete: ${this.context.runEnvironment.serialPortDevices.length} PropPlug device(s) found`
        );
      } catch (error) {
        this.context.logger.debugMsg('* USB enumeration failed - check permissions or device drivers');
        // Don't abort if just listing nodes - show the error but continue
        if (showingNodeList) {
          this.context.logger.errorMsg(`* loadUsbPortsFound() Exception: ${error}`);
        } else {
          this.environmentError(`Could not enumerate USB serial devices: ${error}`);
        }
      }
    }

    if (showingNodeList) {
      this.context.logger.verboseMsg('* Listing USB PropPlug devices (VID:0403 PID:6015)...');

      if (this.context.runEnvironment.serialPortDevices.length > 0) {
        for (let index = 0; index < this.context.runEnvironment.serialPortDevices.length; index++) {
          const dvcNode = this.context.runEnvironment.serialPortDevices[index];
          this.context.logger.progressMsg(` USB #${index + 1} [${dvcNode}]`);
        }
      } else {
        // no ports found
        this.context.logger.progressMsg(` USB  - no PropPlug Serial Devices Found!`);
        this.context.logger.verboseMsg('* Note: Only Parallax PropPlug devices (0403:6015) are detected');
        this.context.logger.verboseMsg('* Check: Device connected, drivers installed, USB permissions');
      }
    }

    if (options.plug) {
      // if port given on command line, use it!
      // Case-insensitive matching for user-friendly serial number lookup
      const searchTerm = options.plug.toLowerCase();
      const foundDevice = this.deviceInfoList.find(
        (device) =>
          device.path.toLowerCase().includes(searchTerm) || device.serialNumber.toLowerCase().includes(searchTerm)
      );
      if (foundDevice !== undefined) {
        this.context.runEnvironment.selectedPropPlug = foundDevice.path;
        this.context.runEnvironment.selectedPropPlugSerial = foundDevice.serialNumber;
        // Look up device settings and apply controlLine
        // If --rts override is active, use RTS for this session (don't overwrite)
        // Otherwise, use the device's stored control line preference
        if (!this.context.runEnvironment.rtsOverride) {
          const deviceEntry = this.context.getKnownPropPlug(foundDevice.serialNumber);
          if (deviceEntry) {
            this.context.runEnvironment.controlLine = deviceEntry.controlLine;
            this.context.logger.verboseMsg(
              `* Device ${foundDevice.serialNumber} uses ${deviceEntry.controlLine} control line`
            );
          }
        } else {
          this.context.logger.verboseMsg(
            `* Device ${foundDevice.serialNumber} using RTS control line (--rts session override)`
          );
        }
      } else {
        // Device specified but not found. The command line is well-formed — the
        // named device simply isn't attached — so this is an ENVIRONMENT error
        // (PortError), not a usage error. It is RECORDED rather than exited on:
        // bailing out here used to skip the remaining checks and, worse, exited
        // before the caller could learn anything else that was wrong.
        const detail: string =
          this.deviceInfoList.length > 0
            ? `Available devices:\n${this.deviceInfoList
                .map((device) => `  ${device.path} (SN: ${device.serialNumber})`)
                .join('\n')}`
            : 'No USB serial devices detected';
        this.environmentError(`Device "${options.plug}" not found\n  ${detail}`);
      }
    }

    // ── ENVIRONMENT GATE ────────────────────────────────────────────────────
    // The command line was good, but the hardware isn't there. Stop before the
    // device-selection fallbacks below — otherwise a failed `--plug` lookup
    // would fall through to auto-detect and silently run against a DIFFERENT
    // device than the one the caller explicitly named.
    if (this.environmentErrorCount > 0) {
      return this.abort(options.quiet);
    }

    // Check for project-level PropPlug selection
    if (!this.context.runEnvironment.selectedPropPlug) {
      const projectPropPlug = this.context.getProjectSelectedPropPlug();
      if (projectPropPlug) {
        const foundDevice = this.deviceInfoList.find((device) => device.serialNumber === projectPropPlug);
        if (foundDevice) {
          this.context.runEnvironment.selectedPropPlug = foundDevice.path;
          this.context.runEnvironment.selectedPropPlugSerial = foundDevice.serialNumber;
          // Look up device settings and apply controlLine (unless --rts override active)
          if (!this.context.runEnvironment.rtsOverride) {
            const deviceEntry = this.context.getKnownPropPlug(foundDevice.serialNumber);
            if (deviceEntry) {
              this.context.runEnvironment.controlLine = deviceEntry.controlLine;
              this.context.logger.verboseMsg(
                `* Project-selected device ${foundDevice.serialNumber} uses ${deviceEntry.controlLine} control line`
              );
            }
          } else {
            this.context.logger.verboseMsg(
              `* Project-selected device ${foundDevice.serialNumber} using RTS control line (--rts session override)`
            );
          }
        } else {
          // Only warn if not showing help AND auto-detect won't find a device
          if (!showingHelp && this.deviceInfoList.length !== 1) {
            this.context.logger.warningMsg(
              `* Project-selected PropPlug "${projectPropPlug}" not found, will try other selection methods`
            );
          }
        }
      }
    }

    // Check for user-default PropPlug selection
    if (!this.context.runEnvironment.selectedPropPlug) {
      const userDefaultPropPlug = this.context.preferences.serialPort.defaultPropPlug;
      if (userDefaultPropPlug) {
        const foundDevice = this.deviceInfoList.find((device) => device.serialNumber === userDefaultPropPlug);
        if (foundDevice) {
          this.context.runEnvironment.selectedPropPlug = foundDevice.path;
          this.context.runEnvironment.selectedPropPlugSerial = foundDevice.serialNumber;
          // Look up device settings and apply controlLine (unless --rts override active)
          if (!this.context.runEnvironment.rtsOverride) {
            const deviceEntry = this.context.getKnownPropPlug(foundDevice.serialNumber);
            if (deviceEntry) {
              this.context.runEnvironment.controlLine = deviceEntry.controlLine;
              this.context.logger.verboseMsg(
                `* User-default device ${foundDevice.serialNumber} uses ${deviceEntry.controlLine} control line`
              );
            }
          } else {
            this.context.logger.verboseMsg(
              `* User-default device ${foundDevice.serialNumber} using RTS control line (--rts session override)`
            );
          }
        } else {
          // Only warn if not showing help AND auto-detect won't find a device
          // (auto-detect succeeds when exactly 1 device is connected)
          if (!showingHelp && this.deviceInfoList.length !== 1) {
            this.context.logger.warningMsg(
              `* User-default PropPlug "${userDefaultPropPlug}" not found, will try auto-detect`
            );
          }
        }
      }
    }

    if (!this.context.runEnvironment.selectedPropPlug && this.deviceInfoList.length == 1) {
      // found only port, select it!
      const singleDevice = this.deviceInfoList[0];
      this.context.runEnvironment.selectedPropPlug = singleDevice.path;
      this.context.runEnvironment.selectedPropPlugSerial = singleDevice.serialNumber;

      // Auto-default: If no user default exists, set this as the default
      if (!this.context.preferences.serialPort.defaultPropPlug) {
        this.context.logger.verboseMsg(
          `* Setting ${singleDevice.serialNumber} as user default (first and only device)`
        );
        this.context.preferences.serialPort.defaultPropPlug = singleDevice.serialNumber;
        this.context.saveUserGlobalSettings(this.context.preferences);
      }

      // Look up device settings and apply controlLine (unless --rts override active)
      if (!this.context.runEnvironment.rtsOverride) {
        const deviceEntry = this.context.getKnownPropPlug(singleDevice.serialNumber);
        if (deviceEntry) {
          this.context.runEnvironment.controlLine = deviceEntry.controlLine;
          this.context.logger.verboseMsg(
            `* Auto-selected device ${singleDevice.serialNumber} uses ${deviceEntry.controlLine} control line`
          );
        }
      } else {
        this.context.logger.verboseMsg(
          `* Auto-selected device ${singleDevice.serialNumber} using RTS control line (--rts session override)`
        );
      }
    }

    let havePropPlug: boolean = false;
    if (this.context.runEnvironment.selectedPropPlug.length > 0) {
      // if a port was only or given on command line, show that we selected it
      this.context.logger.verboseMsg(`* using USB [${this.context.runEnvironment.selectedPropPlug}]`);
      havePropPlug = true;
    }

    // Store verbose/quiet flags in context
    this.context.runEnvironment.verbose = options.verbose || false;
    this.context.runEnvironment.quiet = options.quiet || false;
    this.context.runEnvironment.consoleMode = options.consoleMode || false;

    // Report font folder location when verbose
    const fontPath = path.join(__dirname, '..', 'fonts');
    this.context.logger.verboseMsg(`* fonts located at [${fontPath}]`);

    // All validation is complete - determine if we need to launch Electron UI
    const needsElectronUI: boolean = !showingHelp && !showingNodeList && !this.shouldAbort;

    this.context.logger.debugMsg(
      `* showingHelp=(${showingHelp}), shouldAbort=(${this.shouldAbort}), needsElectronUI=(${needsElectronUI})`
    );

    if (needsElectronUI) {
      // Check if we have a PropPlug selected
      if (havePropPlug) {
        const propPlug: string = this.context.runEnvironment.selectedPropPlug;
        this.context.logger.debugMsg(`* Will launch Electron UI attached to [${propPlug}]`);
      }

      // Check for headless mode - run without Electron GUI
      if (this.context.runEnvironment.headlessMode) {
        this.context.logger.debugMsg('🤖 Running in headless mode (no GUI)...');

        // Import HeadlessController dynamically to avoid loading Electron-dependent code
        const { HeadlessController } = await import('./classes/headlessController');

        // Determine if download is needed
        const ramFileSpec = options.ram;
        const flashFileSpec = options.flash;
        const downloadPath = ramFileSpec || flashFileSpec || undefined;
        const downloadToFlash = !!flashFileSpec;

        const controller = new HeadlessController(this.context, downloadPath, downloadToFlash);

        // Start the headless controller (blocks until termination)
        const exitCode = await controller.run();

        return Promise.resolve(exitCode);
      }

      // All parameters are validated and stored in context
      // Now launch Electron with the validated parameters
      this.context.logger.debugMsg('🚀 Launching Electron UI with validated parameters...');

      const exitCode = await this.launchElectron();
      return Promise.resolve(exitCode);
    }

    // Nothing to run: --help, --dvcnodes, or an abort. Any abort has already
    // been reported and returned at a gate above; this is belt-and-braces so a
    // future shouldAbort path can never again escape as a success.
    if (this.shouldAbort) {
      return this.abort(options.quiet);
    }

    if ((!options.quiet && !showingHelp) || (showingHelp && options.verbose)) {
      this.context.logger.progressMsg('Done');
    }
    return ExitCode.OK;
  }

  private async loadUsbPortsFound(): Promise<void> {
    this.context.logger.verboseMsg('* Calling UsbSerial.getDeviceInfoList()...');
    try {
      // Get full device info for PropPlug tracking
      this.deviceInfoList = await UsbSerial.getDeviceInfoList(this.context);
      this.context.runEnvironment.serialPortDevices = [];

      this.context.logger.verboseMsg(`* Device enumeration returned ${this.deviceInfoList.length} item(s)`);

      const now = new Date().toISOString();

      for (let index = 0; index < this.deviceInfoList.length; index++) {
        const deviceInfo = this.deviceInfoList[index];
        this.context.runEnvironment.serialPortDevices.push(deviceInfo.path);
        this.context.logger.debugMsg(
          `*   Device ${index + 1}: ${deviceInfo.path} (SN: ${
            deviceInfo.serialNumber
          }, VID:${deviceInfo.vendorId.toString(16)}, PID:${deviceInfo.productId.toString(16)})`
        );

        // Track this device in the master PropPlug list
        const existingEntry = this.context.getKnownPropPlug(deviceInfo.serialNumber);
        if (existingEntry) {
          // Update lastSeen timestamp
          this.context.updateKnownPropPlug(deviceInfo.serialNumber, { lastSeen: now });
        } else {
          // Add new device to master list
          // If --rts flag was specified on command line, use RTS for new devices
          // Otherwise use PID-based default (usually DTR)
          const defaultControlLine = this.context.runEnvironment.rtsOverride
            ? 'RTS'
            : Context.getDefaultControlLine(deviceInfo.productId);

          const newEntry: PropPlugEntry = {
            serialNumber: deviceInfo.serialNumber,
            vendorId: deviceInfo.vendorId,
            productId: deviceInfo.productId,
            friendlyName: '',
            controlLine: defaultControlLine,
            lastSeen: now,
            lastUsed: ''
          };
          this.context.addOrUpdateKnownPropPlug(newEntry);
          this.context.logger.verboseMsg(
            `*   Added new PropPlug to master list: ${deviceInfo.serialNumber} (control line: ${defaultControlLine})`
          );
        }
      }

      if (this.context.runEnvironment.serialPortDevices.length === 0) {
        const deviceType = this.context.runEnvironment.matchVendorOnly ? 'FTDI devices' : 'PropPlug devices';
        this.context.logger.debugMsg(`* No ${deviceType} found during enumeration`);
      } else {
        const deviceType = this.context.runEnvironment.matchVendorOnly ? 'FTDI device(s)' : 'PropPlug device(s)';
        this.context.logger.debugMsg(
          `* Successfully enumerated ${this.context.runEnvironment.serialPortDevices.length} ${deviceType}`
        );
      }
    } catch (error: any) {
      // Re-throw to let caller handle with better context
      const errorMsg = error?.message || String(error);
      this.context.logger.debugMsg(`* USB enumeration error details: ${errorMsg}`);
      this.context.runEnvironment.serialPortDevices = [];
      throw error; // Re-throw so caller knows enumeration failed
    }
  }

  private errorColor(str: string): string {
    // Add ANSI escape codes to display text in red.
    return `\x1b[31m${str}\x1b[0m`;
  }

  private prefixName(str: string): string {
    if (str.startsWith('$-')) {
      return `${str.substring(2)}`;
    } else {
      return `PNut-Term-TS: ${str}`;
    }
  }

  private async launchElectron(): Promise<number> {
    const electronPath = this.findElectronExecutable();
    if (!electronPath) {
      console.error('❌ Built-in Electron executable not found!!!');
      return 1;
    }

    // Find the electron-main.js file
    const electronMainPath = path.join(__dirname, 'electron-main.js');
    if (!fs.existsSync(electronMainPath)) {
      console.error(`❌ Electron main file not found at: ${electronMainPath}`);
      return 1;
    }

    // Write the validated context to a temporary JSON file
    const tmpDir = require('os').tmpdir();
    const contextFile = path.join(tmpDir, `pnut-term-context-${process.pid}.json`);

    // Create a serializable version of the context
    // Map our internal names to RuntimeEnvironment names
    const contextData = {
      runEnvironment: {
        selectedPropPlug: this.context.runEnvironment.selectedPropPlug,
        selectedPropPlugSerial: this.context.runEnvironment.selectedPropPlugSerial,
        controlLine: this.context.runEnvironment.controlLine,
        debugBaudrate: this.context.runEnvironment.debugBaudrate,
        debugBaudRateFromCLI: this.context.runEnvironment.debugBaudRateFromCLI,
        // Must cross the boundary in BOTH lists (here and electron-main.ts) or the
        // flag is silently absent in the Electron process — the documented trap.
        downloadBaudrate: this.context.runEnvironment.downloadBaudrate,
        downloadBaudRateFromCLI: this.context.runEnvironment.downloadBaudRateFromCLI,
        developerModeEnabled: this.context.runEnvironment.developerModeEnabled,
        verbose: this.context.runEnvironment.verbose,
        ideMode: this.context.runEnvironment.ideMode,
        rtsOverride: this.context.runEnvironment.rtsOverride,
        quiet: this.context.runEnvironment.quiet,
        serialPortDevices: this.context.runEnvironment.serialPortDevices,
        usbTrafficLogging: this.context.runEnvironment.usbTrafficLogging,
        usbTrafficCountsOnly: this.context.runEnvironment.usbTrafficCountsOnly,
        // --diag-serial must cross this boundary too, or the flag is silently false in
        // the Electron process (and therefore in the serial UtilityProcess below it).
        serialDiagnostics: this.context.runEnvironment.serialDiagnostics,
        // Headed batch termination: must cross the process boundary so the
        // Electron-side WindowRouter/MainWindow can honor --exit-on-end-session.
        exitOnEndSession: this.context.runEnvironment.exitOnEndSession,
        headlessEndMarker: this.context.runEnvironment.headlessEndMarker,
        // These are passed separately as they're not in RuntimeEnvironment
        ramFileSpec: this.context.actions.writeRAM ? this.context.actions.binFilename : '',
        flashFileSpec: this.context.actions.writeFlash ? this.context.actions.binFilename : ''
      }
    };

    try {
      fs.writeFileSync(contextFile, JSON.stringify(contextData, null, 2));
      this.context.logger.debugMsg(`Wrote context to: ${contextFile}`);
    } catch (error) {
      console.error('❌ Failed to write context file:', error);
      return 1;
    }

    // Pass the context file path to Electron
    // FOR DEBUG  const electronArgs = [electronMainPath, '--context', contextFile, '--trace-warnings'];
    const electronArgs = [electronMainPath, '--context', contextFile];

    this.context.logger.debugMsg(`Launching Electron with context file: ${contextFile}`);

    // Spawn Electron as a child process
    // IMPORTANT: Remove ELECTRON_RUN_AS_NODE so child runs as Electron GUI, not Node
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    // On macOS, pipe stderr so we can drop ONE benign upstream Electron/Chromium
    // log line — "SecCodeCheckValidity … codesign_util.cc … Code=-67062" — which
    // is cosmetic on newer macOS (it appears even for valid signatures; tracked
    // at electron/electron#49652). Everything else on stderr passes through
    // verbatim. Other platforms keep plain inherit (the line never appears there).
    const isMac = process.platform === 'darwin';

    return new Promise((resolve) => {
      const electronProcess = spawn(electronPath, electronArgs, {
        stdio: isMac ? ['inherit', 'inherit', 'pipe'] : 'inherit',
        detached: false,
        env: env // Use environment without ELECTRON_RUN_AS_NODE
      });

      if (isMac && electronProcess.stderr) {
        const CODESIGN_NOISE = /codesign_util\.cc/; // benign SecCodeCheckValidity -67062 on macOS
        let tail = ''; // hold a partial trailing line between chunks
        electronProcess.stderr.on('data', (chunk: Buffer) => {
          const lines = (tail + chunk.toString()).split('\n');
          tail = lines.pop() ?? '';
          for (const line of lines) {
            if (!CODESIGN_NOISE.test(line)) {
              process.stderr.write(`${line}\n`);
            }
          }
        });
        electronProcess.stderr.on('end', () => {
          if (tail.length > 0 && !CODESIGN_NOISE.test(tail)) {
            process.stderr.write(tail);
          }
        });
      }

      electronProcess.on('close', (code, signal) => {
        // Clean up the context file
        try {
          fs.unlinkSync(contextFile);
          this.context.logger.debugMsg(`Cleaned up context file: ${contextFile}`);
        } catch {}

        // The GUI's exit code IS this process's exit code — that is the whole
        // point of the unified map: a launching script branches on $? the same
        // way whether it ran headed or headless.
        //
        // A signal death has code === null. `code || 0` used to turn that into
        // a clean 0, i.e. the app being killed or crashing reported SUCCESS.
        // Report the shell's own convention instead (128 + signal number).
        if (code === null) {
          const signalExit: number = 128 + (os.constants.signals[signal as NodeJS.Signals] ?? 0);
          this.context.logger.debugMsg(`Electron process died on signal ${signal} (exit ${signalExit})`);
          resolve(signalExit);
        } else {
          this.context.logger.debugMsg(`Electron process exited with code: ${code}`);
          resolve(code);
        }
      });

      electronProcess.on('error', (error) => {
        console.error('❌ Failed to launch Electron:', error);
        // Clean up the context file
        try {
          fs.unlinkSync(contextFile);
        } catch {}
        resolve(ExitCode.PortError);
      });
    });
  }

  private findElectronExecutable(): string | null {
    // Debug output
    this.context.logger.debugMsg(`[ELECTRON FINDER] Looking for Electron executable...`);
    this.context.logger.debugMsg(`[ELECTRON FINDER] __dirname = ${__dirname}`);

    // Build list of possible paths
    const possiblePaths: string[] = [];

    // If we detected an app bundle, use that path first
    if (__dirname.includes('PNut-Term-TS.app')) {
      const appIndex = __dirname.indexOf('PNut-Term-TS.app');
      const appBundlePath = __dirname.substring(0, appIndex + 'PNut-Term-TS.app'.length);
      // Look for the standard Electron executable (not renamed)
      possiblePaths.push(
        path.join(appBundlePath, 'Contents', 'MacOS', 'Electron'), // Standard Electron name
        path.join(appBundlePath, 'Contents', 'MacOS', 'electron') // Lowercase variant
      );
      this.context.logger.debugMsg(`[ELECTRON FINDER] Detected app bundle at: ${appBundlePath}`);
    }

    // Add other possible locations
    possiblePaths.push(
      // macOS app bundle (when packaged) - relative path
      // From dist directory, go up to Resources/app/dist/../../../../MacOS/Electron
      path.join(__dirname, '..', '..', '..', '..', 'MacOS', 'Electron'),
      // Another macOS location if running from different path
      '/Applications/PNut-Term-TS.app/Contents/MacOS/Electron',
      // Windows packaged - from resources/app/dist up to package root
      // resources/app/dist -> resources/app -> resources -> root
      path.join(__dirname, '..', '..', '..', 'electron.exe'),
      // Linux packaged - from resources/app/dist up to package root
      // resources/app/dist -> resources/app -> resources -> root
      path.join(__dirname, '..', '..', '..', 'electron'),
      // Local node_modules
      path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
      // Global installation
      '/usr/local/bin/electron',
      '/usr/bin/electron',
      // Windows global
      path.join(process.env.APPDATA || '', 'npm', 'electron.cmd')
    );

    for (const electronPath of possiblePaths) {
      this.context.logger.debugMsg(`[ELECTRON FINDER] Checking: ${electronPath}`);
      if (fs.existsSync(electronPath)) {
        this.context.logger.debugMsg(`[ELECTRON FINDER] ✅ Found at: ${electronPath}`);
        return electronPath;
      }
    }

    // Try using 'which' command on Unix-like systems
    try {
      const { execSync } = require('child_process');
      const result = execSync('which electron', { encoding: 'utf-8' }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch {}

    return null;
  }

  private async runCommand(command: string): Promise<{ cmd: string; value: string | null; error: string | null }> {
    return new Promise((resolve) => {
      try {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            resolve({ cmd: command, value: null, error: error.message });
          }
          if (stderr) {
            resolve({ cmd: command, value: null, error: stderr });
          }
          resolve({ cmd: command, value: stdout.trim(), error: null });
        });
      } catch (error: unknown) {
        let excString: string = '?exc?';
        if (error instanceof Error) {
          excString = `Exception: ${error.name}-${error.message}`;
        } else {
          excString = `Exception: ${JSON.stringify(error)}`;
        }
        resolve({ cmd: command, value: null, error: excString });
      }
    });
  }
}

// --------------------------------------------------
// our actual command line tool when run stand-alone
//
// This is the ONE place the process's exit status is set, and every mode funnels
// through it: a validation abort returns its code from run(), headless returns
// HeadlessController.run()'s code, and headed returns the Electron child's exit
// code. run()'s return value used to be DISCARDED here, which silently made the
// entire documented exit-code contract (see src/utils/exitCodes.ts) inert — the
// shell saw 0 no matter what happened, including "Aborted!".
//
// We set process.exitCode rather than calling process.exit(): it lets Node
// finish flushing buffered stdout/stderr (which process.exit can truncate when
// output is piped — exactly how CI and agent runs consume us) and then exit with
// this status on its own.
const cliTool = new DebugTerminalInTypeScript();
cliTool
  .run()
  .then((exitCode: number) => {
    process.exitCode = Number.isInteger(exitCode) && exitCode >= 0 ? exitCode : ExitCode.PortError;
  })
  .catch((error: unknown) => {
    console.error(`PNut-Term-TS: unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = ExitCode.PortError;
  });
