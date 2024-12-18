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

export class PNutInTypeScript {
  private readonly program = new Command();
  //static isTesting: boolean = false;
  private options: OptionValues = this.program.opts();
  private version: string = "0.0.1";
  private argsArray: string[] = [];
  private context: Context;
  private shouldAbort: boolean = false;
  private requiresFilename: boolean = false;

  constructor(argsOverride?: string[]) {
    //console.log(`PNut-TermDebug-TS: argsOverride=[${argsOverride}]`);
    if (argsOverride !== undefined) {
      this.argsArray = argsOverride;
      //PNutInTypeScript.isTesting = true;
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
    //PNutInTypeScript.isTesting = true;
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
      .usage("[optons] filename")
      .description(`Serial Debug Terminal - v${this.version}`)
      .arguments("[filename]")
      .action((filename: string) => {
        this.options.filename = filename;
      })
      .option("-d, --debug", "Compile with DEBUG")
      .option("-l, --list", "Generate listing files (.lst) from compilation")
      .option(
        "-p, --plug <dvcNode>",
        "download to/flash Propeller attached to <dvcNode>"
      )
      .option("-n, --dvcnodes", "List available USB PropPlug device (n)odes")
      .option("-v, --verbose", "Output verbose messages")
      .option("-o, --output <name>", "Specify output file basename")
      .option("-q, --quiet", "Quiet mode (suppress banner and non-error text)")
      .addOption(
        new Option("--log <objectName...>", "objectName").choices([
          "all",
          "outline",
          "compiler",
          "elementizer",
          "parser",
          "distiller",
          "preproc",
          "resolver",
        ])
      );

    this.program.addHelpText("beforeAll", `$-`);

    this.program.addHelpText(
      "afterAll",
      `$-
      Example:
         $ pnut-termdebug-ts my-top-level.spin2         # compile leaving .bin file
         $ pnut-termdebug-ts -l my-top-level.spin2      # compile file leaving .bin and .lst files
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

    //this.context.logger.progressMsg(`after parse()`);
    //console.log('arguments: %o', this.program.args);  // should be just filespec to compile
    //console.log('combArguments: %o', combinedArgs);
    //console.log('options: %o', this.program.opts());

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

    if (this.options.dvcnodes) {
      this.loadUsbPortsFound();
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
      } else if (this.context.runEnvironment.serialPortDevices.length == 1) {
        // found only port, select it!
        this.context.runEnvironment.selectedPropPlug =
          this.context.runEnvironment.serialPortDevices[0];
      }
    }

    if (this.options.plug) {
      // if port given on command line, use it!
      this.context.runEnvironment.selectedPropPlug = this.options.plug;
    }

    if (this.context.runEnvironment.selectedPropPlug.length > 0) {
      // if a port was only or given on command line, show that we selected it
      this.context.logger.verboseMsg(
        `* using USB [${this.context.runEnvironment.selectedPropPlug}]`
      );
    } else {
      this.shouldAbort = true;
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

    if (this.options.filename === undefined) {
      let needAbort: boolean = false;
      for (let index = 0; index < combinedArgs.length; index++) {
        if (
          combinedArgs[index].length > 0 &&
          combinedArgs[index].toLowerCase().endsWith(".spin2")
        ) {
          if (this.options.filename === undefined) {
            this.options.filename = combinedArgs[index];
          } else {
            this.context.logger.errorMsg(
              "Compiling more than one .spin2 files at a time, not supported!"
            );
            needAbort = true;
            break;
          }
        }
      }
      if (needAbort) {
        return Promise.resolve(-1);
      }
    }

    if (this.options.log) {
      // forward our LOG Options
      this.requiresFilename = true;
      const choices: string[] = this.options.log;
      this.context.logger.verboseMsg("MODE: Logging:");
      //this.context.logger.verboseMsg(`* log: [${choices}]`);
      const wantsAll: boolean = choices.includes("all");
      if (choices.includes("outline") || wantsAll) {
        this.context.logOptions.logOutline = true;
        this.context.logger.verboseMsg("  Outline");
      }
      if (choices.includes("distiller") || wantsAll) {
        this.context.logOptions.logDistiller = true;
        this.context.logger.verboseMsg("  Distiller");
      }
      if (choices.includes("elementizer") || wantsAll) {
        this.context.logOptions.logElementizer = true;
        this.context.logger.verboseMsg("  Elementizer");
      }
      if (choices.includes("parser") || wantsAll) {
        this.context.logOptions.logParser = true;
        this.context.logger.verboseMsg("  Parser");
      }
      if (choices.includes("compiler") || wantsAll) {
        this.context.logOptions.logCompile = true;
        this.context.logger.verboseMsg("  Compile");
      }
      if (choices.includes("resolver") || wantsAll) {
        this.context.logOptions.logResolver = true;
        this.context.logger.verboseMsg("  Resolver");
      }
      if (choices.includes("preproc")) {
        this.context.logOptions.logPreprocessor = true;
        this.context.logger.verboseMsg("  PreProcessor");
      }
    }

    if (this.options.output) {
      // forward our Output Filename
      const outFilename = this.options.output;
      //this.context.compileOptions.outputFilename = outFilename;
      this.context.logger.verboseMsg(
        `* Override output filename, now [${outFilename}]`
      );
    }

    /*
    if (this.options.both) {
      this.context.logger.verboseMsg('have BOTH: enabling FLASH and DEBUG');
      this.options.debug = true;
      this.options.flash = true;
      this.options.ram = false;
    }*/

    if (this.options.debug) {
      this.context.logger.progressMsg("Compiling with DEBUG");
      //this.context.compileOptions.enableDebug = true;
      this.requiresFilename = true;
    }

    if (this.options.flash) {
      this.context.logger.progressMsg("Downloading to FLASH");
      //this.context.compileOptions.writeFlash = true;
      this.requiresFilename = true;
    }

    /*
    if (this.options.ram) {
      this.context.logger.progressMsg('Downloading to RAM');
      this.context.compileOptions.writeRAM = true;
      this.requiresFilename = true;
    }

    if (this.options.ram && this.options.flash) {
      //this.program.error('Please only use one of -f and -r');
      this.context.logger.errorMsg('Please only use one of -f and -r');
      this.shouldAbort = true;
    }*/

    //if (this.options.compile) {
    // ALWAYS SET THIS until we have a built-in flasher
    if (!showingHelp) {
      if (
        (foundJest || runningCoverageTesting) &&
        this.options.filename === undefined
      ) {
        // we don't handle this!
        this.requiresFilename = false;
        //this.context.compileOptions.compile = false;
      } else {
        this.requiresFilename = true;
        //this.context.compileOptions.compile = true;
      }
    }
    //}

    let filename: string | undefined = this.options.filename;
    if (filename !== undefined && filename.endsWith(".json")) {
      // we don't handle .json files if presented
      filename = undefined;
    }

    if (!this.options.verbose && !this.options.quiet && !showingHelp) {
      console.log("arguments: %o", this.program.args);
      console.log("combArguments: %o", combinedArgs);
      console.log("options: %o", this.program.opts());
    }

    if (this.shouldAbort == false) {
      this.context.logger.verboseMsg(""); // blank line
      this.context.logger.verboseMsg(
        `ext dir [${this.context.extensionFolder}]`
      );
      this.context.logger.verboseMsg(`lib dir [${this.context.libraryFolder}]`);
      this.context.logger.verboseMsg(`wkg dir [${this.context.currentFolder}]`);
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
    }

    let theTerminal: DebugTerminal | undefined = undefined;
    if (!this.shouldAbort && !showingHelp) {
      const propPlug: string = this.context.runEnvironment.selectedPropPlug;
      this.context.logger.verboseMsg(
        `Loading terminal attached to [${propPlug}]`
      );
      try {
        theTerminal = new DebugTerminal(this.context, propPlug);
      } catch (error) {
        this.context.logger.errorMsg(`Create Terminal failed: ${error}`);
        // Instead of throwing, return a resolved Promise with a specific value, e.g., -1
        return Promise.resolve(-1);
      }
    }
    if (theTerminal !== undefined) {
      while (theTerminal.isDone() == false) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10,000 mSec = 10 seconds
      }
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
    this.context.runEnvironment.serialPortDevices = deviceNodes;
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
//if (PNutInTypeScript.isTesting == false) {
const cliTool = new PNutInTypeScript();
cliTool.run();
//}
