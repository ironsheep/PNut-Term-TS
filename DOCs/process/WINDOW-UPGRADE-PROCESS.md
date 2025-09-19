# Window Upgrade Process

## Overview
This document defines the standard process for upgrading debug windows to achieve Pascal parity and improved robustness.

## Phase 1: Discovery & Analysis

### 1.1 Gap Analysis
Compare TypeScript implementation against Pascal source:
- List all commands/features in Pascal version
- List all commands/features in TypeScript version
- Identify missing functionality
- Document behavioral differences
- **Mouse hover behavior**: Check coordinate display format and flyout positioning

### 1.2 Architecture Analysis
Examine current implementation for structural issues:
- Parser patterns (lookahead, string parsing, etc.)
- State management approach
- Rendering pipeline (main vs renderer process)
- Error handling and reporting

### 1.3 Pattern Identification
Look for established patterns in working windows:
- How do robust windows parse commands?
- How do windows emit errors to debug logger?
- What shared components are available?
- How do windows implement mouse hover coordinate display?

## Phase 2: Planning with Behavior Specifications

### 2.1 Document Behaviors, Not Implementations
For each command or feature, specify:

#### ✅ CORRECT: Behavior Specification
```markdown
## COMMAND_NAME
**Input Format**: `COMMAND <param1> <param2>`

**Expected Behavior**:
- Clear description of what should happen
- Edge cases and boundaries
- State changes that occur
- Persistence and scope of effects

**Test Cases**:
- `COMMAND 5` → Specific outcome
- `COMMAND -1` → Boundary behavior
- `COMMAND abc` → Error case

**Error Handling**:
- Missing parameters → Specific error message
- Invalid values → How to handle and report
```

#### ❌ WRONG: Implementation Details
```pascal
// Don't include Pascal code showing HOW it's done
if GetWord(s) = 'COMMAND' then
  ProcessCommand(GetNumber(s))
```

### 2.2 Why Behavior Specifications?
- **Language-agnostic**: Defines WHAT not HOW
- **Enables innovation**: TypeScript solution may be better
- **Clear acceptance criteria**: Implementer knows when done
- **Test-driven**: Test cases become unit tests

### 2.3 Include Concrete Examples
Every behavior should have:
- Valid input examples with expected outcomes
- Invalid input examples with error behaviors
- Boundary cases (min/max values, empty inputs)
- State-dependent behaviors if applicable

## Phase 3: Implementation Planning

### 3.1 Technical Architecture
Define high-level approach without prescribing implementation:
- Command processing pattern (registry, router, etc.)
- Error reporting strategy (logger integration)
- State management approach
- Performance considerations

### 3.2 Task Breakdown
Create phases based on:
- **Dependencies**: What must be done first?
- **Risk**: What's most likely to break?
- **Value**: What provides most user benefit?
- **Complexity**: Balance hard and easy tasks

### 3.3 Success Metrics
Define measurable outcomes:
- All Pascal commands implemented
- Parse errors visible in debug logger
- No regression in existing functionality
- Performance targets (if applicable)

## Phase 4: Handoff Documentation

### 4.1 Create Comprehensive Plan Document
Include:
1. Executive summary of issues found
2. Behavior specifications for all commands
3. Test cases as acceptance criteria
4. Technical approach (high-level)
5. Phased implementation plan
6. Success metrics

### 4.2 Preserve Context
Store key findings in MCP context:
- Gap analysis results
- Critical issues identified
- Architectural decisions made
- Implementation constraints

### 4.3 Clean Handoff
- DO NOT create tasks in MCP (let implementer create their own)
- DO provide exhaustive planning documentation
- DO include all resources and references
- DO specify expected outcomes, not methods

## Example Behavior Specifications

### Good Example: Mouse Hover Coordinate Display

**Expected Behavior**:
- Coordinate display appears as flyout/overlay at mouse position
- Format varies by window type (check Pascal's FormMouseMove)
- Flyout positioning avoids obscuring data (quadrant-based)
- Only displays when mouse within display area bounds
- Updates in real-time without lag
- Can be hidden with HIDEXY directive

**Test Cases**:
- Mouse at (100, 50) → Flyout shows "100,50" (format varies by window)
- Mouse near top-right corner → Flyout appears bottom-left of cursor
- Mouse outside display area → No flyout shown
- HIDEXY set → No flyout regardless of mouse position

**Pascal Reference**:
- DebugDisplayUnit.pas lines 647-746 (FormMouseMove procedure)
- Each window type has specific coordinate calculation
- Custom cursor with text overlay implementation

### Good Example: CONFIGURE SIZE Command

**Input Format**: `CONFIGURE SIZE <width>,<height>`

**Expected Behavior**:
- Sets the window's canvas dimensions in pixels
- Width must be between 32-2048 pixels
- Height must be between 32-2048 pixels
- Values outside range are clamped, not rejected
- Window chrome is added by the windowing system

**Test Cases**:
- `CONFIGURE SIZE 640,480` → Canvas becomes 640x480 pixels
- `CONFIGURE SIZE 10,10` → Canvas becomes 32x32 (minimum clamped)
- `CONFIGURE SIZE 3000,3000` → Canvas becomes 2048x2048 (maximum clamped)
- `CONFIGURE SIZE 640` → Error: "Missing height parameter"

**Error Handling**:
- Missing width or height → Emit error, maintain current size
- Non-numeric values → Emit error with unparseable value
- Negative values → Clamp to minimum (32)

## Key Principles

1. **Describe outcomes, not methods**: What should happen, not how to code it
2. **Be exhaustive in test cases**: Cover normal, edge, and error cases
3. **Specify error messages**: Exact text helps debugging
4. **Define boundaries clearly**: Min/max values, valid ranges
5. **Consider state**: What persists, what resets, what's transient

## Deliverables

1. **Gap Analysis Document**: What's missing/broken
2. **Implementation Plan**: Phased approach with behavior specs
3. **Context Preservation**: Key findings in MCP
4. **Handoff Document**: Summary for next implementer

## Anti-patterns to Avoid

- ❌ Including Pascal/TypeScript code snippets
- ❌ Prescribing specific algorithms
- ❌ Creating MCP tasks for implementer
- ❌ Mixing implementation with specification
- ❌ Vague error descriptions ("handle errors appropriately")

## Success Criteria

The upgrade process succeeds when:
- All behaviors are clearly specified
- Test cases provide complete coverage
- Implementer can work without ambiguity
- No Pascal code consultation needed during implementation
- Error cases are as detailed as success cases
- Mouse hover coordinate display matches Pascal format and positioning