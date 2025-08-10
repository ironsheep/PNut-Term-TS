/** @format */

// src/classes/shared/disassembler.ts

/**
 * P2 Instruction formats and decoding
 * Based on Propeller 2 instruction set architecture
 */

/**
 * Instruction condition codes (4-bit field)
 */
const CONDITIONS: { [key: number]: string } = {
  0x0: '_ret_',     // Return (forces return)
  0x1: 'if_nc_and_nz', // C=0 AND Z=0
  0x2: 'if_nc_and_z',  // C=0 AND Z=1
  0x3: 'if_nc',        // C=0
  0x4: 'if_c_and_nz',  // C=1 AND Z=0
  0x5: 'if_nz',        // Z=0
  0x6: 'if_c_ne_z',    // C≠Z
  0x7: 'if_nc_or_nz',  // C=0 OR Z=0
  0x8: 'if_c_and_z',   // C=1 AND Z=1
  0x9: 'if_c_eq_z',    // C=Z
  0xA: 'if_z',         // Z=1
  0xB: 'if_nc_or_z',   // C=0 OR Z=1
  0xC: 'if_c',         // C=1
  0xD: 'if_c_or_nz',   // C=1 OR Z=0
  0xE: 'if_c_or_z',    // C=1 OR Z=1
  0xF: ''              // Always (no condition)
};

/**
 * Basic P2 instruction opcodes (simplified subset)
 */
const OPCODES: { [key: number]: string } = {
  // Basic ALU operations
  0x0A8: 'add',
  0x0A9: 'addx',
  0x0AA: 'adds',
  0x0AB: 'addsx',
  0x0AC: 'sub',
  0x0AD: 'subx',
  0x0AE: 'subs',
  0x0AF: 'subsx',
  0x0B0: 'cmp',
  0x0B1: 'cmpx',
  0x0B2: 'cmps',
  0x0B3: 'cmpsx',
  0x0B4: 'cmpr',
  0x0B5: 'cmpm',
  0x0B6: 'subr',
  0x0B7: 'cmpsub',
  
  // Logic operations
  0x0C0: 'and',
  0x0C1: 'andn',
  0x0C2: 'or',
  0x0C3: 'xor',
  0x0C4: 'muxc',
  0x0C5: 'muxnc',
  0x0C6: 'muxz',
  0x0C7: 'muxnz',
  
  // Move operations
  0x0C8: 'mov',
  0x0C9: 'not',
  0x0CA: 'abs',
  0x0CB: 'neg',
  0x0CC: 'negc',
  0x0CD: 'negnc',
  0x0CE: 'negz',
  0x0CF: 'negnz',
  
  // Shift/Rotate
  0x0D0: 'shl',
  0x0D1: 'shr',
  0x0D2: 'rcl',
  0x0D3: 'rcr',
  0x0D4: 'sal',
  0x0D5: 'sar',
  0x0D6: 'rol',
  0x0D7: 'ror',
  
  // Memory operations
  0x100: 'rdbyte',
  0x101: 'rdword',
  0x102: 'rdlong',
  0x108: 'wrbyte',
  0x109: 'wrword',
  0x10A: 'wrlong',
  
  // Branch/Jump
  0x0D8: 'jmp',
  0x0D9: 'call',
  0x0DA: 'ret',
  0x0DB: 'calla',
  0x0DC: 'callb',
  0x0DD: 'calld',
  0x0DE: 'reta',
  0x0DF: 'retb',
  
  // Special
  0x000: 'nop',
  0x0F4: 'waitcnt',
  0x0F5: 'waitpeq',
  0x0F6: 'waitpne',
  0x0F7: 'waitvid'
};

/**
 * Instruction format types
 */
enum InstructionFormat {
  NORMAL,     // Normal 2-operand instruction
  IMMEDIATE,  // Immediate value in S field
  BRANCH,     // Branch/Jump instruction
  SPECIAL,    // Special instruction format
  UNKNOWN     // Unknown/invalid instruction
}

/**
 * Decoded instruction representation
 */
export interface DecodedInstruction {
  address: number;      // Instruction address
  value: number;        // Raw instruction value
  condition: string;    // Condition code string
  opcode: string;       // Mnemonic
  destination: string;  // Destination operand
  source: string;       // Source operand
  effects: string;      // WC, WZ, WCZ flags
  comment: string;      // Additional comment
  isSkipped: boolean;   // True if skipped by SKIP pattern
}

/**
 * Disassembler - P2 instruction decoder and formatter
 * 
 * This class decodes Propeller 2 instructions and formats them for display.
 * It maintains Pascal parity by always showing both hex values and decoded
 * instructions side-by-side in the debugger window.
 * 
 * Reference: P2 instruction set documentation
 */
export class Disassembler {
  private skipPattern: number = 0;
  private skipRemaining: number = 0;
  private programCounter: number = 0;
  
  /**
   * Set the current SKIP pattern
   */
  public setSkipPattern(pattern: number): void {
    this.skipPattern = pattern;
    this.skipRemaining = this.countSkipBits(pattern);
  }
  
  /**
   * Set the program counter
   */
  public setProgramCounter(pc: number): void {
    this.programCounter = pc;
  }
  
  /**
   * Count bits in skip pattern
   */
  private countSkipBits(pattern: number): number {
    let count = 0;
    let p = pattern;
    while (p) {
      count += p & 1;
      p >>>= 1;
    }
    return count;
  }
  
  /**
   * Decode a single instruction
   */
  public decodeInstruction(address: number, value: number): DecodedInstruction {
    // Extract instruction fields
    const condition = (value >>> 28) & 0xF;
    const wc = (value >>> 20) & 1;
    const wz = (value >>> 19) & 1;
    const immediate = (value >>> 22) & 1;
    // The opcode is bits 26:18 for most instructions
    const opcode = (value >>> 18) & 0x1FF;
    const destination = (value >>> 9) & 0x1FF;
    const source = value & 0x1FF;
    
    // Check if instruction is skipped
    const isSkipped = this.checkSkipped(address);
    
    // Get condition string
    const condStr = CONDITIONS[condition] || '';
    
    // Get opcode mnemonic
    let mnemonic = OPCODES[opcode] || `op_${opcode.toString(16)}`;
    
    // Format operands
    let destStr = this.formatOperand(destination, false);
    let srcStr = this.formatOperand(source, immediate === 1);
    
    // Handle special instruction formats
    if (this.isBranchInstruction(opcode)) {
      // Branch instructions use relative addressing
      const offset = this.signExtend(source, 9);
      const target = address + offset * 4;
      srcStr = `$${target.toString(16).padStart(5, '0')}`;
    }
    
    // Build effects string
    let effects = '';
    if (wc) effects += 'wc';
    if (wz) effects += (effects ? ',' : '') + 'wz';
    
    // Build comment
    let comment = '';
    if (address === this.programCounter) {
      comment = '← PC';
    }
    
    return {
      address,
      value,
      condition: condStr,
      opcode: mnemonic,
      destination: destStr,
      source: srcStr,
      effects,
      comment,
      isSkipped
    };
  }
  
  /**
   * Format a complete disassembly line
   */
  public formatDisassemblyLine(instruction: DecodedInstruction, showHex: boolean = true): string {
    const { address, value, condition, opcode, destination, source, effects, comment, isSkipped } = instruction;
    
    // Format address
    const addrStr = address.toString(16).padStart(5, '0').toUpperCase();
    
    // Format hex value
    const hexStr = value.toString(16).padStart(8, '0').toUpperCase();
    
    // Build instruction string
    let instrStr = '';
    
    // Add condition if present
    if (condition) {
      instrStr += condition + ' ';
    }
    
    // Add opcode
    instrStr += opcode;
    
    // Add operands
    if (destination || source) {
      instrStr += ' ';
      if (destination) {
        instrStr += destination;
        if (source) {
          instrStr += ', ' + source;
        }
      } else if (source) {
        instrStr += source;
      }
    }
    
    // Add effects
    if (effects) {
      instrStr += ' ' + effects;
    }
    
    // Format complete line
    let line = '';
    
    // Skip marker
    if (isSkipped) {
      line += '- ';
    } else {
      line += '  ';
    }
    
    // Address
    line += addrStr + ': ';
    
    // Hex value (if requested - Pascal always shows both)
    if (showHex) {
      line += hexStr + '  ';
    }
    
    // Instruction
    line += instrStr.padEnd(30);
    
    // Comment
    if (comment) {
      line += ' ; ' + comment;
    }
    
    return line;
  }
  
  /**
   * Disassemble a block of memory
   */
  public disassembleBlock(
    startAddress: number,
    instructions: number[],
    count: number = 16
  ): DecodedInstruction[] {
    const result: DecodedInstruction[] = [];
    
    for (let i = 0; i < Math.min(count, instructions.length); i++) {
      const address = startAddress + i * 4;
      const value = instructions[i] || 0;
      result.push(this.decodeInstruction(address, value));
    }
    
    return result;
  }
  
  /**
   * Format operand (register or immediate)
   */
  private formatOperand(value: number, isImmediate: boolean): string {
    if (isImmediate) {
      // Immediate value
      if (value < 10) {
        return `#${value}`;
      } else {
        return `#$${value.toString(16)}`;
      }
    } else {
      // Register reference
      return this.getRegisterName(value);
    }
  }
  
  /**
   * Get register name
   */
  private getRegisterName(reg: number): string {
    // Special registers
    switch (reg) {
      case 0x1F0: return 'par';
      case 0x1F1: return 'cnt';
      case 0x1F2: return 'ina';
      case 0x1F3: return 'inb';
      case 0x1F4: return 'outb';  // Note: These may be swapped in P2
      case 0x1F5: return 'outa';
      case 0x1F6: return 'dira';
      case 0x1F7: return 'dirb';
      case 0x1F8: return 'ctra';
      case 0x1F9: return 'ctrb';
      case 0x1FA: return 'frqa';
      case 0x1FB: return 'frqb';
      case 0x1FC: return 'phsa';
      case 0x1FD: return 'phsb';
      case 0x1FE: return 'vcfg';
      case 0x1FF: return 'vscl';
      default:
        if (reg < 0x200) {
          return `$${reg.toString(16).padStart(3, '0')}`;
        } else {
          return `$${reg.toString(16)}`;
        }
    }
  }
  
  /**
   * Check if instruction is a branch
   */
  private isBranchInstruction(opcode: number): boolean {
    return opcode >= 0x0D8 && opcode <= 0x0DF;
  }
  
  /**
   * Sign extend a value
   */
  private signExtend(value: number, bits: number): number {
    const sign = 1 << (bits - 1);
    return (value & (sign - 1)) - (value & sign);
  }
  
  /**
   * Check if instruction should be skipped
   */
  private checkSkipped(address: number): boolean {
    if (this.skipRemaining > 0 && this.skipPattern > 0) {
      const offset = (address - this.programCounter) / 4;
      if (offset > 0 && offset <= 32) {
        const bit = 1 << (offset - 1);
        if (this.skipPattern & bit) {
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Get instruction format type
   */
  private getInstructionFormat(opcode: number): InstructionFormat {
    if (this.isBranchInstruction(opcode)) {
      return InstructionFormat.BRANCH;
    } else if (OPCODES[opcode]) {
      return InstructionFormat.NORMAL;
    } else {
      return InstructionFormat.UNKNOWN;
    }
  }
  
  /**
   * Analyze instruction for effects
   */
  public analyzeInstruction(value: number): {
    modifiesC: boolean;
    modifiesZ: boolean;
    isBranch: boolean;
    isCall: boolean;
    isReturn: boolean;
  } {
    const opcode = (value >>> 18) & 0x1FF;
    const wc = (value >>> 20) & 1;
    const wz = (value >>> 19) & 1;
    
    return {
      modifiesC: wc === 1,
      modifiesZ: wz === 1,
      isBranch: this.isBranchInstruction(opcode),
      isCall: opcode >= 0x0D9 && opcode <= 0x0DD,
      isReturn: opcode === 0x0DA || (opcode >= 0x0DE && opcode <= 0x0DF)
    };
  }
  
  /**
   * Get a descriptive comment for an instruction
   */
  public getInstructionComment(instruction: DecodedInstruction): string {
    const analysis = this.analyzeInstruction(instruction.value);
    
    let comments: string[] = [];
    
    if (instruction.comment) {
      comments.push(instruction.comment);
    }
    
    if (analysis.isCall) {
      comments.push('Call subroutine');
    } else if (analysis.isReturn) {
      comments.push('Return from subroutine');
    } else if (analysis.isBranch) {
      comments.push('Branch');
    }
    
    if (instruction.isSkipped) {
      comments.push('SKIPPED');
    }
    
    return comments.join(', ');
  }
}