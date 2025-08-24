# Test-Driven Debugging Methodology

## Core Principle: Tests Are The Truth
```
Tests are the bible that locks down class requirements.
If a class isn't doing something correctly and the test doesn't detect it,
the test is incomplete, not the class.
```

## Mandatory Testing Discipline

### Before Any Code Change:
1. **Run existing tests** for that component - do they pass?
2. **Run integration tests** that use that component - do they pass?
3. **After your change**: do ALL tests still pass?
4. **If tests break** → ANALYZE FIRST:
   - Are we legitimately changing class behavior? (update test expectations)
   - Did we break existing functionality? (fix the code)
   - Are we adding untested features? (expand test coverage)
   - **ONLY revert** if analysis shows we broke existing functionality
   - If changing behavior legitimately → update tests accordingly
   - **If unsure** → STOP and consult human operator

## Test-First Debugging Process

Replace: Change code → Build → Test externally → Debug why it didn't work

With: Find/Write test → Verify it fails → Fix code → Test passes

1. **FIND THE TEST**: Which test exercises the broken behavior?
2. **VERIFY FAILURE**: Does the test detect the problem and fail?
3. **FIX THE CODE**: Change code until test passes
4. **VALIDATE**: All other tests still pass

## Anti-Experiment Discipline

### Never:
- "Let me try changing this and see what happens"
- Random component testing without systematic analysis

### Always:
- "Let me write/run a test that shows this is broken, then fix it"
- Systematic component identification based on responsibilities

### When Tests Don't Show The Problem:
1. **SYSTEMATICALLY identify** which component SHOULD handle this behavior
2. **If you can't find the right component**, analyze WHY:
   - Is the behavior split across multiple components?
   - Are you missing a layer in the architecture?
   - Is the behavior not implemented yet?
3. **DON'T randomly try different components**
4. **If analysis doesn't yield clear answers** → STOP and get human guidance

## Component Boundary Understanding

### Before Modifying Any Class:
1. **Read existing class documentation** - what are ALL the behaviors this class should implement?
2. **If documentation is missing/incomplete** → study the class implementation and document what it actually does
3. **Identify boundaries** - what should it NOT do (responsibilities/limits)
4. **Verify your change fits** within stated responsibilities
5. **If expanding responsibilities** → justify and document the expansion
6. **After modification** → update class documentation to reflect new/changed behavior

### Class Documentation Standards:
```typescript
/**
 * ClassName: One-line description of primary responsibility
 * 
 * RESPONSIBILITIES:
 * - Specific behavior A that this class handles
 * - Specific behavior B that this class provides  
 * - Specific behavior C that this class manages
 * 
 * NOT RESPONSIBLE FOR:
 * - Things this class should not do
 * - Behaviors that belong in other components
 * - Cross-cutting concerns handled elsewhere
 * 
 * DEPENDENCIES:
 * - Other classes this depends on and why
 * - External resources this class needs
 * 
 * TESTING NOTES:
 * - Key behaviors that must be tested
 * - Edge cases this class should handle
 * - Integration points to validate
 */
```

### Touch a Class, Improve Its Documentation:
Every interaction with a class is an opportunity to strengthen our protection:
- **Reading a class** → if documentation unclear, improve it
- **Modifying a class** → update documentation to reflect changes
- **Testing a class** → document discovered behaviors and edge cases
- **Debugging a class** → capture insights about how it actually works

## Path Validation Through Testing

### To Prove You're In The Right Place:
1. **Add logging** to suspected component
2. **Write/run test** that exercises the broken path
3. **Verify your logging appears** in test output
4. **If logging doesn't appear** → wrong component
5. **If logging appears but behavior is correct** → test needs better assertions

## Change Impact Detection

### The Testing Framework Guards Against Wrong Changes:
- **Change the right component** → its test passes, others unaffected
- **Change the wrong component** → multiple tests fail (red flag!)
- **Break a dependency** → downstream tests fail (immediate feedback)

### Test Failures Are Navigation Signals:
- **Many tests failing** → you broke something fundamental
- **One test failing** → you're in the right area, refine your fix
- **No tests failing** → your change isn't in any tested path

## Zero Tolerance Testing Posture

- **ALL tests must pass** after every change
- **Fix tests** that were previously broken and ignored
- **No "leaving problems for later"**
- **Tests are contracts** - broken tests mean broken contracts

---

**Document Version:** 1.0  
**Date:** 2025-08-23  
**Status:** MANDATORY REFERENCE - Read before debugging any issue