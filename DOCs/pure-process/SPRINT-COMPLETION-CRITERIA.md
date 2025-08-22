# Sprint Completion Criteria
## Living Document - Last Updated: 2025-08-12

## Definition of "Sprint Complete"

### Core Principle
**A sprint is ONLY complete when ALL tests pass.**

No exceptions. No deferrals. No "we'll fix it later."

### The Order (MUST follow):
1. **Implement Code** - Build all missing components
2. **Fix All Tests** - Make them pass correctly (not just pass)
3. **Update Documentation** - Based on what was built
4. **Ensure Stability** - Coverage, quality checks
5. **Commit** - Single comprehensive commit

## Critical Rules

### No Failing Tests as Technical Debt
- Tests are NEVER technical debt
- Cannot mark sprint complete with failing tests
- This prevents cascading failures in future sprints

### Test Fix Philosophy
- Fix the implementation, not the test
- If test expectation is wrong, document why
- Never stub or short-circuit tests
- Always implement the best solution

### Priority During Sprint

#### Critical Path
Tests that block other functionality:
- Infrastructure tests (base classes, routers)
- Shared component tests
- Integration tests

#### Can Defer During Sprint (but must fix before complete)
- Feature-specific tests
- Enhancement tests
- UI/cosmetic tests

**Important**: "Defer during sprint" means fix later in sprint, NOT leave broken

## Documentation Requirements

### Continuous (not end-of-sprint)
- Update TEST-STATUS.md when any test changes
- Update test scripts when adding new tests
- Document shared components as created
- Update architecture docs with changes

### Test Script Maintenance
When adding ANY new test file:
1. Add to `scripts/claude/run-all-tests.sh` immediately
2. Add to other relevant test scripts
3. Verify script runs the new test
4. Document in TEST-STATUS.md

## Quality Gates

### Before Marking Task Complete
- Relevant tests must pass
- Documentation updated
- Scripts updated if applicable

### Before Sprint Complete
- ALL tests pass (0 failures)
- NO .skip() or .todo() markers
- TEST-STATUS.md is current
- All test scripts include all files
- Coverage meets targets

## Handling Blocked Tasks

### When Task Dependencies Aren't Met
1. Identify missing dependency
2. Reorder tasks to build dependency first
3. Use MCP task dependencies if complex
4. Never skip - always resolve

### Accidental Task Starts
If task started by accident (wrong priority):
1. Pause the task
2. Document why paused
3. Resume when it becomes right priority
4. Don't force completion out of order

## Time vs Quality

### Principle
**Quality over speed, always.**

- Estimates are guidelines, not deadlines
- Take time needed to do it right
- Fast completion of broken code helps nobody
- We're usually faster than estimates anyway

## Lessons Learned

### From Sprint 1 (2025-08-12)
- Found 24 failing tests marked as "complete"
- Cause: No enforcement of completion criteria
- Fix: This document and mandatory gates

### Red Flags to Avoid
- "We'll fix tests later" → NO
- "It mostly works" → Not complete
- "Tests are wrapup tasks" → Tests are CRITICAL
- "Let's defer to technical debt" → Tests aren't debt

## Checklist for Sprint Completion

- [ ] All code implemented
- [ ] All tests passing (run full suite)
- [ ] No .skip() markers in tests
- [ ] TEST-STATUS.md updated
- [ ] Test scripts include all test files
- [ ] Documentation current
- [ ] Shared components documented
- [ ] Coverage targets met
- [ ] Clean build with no warnings
- [ ] Ready for single commit

If ANY box unchecked, sprint is NOT complete.