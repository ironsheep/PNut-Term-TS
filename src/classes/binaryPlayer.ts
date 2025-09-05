import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

interface PlaybackEntry {
  deltaMs: number;
  data: Buffer;
}

export class BinaryPlayer extends EventEmitter {
  private entries: PlaybackEntry[] = [];
  private currentIndex: number = 0;
  private playbackTimer: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPaused: boolean = false;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 1.0;
  private totalDuration: number = 0;
  private filepath: string = '';

  constructor() {
    super();
  }

  /**
   * Load a .p2rec file for playback
   */
  public async loadRecording(filepath: string): Promise<void> {
    this.filepath = filepath;
    this.entries = [];
    this.currentIndex = 0;
    this.totalDuration = 0;

    return new Promise((resolve, reject) => {
      try {
        const fileBuffer = fs.readFileSync(filepath);
        let offset = 0;
        
        // Read header (64 bytes)
        if (fileBuffer.length < 64) {
          throw new Error('Invalid .p2rec file: header too short');
        }
        
        // Verify magic bytes 'P2RC'
        const magic = fileBuffer.subarray(0, 4).toString();
        if (magic !== 'P2RC') {
          throw new Error('Invalid .p2rec file: incorrect magic bytes');
        }
        
        // Read version (4 bytes)
        const version = fileBuffer.readUInt32LE(4);
        if (version !== 1) {
          throw new Error(`Unsupported .p2rec version: ${version}`);
        }
        
        // Read start timestamp (8 bytes)
        const startTimestamp = fileBuffer.readBigUInt64LE(8);
        
        // Read metadata length (4 bytes)
        const metadataLength = fileBuffer.readUInt32LE(12);
        
        // Skip to metadata
        offset = 64;
        
        // Read metadata JSON
        if (offset + metadataLength > fileBuffer.length) {
          throw new Error('Invalid .p2rec file: metadata truncated');
        }
        const metadataJson = fileBuffer.subarray(offset, offset + metadataLength).toString('utf-8');
        const metadata = JSON.parse(metadataJson);
        offset += metadataLength;
        
        // Read data entries
        let cumulativeTime = 0;
        while (offset < fileBuffer.length) {
          // Read delta time (4 bytes, little-endian)
          if (offset + 4 > fileBuffer.length) break;
          
          const deltaMs = fileBuffer.readUInt32LE(offset);
          offset += 4;
          
          // Read data type (1 byte: 0=text, 1=binary)
          if (offset + 1 > fileBuffer.length) break;
          const dataType = fileBuffer.readUInt8(offset);
          offset += 1;
          
          // Read data length (4 bytes, little-endian)
          if (offset + 4 > fileBuffer.length) break;
          const dataLength = fileBuffer.readUInt32LE(offset);
          offset += 4;
          
          // Read data
          if (offset + dataLength > fileBuffer.length) break;
          const data = fileBuffer.subarray(offset, offset + dataLength);
          offset += dataLength;
          
          cumulativeTime += deltaMs;
          this.entries.push({ deltaMs: cumulativeTime, data: Buffer.from(data) });
          this.totalDuration = cumulativeTime;
        }

        console.log(`[BinaryPlayer] Loaded ${this.entries.length} entries from ${path.basename(filepath)}`);
        console.log(`[BinaryPlayer] Duration: ${this.totalDuration}ms, Metadata:`, metadata);
        
        this.emit('loaded', { 
          entries: this.entries.length, 
          duration: this.totalDuration,
          filepath: this.filepath,
          metadata
        });
        resolve();
      } catch (error) {
        console.error('[BinaryPlayer] Failed to load recording:', error);
        reject(error);
      }
    });
  }

  /**
   * Start or resume playback
   */
  public play(): void {
    if (this.isPlaying && !this.isPaused) return;

    if (this.isPaused) {
      // Resume from paused position
      this.isPaused = false;
      this.startTime = Date.now() - this.pausedTime;
    } else {
      // Start from current position
      this.startTime = Date.now();
      if (this.currentIndex === 0) {
        this.emit('started');
      }
    }

    this.isPlaying = true;
    this.scheduleNextEntry();
  }

  /**
   * Pause playback
   */
  public pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pausedTime = Date.now() - this.startTime;
    
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.emit('paused', this.getProgress());
  }

  /**
   * Stop playback and reset
   */
  public stop(): void {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.pausedTime = 0;

    this.emit('stopped');
  }

  /**
   * Seek to a specific position (0-1)
   */
  public seek(position: number): void {
    const targetTime = position * this.totalDuration;
    
    // Find the entry closest to the target time
    let newIndex = 0;
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].deltaMs <= targetTime) {
        newIndex = i;
      } else {
        break;
      }
    }

    this.currentIndex = newIndex;
    
    if (this.isPlaying) {
      // Reset timing if playing
      this.startTime = Date.now() - targetTime;
      this.pausedTime = targetTime;
      
      if (this.playbackTimer) {
        clearTimeout(this.playbackTimer);
        this.scheduleNextEntry();
      }
    } else {
      this.pausedTime = targetTime;
    }

    this.emit('seeked', this.getProgress());
  }

  /**
   * Set playback speed
   */
  public setSpeed(speed: number): void {
    this.playbackSpeed = speed;
    
    if (this.isPlaying && !this.isPaused) {
      // Adjust timing for new speed
      const currentTime = this.getCurrentTime();
      this.startTime = Date.now() - (currentTime / this.playbackSpeed);
      
      if (this.playbackTimer) {
        clearTimeout(this.playbackTimer);
        this.scheduleNextEntry();
      }
    }

    this.emit('speedChanged', speed);
  }

  /**
   * Get current playback progress
   */
  public getProgress(): { current: number; total: number; percentage: number } {
    const current = this.getCurrentTime();
    return {
      current,
      total: this.totalDuration,
      percentage: this.totalDuration > 0 ? (current / this.totalDuration) * 100 : 0
    };
  }

  /**
   * Check if currently playing
   */
  public isCurrentlyPlaying(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  private getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.pausedTime;
    }
    
    if (this.isPaused) {
      return this.pausedTime;
    }
    
    return (Date.now() - this.startTime) * this.playbackSpeed;
  }

  private scheduleNextEntry(): void {
    if (!this.isPlaying || this.isPaused || this.currentIndex >= this.entries.length) {
      if (this.currentIndex >= this.entries.length) {
        this.stop();
        this.emit('finished');
      }
      return;
    }

    const entry = this.entries[this.currentIndex];
    const currentTime = this.getCurrentTime();
    const entryTime = entry.deltaMs;
    const targetDelay = Math.max(0, (entryTime - currentTime) / this.playbackSpeed);

    // Use high-resolution timer for better accuracy
    const startTime = process.hrtime.bigint();
    
    this.playbackTimer = setTimeout(() => {
      // Calculate actual delay for drift compensation
      const actualDelay = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms
      
      // Emit the data for processing
      this.emit('data', entry.data);
      
      // Update progress
      this.emit('progress', this.getProgress());
      
      // Move to next entry
      this.currentIndex++;
      
      // Compensate for timer drift in next scheduling
      if (this.currentIndex < this.entries.length) {
        const drift = actualDelay - targetDelay;
        if (Math.abs(drift) > 5) { // Only compensate if drift > 5ms
          this.startTime -= drift * this.playbackSpeed;
        }
      }
      
      this.scheduleNextEntry();
    }, targetDelay);
  }
}