# Sprint Methodology for PNut-Term-TS

## Sprint Philosophy
**Broad Progress with Each External Build**

### Core Principles
1. **Rich Test Cycles** - Multiple fixes per external build to maximize learning
2. **Root Cause Analysis** - Hypothesis → Validate → Fix (never guess)
3. **No Error Recovery** - Every error must be fixed, no graceful degradation
4. **Perfect Transport** - Zero data loss at 2Mbps+ is the standard
5. **Document Everything** - Test findings, sprint plans, technical debt

### Sprint Process

#### 1. Test & Gather Feedback
- Run external test with P2 hardware
- Document console output
- Document debug window output
- Record visual observations
- Note unexpected behaviors

#### 2. Create Test Findings Document
```
tasks/TEST-FINDINGS-YYYY-MM-DD-HHMM.md
```
- Timestamp
- Build identifier
- Working/Not Working lists
- Critical findings
- Performance observations

#### 3. Create Sprint Plan
```
tasks/SPRINT-YYYY-MM-DD-HHMM.md
```
- Prioritized task list
- Rich task descriptions
- Model assignment (Sonnet/Opus)
- Success criteria

#### 4. Task Execution
- Work broad (multiple fronts)
- Test after each fix
- Document discoveries
- Update technical debt

#### 5. Validation
- TypeScript compilation (zero errors)
- Test suite passes (or documented why not)
- Build external package
- Test with hardware

#### 6. Commit
- Comprehensive commit message
- Document all changes
- Note remaining issues
- Update version if appropriate

### Task Priority System
- **Critical**: Blocks testing or core functionality
- **High**: Important but not blocking
- **Medium**: Polish and improvements
- **Low**: Investigation and future work

### Model Assignment Guidelines
**Sonnet-appropriate tasks:**
- DOM manipulation fixes
- Routing logic changes
- UI updates
- Simple debugging
- Documentation

**Opus-appropriate tasks:**
- Complex algorithm design
- Performance optimization
- Architecture changes
- Complex debugging
- Test creation

### Testing Requirements
**Two Testing Modes Required:**
1. **Mode 1 (Hot Sync)**: P2 already streaming, must synchronize
2. **Mode 2 (Clean Start)**: DTR reset for perfect sync

### Performance Standards
- Handle 2Mbps sustained (goal: 3.5Mbps)
- Zero data loss
- Worst case: continuous single-byte messages
- All 4 EOL forms handled correctly

### Documentation Requirements
Each sprint produces:
1. Test findings document
2. Sprint plan document
3. Updated technical debt
4. Commit with comprehensive message

## Current Sprint Naming Convention
Format: `SPRINT-YYYY-MM-DD-HHMM`
- Date/time based for clear chronology
- Allows multiple sprints per day
- Easy to reference historically