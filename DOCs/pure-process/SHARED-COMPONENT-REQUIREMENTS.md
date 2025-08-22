# Shared Component Requirements
## Living Document - Last Updated: 2025-08-12

## Core Philosophy

**Before creating ANY new code, ask:**
1. Does something similar already exist?
2. Should this be shared?
3. Who else might use this?

## Mandatory Analysis Process

### Before Creating New Classes

#### Step 1: Audit Existing Shared Components
- Check `src/classes/shared/` (or equivalent)
- Check `tests/shared/` for test utilities
- Search for similar functionality
- Document what you found

#### Step 2: Evaluate for Sharing
Ask these questions:
- Will multiple components need this?
- Is this a common pattern?
- Could this benefit future features?
- Is this solving a general problem?

**If YES to any**: Create as shared component

#### Step 3: Document Decision
If keeping component-specific:
- Document WHY it's not shared
- Note in code comments
- Add to technical debt if might change

### Before Creating New Tests

#### Step 1: Check Shared Test Utilities
- Review `tests/shared/mockHelpers.ts` (or equivalent)
- Check for existing mock factories
- Look for common test patterns
- Identify reusable assertions

#### Step 2: Extract Reusable Patterns
When writing tests, identify:
- Common mocks (extract to shared)
- Repeated setup (create helpers)
- Useful assertions (make utilities)
- Test data factories (share them)

#### Step 3: Create in Shared First
- Don't create mocks in individual tests
- Put them in shared utilities
- Document for discovery
- Update other tests to use them

## Examples of Good Sharing

### Implementation Components
```typescript
// GOOD: Created as shared
src/classes/shared/WindowRouter.ts  // Used by all windows
src/classes/shared/ColorTranslator.ts  // Used by multiple displays

// BAD: Should have been shared
src/components/SpecificWindowPlacer.ts  // Only one window uses, but all could
```

### Test Utilities
```typescript
// GOOD: In shared utilities
tests/shared/mockHelpers.ts:
  - createMockBrowserWindow()  // All tests use this
  - createMockContext()  // Reusable everywhere

// BAD: Duplicated in tests
tests/window1.test.ts: const mockWindow = {...}  // Duplicated
tests/window2.test.ts: const mockWindow = {...}  // Same mock!
```

## Planning Requirements

### In Task Descriptions
Every implementation task MUST include:
- [ ] List of existing shared classes to use
- [ ] Identification of new shared classes to create
- [ ] Justification if not creating as shared

### In Test Planning
Every test task MUST include:
- [ ] List of shared test utilities to use
- [ ] New test utilities to extract
- [ ] Documentation plan for new utilities

## Anti-Patterns to Avoid

### The "I'll Share It Later" Trap
- Never plan to refactor to shared later
- Sharing is harder after code is written
- Dependencies form quickly
- Technical debt accumulates

### The "It's Too Specific" Excuse
- Most functionality can be generalized
- Parameters can make things flexible
- Better to over-share than under-share
- Refactoring to specific is easier than to general

### The "Not My Problem" Mindset
- Think beyond current feature
- Consider future developers
- Your specific need today might be common tomorrow
- Leave codebase better than you found it

## Enforcement Checklist

### During Planning
- [ ] Identified ALL existing shared components
- [ ] Evaluated EVERY new component for sharing
- [ ] Documented sharing decisions
- [ ] Added shared requirements to tasks

### During Implementation
- [ ] Using identified shared components
- [ ] Creating new shared components as planned
- [ ] Extracting discovered patterns to shared
- [ ] Documenting shared components

### During Testing
- [ ] Using shared test utilities
- [ ] Creating new utilities in shared
- [ ] Updating other tests to use new utilities
- [ ] Documenting test utilities

### During Review
- [ ] No duplicate code across components
- [ ] No duplicate mocks across tests
- [ ] Shared components are actually shared
- [ ] Documentation explains sharing decisions

## Lessons Learned

### From Sprint 1 (2025-08-12)
- WindowPlacer created as specific, should be shared
- Multiple test files have duplicate BrowserWindow mocks
- No requirement to evaluate for sharing
- Result: Inconsistent implementations, harder maintenance

## Success Metrics

### Good Sprint
- High reuse of existing shared components
- New shared components created
- No duplicate implementations
- Consistent patterns across codebase

### Bad Sprint
- Lots of specific implementations
- Duplicate code across files
- Missed sharing opportunities
- Inconsistent approaches to same problem