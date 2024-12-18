/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

// Common runtime context shares by classes in Pnut-TS.

// src/utils/context.ts

"use strict";
import fs from "fs";
import path from "path";
import { Logger } from "../classes/logger";

export interface RuntimeEnvironment {
  serialPortDevices: string[];
  selectedPropPlug: string;
  developerModeEnabled: boolean;
}
export interface LogOptions {
  logElementizer: boolean; // write elementizer log
  logParser: boolean; // write parser log
  logResolver: boolean; // write resolver log
  logPreprocessor: boolean; // write preprocessor log
  logCompile: boolean;
  logOutline: boolean; // write overview of operation log
  logDistiller: boolean; // write distiller log
}

export function logContextState(ctx: Context, callerId: string) {
  ctx.logger.logMessage("");
  ctx.logger.logMessage(`LogCtx requested by ${callerId}:`);
  const logCompile: boolean = ctx.logOptions.logCompile;
  ctx.logger.logMessage(`  LogCtx: logCompile=(${logCompile})`);
  const logElementizer: boolean = ctx.logOptions.logElementizer;
  ctx.logger.logMessage(`  LogCtx: logElementizer=(${logElementizer})`);
  const logParser: boolean = ctx.logOptions.logParser;
  ctx.logger.logMessage(`  LogCtx: logParser=(${logParser})`);
  const logPreprocessor: boolean = ctx.logOptions.logPreprocessor;
  ctx.logger.logMessage(`  LogCtx: logPreprocessor=(${logPreprocessor})`);
  const logResolver: boolean = ctx.logOptions.logResolver;
  ctx.logger.logMessage(`  LogCtx: logResolver=(${logResolver})`);
}

export class Context {
  public libraryFolder: string;
  public extensionFolder: string;
  public currentFolder: string;
  public logger: Logger;
  public logOptions: LogOptions;
  public runEnvironment: RuntimeEnvironment;

  constructor() {
    this.logOptions = {
      logElementizer: false,
      logParser: false,
      logResolver: false,
      logPreprocessor: false,
      logCompile: false,
      logOutline: false,
      logDistiller: false,
    };
    this.runEnvironment = {
      selectedPropPlug: "",
      serialPortDevices: [],
      developerModeEnabled: false,
    };
    let possiblePath = path.join(__dirname, "../lib");
    if (!fs.existsSync(possiblePath)) {
      possiblePath = path.join(__dirname, "lib");
    }
    this.libraryFolder = possiblePath;
    possiblePath = path.join(__dirname, "../ext");
    if (!fs.existsSync(possiblePath)) {
      possiblePath = path.join(__dirname, "ext");
    }
    this.extensionFolder = possiblePath;
    this.currentFolder = process.cwd();
    this.logger = new Logger();
  }
}
