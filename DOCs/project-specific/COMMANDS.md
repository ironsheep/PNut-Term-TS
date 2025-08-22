# Commands Reference

## Essential Commands
- `npm run build` - Full build pipeline
- `npm test` - Run all tests (includes build)
- `npm run test:coverage` - Generate coverage reports (sequential for reliability)
- `npm run test:sequential` - All tests sequential (for resource management)
- `npm run clean` - Clean build artifacts
- `tsc --noEmit` - Quick type check
- Main executable: `dist/pnut-term-ts.min.js`

## Claude Helper Scripts
Located in `scripts/claude/` directory:
- `run-all-tests.sh` - Runs all test files individually with detailed pass/fail reporting
- `test-runner.sh` - Runs a single test file (pass filename as argument)
- `check_tests.sh` - Quick check of recently fixed test files

**CRITICAL BEFORE RUNNING TESTS**: 
1. **Always audit test scripts first** - The test file lists in these scripts may be out of date
2. **Check current test files**: `ls tests/*.test.ts`
3. **Check script contents**: `grep "TEST_FILES=" scripts/claude/*.sh`
4. **Update if needed** - Add any missing test files to the TEST_FILES array
5. **Never use `npm test` directly** - It runs tests in parallel and will saturate the container

**Important**: This project runs in a Docker container environment. Tests must be run sequentially (one at a time) to avoid resource conflicts and ensure reliable results. The Claude helper scripts were specifically created to handle this by iterating over test files one by one.

## Jest/NPM Test Command Gotcha
**IMPORTANT**: When running npm test with shell redirection, always use `--` to separate npm args:
```bash
# WRONG - Jest will interpret "2" as part of test pattern
npm test tests/file.test.ts 2>&1 | grep something

# CORRECT - Use -- to separate npm arguments
npm test -- tests/file.test.ts 2>&1 | grep something
```
Without `--`, Jest treats everything after the filename as test name patterns to match.

## Testing Commands
```bash
npm test                                    # Run all tests
npm run test:sequential                     # All tests sequential (for resource management)
npm run test:coverage                       # Coverage reports (sequential execution)
npm test -- tests/specific.test.ts          # Run specific test
npm test -- --testNamePattern="pattern"     # Run by pattern
```

## Finding Technical Debt
```bash
grep -r "TECH-DEBT" src/
grep -r "TODO" src/
grep -r "FIXME" src/
```