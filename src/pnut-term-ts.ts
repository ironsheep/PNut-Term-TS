#!/usr/bin/env node
/* eslint-disable no-console */
/** @format */

// src/pnut-term-ts.ts
'use strict';
import { Command, CommanderError, type OptionValues } from 'commander';
import { Context } from './utils/context';
import path from 'path';
import { exec } from 'child_process';
import { UsbSerial } from './utils/usb.serial';
import { MainWindow } from './classes/mainWindow';
import { app, crashReporter } from 'electron';
import { getFormattedDateTime } from './utils/files';

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
  private version: string = '0.1.0';
  private argsArray: string[] = [];
  private context: Context;
  private shouldAbort: boolean = false;
  private inContainer: boolean = false;
  private requiresFilename: boolean = false;

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

    this.context = new Context();

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
      // FIXME: errors above on MacOS, need to disable GPU acceleration, and sandbox (what about windows?, linux?)
      crashReporter.start({ uploadToServer: false });
      console.error('PNut-Term-TS: Storing dumps inside: ', app.getPath('crashDumps'));
      // macOS this is problematic, disable hardware acceleration
      //if (!app.getGPUFeatureStatus().gpu_compositing.includes("enabled")) {
      app.disableHardwareAcceleration();
      //}

      // Disable network service sandbox
      app.commandLine.appendSwitch('no-sandbox');
    }
  }

  public setArgs(runArgs: string[]) {
    //console.log('runArgs: %o', runArgs);
    this.argsArray = runArgs;
    //DebugTerminalInTypeScript.isTesting = true;
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
      .usage('[optons]')
      .description(`PNut Terminal TS - v${this.version}`)
      .option('-f, --flash <fileSpec>', 'Download to FLASH and run')
      .option('-r, --ram <fileSpec>', 'Download to RAM and run')
      .option('-b, --debug(b)aud {rate}', 'set debug baud rate (default 2000000)')
      .option('-p, --plug <dvcNode>', 'Receive serial data from Propeller attached to <dvcNode>')
      .option('-n, --dvcnodes', 'List available USB PropPlug device (n)odes')
      .option('-l, --log <basename>', 'Specify .log file basename')
      .option('-d, --debug', 'Output Term-TS Debug messages')
      .option('-v, --verbose', 'Output Term-TS Verbose messages')
      .option('-q, --quiet', 'Quiet mode (suppress Term-TS banner and non-error text)')
      .option('--ide', 'IDE mode - minimal UI for VSCode/IDE integration');

    this.program.addHelpText('beforeAll', `$-`);

    this.program.addHelpText(
      'afterAll',
      `$-
      Example:
         $ pnut-term-ts -p P9cektn7                              # run using PropPlug on /dev/tty.usbserial-P9cektn7
         $ pnut-term-ts -l myApp -p P9cektn7                     # run and log to myApp-YYMMDD-HHmm.log
         $ pnut-term-ts -l topFile -p P9cektn7 -r myTopfile.bin  # download myTopfile.bin to RAM, run with logging to topFile-YYMMDD-HHmm.log
         `
    );

    //this.program.showHelpAfterError('(add --help for additional information)');

    this.program.exitOverride(); // throw instead of exit

    // condition our logger
    this.context.logger.setProgramName(this.program.name());

    // Combine process.argv with the modified this.argsArray
    const testArgsInterp = this.argsArray.length === 0 ? '[]' : this.argsArray.join(', ');

    const combinedArgs: string[] = process.argv;
    try {
      this.program.parse(combinedArgs);
    } catch (error: unknown) {
      if (error instanceof CommanderError) {
        //this.context.logger.logMessage(`XYZZY Error: name=[${error.name}], message=[${error.message}]`);
        if (error.name === 'CommanderError') {
          this.context.logger.logMessage(``); // our blank line so prompt is not too close after output
          //this.context.logger.logMessage(`  xyzxzy `);
          if (error.message !== '(outputHelp)') {
            this.context.logger.logMessage(`  (See --help for available options)\n`);
            //this.program.outputHelp();
          }
        } else {
          if (
            error.name != 'oe' &&
            error.name != 'Ee' &&
            error.name != 'CommanderError2' &&
            error.message != 'outputHelp' &&
            error.message != '(outputHelp)'
          ) {
            this.context.logger.logMessage(`Catch name=[${error.name}], message=[${error.message}]`);
            // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
            return Promise.resolve(-1);
          }
        }
      } else {
        this.context.logger.logMessage(`XYZZY Catch unknown error=[${error}]`);
        // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
        return Promise.resolve(-1);
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

    if (!options.quiet) {
      const signOnCompiler: string =
        "Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC., Parallax Inc.";
      this.context.logger.infoMsg(`* ${signOnCompiler}`);
      const signOnVersion: string = `Version ${this.version}, {buildDateHere}`;
      this.context.logger.infoMsg(`* ${signOnVersion}`);
      this.context.logger.logMessage(''); // blank line...
    }

    if ((!showingHelp && !options.quiet) || (showingHelp && options.verbose)) {
      let commandLine: string = `pnut-term-ts ${combinedArgs.slice(1).join(' ')}`;
      this.context.logger.infoMsg(`* ${commandLine}`);
      this.context.logger.infoMsg(
        `** process.argv=[${process.argv.join(', ')}], this.argsArray=[${testArgsInterp}] inContainer=[${
          this.inContainer
        }]`
      );
      console.log('- -------------------------------- -');
      console.log('arguments: %o', this.program.args);
      console.log('combArguments: %o', combinedArgs);
      console.log('options: %o', this.program.opts());
      console.log('- -------------------------------- -');
    }

    if (options.verbose) {
      this.context.logger.enabledVerbose();
    }

    if (options.debug) {
      this.context.logger.enabledDebug();
    }

    if (this.context.runEnvironment.developerModeEnabled) {
      this.context.logger.verboseMsg('PNUT_DEVELOP_MODE is enabled');
    }

    const showingNodeList: boolean = options.dvcnodes;

    if (options.flash && options.ram) {
      this.context.logger.errorMsg('Please use only one of FLASH or RAM options!');
      this.shouldAbort = true;
    }

    if (options.flash && !options.ram) {
      this.context.actions.writeFlash = true;
      this.requiresFilename = true;
      this.context.actions.binFilename = options.flash;
      this.context.logger.progressMsg(`Downloading [${this.context.actions.binFilename}] to FLASH`);
    }

    if (options.ram && !options.flash) {
      this.context.actions.writeRAM = true;
      this.requiresFilename = true;
      this.context.actions.binFilename = options.ram;
      this.context.logger.progressMsg(`Downloading [${this.context.actions.binFilename}] to RAM`);
    }

    if (this.shouldAbort == false) {
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
      /*
      this.runCommand('node -v').then((result) => {
        if (result.error) {
          this.context.logger.errorMsg(`${result.error}`);
        } else {
          this.context.logger.verboseMsg(`Node version: ${result.value}`);
          this.context.logger.verboseMsg(''); // blank line
        }
      });
      */
      const result = await this.runCommand('node -v');
      if (result.value !== null) {
        this.context.logger.verboseMsg(`Node version: ${result.value} (external)`);
      } else {
        // fake this for now...
        this.context.logger.verboseMsg(`Node version: v18.5.0 (built-in)`);
        /*
        const nodePath = process.execPath;
        this.context.logger.verboseMsg(`nodePath: [${nodePath}]`);
        result = await this.runCommand(`${nodePath} -v`);
        if (result.value !== null) {
          this.context.logger.verboseMsg(`Node version: ${result.value}`);
        } else {
          this.context.logger.verboseMsg(`CMD [${result.cmd}] FAIL: [${result.error}]`);
        }
        */
      }
      this.context.logger.verboseMsg(''); // blank line
    }

    if (!showingHelp) {
      try {
        await this.loadUsbPortsFound();
      } catch (error) {
        this.context.logger.errorMsg(`* loadUsbPortsFound() Exception: ${error}`);
        this.shouldAbort = true;
      }
    }

    if (showingNodeList) {
      for (let index = 0; index < this.context.runEnvironment.serialPortDevices.length; index++) {
        const dvcNode = this.context.runEnvironment.serialPortDevices[index];
        this.context.logger.progressMsg(` USB #${index + 1} [${dvcNode}]`);
      }
      if (this.context.runEnvironment.serialPortDevices.length == 0) {
        // no ports found
        this.context.logger.progressMsg(` USB  - no Serial Ports Found!`);
      }
    }

    if (options.plug) {
      // if port given on command line, use it!
      const foundPlug: string | undefined = this.context.runEnvironment.serialPortDevices.find((propPlug) =>
        propPlug.includes(options.plug)
      );
      if (foundPlug !== undefined) {
        this.context.runEnvironment.selectedPropPlug = foundPlug;
        //this.context.logger.verboseMsg(`* MATCHED USB  - ${foundPlug}!`);
      }
    }

    if (this.context.runEnvironment.serialPortDevices.length == 1) {
      // found only port, select it!
      this.context.runEnvironment.selectedPropPlug = this.context.runEnvironment.serialPortDevices[0];
    }

    let havePropPlug: boolean = false;
    if (this.context.runEnvironment.selectedPropPlug.length > 0) {
      // if a port was only or given on command line, show that we selected it
      this.context.logger.verboseMsg(`* using USB [${this.context.runEnvironment.selectedPropPlug}]`);
      havePropPlug = true;
    }

    if (options.log) {
      // generate log file basename
      const dateTimeStr: string = getFormattedDateTime();
      this.context.runEnvironment.logFilename = `${options.log}-${dateTimeStr}.log`;
      this.context.logger.verboseMsg(` * logging to [${this.context.runEnvironment.logFilename}]`);
    }

    const startMainWindow: boolean = !showingHelp && !showingNodeList && !this.shouldAbort;
    this.context.logger.debugMsg(
      `* showingHelp=(${showingHelp}), shouldAbort=(${this.shouldAbort}), startMainWindow=(${startMainWindow})`
    );

    let theTerminal: MainWindow | undefined = undefined;
    if (startMainWindow) {
      if (havePropPlug) {
        const propPlug: string = this.context.runEnvironment.selectedPropPlug;
        this.context.logger.verboseMsg(`* Loading terminal attached to [${propPlug}]`);
      }

      try {
        theTerminal = new MainWindow(this.context);
      } catch (error) {
        this.context.logger.errorMsg(`* new MainWindow() Exception: ${error}`);
        // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
        return Promise.resolve(-1);
      }

      try {
        await theTerminal.initialize();
      } catch (error) {
        this.context.logger.errorMsg(`* theTerminal.initialize() Exception: ${error}`);
        // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
        return Promise.resolve(-1);
      }
    }

    if (theTerminal !== undefined) {
      // Wait for the terminal to be done
      while (theTerminal.isDone() == false) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10,000 mSec = 10 seconds
      }
      this.context.logger.progressMsg('Terminal says done!');

      // and release the serial port
      theTerminal.close();
    }

    if ((!options.quiet && !showingHelp) || (showingHelp && options.verbose)) {
      if (this.shouldAbort) {
        this.context.logger.progressMsg('Aborted!');
      } else {
        this.context.logger.progressMsg('Done');
      }
    }
    app.exit(0);
    return Promise.resolve(0);
  }

  private async loadUsbPortsFound(): Promise<void> {
    const deviceNodes: string[] = await UsbSerial.serialDeviceList();
    this.context.runEnvironment.serialPortDevices = [];
    for (let index = 0; index < deviceNodes.length; index++) {
      const element: string = deviceNodes[index];
      const lineParts: string[] = element.split(',');
      this.context.runEnvironment.serialPortDevices.push(lineParts[0]);
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
//if (DebugTerminalInTypeScript.isTesting == false) {
const cliTool = new DebugTerminalInTypeScript();
cliTool.run();
//}
