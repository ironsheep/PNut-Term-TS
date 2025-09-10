/**
 * Comprehensive Binary Recording & Playback Test Suite
 * 
 * Tests the .p2rec format implementation following byte-perfect validation standards.
 * Every single byte is accounted for and validated to ensure data integrity.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BinaryRecorder, RecordingMetadata } from '../src/classes/shared/binaryRecorder';
import { BinaryPlayer } from '../src/classes/binaryPlayer';

describe('Binary Recording System (.p2rec format)', () => {
  const testDir = path.join(__dirname, '..', 'test-output', 'binary-recording-tests');
  let recorder: BinaryRecorder;
  let player: BinaryPlayer;

  beforeEach(() => {
    recorder = new BinaryRecorder();
    player = new BinaryPlayer();
    
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        if (file.endsWith('.p2rec')) {
          fs.unlinkSync(path.join(testDir, file));
        }
      });
    }
  });

  describe('Format Structure Validation', () => {
    test('should create recording with correct .p2rec header format', () => {
      const metadata: RecordingMetadata = {
        sessionName: 'test-header-validation',
        description: 'Header format test',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      
      // Record some test data
      recorder.recordMessage('Test message 1');
      recorder.recordMessage(Buffer.from([0x01, 0x02, 0x03, 0x04]));
      recorder.recordMessage('Test message 2');
      
      const finalMetadata = recorder.stopRecording();
      
      // Verify file exists
      expect(fs.existsSync(filepath)).toBe(true);
      
      // Read and validate header structure
      const fileBuffer = fs.readFileSync(filepath);
      
      // Validate minimum size (header + metadata + some data)
      expect(fileBuffer.length).toBeGreaterThan(64);
      
      // Validate magic bytes 'P2RC' (bytes 0-3)
      const magic = fileBuffer.subarray(0, 4);
      expect(magic.toString()).toBe('P2RC');
      
      // Validate version = 1 (bytes 4-7)
      const version = fileBuffer.readUInt32LE(4);
      expect(version).toBe(1);
      
      // Validate start timestamp (bytes 8-15)
      const startTimestamp = fileBuffer.readBigUInt64LE(8);
      expect(Number(startTimestamp)).toBeCloseTo(metadata.startTime, -3); // Allow ±1000ms tolerance
      
      // Validate metadata length (bytes 12-15)
      const metadataLength = fileBuffer.readUInt32LE(12);
      expect(metadataLength).toBeGreaterThan(0);
      
      // Validate reserved bytes (bytes 16-63 should be zeros)
      const reserved = fileBuffer.subarray(16, 64);
      const allZeros = Buffer.alloc(48, 0);
      expect(reserved.equals(allZeros)).toBe(true);
      
      // Validate metadata JSON is parseable
      const metadataJson = fileBuffer.subarray(64, 64 + metadataLength).toString('utf-8');
      const parsedMetadata = JSON.parse(metadataJson);
      expect(parsedMetadata.sessionName).toBe(metadata.sessionName);
      expect(parsedMetadata.description).toBe(metadata.description);
      expect(parsedMetadata.messageCount).toBe(3);
    });

    test('should have monotonically increasing timestamps in data entries', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'timestamp-validation',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      
      // Record messages with controlled timing
      recorder.recordMessage('Message 1');
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      recorder.recordMessage('Message 2');
      await new Promise(resolve => setTimeout(resolve, 20));
      recorder.recordMessage('Message 3');
      recorder.stopRecording();
        
      // Read file and validate timestamp ordering
      const fileBuffer = fs.readFileSync(filepath);
      const metadataLength = fileBuffer.readUInt32LE(12);
      let offset = 64 + metadataLength;
      
      let cumulativeTime = 0;
      let previousCumulativeTime = -1;
      let entryCount = 0;
      
      // Parse all data entries
      while (offset < fileBuffer.length) {
        // Read delta time (4 bytes)
        if (offset + 9 > fileBuffer.length) break; // Need at least delta(4) + type(1) + length(4)
        
        const deltaMs = fileBuffer.readUInt32LE(offset);
        offset += 4;
        
        // Skip data type (1 byte)
        offset += 1;
        
        // Read data length
        const dataLength = fileBuffer.readUInt32LE(offset);
        offset += 4;
        
        // Skip data
        offset += dataLength;
        
        cumulativeTime += deltaMs;
        
        // Verify timestamps are monotonically increasing
        expect(cumulativeTime).toBeGreaterThanOrEqual(previousCumulativeTime);
        previousCumulativeTime = cumulativeTime;
        entryCount++;
      }
      
      expect(entryCount).toBe(3);
    });

    test('should account for every single byte in format structure', () => {
      const metadata: RecordingMetadata = {
        sessionName: 'byte-accounting',
        startTime: Date.now()
      };

      const testMessages = [
        'Short',
        'This is a longer test message with more content',
        Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]),
        Buffer.alloc(256, 0x42), // Large buffer
        '' // Empty string
      ];

      const filepath = recorder.startRecording(metadata, testDir);
      
      testMessages.forEach(msg => {
        recorder.recordMessage(msg);
      });
      
      recorder.stopRecording();
      
      // Calculate expected file size
      const fileBuffer = fs.readFileSync(filepath);
      const metadataLength = fileBuffer.readUInt32LE(12);
      
      let expectedSize = 64; // Header
      expectedSize += metadataLength; // Metadata
      
      // Calculate expected data section size
      let expectedDataSize = 0;
      testMessages.forEach(msg => {
        const dataBuffer = typeof msg === 'string' ? Buffer.from(msg, 'utf-8') : msg;
        expectedDataSize += 4; // delta timestamp
        expectedDataSize += 1; // data type
        expectedDataSize += 4; // data length
        expectedDataSize += dataBuffer.length; // actual data
      });
      
      expectedSize += expectedDataSize;
      
      // Verify every byte is accounted for
      expect(fileBuffer.length).toBe(expectedSize);
      
      // Verify we can parse every single entry back perfectly
      let offset = 64 + metadataLength;
      let parsedMessages: Buffer[] = [];
      
      while (offset < fileBuffer.length) {
        // Read entry
        const deltaMs = fileBuffer.readUInt32LE(offset);
        offset += 4;
        
        const dataType = fileBuffer.readUInt8(offset);
        offset += 1;
        
        const dataLength = fileBuffer.readUInt32LE(offset);
        offset += 4;
        
        const data = fileBuffer.subarray(offset, offset + dataLength);
        offset += dataLength;
        
        parsedMessages.push(Buffer.from(data));
      }
      
      // Verify exact byte-for-byte equality
      expect(parsedMessages.length).toBe(testMessages.length);
      testMessages.forEach((original, index) => {
        const originalBuffer = typeof original === 'string' ? Buffer.from(original, 'utf-8') : original;
        const parsedBuffer = parsedMessages[index];
        expect(parsedBuffer.equals(originalBuffer)).toBe(true);
      });
    });
  });

  describe('Data Integrity Validation', () => {
    test('should preserve exact byte content through record-playback cycle', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'data-integrity',
        startTime: Date.now()
      };

      // Create comprehensive test patterns
      const testPatterns = [
        // COG messages simulation
        'Cog0: Starting debug session',
        'Cog1: Processing data packet',
        'Cog2: Memory allocation complete',
        
        // Debugger packets simulation
        Buffer.from([0x7E, 0x01, 0x00, 0x00, 0x42, 0x7E]), // Framed packet
        Buffer.from([0xFF, 0x00, 0xAA, 0x55]), // Binary pattern
        
        // Mixed data
        'Status: OK\r\n',
        Buffer.from('Mixed\x00binary\x01data\xFF', 'binary'),
        
        // Edge cases
        '', // Empty string
        Buffer.alloc(0), // Empty buffer
        Buffer.alloc(1, 0), // Single null byte
        Buffer.alloc(1024, 0xAB), // Large repeated pattern
        'Unicode test: 🚀 ñ ü ℃ ∞', // Unicode characters
      ];

      // Record all test patterns
      const filepath = recorder.startRecording(metadata, testDir);
      testPatterns.forEach(pattern => {
        recorder.recordMessage(pattern);
      });
      recorder.stopRecording();

      // Load recording for playback
      await player.loadRecording(filepath);

      // Capture playback data
      const playbackData: Buffer[] = [];
      player.on('data', (data: Buffer) => {
        playbackData.push(Buffer.from(data)); // Ensure we get a copy
      });

      // Play back and wait for completion
      return new Promise<void>((resolve) => {
        player.on('finished', () => {
          // Verify exact count
          expect(playbackData.length).toBe(testPatterns.length);
          
          // Verify byte-for-byte equality for each message
          testPatterns.forEach((original, index) => {
            const originalBuffer = typeof original === 'string' ? Buffer.from(original, 'utf-8') : original;
            const playedBuffer = playbackData[index];
            
            // Critical: Every single byte must match exactly
            expect(playedBuffer.length).toBe(originalBuffer.length);
            expect(playedBuffer.equals(originalBuffer)).toBe(true);
            
            // Additional verification: byte-by-byte comparison
            for (let i = 0; i < originalBuffer.length; i++) {
              expect(playedBuffer[i]).toBe(originalBuffer[i]);
            }
          });
          
          resolve();
        });
        
        player.play();
      });
    });

    test('should handle binary data with all possible byte values', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'full-byte-range',
        startTime: Date.now()
      };

      // Create buffer with all possible byte values (0x00 to 0xFF)
      const fullRangeBuffer = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        fullRangeBuffer[i] = i;
      }

      const filepath = recorder.startRecording(metadata, testDir);
      recorder.recordMessage(fullRangeBuffer);
      recorder.stopRecording();

      // Playback and verify
      await player.loadRecording(filepath);
      
      return new Promise<void>((resolve) => {
        player.on('data', (data: Buffer) => {
          expect(data.length).toBe(256);
          
          // Verify every byte value is preserved
          for (let i = 0; i < 256; i++) {
            expect(data[i]).toBe(i);
          }
          
          resolve();
        });
        
        player.play();
      });
    });
  });

  describe('Timing Accuracy Validation', () => {
    test('should maintain accurate timing during playback at 1x speed', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'timing-1x',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      const expectedDelays = [100, 500, 1000]; // ms
      const recordedTimes: number[] = [];
      
      // Record with known delays
      recordedTimes.push(Date.now());
      recorder.recordMessage('Message 1');
      
      for (let i = 0; i < expectedDelays.length; i++) {
        await new Promise(resolve => setTimeout(resolve, expectedDelays[i]));
        recordedTimes.push(Date.now());
        recorder.recordMessage(`Message ${i + 2}`);
      }
      
      recorder.stopRecording();

      // Calculate expected intervals
      const expectedIntervals: number[] = [];
      for (let i = 1; i < recordedTimes.length; i++) {
        expectedIntervals.push(recordedTimes[i] - recordedTimes[i - 1]);
      }

      // Playback and measure timing
      await player.loadRecording(filepath);
      
      const playbackTimes: number[] = [];
      
      return new Promise<void>((resolve) => {
        player.on('data', () => {
          playbackTimes.push(Date.now());
        });
        
        player.on('finished', () => {
          // Calculate actual intervals
          const actualIntervals: number[] = [];
          for (let i = 1; i < playbackTimes.length; i++) {
            actualIntervals.push(playbackTimes[i] - playbackTimes[i - 1]);
          }
          
          // Verify timing accuracy within ±10ms tolerance
          expect(actualIntervals.length).toBe(expectedIntervals.length);
          expectedIntervals.forEach((expected, index) => {
            const actual = actualIntervals[index];
            const tolerance = 10; // ±10ms as specified
            const difference = Math.abs(actual - expected);
            
            expect(difference).toBeLessThanOrEqual(tolerance);
          });
          
          resolve();
        });
        
        player.play();
      });
    });

    test('should double playback speed at 2x setting', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'timing-2x',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      const baseDelay = 200; // ms
      
      recorder.recordMessage('Start');
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      recorder.recordMessage('Middle');
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      recorder.recordMessage('End');
      
      recorder.stopRecording();

      // Test 2x speed playback
      await player.loadRecording(filepath);
      player.setSpeed(2.0);
      
      const playbackTimes: number[] = [];
      
      return new Promise<void>((resolve) => {
        player.on('data', () => {
          playbackTimes.push(Date.now());
        });
        
        player.on('finished', () => {
          // At 2x speed, intervals should be halved
          const actualInterval = playbackTimes[1] - playbackTimes[0];
          const expectedInterval = baseDelay / 2; // Half speed
          const tolerance = 10;
          
          const difference = Math.abs(actualInterval - expectedInterval);
          expect(difference).toBeLessThanOrEqual(tolerance);
          
          resolve();
        });
        
        player.play();
      });
    });

    test('should maintain timing continuity through pause/resume cycles', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'pause-resume',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      
      // Record messages with 300ms intervals
      recorder.recordMessage('Message 1');
      await new Promise(resolve => setTimeout(resolve, 300));
      recorder.recordMessage('Message 2');
      await new Promise(resolve => setTimeout(resolve, 300));
      recorder.recordMessage('Message 3');
      await new Promise(resolve => setTimeout(resolve, 300));
      recorder.recordMessage('Message 4');
      
      recorder.stopRecording();

      // Test pause/resume behavior
      await player.loadRecording(filepath);
      
      const events: { type: string; time: number }[] = [];
      
      return new Promise<void>((resolve) => {
        player.on('data', (data) => {
          events.push({ type: 'data', time: Date.now() });
          
          // Pause after second message
          if (data.toString() === 'Message 2') {
            setTimeout(() => {
              player.pause();
              events.push({ type: 'pause', time: Date.now() });
              
              // Resume after 100ms pause
              setTimeout(() => {
                events.push({ type: 'resume', time: Date.now() });
                player.play();
              }, 100);
            }, 10);
          }
        });
        
        player.on('finished', () => {
          // Verify timing continuity
          const dataEvents = events.filter(e => e.type === 'data');
          expect(dataEvents.length).toBe(4);
          
          // Check intervals (accounting for pause)
          const interval1 = dataEvents[1].time - dataEvents[0].time;
          const interval2 = dataEvents[2].time - dataEvents[1].time; // Should include pause
          const interval3 = dataEvents[3].time - dataEvents[2].time;
          
          // First and third intervals should be ~300ms
          expect(Math.abs(interval1 - 300)).toBeLessThanOrEqual(20);
          expect(Math.abs(interval3 - 300)).toBeLessThanOrEqual(20);
          
          // Second interval should be longer due to pause
          expect(interval2).toBeGreaterThan(350);
          
          resolve();
        });
        
        player.play();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle zero-length data correctly', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'zero-length',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      
      // Record zero-length data
      recorder.recordMessage('');
      recorder.recordMessage(Buffer.alloc(0));
      recorder.recordMessage('Normal message');
      
      recorder.stopRecording();

      // Verify file format is still correct
      const fileBuffer = fs.readFileSync(filepath);
      const metadataLength = fileBuffer.readUInt32LE(12);
      let offset = 64 + metadataLength;
      
      // Parse first entry (empty string)
      let deltaMs = fileBuffer.readUInt32LE(offset);
      offset += 4;
      let dataType = fileBuffer.readUInt8(offset);
      offset += 1;
      let dataLength = fileBuffer.readUInt32LE(offset);
      offset += 4;
      
      expect(dataType).toBe(0); // text
      expect(dataLength).toBe(0); // zero length
      
      // Parse second entry (empty buffer)
      deltaMs = fileBuffer.readUInt32LE(offset);
      offset += 4;
      dataType = fileBuffer.readUInt8(offset);
      offset += 1;
      dataLength = fileBuffer.readUInt32LE(offset);
      offset += 4;
      
      expect(dataType).toBe(1); // binary
      expect(dataLength).toBe(0); // zero length

      // Verify playback handles zero-length data
      await player.loadRecording(filepath);
      
      const receivedData: Buffer[] = [];
      
      return new Promise<void>((resolve) => {
        player.on('data', (data: Buffer) => {
          receivedData.push(Buffer.from(data));
        });
        
        player.on('finished', () => {
          expect(receivedData.length).toBe(3);
          expect(receivedData[0].length).toBe(0); // Empty string
          expect(receivedData[1].length).toBe(0); // Empty buffer
          expect(receivedData[2].toString()).toBe('Normal message');
          
          resolve();
        });
        
        player.play();
      });
    });

    test('should handle maximum size packets (64KB)', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'max-size',
        startTime: Date.now()
      };

      // Create maximum size buffer (64KB)
      const maxBuffer = Buffer.alloc(65536, 0xAB);
      
      const filepath = recorder.startRecording(metadata, testDir);
      recorder.recordMessage(maxBuffer);
      recorder.stopRecording();

      // Verify large data is recorded correctly
      const fileBuffer = fs.readFileSync(filepath);
      const metadataLength = fileBuffer.readUInt32LE(12);
      let offset = 64 + metadataLength;
      
      // Parse entry
      const deltaMs = fileBuffer.readUInt32LE(offset);
      offset += 4;
      const dataType = fileBuffer.readUInt8(offset);
      offset += 1;
      const dataLength = fileBuffer.readUInt32LE(offset);
      offset += 4;
      
      expect(dataType).toBe(1); // binary
      expect(dataLength).toBe(65536);
      
      const storedData = fileBuffer.subarray(offset, offset + dataLength);
      expect(storedData.equals(maxBuffer)).toBe(true);

      // Verify playback
      await player.loadRecording(filepath);
      
      return new Promise<void>((resolve) => {
        player.on('data', (data: Buffer) => {
          expect(data.length).toBe(65536);
          expect(data.equals(maxBuffer)).toBe(true);
          resolve();
        });
        
        player.play();
      });
    });

    test('should detect corrupted file headers', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'corruption-test',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      recorder.recordMessage('Test data');
      recorder.stopRecording();

      // Corrupt magic bytes
      const fileBuffer = fs.readFileSync(filepath);
      fileBuffer.write('XXXX', 0); // Corrupt magic
      fs.writeFileSync(filepath, fileBuffer);

      // Verify player detects corruption
      await expect(player.loadRecording(filepath)).rejects.toThrow('Invalid .p2rec file: incorrect magic bytes');

      // Test version corruption
      fileBuffer.write('P2RC', 0); // Fix magic
      fileBuffer.writeUInt32LE(999, 4); // Invalid version
      fs.writeFileSync(filepath, fileBuffer);

      await expect(player.loadRecording(filepath)).rejects.toThrow('Unsupported .p2rec version: 999');
    });

    test('should prevent multiple simultaneous recordings', () => {
      const metadata1: RecordingMetadata = {
        sessionName: 'test1',
        startTime: Date.now()
      };

      const metadata2: RecordingMetadata = {
        sessionName: 'test2',
        startTime: Date.now()
      };

      // Start first recording
      const filepath1 = recorder.startRecording(metadata1);
      expect(fs.existsSync(filepath1)).toBe(true);

      // Attempt second recording should throw
      expect(() => {
        recorder.startRecording(metadata2);
      }).toThrow('Recording already in progress');

      // Cleanup
      recorder.stopRecording();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle long recordings efficiently (simulated hours of data)', async () => {
      const metadata: RecordingMetadata = {
        sessionName: 'long-recording',
        startTime: Date.now()
      };

      const filepath = recorder.startRecording(metadata, testDir);
      
      // Simulate 1000 messages (representing hours of sparse data)
      const messageCount = 1000;
      const testMessage = 'Periodic status update';
      
      for (let i = 0; i < messageCount; i++) {
        recorder.recordMessage(`${testMessage} #${i}`);
      }
      
      const finalMetadata = recorder.stopRecording();
      
      // Verify recording completed
      expect(finalMetadata?.messageCount).toBe(messageCount);
      
      // Verify file size is reasonable (not exponentially growing)
      const fileStats = fs.statSync(filepath);
      const expectedMinSize = messageCount * (testMessage.length + 9); // More accurate: msg + 9 bytes overhead per entry
      const expectedMaxSize = expectedMinSize * 3; // Allow for more generous overhead
      
      expect(fileStats.size).toBeGreaterThan(expectedMinSize * 0.8); // 20% tolerance on minimum
      expect(fileStats.size).toBeLessThan(expectedMaxSize);

      // Verify playback works efficiently
      await player.loadRecording(filepath);
      
      let receivedCount = 0;
      
      return new Promise<void>((resolve) => {
        player.on('data', (data: Buffer) => {
          receivedCount++;
          const message = data.toString();
          expect(message).toMatch(/^Periodic status update #\d+$/);
        });
        
        player.on('finished', () => {
          expect(receivedCount).toBe(messageCount);
          resolve();
        });
        
        // Use high speed to test quickly
        player.setSpeed(100);
        player.play();
      });
    });
  });
});