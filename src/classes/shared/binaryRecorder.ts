/**
 * Binary Recording Format (.p2rec)
 * 
 * Format Structure:
 * - Header (64 bytes)
 *   - Magic: 'P2RC' (4 bytes)
 *   - Version: 1 (4 bytes)
 *   - Start timestamp (8 bytes)
 *   - Metadata length (4 bytes)
 *   - Reserved (44 bytes)
 * - Metadata (JSON, variable length)
 * - Data entries (repeated):
 *   - Delta timestamp (4 bytes, milliseconds since last entry)
 *   - Data type (1 byte: 0=text, 1=binary)
 *   - Data length (4 bytes)
 *   - Data (variable length)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RecordingMetadata {
  sessionName: string;
  description?: string;
  serialPort?: string;
  baudRate?: number;
  startTime: number;
  endTime?: number;
  messageCount?: number;
}

export interface RecordingEntry {
  timestamp: number;
  type: 'text' | 'binary';
  data: Buffer | string;
}

export class BinaryRecorder {
  private static readonly MAGIC = Buffer.from('P2RC');
  private static readonly VERSION = 1;
  private static readonly HEADER_SIZE = 64;
  
  private fileStream: fs.WriteStream | null = null;
  private metadata: RecordingMetadata | null = null;
  private lastTimestamp: number = 0;
  private messageCount: number = 0;
  private isRecording: boolean = false;
  private filepath: string = '';
  
  constructor() {
    // Initialize
  }
  
  /**
   * Start a new recording session
   */
  public startRecording(metadata: RecordingMetadata): string {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }
    
    // Generate filepath
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${metadata.sessionName}.p2rec`;
    const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
    
    // Ensure directory exists
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    
    this.filepath = path.join(recordingsDir, filename);
    this.metadata = metadata;
    this.lastTimestamp = metadata.startTime;
    this.messageCount = 0;
    
    // Create file stream
    this.fileStream = fs.createWriteStream(this.filepath, { flags: 'w' });
    
    // Write header
    this.writeHeader();
    
    this.isRecording = true;
    return this.filepath;
  }
  
  /**
   * Record a message
   */
  public recordMessage(data: Buffer | string): void {
    if (!this.isRecording || !this.fileStream) {
      return;
    }
    
    const now = Date.now();
    const delta = Math.min(now - this.lastTimestamp, 0xFFFFFFFF); // Cap at 32-bit max
    this.lastTimestamp = now;
    
    // Determine type and convert to Buffer
    const isText = typeof data === 'string';
    const buffer = isText ? Buffer.from(data, 'utf-8') : data;
    
    // Write entry
    // Delta timestamp (4 bytes)
    const deltaBuffer = Buffer.allocUnsafe(4);
    deltaBuffer.writeUInt32LE(delta, 0);
    this.fileStream.write(deltaBuffer);
    
    // Data type (1 byte)
    this.fileStream.write(Buffer.from([isText ? 0 : 1]));
    
    // Data length (4 bytes)
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32LE(buffer.length, 0);
    this.fileStream.write(lengthBuffer);
    
    // Data
    this.fileStream.write(buffer);
    
    this.messageCount++;
  }
  
  /**
   * Stop recording
   */
  public stopRecording(): RecordingMetadata | null {
    if (!this.isRecording || !this.fileStream || !this.metadata) {
      return null;
    }
    
    // Update metadata
    this.metadata.endTime = Date.now();
    this.metadata.messageCount = this.messageCount;
    
    // Close stream
    this.fileStream.end();
    this.fileStream = null;
    this.isRecording = false;
    
    // Update file with final metadata
    this.updateMetadata();
    
    return this.metadata;
  }
  
  /**
   * Write file header
   */
  private writeHeader(): void {
    if (!this.fileStream || !this.metadata) return;
    
    const header = Buffer.alloc(BinaryRecorder.HEADER_SIZE);
    let offset = 0;
    
    // Magic
    BinaryRecorder.MAGIC.copy(header, offset);
    offset += 4;
    
    // Version
    header.writeUInt32LE(BinaryRecorder.VERSION, offset);
    offset += 4;
    
    // Start timestamp
    header.writeBigUInt64LE(BigInt(this.metadata.startTime), offset);
    offset += 8;
    
    // Metadata length (will be updated later)
    const metadataJson = JSON.stringify(this.metadata);
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    header.writeUInt32LE(metadataBuffer.length, offset);
    offset += 4;
    
    // Reserved (44 bytes of zeros already from alloc)
    
    // Write header and metadata
    this.fileStream.write(header);
    this.fileStream.write(metadataBuffer);
  }
  
  /**
   * Update metadata in file after recording stops
   */
  private updateMetadata(): void {
    if (!this.filepath) return;
    
    try {
      // Read existing file
      const fileBuffer = fs.readFileSync(this.filepath);
      
      // Update metadata
      const metadataJson = JSON.stringify(this.metadata);
      const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
      
      // Create new buffer with updated metadata
      const newBuffer = Buffer.alloc(
        BinaryRecorder.HEADER_SIZE + metadataBuffer.length + 
        (fileBuffer.length - BinaryRecorder.HEADER_SIZE - fileBuffer.readUInt32LE(12))
      );
      
      // Copy header (updating metadata length)
      fileBuffer.copy(newBuffer, 0, 0, BinaryRecorder.HEADER_SIZE);
      newBuffer.writeUInt32LE(metadataBuffer.length, 12);
      
      // Write new metadata
      metadataBuffer.copy(newBuffer, BinaryRecorder.HEADER_SIZE);
      
      // Copy data entries
      const oldMetadataLength = fileBuffer.readUInt32LE(12);
      const dataStart = BinaryRecorder.HEADER_SIZE + oldMetadataLength;
      fileBuffer.copy(
        newBuffer, 
        BinaryRecorder.HEADER_SIZE + metadataBuffer.length,
        dataStart
      );
      
      // Write back to file
      fs.writeFileSync(this.filepath, newBuffer);
    } catch (error) {
      console.error('[BinaryRecorder] Failed to update metadata:', error);
    }
  }
  
  /**
   * Check if recording is active
   */
  public isRecordingActive(): boolean {
    return this.isRecording;
  }
  
  /**
   * Get current recording statistics
   */
  public getStats(): { messageCount: number; duration: number } | null {
    if (!this.isRecording || !this.metadata) return null;
    
    return {
      messageCount: this.messageCount,
      duration: Date.now() - this.metadata.startTime
    };
  }
}