# Test Cycle Methodology

## Purpose
Standardized process for external testing cycles to achieve full application functionality through systematic issue identification, root cause analysis, and resolution.

## Test Cycle Process

### Phase 1: Issue Collection
1. **External Test Execution**: User runs application with real hardware
2. **Issue Documentation**: All findings documented in `test-results/external-test-results-YYYY-MM-DDTHH-MM-SS.md`
3. **Criticality Assignment**: **ALL ISSUES ARE CRITICAL** during functionality development

### Phase 2: Root Cause Research
1. **Issue Analysis**: Research each identified problem systematically
2. **Root Cause Investigation**: Chase every issue to fundamental cause
3. **Impact Assessment**: Understand full scope of each problem
4. **Solution Planning**: Document proposed fixes before implementation

### Phase 3: Fix Implementation
1. **Address All Critical Issues**: Work through entire list systematically  
2. **Verification**: Ensure each fix addresses root cause
3. **Integration**: Maintain system coherence during fixes

### Phase 4: Quality Assurance
1. **Compilation Check**: Ensure code compiles without errors
2. **Sequential Regression Tests**: Run test suite one test at a time
   - Use `scripts/claude/run_tests_sequentially.sh`
   - **NEVER** use `npm test` without args (causes container saturation)
   - Individual tests OK: `npm test -- specific.test.ts`
3. **Fix Any Regression Failures**: Address test failures before proceeding

### Phase 5: Package & Deploy
1. **External Package Build**: Use `./scripts/create-electron-ready-package.sh`
   - **DO NOT** use `npm run packageMac` (broken dmg-license)
2. **Package Verification**: Confirm successful build
3. **Test Ready**: Wait for next external testing cycle

## Key Principles

### Issue Severity
- **ALL issues during functionality development are CRITICAL**
- No issue prioritization until core functionality complete
- Every problem gets full root cause analysis

### Research Before Implementation
- Understand the problem completely before coding
- Document root cause analysis
- Present findings and proposed solutions for review
- Get approval before implementation begins

### Systematic Approach  
- Work through issues methodically
- One complete cycle at a time
- Don't skip quality assurance steps
- Maintain comprehensive documentation

### Documentation Requirements
- Test results captured in timestamped files
- Root cause analysis documented
- Proposed fixes documented before implementation
- Cycle completion confirmed before next iteration

## Success Criteria
- All identified issues resolved to root cause
- No compilation errors
- All regression tests passing
- External package builds successfully
- Ready for next test cycle

This process ensures systematic progress toward full functionality while maintaining code quality and preventing regressions.