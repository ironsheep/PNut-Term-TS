# External Hardware Test Protocol

## CRITICAL: This Process is MANDATORY for ALL External Hardware Tests

### Phase 1: IMMEDIATE DATA CAPTURE
When user provides test data, **IMMEDIATELY** save everything:

1. **Console Logs** - Every line, including:
   - `[SERIAL RX]` messages with byte counts
   - Complete hex dumps
   - Routing messages
   - Error messages
   - Timing information

2. **Window Outputs** - All debug window contents:
   - Debug Logger output
   - Terminal output  
   - Any other window data provided

3. **User Observations** - Exactly as stated:
   - What worked
   - What failed
   - Unexpected behaviors
   - Device responses

**ACTION:** Use Write tool to save to `test-results/YYYY-MM-DD_HHMM_hardware_test_raw.md`

### Phase 2: DEEP ANALYSIS
After capturing raw data, perform comprehensive analysis:

1. **Data Flow Analysis**
   - Trace bytes from receipt to display
   - Identify where data is lost/corrupted
   - Map expected vs actual behavior

2. **Pattern Recognition**
   - Identify packet boundaries
   - Verify message types
   - Check byte sequences

3. **Issue Identification**
   - List all problems found
   - Categorize by severity
   - Note any regressions

**ACTION:** Append analysis to same file under "## Analysis" section

### Phase 3: CODE INVESTIGATION
Based on analysis, inspect relevant code:

1. **Root Cause Analysis**
   - Find exact code locations causing issues
   - Identify why failures occur
   - Document code flow problems

2. **Solution Development**
   - Propose specific fixes
   - Include file names and line numbers
   - Explain why fix will work

**ACTION:** Append solutions to file under "## Solutions" section

### Phase 4: CONTINUOUS UPDATES
As work progresses:

1. **Document Fix Attempts**
   - What was tried
   - Results of each attempt
   - Why it worked/failed

2. **Track Verification**
   - Test results after fixes
   - Confirmation of resolution
   - Any new issues discovered

**ACTION:** Keep updating the same test file throughout session

## File Structure Template

```markdown
# Hardware Test Results - YYYY-MM-DD HH:MM

## Raw Test Data
[PASTE EVERYTHING USER PROVIDES HERE - VERBATIM]

## Analysis
[YOUR DEEP ANALYSIS HERE]

## Problems Identified
[LIST OF ISSUES FOUND]

## Solutions
[CODE FIXES WITH FILE:LINE REFERENCES]

## Implementation Progress
[UPDATES AS FIXES ARE APPLIED]

## Verification Results
[FINAL TEST OUTCOMES]
```

## Why This Matters

- **Test data cannot be recreated** - Once lost, it's gone forever
- **Raw bytes are truth** - They show exactly what hardware sends
- **Complete artifacts enable debugging** - Future sessions can reference past tests
- **Progress tracking** - Shows what was tried and what worked

## Remember

**NEVER** proceed with analysis before saving raw data.
**ALWAYS** create the file immediately upon receiving test data.
**CONTINUOUSLY** update the file as investigation proceeds.

This is not optional - it's a critical process requirement.