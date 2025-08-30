/**
 * P2 Debugger Response Generator
 * 
 * CRITICAL: The P2 uses lock #15 to serialize COG communications.
 * Each COG blocks waiting for host response before releasing the lock!
 * Without sending this response, only COG1 will ever send data.
 */

export class DebuggerResponse {
  // Previous state for checksum comparison
  private cogBlockOld: Uint8Array = new Uint8Array(128);
  private hubBlockOld: Uint8Array = new Uint8Array(248);
  
  // Current state from received packet
  private cogBlock: Uint8Array = new Uint8Array(128);
  private hubBlock: Uint8Array = new Uint8Array(248);
  
  /**
   * Generate response packet for P2 debugger
   * Total response: 75 bytes
   * - COG checksums: 16 bytes
   * - Hub checksums: 31 bytes  
   * - Hub requests: 20 bytes (5 longs)
   * - COGBRK: 4 bytes
   * - Command: 4 bytes
   */
  public generateResponse(debugPacket: Uint8Array): Uint8Array {
    // Update current blocks from packet
    this.updateBlocksFromPacket(debugPacket);
    
    const response = new Uint8Array(75);
    let offset = 0;
    
    // 1. COG checksum bits (16 bytes - 128 bits packed into bytes)
    for (let byteIndex = 0; byteIndex < 16; byteIndex++) {
      let h = 0;
      for (let bit = 0; bit < 8; bit++) {
        const i = byteIndex * 8 + bit;
        if (this.cogBlock[i] !== this.cogBlockOld[i]) {
          h |= (1 << bit);
        }
      }
      response[offset++] = h;
    }
    
    // 2. Hub checksum bits (31 bytes - 248 bits packed into bytes)
    for (let byteIndex = 0; byteIndex < 31; byteIndex++) {
      let h = 0;
      for (let bit = 0; bit < 8; bit++) {
        const i = byteIndex * 8 + bit;
        if (i < 248 && this.hubBlock[i] !== this.hubBlockOld[i]) {
          h |= (1 << bit);
        }
      }
      response[offset++] = h;
    }
    
    // 3. Hub read requests (5 longs = 20 bytes)
    // For now, send zeros (no additional data requested)
    offset = this.writeLong(response, offset, 0); // Disassembly request
    offset = this.writeLong(response, offset, 0); // FPTR window
    offset = this.writeLong(response, offset, 0); // PTRA window
    offset = this.writeLong(response, offset, 0); // PTRB window
    offset = this.writeLong(response, offset, 0); // Hub memory window
    
    // 4. COGBRK request (4 bytes)
    offset = this.writeLong(response, offset, 0); // No break request
    
    // 5. Break/Stall command (4 bytes)
    // $80000000 = StallCmd (continue running)
    offset = this.writeLong(response, offset, 0x80000000);
    
    // Save current state as old for next comparison
    this.cogBlockOld.set(this.cogBlock);
    this.hubBlockOld.set(this.hubBlock);
    
    return response;
  }
  
  /**
   * Update internal blocks from received debugger packet
   * Packet structure (416 bytes total):
   * - 40 bytes: Status block
   * - 128 bytes: COG CRC block
   * - 248 bytes: Hub checksums
   */
  private updateBlocksFromPacket(packet: Uint8Array): void {
    if (packet.length < 416) {
      console.warn(`[DebuggerResponse] Packet too small: ${packet.length} bytes, expected 416`);
      return;
    }
    
    // Extract COG block (128 bytes starting at offset 40)
    this.cogBlock.set(packet.slice(40, 168));
    
    // Extract Hub block (248 bytes starting at offset 168)
    this.hubBlock.set(packet.slice(168, 416));
  }
  
  /**
   * Write a 32-bit long in little-endian format
   */
  private writeLong(buffer: Uint8Array, offset: number, value: number): number {
    buffer[offset] = value & 0xFF;
    buffer[offset + 1] = (value >> 8) & 0xFF;
    buffer[offset + 2] = (value >> 16) & 0xFF;
    buffer[offset + 3] = (value >> 24) & 0xFF;
    return offset + 4;
  }
  
  /**
   * Reset state (e.g., after DTR reset)
   */
  public reset(): void {
    this.cogBlockOld.fill(0);
    this.hubBlockOld.fill(0);
    this.cogBlock.fill(0);
    this.hubBlock.fill(0);
  }
}