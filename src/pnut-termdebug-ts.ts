#!/usr/bin/env node
/* eslint-disable no-console */
/** @format */

// src/pnut-termdebug-ts.ts
"use strict";
import { Command, Option, CommanderError, type OptionValues } from "commander";
import { Context } from "./utils/context";
import path from "path";
import { exec } from "child_process";
import { UsbSerial } from "./utils/usb.serial";
import { DebugTerminal } from "./classes/debugTerminal";

// NOTEs re-stdio in js/ts
// REF https://blog.logrocket.com/using-stdout-stdin-stderr-node-js/

// expose our installation path
// REF: https://stackoverflow.com/questions/32944714/best-way-to-find-the-location-of-a-specific-file-within-a-node-dependency
// can then get by:
//  var assets = require('foo');
//  fs.readFile(assets.root + '/bar.png', function(){/*whatever*/});
export const root: string = __dirname;

export class DebugTerminalInTypeScript {
  private readonly program = new Command();
  //static isTesting: boolean = false;
  private options: OptionValues = this.program.opts();
  private version: string = "0.0.1";
  private argsArray: string[] = [];
  private context: Context;
  private shouldAbort: boolean = false;

  constructor(argsOverride?: string[]) {
    //console.log(`PNut-TermDebug-TS: argsOverride=[${argsOverride}]`);
    if (argsOverride !== undefined) {
      this.argsArray = argsOverride;
      //DebugTerminalInTypeScript.isTesting = true;
    }

    if (process.stdin.isTTY) {
      console.log("No input provided. Use --help for usage.");
    } else {
      let inputData = "";

      process.stdin.on("data", (chunk) => {
        inputData += chunk;
      });

      process.stdin.on("end", () => {
        console.log(`Received input: ${inputData}`);

        // Process input and optionally open an Electron window
        //createWindow();
      });
    }

    process.stdout.on("error", (error: Error) => {
      console.error(
        `PNut-TermDebug-TS: An error occurred on stdout: "${error.message}", Aborting.`
      );
      process.exit(1);
    });

    process.stderr.on("error", (error: Error) => {
      console.error(
        `PNut-TermDebug-TS: An error occurred on stderr: "${error.message}", Aborting.`
      );
      process.exit(1);
    });
    process.stdout.on("close", () => {
      console.log("PNut-TermDebug-TS: stdout was closed");
    });

    process.stderr.on("close", () => {
      console.log("PNut-TermDebug-TS: stderr was closed");
    });

    this.context = new Context();
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
        outputError: (str, write) => write(this.errorColor(str)),
      })
      .name("pnut-termdebug-ts")
      .version(`v${this.version}`, "-V, --version", "Output the version number")
      //.version(`v${this.version}`)
      .usage("[optons]")
      .description(`Serial Debug Terminal - v${this.version}`)
      .action((filename: string) => {
        this.options.filename = filename;
      })
      .option("-d, --debug", "Compile with DEBUG")
      .option(
        "-p, --plug <dvcNode>",
        "Receive serial data from Propeller attached to <dvcNode>"
      )
      .option("-n, --dvcnodes", "List available USB PropPlug device (n)odes")
      .option("-v, --verbose", "Output verbose messages")
      .option("-l, --log <basename>", "Specify .log file basename")
      .option("-q, --quiet", "Quiet mode (suppress banner and non-error text)");

    this.program.addHelpText("beforeAll", `$-`);

    this.program.addHelpText(
      "afterAll",
      `$-
      Example:
         $ pnut-termdebug-ts -p P9cektn7           # run using PropPlug on /dev/tty.usbserial-P9cektn7
         $ pnut-termdebug-ts -l myApp -p P9cektn7  # run and log to myApp-YYMMDD-HHmm.log
         `
    );

    //this.program.showHelpAfterError('(add --help for additional information)');

    this.program.exitOverride(); // throw instead of exit

    this.context.logger.setProgramName(this.program.name());

    // Combine process.argv with the modified this.argsArray
    //const testArgsInterp = this.argsArray.length === 0 ? '[]' : this.argsArray.join(', ');
    //this.context.logger.progressMsg(`** process.argv=[${process.argv.join(', ')}], this.argsArray=[${testArgsInterp}]`);
    let processArgv: string[] = process.argv;
    const runningCoverageTesting: boolean =
      processArgv.includes("--coverage") ||
      path.basename(processArgv[1]) == "processChild.js";
    const foundJest: boolean = path.basename(processArgv[1]) == "jest";
    if (foundJest && !runningCoverageTesting) {
      processArgv = processArgv.slice(0, 2);
    }
    const combinedArgs: string[] =
      this.argsArray.length == 0
        ? processArgv
        : [...processArgv, ...this.argsArray.slice(2)];
    //console.log(`DBG: combinedArgs=[${combinedArgs}](${combinedArgs.length})`);

    //if (!runningCoverageTesting) {
    //}
    //const GAHrunAsCoverageBUG: boolean = combinedArgs.includes('/workspaces/PNut-TermDebug-TS/node_modules/.bin/jest');
    /*
    if (combinedArgs.includes('/workspaces/PNut-TermDebug-TS/node_modules/.bin/jest')) {
      //console.error(`ABORT pnut-termdebug-ts.js run as jest coverage`);
      return 0;
      //process.exit(0);
    }
    //*/
    try {
      this.program.parse(combinedArgs);
    } catch (error: unknown) {
      if (error instanceof CommanderError) {
        //this.context.logger.logMessage(`XYZZY Error: name=[${error.name}], message=[${error.message}]`);
        if (error.name === "CommanderError") {
          this.context.logger.logMessage(``); // our blank line so prompt is not too close after output
          //this.context.logger.logMessage(`  xyzxzy `);
          if (error.message !== "(outputHelp)") {
            this.context.logger.logMessage(
              `  (See --help for available options)\n`
            );
            //this.program.outputHelp();
          }
        } else {
          if (
            error.name != "oe" &&
            error.name != "Ee" &&
            error.name != "CommanderError2" &&
            error.message != "outputHelp" &&
            error.message != "(outputHelp)"
          ) {
            this.context.logger.logMessage(
              `Catch name=[${error.name}], message=[${error.message}]`
            );
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

    if (this.context.runEnvironment.developerModeEnabled) {
      this.context.logger.verboseMsg("PNUT_DEVELOP_MODE is enabled");
    }

    //this.context.logger.progressMsg(`** RUN WITH ARGV=[${combinedArgs.join(', ')}]`);
    if (!foundJest && runningCoverageTesting) {
      //this.context.reportOptions.coverageTesting = true;
    }

    this.options = { ...this.options, ...this.program.opts() };

    const showingHelp: boolean =
      this.program.args.includes("--help") || this.program.args.includes("-h");

    if (!showingHelp) {
      if (foundJest || runningCoverageTesting) {
        this.context.logger.progressMsg(
          `(DBG) foundJest=(${foundJest}), runningCoverageTesting=(${runningCoverageTesting})`
        );
      }
    }

    if (this.options.verbose) {
      this.context.logger.enabledVerbose();
    }

    if (!this.options.quiet && !foundJest && !runningCoverageTesting) {
      const signOnCompiler: string =
        "Propeller Debug Terminal 'pnut-termdebug-ts' (c) 2024 Iron Sheep Productions, LLC., Parallax Inc.";
      this.context.logger.infoMsg(`* ${signOnCompiler}`);
      const signOnVersion: string = `Version ${this.version}, {buildDateHere}`;
      this.context.logger.infoMsg(`* ${signOnVersion}`);
    }

    if (!this.options.quiet && !showingHelp) {
      let commandLine: string;
      if (
        (foundJest || runningCoverageTesting) &&
        this.argsArray.length === 0
      ) {
        commandLine = `pnut-termdebug-ts -- pre-run, IGNORED --`;
      } else {
        commandLine = `pnut-termdebug-ts ${combinedArgs.slice(2).join(" ")}`;
      }
      this.context.logger.infoMsg(`* ${commandLine}`);
    }

    if (!this.options.verbose && !this.options.quiet && !showingHelp) {
      console.log("arguments: %o", this.program.args);
      console.log("combArguments: %o", combinedArgs);
      console.log("options: %o", this.program.opts());
    }

    if (this.shouldAbort == false) {
      this.context.logger.verboseMsg(""); // blank line
      let enclosingFolder: string = path.dirname(this.context.currentFolder);
      //enclosingFolder = path.dirname(enclosingFolder);
      this.context.logger.verboseMsg(`wkg dir [${enclosingFolder}]`);
      this.context.logger.verboseMsg(
        `ext dir [~${this.context.extensionFolder.replace(
          enclosingFolder,
          ""
        )}]`
      );
      this.context.logger.verboseMsg(
        `lib dir [~${this.context.libraryFolder.replace(enclosingFolder, "")}]`
      );
      this.context.logger.verboseMsg(""); // blank line
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
      const result = await this.runCommand("node -v");
      if (result.value !== null) {
        this.context.logger.verboseMsg(
          `Node version: ${result.value} (external)`
        );
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
      this.context.logger.verboseMsg(""); // blank line
    }

    if (!showingHelp) {
      await this.loadUsbPortsFound();
    }

    if (this.options.dvcnodes) {
      for (
        let index = 0;
        index < this.context.runEnvironment.serialPortDevices.length;
        index++
      ) {
        const dvcNode = this.context.runEnvironment.serialPortDevices[index];
        this.context.logger.progressMsg(` USB #${index + 1} [${dvcNode}]`);
      }
      if (this.context.runEnvironment.serialPortDevices.length == 0) {
        // no ports found
        this.context.logger.progressMsg(` USB  - no Serial Ports Found!`);
      }
    }

    if (this.options.plug) {
      // if port given on command line, use it!
      const foundPlug: string | undefined =
        this.context.runEnvironment.serialPortDevices.find((propPlug) =>
          propPlug.includes(this.options.plug)
        );
      if (foundPlug !== undefined) {
        this.context.runEnvironment.selectedPropPlug = foundPlug;
        //this.context.logger.verboseMsg(`* MATCHED USB  - ${foundPlug}!`);
      }
    }

    if (this.context.runEnvironment.serialPortDevices.length == 1) {
      // found only port, select it!
      this.context.runEnvironment.selectedPropPlug =
        this.context.runEnvironment.serialPortDevices[0];
    }

    if (this.context.runEnvironment.selectedPropPlug.length > 0) {
      // if a port was only or given on command line, show that we selected it
      this.context.logger.verboseMsg(
        `* using USB [${this.context.runEnvironment.selectedPropPlug}]`
      );
    } else if (!this.options.dvcnodes) {
      this.shouldAbort = true;
    }

    if (this.options.log) {
      // generate log file basename
    }

    let theTerminal: DebugTerminal | undefined = undefined;
    if (!this.shouldAbort && !showingHelp && !this.options.dvcnodes) {
      const propPlug: string = this.context.runEnvironment.selectedPropPlug;
      this.context.logger.verboseMsg(
        `* Loading terminal attached to [${propPlug}]`
      );

      try {
        theTerminal = new DebugTerminal(this.context);
      } catch (error) {
        this.context.logger.errorMsg(
          `* new DebugTerminal() Exception: ${error}`
        );
        // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
        return Promise.resolve(-1);
      }

      try {
        await theTerminal.initialize();
      } catch (error) {
        this.context.logger.errorMsg(
          `* theTerminal.initialize() Exception: ${error}`
        );
        // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
        return Promise.resolve(-1);
      }
    }

    if (theTerminal !== undefined) {
      // Wait for the terminal to be done
      while (theTerminal.isDone() == false) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10,000 mSec = 10 seconds
      }

      // and rlease the serial port
      theTerminal.close();
    }

    if (!this.options.quiet && !showingHelp) {
      if (this.shouldAbort) {
        this.context.logger.progressMsg("Aborted!");
      } else {
        this.context.logger.progressMsg("Done");
      }
    }
    return Promise.resolve(0);
  }

  private async loadUsbPortsFound(): Promise<void> {
    const deviceNodes: string[] = await UsbSerial.serialDeviceList();
    this.context.runEnvironment.serialPortDevices = [];
    for (let index = 0; index < deviceNodes.length; index++) {
      const element: string = deviceNodes[index];
      const lineParts: string[] = element.split(",");
      this.context.runEnvironment.serialPortDevices.push(lineParts[0]);
    }
  }

  private errorColor(str: string): string {
    // Add ANSI escape codes to display text in red.
    return `\x1b[31m${str}\x1b[0m`;
  }

  private prefixName(str: string): string {
    if (str.startsWith("$-")) {
      return `${str.substring(2)}`;
    } else {
      return `PNut-TermDebug-TS: ${str}`;
    }
  }

  private async runCommand(
    command: string
  ): Promise<{ cmd: string; value: string | null; error: string | null }> {
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
        let excString: string = "?exc?";
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
