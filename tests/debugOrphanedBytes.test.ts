/** @format */

// Debug test to isolate the orphaned bytes issue

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

describe('Debug Orphaned Bytes Issue', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer();
  });

  it('should debug the exact orphaned bytes scenario', () => {
    console.log('Starting orphaned bytes debug test...');
    
    // The exact same test that's failing
    const messages = [
      new Uint8Array([1, 2, 3, 4, 5]),        // 5 bytes
      new Uint8Array([10, 11, 12]),           // 3 bytes  
      new Uint8Array([20, 21, 22, 23, 24, 25, 26])  // 7 bytes
    ];
    
    console.log(`Total messages: ${messages.length}`);
    
    let totalExpected = 0;
    messages.forEach((msg, index) => {
      console.log(`\nAppending message ${index}: [${Array.from(msg).join(', ')}] (${msg.length} bytes)`);
      console.log(`Buffer stats before append:`, buffer.getStats());
      
      const success = buffer.appendAtTail(msg);
      console.log(`Append success: ${success}`);
      
      if (!success) {
        console.log(`❌ FAILED to append message ${index}!`);
        console.log(`Available space: ${buffer.getAvailableSpace()}`);
        console.log(`Used space: ${buffer.getUsedSpace()}`);
        console.log(`Buffer stats:`, buffer.getStats());
      } else {
        totalExpected += msg.length;
        console.log(`✅ Successfully appended message ${index}`);
        console.log(`Buffer stats after append:`, buffer.getStats());
      }
    });
    
    console.log(`\nTotal expected bytes: ${totalExpected}`);
    console.log(`Final buffer stats:`, buffer.getStats());
    
    // Read all data
    console.log('\nReading data back...');
    const actualData: number[] = [];
    let result: NextResult;
    let readCount = 0;
    
    while ((result = buffer.next()).status === NextStatus.DATA) {
      actualData.push(result.value!);
      readCount++;
      if (readCount <= 20) { // Log first 20 for debugging
        console.log(`Read byte ${readCount}: ${result.value} (0x${result.value!.toString(16).padStart(2, '0')})`);
      }
    }
    
    console.log(`\nTotal bytes read: ${actualData.length}`);
    console.log(`Expected: ${totalExpected}, Actual: ${actualData.length}`);
    console.log(`First 15 bytes read: [${actualData.slice(0, 15).join(', ')}]`);
    console.log(`Expected first 15: [1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26]`);
    
    // This will fail, but we'll see the debug output
    expect(actualData.length).toBe(totalExpected);
  });
});