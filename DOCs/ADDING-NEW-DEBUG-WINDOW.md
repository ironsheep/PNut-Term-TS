# Adding New Debug Windows - Standard Process

This document captures the standard process for adding new debug window types to PNut-Term-TS, based on the successful planning approach used for the SCOPE_XY window implementation.

## Process Overview

### Phase 1: Pascal Source Analysis
1. **Locate and study Pascal implementation**:
   - Primary source: `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas`
   - Look for procedures: `[WINDOW_TYPE]_Configure`, `[WINDOW_TYPE]_Update`, and related methods
   - Study constants, data structures, and buffer sizes

2. **Document core functionality**:
   - Display modes and variations
   - Data structures and buffer management
   - Rendering approach and special features
   - Mouse/keyboard interaction patterns
   - Default values and constraints

3. **Find test examples**:
   - Check `/pascal-source/P2_PNut_Public/DEBUG-TESTING/` for `.spin2` examples
   - These will be referenced in JSDoc and inform testing approach

### Phase 2: Planning Documentation
Create a detailed implementation plan (`/tasks/[WINDOW_TYPE]_IMPLEMENTATION.md`) with these sections:

#### Required Plan Sections

1. **Pascal Source Analysis**
   - Core functionality description
   - Key features list
   - Pascal implementation details (Configure, Update, Plot/Render methods)
   - Mouse interaction behavior
   - Data flow and processing

2. **TypeScript Implementation Architecture**
   - File structure (main class, shared classes, test files)
   - Class hierarchy showing inheritance and dependencies
   - Clear identification of NEW vs EXISTING shared classes
   - Implementation requirements
   - Configuration and data interfaces

3. **Testing Strategy**
   - Incremental unit testing approach (build tests as we develop)
   - Unit test structure for each new class
   - Reference examples from DEBUG-TESTING (cite in JSDoc)
   - Coverage goals (minimum 80%)

4. **Implementation Steps**
   - Phase 1: Core Infrastructure
     - Create window class extending DebugWindowBase
     - Add comprehensive JSDoc (features, config params, data format, commands)
     - Basic configuration parsing
     - Canvas setup (using existing CanvasRenderer)
     - Input forwarding (using existing InputForwarder)
     - Initial test file
   
   - Phase 2: Shared Components
     - Implement NEW shared classes if needed
     - Study Pascal for exact rendering patterns
     - Test Canvas API capabilities during implementation
     - Integrate with EXISTING shared classes
     - Use exact colors/constants from Pascal
     - Add incremental tests
   
   - Phase 3-5: Progressive feature implementation
     - Display modes
     - Special features
     - Polish and commands
     - Complete test coverage

5. **Pascal Parity Checklist**
   - List all critical behaviors to match
   - Include exact values from Pascal (colors, limits, formulas)
   - Note what needs exact matching vs what can be optimized

6. **Risk Mitigation**
   - Performance considerations
   - Compatibility concerns
   - Technical debt items

7. **Success Criteria**
   - Functional parity
   - Visual parity
   - Performance targets
   - Test coverage
   - Documentation completeness

### Phase 3: Planning Review Process

#### Key Questions to Address
1. **Implementation Approach**:
   - Should we create new shared classes or extend existing ones?
   - Which existing shared classes can be reused?
   - Are there patterns from other windows we should follow?

2. **Technical Decisions**:
   - Canvas API capabilities vs custom implementation
   - Performance optimization opportunities
   - Browser compatibility considerations

3. **Pascal Matching Requirements**:
   - What must match exactly? (grids, colors, formulas)
   - What can be optimized for web environment?
   - Any artificial limits to avoid?

#### Planning Guidelines
- **No artificial limits**: Match Pascal exactly unless performance requires it
- **GPU acceleration**: Canvas 2D uses GPU automatically when available
- **Test incrementally**: Build tests as we develop, not all at end
- **Defer when appropriate**: Complex features can be marked as technical debt
- **Study Pascal patterns**: Examine exact rendering patterns before implementing
- **Use exact constants**: Colors, sizes, limits should match Pascal exactly
- **Document thoroughly**: Comprehensive JSDoc in Phase 1

### Phase 4: Review Iterations
1. Present initial plan
2. Incorporate feedback on:
   - Missing features or requirements
   - Technical approach adjustments
   - Testing strategy refinements
   - Shared class usage clarification
3. Update plan with feedback
4. Get final approval before starting implementation

## Standard Patterns to Follow

### Shared Class Usage
**Existing classes to leverage**:
- `CanvasRenderer` - Canvas operations
- `ColorTranslator` - Color system handling
- `PackedDataProcessor` - Packed data modes
- `InputForwarder` - Mouse/keyboard forwarding
- `DisplaySpecParser` - Configuration parsing (if applicable)

**When to create new shared classes**:
- Window-specific rendering logic
- Specialized data structures (buffers, managers)
- Complex coordinate transformations
- Reusable patterns not covered by existing classes

### Testing Approach
- Create test file immediately in Phase 1
- Add tests incrementally with each feature
- Test transformation logic thoroughly
- Test edge cases and boundaries
- Verify against Pascal examples when available
- **Coverage Requirements**:
  - Overall window implementation: minimum 80% coverage
  - Shared classes (`src/classes/shared/`): target 100% coverage when possible
  - New shared classes MUST achieve 100% coverage
  - Document any uncovered edge cases as technical debt

### Test Implementation Standards
**MANDATORY**: All tests must use shared test utilities for consistency:
- Use `tests/shared/mockHelpers.ts` for:
  - `createMockContext()` - Standard Context mock
  - `createMockBrowserWindow()` - Electron BrowserWindow mock
  - `createMockCanvasContext()` - Canvas 2D context mock
  - `setupDebugWindowTest()` - Complete test environment setup
- Use `tests/shared/debugWindowTestUtils.ts` for:
  - `setupDebugWindowTests()` - Standard debug window test setup
  - `triggerWindowCreation()` - Trigger BrowserWindow creation
  - `testCommand()` - Test command processing
  
**Test Validation Before Completion**:
1. Run individual test file: `npx jest tests/[window].test.ts`
   - MUST show "Test Suites: 1 passed" (no failures allowed)
2. Run coverage: `npm run test:coverage`
3. Use Claude helper scripts: `bash scripts/claude/check_tests.sh`
4. Verify no TypeScript errors in test files
5. Ensure all tests pass in Docker container environment
6. **CRITICAL**: If any test fails, the window is NOT complete - fix implementation or adjust tests to match actual behavior

### Documentation Requirements
**JSDoc must include**:
- Feature description and purpose
- Configuration parameters with types and defaults
- Data feeding format and examples
- Commands supported (CLEAR, SAVE, CLOSE, etc.)
- References to Pascal examples if available
- Any deviations from Pascal implementation

### Technical Debt Management
**Items commonly deferred**:
- Sub-pixel precision (unless Canvas API makes it easy)
- Custom anti-aliasing (if Canvas API is sufficient)
- Performance optimizations (unless critical)
- Browser-specific workarounds

**Always defer with documentation** explaining why and what would be needed to implement.

## Checklist for New Window Implementation

- [ ] Study Pascal source thoroughly
- [ ] Find and document test examples
- [ ] Create detailed implementation plan
- [ ] Identify NEW vs EXISTING shared classes
- [ ] Plan comprehensive JSDoc documentation
- [ ] Define incremental testing approach
- [ ] Review and iterate on plan
- [ ] Get approval before starting
- [ ] Create task list after plan approval
- [ ] Implement in phases with tests
- [ ] **Ensure all tests pass BEFORE marking complete**:
  - [ ] All unit tests must pass without errors
  - [ ] Every new test added must run without failures
  - [ ] Coverage tests must run without errors
  - [ ] Tests MUST use shared utilities from `tests/shared/*` for consistency
  - [ ] No skipped tests without documented technical debt
- [ ] Achieve minimum test coverage:
  - [ ] 80%+ for window implementation
  - [ ] 100% for new shared classes
  - [ ] 100% for existing shared class modifications
- [ ] Document any technical debt
- [ ] **Update project documentation after completion**:
  - [ ] Update CLAUDE.md implementation progress table (window count & percentage)
  - [ ] Update CLAUDE.md debug display status summary
  - [ ] Add window to docs/ARCHITECTURE.md implemented windows list
  - [ ] Add window to docs/TECHNICAL-DEBT.md Pascal documentation list
  - [ ] **Update docs/TEST-STATUS.md with all new test files**:
    - [ ] Add new test files to the test results table with pass/fail status and timings
    - [ ] Update total test count (e.g., "1014 tests across 33 files")
    - [ ] Add any new shared classes to coverage status section
    - [ ] Document any test fixes or special considerations in Recent Fixes section
  - [ ] **Update Claude helper scripts for new test files**:
    - [ ] Add new test files to `scripts/claude/run-all-tests.sh` TEST_FILES array
    - [ ] Add new test files to `scripts/claude/check_tests.sh` if applicable

## Example Success Stories

### SCOPE_XY Window Implementation
The SCOPE_XY window planning followed this process:
1. Analyzed Pascal source for display modes, persistence, transformations
2. Found 3 test examples in DEBUG-TESTING
3. Created detailed plan with 5 implementation phases
4. Identified 2 NEW shared classes needed
5. Clarified Canvas API testing approach
6. Specified exact Pascal constants to use
7. Deferred sub-pixel precision to technical debt
8. Achieved consensus on all implementation decisions

### FFT Window Implementation (December 2024)
The FFT window implementation demonstrated the effectiveness of this process:
1. **Planning Phase**: Created comprehensive 42-task plan across 5 phases
2. **Pascal Analysis**: Discovered non-standard Hanning window formula requiring exact replication
3. **Shared Classes Created**: 
   - `FFTProcessor` - Cooley-Tukey algorithm with 12-bit fixed-point math
   - `WindowFunctions` - Window function utilities with Pascal's exact formulas
4. **Test-Driven Development**: Created 7 test files with ~145 tests total
5. **Time Efficiency**: Completed in 3.5 hours vs 7.5 hour estimate (53% faster)
6. **Technical Debt Documented**: 
   - Hanning window mathematical differences tracked for discussion with Pascal author
   - Static method logging limitations identified
7. **Phased Implementation**:
   - Phase 1: Core infrastructure and base class
   - Phase 2: FFT processing algorithm
   - Phase 3: Data management and circular buffers
   - Phase 4: Rendering with line/bar/dot modes
   - Phase 5: Polish with CLEAR/SAVE commands
8. **Key Success Factors**:
   - Frequent state saving prevented loss during auto-compaction
   - Incremental testing caught issues early
   - Clear task tracking with actual vs estimated times
   - Documentation throughout the process

**Result**: 80% feature parity achieved with Pascal implementation, all core functionality working, comprehensive test coverage established.

## Lessons Learned from FFT Implementation

### What Worked Well
1. **Frequent State Saving**: Creating CURRENT_STATE documents before auto-compaction prevented work loss
2. **Phased Approach**: Breaking into 5 phases with clear boundaries enabled systematic progress
3. **Early Algorithm Testing**: Creating fftProcessor.test.ts early caught mathematical issues
4. **Task Time Tracking**: Recording actual vs estimated times improved future planning

### Areas for Improvement
1. **Keyword Parsing**: Should have added DOT, LINE, RANGE keywords to parser immediately
2. **Mock Completeness**: Test mocks need isDestroyed() and other base class methods
3. **Documentation Updates**: Should update project docs incrementally, not leave until end
4. **Static Method Logging**: Identified limitation that needs architectural solution

### Recommendations for Next Window
1. Start with keyword parsing for any new display-specific commands
2. Create comprehensive mocks for base class methods before writing tests
3. Update documentation files after each phase completion
4. Use TodoWrite tool consistently for task tracking
5. Save state at least every 30 minutes or before context gets large

This process ensures thorough understanding before coding begins, reducing rework and ensuring Pascal parity.