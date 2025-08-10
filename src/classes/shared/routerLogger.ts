/** @format */

// src/classes/shared/routerLogger.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  routingTime?: number;
  windowId?: string;
  messageSize?: number;
}

/**
 * Routing performance metrics
 */
export interface PerformanceMetrics {
  routingTime: number;
  queueDepth: number;
  throughput: number; // messages/second
  bytesPerSecond: number;
  errorRate: number;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  console: boolean;
  file: boolean;
  filePath?: string;
  maxBufferSize: number;
  flushInterval: number; // milliseconds
  circularBufferSize: number;
}

/**
 * RouterLogger - High-performance logging for WindowRouter
 * 
 * This logger is designed specifically for the WindowRouter's needs:
 * - Never blocks routing operations
 * - Configurable log levels
 * - Circular buffer for recent messages
 * - Optional file output with buffering
 * - Performance metrics tracking
 * - Diagnostic dump functionality
 * 
 * The logger uses async writes and buffering to ensure routing
 * performance is never impacted by logging operations.
 */
export class RouterLogger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private circularBuffer: LogEntry[] = [];
  private circularIndex: number = 0;
  private fileStream: fs.WriteStream | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;
  
  // Performance tracking
  private metricsBuffer: PerformanceMetrics[] = [];
  private lastMetricsTime: number = 0;
  private messageCount: number = 0;
  private byteCount: number = 0;
  private errorCount: number = 0;
  
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      console: true,
      file: false,
      maxBufferSize: 1000,
      flushInterval: 100,
      circularBufferSize: 10000,
      ...config
    };
    
    // Check environment variables for configuration
    this.loadEnvironmentConfig();
    
    // Initialize file logging if enabled
    if (this.config.file) {
      this.initializeFileLogging();
    }
    
    // Start flush timer
    this.startFlushTimer();
    
    this.isEnabled = this.shouldLog(LogLevel.TRACE);
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentConfig(): void {
    // ROUTER_LOG_LEVEL: TRACE, DEBUG, INFO, WARN, ERROR
    const envLevel = process.env.ROUTER_LOG_LEVEL;
    if (envLevel) {
      const level = LogLevel[envLevel.toUpperCase() as keyof typeof LogLevel];
      if (level !== undefined) {
        this.config.level = level;
      }
    }
    
    // ROUTER_LOG_CONSOLE: true/false
    const envConsole = process.env.ROUTER_LOG_CONSOLE;
    if (envConsole !== undefined) {
      this.config.console = envConsole.toLowerCase() === 'true';
    }
    
    // ROUTER_LOG_FILE: true/false
    const envFile = process.env.ROUTER_LOG_FILE;
    if (envFile !== undefined) {
      this.config.file = envFile.toLowerCase() === 'true';
    }
    
    // ROUTER_LOG_PATH: file path
    const envPath = process.env.ROUTER_LOG_PATH;
    if (envPath) {
      this.config.filePath = envPath;
    }
  }

  /**
   * Initialize file logging
   */
  private initializeFileLogging(): void {
    const logDir = path.dirname(this.getLogFilePath());
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    this.fileStream = fs.createWriteStream(this.getLogFilePath(), { 
      flags: 'a',
      encoding: 'utf8'
    });
    
    this.fileStream.on('error', (error) => {
      console.error('RouterLogger: File stream error:', error);
      this.config.file = false; // Disable file logging on error
    });
  }

  /**
   * Get log file path
   */
  private getLogFilePath(): string {
    if (this.config.filePath) {
      return this.config.filePath;
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    return path.join(process.cwd(), 'logs', `router-${timestamp}.log`);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * Log a message at TRACE level
   */
  public trace(category: string, message: string, data?: any): void {
    this.log(LogLevel.TRACE, category, message, data);
  }

  /**
   * Log a message at DEBUG level
   */
  public debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Log a message at INFO level
   */
  public info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Log a message at WARN level
   */
  public warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * Log a message at ERROR level
   */
  public error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * Log a routing operation
   */
  public logRouting(windowId: string, messageType: string, size: number, routingTime: number): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    this.log(LogLevel.DEBUG, 'ROUTING', 
      `${messageType} -> ${windowId} (${size}B, ${routingTime.toFixed(2)}ms)`, {
        windowId,
        messageType,
        size,
        routingTime
      });
    
    // Update performance metrics
    this.messageCount++;
    this.byteCount += size;
  }

  /**
   * Log a performance metric
   */
  public logPerformance(metrics: PerformanceMetrics): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    this.log(LogLevel.INFO, 'PERFORMANCE', 
      `Routing: ${metrics.routingTime.toFixed(2)}ms, Queue: ${metrics.queueDepth}, ` +
      `Throughput: ${metrics.throughput.toFixed(1)} msg/s, ${(metrics.bytesPerSecond / 1024).toFixed(1)} KB/s`, 
      metrics);
    
    // Store in metrics buffer
    this.metricsBuffer.push(metrics);
    if (this.metricsBuffer.length > 100) {
      this.metricsBuffer.shift();
    }
  }

  /**
   * Log an error
   */
  public logError(category: string, error: Error, context?: any): void {
    this.errorCount++;
    this.log(LogLevel.ERROR, category, error.message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data
    };
    
    // Add to circular buffer (always, for debugging)
    this.addToCircularBuffer(entry);
    
    // Add to main buffer for output
    this.buffer.push(entry);
    
    // Immediate console output for high-priority messages
    if (level >= LogLevel.WARN && this.config.console) {
      this.outputToConsole(entry);
    }
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.maxBufferSize) {
      setImmediate(() => this.flushBuffer());
    }
  }

  /**
   * Add entry to circular buffer
   */
  private addToCircularBuffer(entry: LogEntry): void {
    this.circularBuffer[this.circularIndex] = entry;
    this.circularIndex = (this.circularIndex + 1) % this.config.circularBufferSize;
  }

  /**
   * Output entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level].padEnd(5);
    const message = `${timestamp} [${levelName}] ${entry.category}: ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(message, entry.data || '');
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(message, entry.data || '');
        break;
    }
  }

  /**
   * Flush buffer to outputs
   */
  private flushBuffer(): void {
    if (this.buffer.length === 0) return;
    
    const entries = this.buffer.splice(0); // Clear buffer atomically
    
    // Console output (if not already output)
    if (this.config.console) {
      for (const entry of entries) {
        if (entry.level < LogLevel.WARN) { // High-priority already output
          this.outputToConsole(entry);
        }
      }
    }
    
    // File output
    if (this.config.file && this.fileStream && this.fileStream.writable) {
      for (const entry of entries) {
        const line = this.formatLogLine(entry);
        this.fileStream.write(line + '\n');
      }
    }
  }

  /**
   * Format log entry for file output
   */
  private formatLogLine(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level].padEnd(5);
    let line = `${timestamp} [${levelName}] ${entry.category}: ${entry.message}`;
    
    if (entry.data) {
      try {
        line += ' | ' + JSON.stringify(entry.data);
      } catch (error) {
        line += ' | [Unserializable data]';
      }
    }
    
    return line;
  }

  /**
   * Get recent log entries from circular buffer
   */
  public getRecentEntries(count?: number): LogEntry[] {
    const maxCount = count || this.config.circularBufferSize;
    const entries: LogEntry[] = [];
    
    // Start from oldest entry in circular buffer
    let index = this.circularIndex;
    for (let i = 0; i < Math.min(maxCount, this.config.circularBufferSize); i++) {
      const entry = this.circularBuffer[index];
      if (entry) {
        entries.push(entry);
      }
      index = (index + 1) % this.config.circularBufferSize;
    }
    
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate diagnostic dump
   */
  public generateDiagnosticDump(): string {
    const dump = {
      timestamp: new Date().toISOString(),
      config: this.config,
      statistics: {
        totalMessages: this.messageCount,
        totalBytes: this.byteCount,
        totalErrors: this.errorCount,
        bufferSize: this.buffer.length,
        circularBufferUsage: this.circularIndex
      },
      recentMetrics: this.metricsBuffer.slice(-10),
      recentEntries: this.getRecentEntries(50)
    };
    
    return JSON.stringify(dump, null, 2);
  }

  /**
   * Save diagnostic dump to file
   */
  public saveDiagnosticDump(filePath?: string): string {
    const dump = this.generateDiagnosticDump();
    const outputPath = filePath || path.join(process.cwd(), 'logs', `router-diagnostic-${Date.now()}.json`);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, dump, 'utf8');
    return outputPath;
  }

  /**
   * Get current statistics
   */
  public getStatistics(): any {
    return {
      totalMessages: this.messageCount,
      totalBytes: this.byteCount,
      totalErrors: this.errorCount,
      bufferSize: this.buffer.length,
      circularBufferUsage: this.circularIndex,
      averageMetrics: this.calculateAverageMetrics(),
      isEnabled: this.isEnabled,
      config: { ...this.config }
    };
  }

  /**
   * Calculate average metrics
   */
  private calculateAverageMetrics(): any {
    if (this.metricsBuffer.length === 0) {
      return null;
    }
    
    const sum = this.metricsBuffer.reduce((acc, metrics) => ({
      routingTime: acc.routingTime + metrics.routingTime,
      queueDepth: acc.queueDepth + metrics.queueDepth,
      throughput: acc.throughput + metrics.throughput,
      bytesPerSecond: acc.bytesPerSecond + metrics.bytesPerSecond,
      errorRate: acc.errorRate + metrics.errorRate
    }), { routingTime: 0, queueDepth: 0, throughput: 0, bytesPerSecond: 0, errorRate: 0 });
    
    const count = this.metricsBuffer.length;
    return {
      routingTime: sum.routingTime / count,
      queueDepth: sum.queueDepth / count,
      throughput: sum.throughput / count,
      bytesPerSecond: sum.bytesPerSecond / count,
      errorRate: sum.errorRate / count
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize file logging if needed
    if (!oldConfig.file && this.config.file) {
      this.initializeFileLogging();
    } else if (oldConfig.file && !this.config.file && this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
    
    this.isEnabled = this.shouldLog(LogLevel.TRACE);
  }

  /**
   * Cleanup and close logger
   */
  public destroy(): void {
    // Flush remaining buffer
    this.flushBuffer();
    
    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Close file stream
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
    
    // Clear buffers
    this.buffer = [];
    this.circularBuffer = [];
    this.metricsBuffer = [];
  }
}