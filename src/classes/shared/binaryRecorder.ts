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
  private dataEntries: Buffer[] = []; // Collect data entries in memory
  
  constructor() {
    // Initialize
  }
  
  /**
   * Start a new recording session
   */
  public startRecording(metadata: RecordingMetadata, outputDir?: string): string {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }
    
    // Generate filepath
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${metadata.sessionName}.p2rec`;
    const recordingsDir = outputDir || path.join(process.cwd(), 'tests', 'recordings');
    
    // Ensure directory exists
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    
    this.filepath = path.join(recordingsDir, filename);
    this.metadata = { ...metadata };
    this.lastTimestamp = metadata.startTime;
    this.messageCount = 0;
    this.dataEntries = [];
    
    // Write initial header immediately (synchronous)
    this.writeHeaderSync();
    
    this.isRecording = true;
    return this.filepath;
  }
  
  /**
   * Record a message
   */
  public recordMessage(data: Buffer | string): void {
    if (!this.isRecording) {
      return;
    }
    
    const now = Date.now();
    const delta = Math.min(now - this.lastTimestamp, 0xFFFFFFFF); // Cap at 32-bit max
    this.lastTimestamp = now;
    
    // Determine type and convert to Buffer
    const isText = typeof data === 'string';
    const buffer = isText ? Buffer.from(data, 'utf-8') : data;
    
    // Create entry buffer
    const entrySize = 4 + 1 + 4 + buffer.length; // delta + type + length + data
    const entryBuffer = Buffer.allocUnsafe(entrySize);
    let offset = 0;
    
    // Delta timestamp (4 bytes)
    entryBuffer.writeUInt32LE(delta, offset);
    offset += 4;
    
    // Data type (1 byte)
    entryBuffer.writeUInt8(isText ? 0 : 1, offset);
    offset += 1;
    
    // Data length (4 bytes)
    entryBuffer.writeUInt32LE(buffer.length, offset);
    offset += 4;
    
    // Data
    buffer.copy(entryBuffer, offset);
    
    // Store entry for later writing
    this.dataEntries.push(entryBuffer);
    this.messageCount++;
  }
  
  /**
   * Stop recording
   */
  public stopRecording(): RecordingMetadata | null {
    if (!this.isRecording || !this.metadata) {
      return null;
    }
    
    // Update metadata
    this.metadata.endTime = Date.now();
    this.metadata.messageCount = this.messageCount;
    
    this.isRecording = false;
    
    // Write complete file synchronously
    this.writeCompleteFile();
    
    return this.metadata;
  }
  
  /**
   * Write complete file with all data synchronously
   */
  private writeCompleteFile(): void {
    if (!this.metadata) return;
    
    // Create header
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
    
    // Metadata length
    const metadataJson = JSON.stringify(this.metadata);
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    header.writeUInt32LE(metadataBuffer.length, offset); // Write metadata length at correct offset
    offset += 4;
    
    // Reserved (44 bytes of zeros already from alloc)
    
    // Combine all data
    const dataBuffer = Buffer.concat(this.dataEntries);
    const completeFile = Buffer.concat([header, metadataBuffer, dataBuffer]);
    
    // Write complete file synchronously
    fs.writeFileSync(this.filepath, completeFile);
  }

  /**
   * Write file header synchronously (for initial file creation)
   */
  private writeHeaderSync(): void {
    if (!this.metadata) return;
    
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
    
    // Metadata length (placeholder - will be updated when stopping)
    const metadataJson = JSON.stringify(this.metadata);
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    header.writeUInt32LE(metadataBuffer.length, offset);
    offset += 4;
    
    // Reserved (44 bytes of zeros already from alloc)
    
    // Write initial header and metadata synchronously
    fs.writeFileSync(this.filepath, Buffer.concat([header, metadataBuffer]));
  }

  /**
   * Write file header (legacy async method)
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
   * Update metadata in file after recording stops (simplified)
   */
  private updateMetadataSimple(): void {
    if (!this.filepath || !this.metadata) return;
    
    try {
      // Read existing file
      const fileBuffer = fs.readFileSync(this.filepath);
      
      // Create updated metadata JSON
      const metadataJson = JSON.stringify(this.metadata);
      const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
      
      // Only update if new metadata is same size or smaller (to avoid buffer issues)
      const oldMetadataLength = fileBuffer.readUInt32LE(12);
      if (metadataBuffer.length <= oldMetadataLength) {
        // Update metadata length in header
        fileBuffer.writeUInt32LE(metadataBuffer.length, 12);
        
        // Replace metadata in place
        metadataBuffer.copy(fileBuffer, BinaryRecorder.HEADER_SIZE);
        
        // Pad with zeros if smaller
        if (metadataBuffer.length < oldMetadataLength) {
          const padding = Buffer.alloc(oldMetadataLength - metadataBuffer.length, 0);
          padding.copy(fileBuffer, BinaryRecorder.HEADER_SIZE + metadataBuffer.length);
        }
        
        // Write back to file
        fs.writeFileSync(this.filepath, fileBuffer);
      } else {
        console.warn('[BinaryRecorder] Metadata grew too large, skipping update');
      }
    } catch (error) {
      console.error('[BinaryRecorder] Failed to update metadata:', error);
    }
  }

  /**
   * Update metadata in file after recording stops (complex version - deprecated)
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
      const oldMetadataLength = fileBuffer.readUInt32LE(12);
      const dataSize = fileBuffer.length - BinaryRecorder.HEADER_SIZE - oldMetadataLength;
      const newBufferSize = BinaryRecorder.HEADER_SIZE + metadataBuffer.length + dataSize;
      
      const newBuffer = Buffer.alloc(newBufferSize);
      
      // Copy header (updating metadata length)
      fileBuffer.copy(newBuffer, 0, 0, BinaryRecorder.HEADER_SIZE);
      newBuffer.writeUInt32LE(metadataBuffer.length, 12);
      
      // Write new metadata
      metadataBuffer.copy(newBuffer, BinaryRecorder.HEADER_SIZE);
      
      // Copy data entries
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