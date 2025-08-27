/** @format */

// this is our common logging mechanism
//  Now context/runtime option aware

"use strict";
// src/classes/logger.ts

import { Context } from '../utils/context';

export class Logger {
  private verboseEnabled: boolean = false;
  private debugEnabled: boolean = false;
  private programName: string = "{notSet}";
  private context: Context | undefined;

  public setContext(context: Context) {
    this.context = context;
  }

  public setProgramName(name: string) {
    this.programName = name;
  }

  private shouldLog(level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE'): boolean {
    if (!this.context || !this.context.runEnvironment.loggingEnabled) {
      return level === 'ERROR'; // Always log errors
    }
    
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    const configuredLevel = this.context.runEnvironment.loggingLevel;
    const configuredIndex = levels.indexOf(configuredLevel);
    const requestedIndex = levels.indexOf(level);
    
    return requestedIndex <= configuredIndex;
  }

  public enabledVerbose() {
    this.progressMsg("Verbose output is enabled");
    this.verboseEnabled = true;
  }

  public enabledDebug() {
    this.progressMsg("Debug output is enabled");
    this.debugEnabled = true;
  }

  public errorMsg(message: string | unknown) {
    if (this.shouldLog('ERROR')) {
      const redMessage: string = this.errorColor(message);
      this.logErrorMessage(`${this.programName}: ERROR- ${redMessage}`);
    }
  }

  public compilerErrorMsg(message: string, underTest: boolean = false) {
    if (typeof message !== "string") {
      this.logMessage(`* compilerErrorMsg() - message is ${typeof message}`);
    }
    const redMessage: string = underTest ? message : this.errorColor(message);
    if (typeof redMessage !== "string") {
      this.logMessage(
        `* compilerErrorMsg() - redMessage is ${typeof redMessage}`
      );
    }
    this.logErrorMessage(`${redMessage}`);
  }

  public verboseMsg(message: string): void {
    if (this.verboseEnabled && this.shouldLog('DEBUG')) {
      if (message.length == 0) {
        this.logMessage(``); // blank line
      } else {
        this.logMessage(`${this.programName}: Verbose- ${message}`);
      }
    }
  }

  public debugMsg(message: string): void {
    if (this.debugEnabled && this.shouldLog('DEBUG')) {
      if (message.length == 0) {
        this.logMessage(``); // blank line
      } else {
        this.logMessage(`${this.programName} (DBG): ${message}`);
      }
    }
  }

  public infoMsg(message: string): void {
    if (this.shouldLog('INFO')) {
      this.logMessage(`${this.programName}: ${message}`);
    }
  }

  public warningMsg(message: string): void {
    if (this.shouldLog('WARN')) {
      const yellowMessage: string = this.warningColor(message);
      this.logErrorMessage(`${this.programName}: WARNING- ${yellowMessage}`);
    }
  }

  public progressMsg(message: string): void {
    if (this.shouldLog('INFO')) {
      this.logMessage(`${this.programName}: ${message}`);
    }
  }

  private errorColor(str: string | unknown): string {
    // Add ANSI escape codes to display text in red.
    return `\x1b[31m${str}\x1b[0m`;
  }

  private warningColor(str: string | unknown): string {
    // Add ANSI escape codes to display text in yellow.
    return `\x1b[33m${str}\x1b[0m`;
  }

  /**
   * Write message to stdout with trailing CRLF
   *
   * @param {string} message
   * @memberof Logger
   */
  public logMessage(message: string) {
    // Only log if context is not set, or if logging is enabled
    if (!this.context || this.context.runEnvironment.loggingEnabled) {
      if (!this.context || this.context.runEnvironment.logToConsole) {
        process.stdout.write(`${message}\r\n`);
      }
      // TODO: Add file logging support when logToFile is true
    }
  }
  /**
   * Write message to stderr with trailing CRLF
   *
   * @param {string} message
   * @memberof Logger
   */
  public logErrorMessage(message: string) {
    if (typeof message !== "string") {
      this.logMessage(`* logErrorMessage() - message is ${typeof message}`);
    }
    // Errors should always be logged regardless of logging settings
    process.stderr.write(`${message}\r\n`);
  }

  /**
   * Force write message to stdout with trailing CRLF, bypassing all logging flags
   * Used for system startup messages that should always appear in console
   *
   * @param {string} message
   * @memberof Logger
   */
  public forceLogMessage(message: string) {
    if (typeof message !== "string") {
      process.stdout.write(`* forceLogMessage() - message is ${typeof message}\r\n`);
      return;
    }
    // System messages should always be logged to console regardless of settings
    process.stdout.write(`${message}\r\n`);
  }
}
