/** @format */

// tests/disassembler.test.ts

import { Disassembler, DecodedInstruction } from '../src/classes/shared/disassembler';

describe('Disassembler', () => {
  let disassembler: Disassembler;

  beforeEach(() => {
    disassembler = new Disassembler();
  });

  describe('Instruction Decoding', () => {
    it('should decode NOP instruction', () => {
      const instruction = disassembler.decodeInstruction(0x000, 0xF0000000);
      
      expect(instruction.opcode).toContain('op_'); // NOP is special
      expect(instruction.condition).toBe('');
      expect(instruction.address).toBe(0x000);
    });

    it('should decode ADD instruction', () => {
      // ADD $100, $101
      const value = 0xF0A80201 | (0x100 << 9) | 0x101;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.opcode).toBe('add');
      expect(instruction.destination).toBe('$100');
      expect(instruction.source).toBe('$101');
      expect(instruction.condition).toBe('');
    });

    it('should decode immediate ADD instruction', () => {
      // ADD $100, #5
      const value = 0xF0A80201 | (1 << 22) | (0x100 << 9) | 5;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.opcode).toBe('add');
      expect(instruction.destination).toBe('$100');
      expect(instruction.source).toBe('#5');
    });

    it('should decode conditional instruction', () => {
      // if_z ADD $100, $101
      const value = 0xA0A80201 | (0x100 << 9) | 0x101; // Condition 0xA = if_z
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.condition).toBe('if_z');
      expect(instruction.opcode).toBe('add');
    });

    it('should decode instruction with WC and WZ flags', () => {
      // ADD $100, $101 wc,wz
      const value = 0xF0A80201 | (1 << 20) | (1 << 19) | (0x100 << 9) | 0x101;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.effects).toBe('wc,wz');
    });

    it('should handle special registers', () => {
      // MOV outa, #$FF
      const value = 0xF0C80201 | (1 << 22) | (0x1F4 << 9) | 0xFF;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.destination).toBe('outa');
      expect(instruction.source).toBe('#$ff');
    });

    it('should decode JMP instruction', () => {
      // JMP #label (relative)
      const value = 0xF0D80000 | 10; // Jump forward 10 instructions
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.opcode).toBe('jmp');
      expect(instruction.source).toContain('$');
    });
  });

  describe('Skip Pattern Handling', () => {
    it('should mark skipped instructions', () => {
      disassembler.setProgramCounter(0x100);
      disassembler.setSkipPattern(0b101); // Skip 1st and 3rd instructions
      
      const inst1 = disassembler.decodeInstruction(0x104, 0xF0A80201);
      const inst2 = disassembler.decodeInstruction(0x108, 0xF0A80201);
      const inst3 = disassembler.decodeInstruction(0x10C, 0xF0A80201);
      
      expect(inst1.isSkipped).toBe(true);  // First instruction skipped
      expect(inst2.isSkipped).toBe(false); // Second not skipped
      expect(inst3.isSkipped).toBe(true);  // Third skipped
    });

    it('should not skip instructions before PC', () => {
      disassembler.setProgramCounter(0x100);
      disassembler.setSkipPattern(0b111);
      
      const inst = disassembler.decodeInstruction(0x0FC, 0xF0A80201);
      expect(inst.isSkipped).toBe(false);
    });
  });

  describe('Disassembly Formatting', () => {
    it('should format basic instruction line', () => {
      const instruction: DecodedInstruction = {
        address: 0x100,
        value: 0xF0A80201,
        condition: '',
        opcode: 'add',
        destination: '$100',
        source: '$101',
        effects: '',
        comment: '',
        isSkipped: false
      };
      
      const line = disassembler.formatDisassemblyLine(instruction);
      
      expect(line).toContain('00100:');
      expect(line).toContain('F0A80201');
      expect(line).toContain('add $100, $101');
    });

    it('should format conditional instruction', () => {
      const instruction: DecodedInstruction = {
        address: 0x104,
        value: 0xA0A80201,
        condition: 'if_z',
        opcode: 'add',
        destination: '$100',
        source: '#10',
        effects: 'wc',
        comment: '',
        isSkipped: false
      };
      
      const line = disassembler.formatDisassemblyLine(instruction);
      
      expect(line).toContain('if_z add $100, #10 wc');
    });

    it('should mark skipped instructions', () => {
      const instruction: DecodedInstruction = {
        address: 0x108,
        value: 0xF0A80201,
        condition: '',
        opcode: 'mov',
        destination: '$100',
        source: '$101',
        effects: '',
        comment: '',
        isSkipped: true
      };
      
      const line = disassembler.formatDisassemblyLine(instruction);
      
      expect(line.startsWith('-')).toBe(true); // Skip marker
    });

    it('should include PC marker in comment', () => {
      disassembler.setProgramCounter(0x100);
      const instruction = disassembler.decodeInstruction(0x100, 0xF0A80201);
      const line = disassembler.formatDisassemblyLine(instruction);
      
      expect(line).toContain('← PC');
    });

    it('should format without hex when requested', () => {
      const instruction: DecodedInstruction = {
        address: 0x100,
        value: 0xF0A80201,
        condition: '',
        opcode: 'add',
        destination: '$100',
        source: '$101',
        effects: '',
        comment: '',
        isSkipped: false
      };
      
      const line = disassembler.formatDisassemblyLine(instruction, false);
      
      expect(line).not.toContain('F0A80201');
      expect(line).toContain('add $100, $101');
    });
  });

  describe('Block Disassembly', () => {
    it('should disassemble block of instructions', () => {
      const instructions = [
        0xF0A80201, // ADD
        0xF0AC0201, // SUB
        0xF0C00201, // AND
        0xF0C80201  // MOV
      ];
      
      const decoded = disassembler.disassembleBlock(0x100, instructions, 4);
      
      expect(decoded).toHaveLength(4);
      expect(decoded[0].address).toBe(0x100);
      expect(decoded[1].address).toBe(0x104);
      expect(decoded[2].address).toBe(0x108);
      expect(decoded[3].address).toBe(0x10C);
    });

    it('should limit block size', () => {
      const instructions = new Array(100).fill(0xF0A80201);
      const decoded = disassembler.disassembleBlock(0x000, instructions, 16);
      
      expect(decoded).toHaveLength(16);
    });
  });

  describe('Instruction Analysis', () => {
    it('should identify instructions that modify flags', () => {
      // ADD with WC and WZ
      const value = 0xF0A80201 | (1 << 20) | (1 << 19);
      const analysis = disassembler.analyzeInstruction(value);
      
      expect(analysis.modifiesC).toBe(true);
      expect(analysis.modifiesZ).toBe(true);
    });

    it('should identify branch instructions', () => {
      const jmpValue = 0xF0D80000; // JMP
      const jmpAnalysis = disassembler.analyzeInstruction(jmpValue);
      
      expect(jmpAnalysis.isBranch).toBe(true);
      expect(jmpAnalysis.isCall).toBe(false);
      expect(jmpAnalysis.isReturn).toBe(false);
    });

    it('should identify call instructions', () => {
      const callValue = 0xF0D90000; // CALL
      const analysis = disassembler.analyzeInstruction(callValue);
      
      expect(analysis.isBranch).toBe(true);
      expect(analysis.isCall).toBe(true);
      expect(analysis.isReturn).toBe(false);
    });

    it('should identify return instructions', () => {
      const retValue = 0xF0DA0000; // RET
      const analysis = disassembler.analyzeInstruction(retValue);
      
      expect(analysis.isBranch).toBe(true);
      expect(analysis.isCall).toBe(false);
      expect(analysis.isReturn).toBe(true);
    });
  });

  describe('Instruction Comments', () => {
    it('should generate appropriate comments', () => {
      const callInstruction: DecodedInstruction = {
        address: 0x100,
        value: 0xF0D90000,
        condition: '',
        opcode: 'call',
        destination: '',
        source: '#$200',
        effects: '',
        comment: '',
        isSkipped: false
      };
      
      const comment = disassembler.getInstructionComment(callInstruction);
      expect(comment).toContain('Call subroutine');
    });

    it('should combine multiple comments', () => {
      disassembler.setProgramCounter(0x100);
      const instruction = disassembler.decodeInstruction(0x100, 0xF0DA0000); // RET at PC
      const comment = disassembler.getInstructionComment(instruction);
      
      expect(comment).toContain('← PC');
      expect(comment).toContain('Return from subroutine');
    });

    it('should mark skipped instructions in comments', () => {
      disassembler.setProgramCounter(0x100);
      disassembler.setSkipPattern(0b1);
      
      const instruction = disassembler.decodeInstruction(0x104, 0xF0A80201);
      const comment = disassembler.getInstructionComment(instruction);
      
      expect(comment).toContain('SKIPPED');
    });
  });

  describe('Operand Formatting', () => {
    it('should format small immediates as decimal', () => {
      // MOV $100, #5
      const value = 0xF0C80201 | (1 << 22) | (0x100 << 9) | 5;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.source).toBe('#5');
    });

    it('should format large immediates as hex', () => {
      // MOV $100, #$FF
      const value = 0xF0C80201 | (1 << 22) | (0x100 << 9) | 0xFF;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.source).toBe('#$ff');
    });

    it('should format register addresses', () => {
      // MOV $1F4, $1F5
      const value = 0xF0C80201 | (0x1F4 << 9) | 0x1F5;
      const instruction = disassembler.decodeInstruction(0x100, value);
      
      expect(instruction.destination).toBe('outa'); // $1F4 = outa
      expect(instruction.source).toBe('outb');      // $1F5 = outb
    });
  });
});