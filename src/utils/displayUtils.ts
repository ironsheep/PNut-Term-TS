/** @format */

/**
 * Display utilities for safely showing binary data
 */

/**
 * Check if buffer contains any bytes outside normal ASCII range (0x20-0x7F)
 * If so, return hex/ASCII dump format. Otherwise return as plain text.
 */
export function safeDisplayString(buffer: string | Uint8Array | Buffer): string {
  let bytes: Uint8Array;
  
  // Convert input to Uint8Array
  if (typeof buffer === 'string') {
    bytes = new TextEncoder().encode(buffer);
  } else if (Buffer.isBuffer(buffer)) {
    bytes = new Uint8Array(buffer);
  } else {
    bytes = buffer;
  }
  
  // Check if all bytes are in normal ASCII range (0x20-0x7F)
  let hasNonAscii = false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] < 0x20 || bytes[i] > 0x7F) {
      hasNonAscii = true;
      break;
    }
  }
  
  if (!hasNonAscii) {
    // All bytes are normal ASCII - display as text
    return typeof buffer === 'string' ? buffer : new TextDecoder().decode(bytes);
  }
  
  // Contains non-ASCII bytes - display as hex/ASCII dump
  return formatHexAsciiDump(bytes);
}

/**
 * Format buffer as hex/ASCII dump using application standard:
 * 8 bytes $ format + double space + 8 bytes $ format + double space + ASCII dump
 */
function formatHexAsciiDump(bytes: Uint8Array): string {
  const lines: string[] = [];
  
  for (let i = 0; i < bytes.length; i += 16) {
    const line = bytes.slice(i, i + 16);
    
    // First 8 bytes with $ format
    const hex1 = Array.from(line.slice(0, 8))
      .map(b => `$${b.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(' ');
    
    // Second 8 bytes with $ format  
    const hex2 = Array.from(line.slice(8, 16))
      .map(b => `$${b.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(' ');
    
    // ASCII representation
    const ascii = Array.from(line)
      .map(b => (b >= 0x20 && b <= 0x7F) ? String.fromCharCode(b) : '.')
      .join('');
    
    // Pad hex sections to consistent width
    const paddedHex1 = hex1.padEnd(23, ' '); // 8 * 3 - 1 = 23
    const paddedHex2 = hex2.padEnd(23, ' ');
    
    lines.push(`${paddedHex1}  ${paddedHex2}   ${ascii}`);
  }
  
  return lines.join('\n');
}