# Systematic Change Process - PNut-Term-TS

## Pre-Change Planning Process

### For Any Component Modification:
1. **READ CLASS DOCUMENTATION**: What are this class's stated responsibilities?
2. **IF DOCUMENTATION MISSING/INCOMPLETE**: Study implementation and document what it actually does
3. **VERIFY CHANGE FITS**: Does your modification belong in this class's scope?
4. **IDENTIFY DEPENDENCIES**: Which classes use this component?
5. **IDENTIFY TESTS**: Which test files exercise this component?
6. **PRE-PLAN IMPACT**: Which tests likely need updates for new behavior?
7. **STUDY IMPLEMENTATION**: Understand current behavior deeply
8. **CHANGE IMPLEMENTATION**: Make the necessary modifications
9. **UPDATE CLASS DOCUMENTATION**: Reflect new/changed behaviors and responsibilities
10. **UPDATE TESTS**: Modify tests to match new behavior
11. **VALIDATE**: All tests pass, new behavior works correctly

### Class Documentation Standards (see TEST-DRIVEN-DEBUGGING-METHODOLOGY.md):
Every class should clearly document:
- **RESPONSIBILITIES**: What this class handles
- **NOT RESPONSIBLE FOR**: What belongs elsewhere  
- **DEPENDENCIES**: What this class needs
- **TESTING NOTES**: Key behaviors to test

### Touch a Class, Improve Its Documentation:
- **Reading a class** → if documentation unclear, improve it
- **Modifying a class** → update documentation to reflect changes  
- **Testing a class** → document discovered behaviors
- **Debugging a class** → capture insights about how it works

## Ground Zero Recovery Protocol

### When System is Corrupted by Changes:
1. **Identify broken tests** in modified components
2. **Revert ALL modifications** that broke functionality
3. **Verify baseline tests pass** again
4. **Run integration tests** → verify system integrity
5. **Confirm working baseline** before new attempts
6. **ONLY THEN** start systematic fixes

## Component-Specific Testing Patterns

### MessageExtractor Testing:
- Feed complete known binary data to buffer
- Verify byte-perfect classification accuracy
- Test each message type boundary detection
- Validate no bytes lost or corrupted
- Check pattern matching logic with logging

### WindowRouter Testing:
- Capture console.log output in tests
- Exercise message routing decisions
- Verify messages reach correct destinations
- Test routing configuration changes
- Validate no message loss or duplication

### Display Component Testing:
- Instrument output formatting
- Test each message type rendering
- Capture formatted output in tests
- Verify defensive binary display
- Test edge cases and error conditions

### Circular Buffer Testing:
- Byte accounting validation (input = output)
- Boundary condition testing
- Position save/restore verification
- No data corruption validation
- Performance under load testing

## Integration Testing Requirements

### Full Stack Message Flow:
1. **Serial input** → CircularBuffer
2. **Buffer** → MessageExtractor
3. **Extractor** → WindowRouter  
4. **Router** → Display Components
5. **Validate** every step preserves data integrity
6. **Test** with realistic P2 hardware message patterns

## Console Log Integration

### Test Framework Logging Capture:
- Capture console.log output during tests
- Verify component logging for debugging
- Test message routing through log analysis
- Validate error reporting and warnings
- Use logging to prove execution paths

## Validation Procedures

### After Any Change:
1. **Unit tests pass** for modified component
2. **Integration tests pass** for affected systems
3. **No regression** in unrelated functionality
4. **New behavior** works as intended
5. **Documentation updated** for any API changes

---

**Document Version:** 1.0  
**Date:** 2025-08-23  
**Status:** MANDATORY - Follow for all code modifications in PNut-Term-TS