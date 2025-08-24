# Technical Climbing Methodology

## The Core Project Principle

In technical climbing, climbers place protection (pitons, cams, nuts) as they ascend. If they fall, they only fall to their last protection point, not to the ground. 

In the PNut-Term-TS project, **working code + comprehensive tests + process documentation** IS our protection.

## How It Works

### Protection = Documentation
Every successful pattern, process, or discovery gets documented immediately. This documentation becomes our protection point - we can never fall below this level of quality or understanding.

### Climbing = Iteration
Each iteration of our work builds from the last protected position. We can only climb higher, never fall below our last documented success.

### The Route = Continuous Improvement
Each attempt reveals more of the route ahead. We document what worked (protection placed) and what opportunities we see (the route forward).

## Universal Application

This methodology applies to EVERY aspect of the PNut-Term-TS project:

### 1. Code Quality & Architecture
- Each working pattern protected by documentation
- Each fix can only improve the system
- No regression in functionality

### 2. Testing Framework
- Each test success documented and preserved
- Process hardened against code changes that break tests
- Coverage monotonically improves

### 3. Message Processing Pipeline
- Each classification/routing pattern documented
- Processing accuracy only increases
- Data integrity never compromised

### 4. Debug & Development Process
- Each session's learnings captured
- Friction points documented and eliminated
- Development velocity continuously improves

## The Four Pillars of PNut-Term-TS

All four pillars climb together:

1. **Serial Message Processing** - Each iteration handles P2 data more accurately
2. **Debug Window Management** - Each version displays information more effectively  
3. **Testing Infrastructure** - Each test suite catches more edge cases
4. **Development Process** - Each methodology iteration prevents more mistakes

## Implementation Rules

### Rule 1: Document Immediately
When something works → Document it NOW
When you see a gap → Document it NOW
When you learn something → Document it NOW

**Never think "I'll document this later"** - Later means lost.

### Rule 2: Protection Before Progress
Before starting new work:
- Review existing documentation
- Understand current protection points
- Plan to climb from there

### Rule 3: No Backward Movement
If something seems worse than before:
- STOP immediately
- Check documentation
- Find where we departed from protected route
- Return to last protection point

### Rule 4: Every Session Climbs
Each work session must:
- Start from documented position
- Add at least one protection point
- Leave documentation better than found

## Quality Gates as Protection

### Before Any Code Change
- Do all existing tests pass? (Our current protection level)
- Are we building on working functionality?
- Can we prove our change fixes the issue without breaking anything?

### Before Committing Changes
- What working patterns did we preserve?
- What edge cases are we now handling?
- How will we know we haven't regressed?

### After Any Debug Session
- What protection did we place? (New tests, documentation, working fixes)
- What route did we discover? (Better understanding of the system)
- What should the next session know? (Context, gotchas, next steps)

## Practical Application

### In Test Results Documentation
```markdown
**Protection Points (What We Keep):**
- MessageExtractor correctly classifies COG messages
- CircularBuffer handles boundary conditions perfectly
- WindowRouter preserves all message data integrity

**Climbing Higher (What Improves):**
- Binary packet classification now accurate
- Debug Logger displays formatted properly
- Integration tests catch cross-component issues
```

### In Process Documents
```markdown
## Technical Climbing Protocol
This debug session follows technical climbing:
- Previous success: [what tests were passing, what functionality worked]
- Protection placed: [new tests written, documentation updated, fixes validated]
- Next climb: [remaining issues, opportunities for improvement]
```

### In Session Work
```bash
# Start of session
mcp__todo-mcp__context_resume  # Where are our protection points?

# During debugging
"This test passes!" → Document the working pattern immediately
"This code breaks tests" → Document the failure point before fixing
"This classification works" → Capture the successful logic

# During development  
"This routing pattern works" → Document it before moving on
"This display formatting is correct" → Save the working implementation
"This integration test catches the bug" → Preserve the test case

# End of session
Update test results documentation with findings
Update process docs with lessons learned  
Commit working code changes (protection placed)
Save context for next session
```

## The Payoff

### Short Term
- No repeated debugging of the same issues
- No lost understanding of complex message flows
- Clear progress visible in working tests

### Long Term
- Exponential code quality improvement
- System knowledge preserved and documented
- New developers start from solid understanding

### Ultimate Goal
Every aspect of PNut-Term-TS becomes more robust with each iteration, and can never become less reliable.

## Remember

**Tests + Documentation isn't overhead - it's protection.**

Every test you write is a piton. Every process you document is a cam. Every working pattern you capture is an anchor. Together, they ensure our code quality can only climb higher.

When in doubt: Test it. Document it. Protect it.

---

*"The best developers aren't the ones who never introduce bugs. They're the ones who place good protection so bugs can't break the system."*

---

**This methodology is mandatory for all PNut-Term-TS development work.**

Last Updated: 2025-08-23
Status: Core Project Principle