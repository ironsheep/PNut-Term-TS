# CLAUDE.md

Essential guidance for Claude Code in PNut-Term-TS repository.

## 🎯 SESSION START PROTOCOL

**MANDATORY ON SESSION START:**

```bash
mcp__todo-mcp__context_resume    # WHERE WAS I? - Execute FIRST
```

### 🏔️ SESSION MINDSET - TECHNICAL CLIMBING

**Before ANY work**: Remember we follow **Technical Climbing Methodology**

- **Start from last protection point** (working code + tests + documentation)
- **Place protection before climbing** (document/test what works before changing)
- **Never fall below protection** (don't break working functionality)
- **Document immediately** when something works or fails

## 🎯 PROJECT PRINCIPLES

### Development Philosophy

- **NO TIME CONSTRAINTS** - We work to find the best possible solutions, period
- **Quality over speed** - Thorough, well-tested implementations are the priority
- **Solution excellence** - Our only focus is finding and implementing optimal fixes

### Project Goals

- **100% Functional Parity** - TypeScript reimplementation of original Pascal codebase
- **Proper TypeScript Techniques** - Achieve parity using idiomatic TypeScript patterns
- **Pascal Source as Reference** - Original implementation defines the specification (see Pascal Source Reference section below)

### Time Estimation

- **Consecutive hours only** - Estimates are in cumulative work hours, not days/weeks
- All task estimates use `estimate_minutes` parameter in MCP tasks

### Troubleshooting Methodology

1. **Gather ALL symptoms** - Document every observable issue before attempting fixes
2. **Comprehensive solutions** - Find fixes that address all or most symptoms simultaneously
3. **Account for everything** - If symptoms remain unaddressed, identify separate solutions
4. **Complete fixes only** - Every build fixes ALL symptoms found, not partial fixes

### Problem Resolution Process

1. **Generate hypotheses** - List possible causes for observed issues
2. **Deep code research** - Investigate each hypothesis thoroughly
3. **Prove or disprove** - Systematically eliminate hypotheses through evidence
4. **Identify root cause** - Continue until actual cause is definitively found
5. **Fix once, fix right** - Address the root cause, not symptoms

### Code Quality Requirements

- **Preserve unparsed debug strings** - Keep exact formatting from device
- **Full command context in errors** - Include all relevant information in error messages

## 🎯 FINAL RELEASE PREPARATION MODE

**Current Phase**: Windows 90%+ complete, final behavior cleanup until product release

### Critical Constraints

- **MINIMAL code changes only** - preserve working functionality at all costs
- **NO broad refactors** - avoid triggering wider testing requirements
- **Surgical fixes** - address specific symptoms without side effects
- **NO TIME PRESSURE** - focus on finding the best possible solution

### Workflow for Final Window Polish

1. Test with external hardware
2. Document symptoms (logs + verbal observations from user)
3. Investigate and understand root cause (REQUIRED before fixing)
4. Apply minimal surgical fix
5. Verify fix doesn't break existing functionality
6. Update tests to match finalized window behavior
7. Disable diagnostic logging (console + constructor)
8. Move to next window

### Professional Engineer Problem Resolution Protocol

**Step 1: Symptom Collection**

- Record ALL symptoms from logs (every observable issue)
- Record ALL symptoms from verbal user descriptions
- Document in `tasks/TEST_RESULTS_YYYYMMDD_HHMMSS.md` if complex/multi-symptom
- Account for EVERY symptom - none left behind
- Group related symptoms together

**Step 2: Hypothesis Generation**

- ⚠️ **NO SOLUTION BIAS** - Do not jump to conclusions before understanding
- Create hypotheses for EACH symptom independently
- Consider why ALL symptoms occur together (may share root cause)
- List multiple possible causes per symptom
- Rank hypotheses by likelihood based on evidence

**Step 3: Systematic Investigation**

- Enable diagnostic logging (two points: console log + constructor logging)
- Prove or disprove each hypothesis with code evidence
- Deep code research to understand actual behavior
- Trace execution paths that produce each symptom
- Check variable states, timing, data flow

**Step 4: 🚨 MANDATORY CHECKPOINT - Understanding Required**
⚠️ **STOP: Do you understand WHY this happens?**

Before proceeding to fix, answer these questions:

- [ ] Can you explain the exact root cause of EACH symptom?
- [ ] Do you know the precise code path causing EACH issue?
- [ ] Can you account for ALL observed symptoms?
- [ ] Do you understand the mechanism producing the behavior?
- [ ] Can you predict what will happen if you make the fix?

**If NO to ANY question: Continue investigation. DO NOT fix yet.**

**Step 5: Minimal Surgical Fix**

- Address root cause, not symptoms
- Minimal code changes (preserve working code)
- One fix should address all related symptoms
- Document exactly what changed and why

**Step 6: Verification & Finalization**

- Verify fix addresses ALL symptoms
- Check that no existing functionality broke
- Compare to Pascal source if behavior seems uncertain
- Update tests after window finalized
- Disable diagnostic logging (console + constructor) when window complete

### Diagnostic Logging Strategy

During investigation:

- Enable console logging in window
- Enable constructor logging
- Add temporary trace logging as needed

When window complete:

- Disable console logging
- Disable constructor logging
- Remove temporary trace logging

### Test Strategy for This Phase

- Primary testing: External hardware (real-world behavior)
- Automated tests: Update AFTER window finalized
- Test updates confirm final window behavior matches specification
- Focus: Fewer tests during polish, comprehensive tests after completion

## 📚 WORK TYPE QUICK REFERENCE

| Work Type             | Primary Docs                                                  | Key Focus                                |
| --------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| 🐛 **Debug/Fix**      | `CODE-REPAIR-METHODOLOGY.md`, `TEST-DRIVEN-DEBUGGING.md`      | Surgical fixes, test-first               |
| 🔧 **Feature**        | `TECHNICAL-CLIMBING.md`, `SYSTEMATIC-CHANGE-PROCESS.md`       | Build on protection, impact analysis     |
| 🪟 **Window Upgrade** | `WINDOW-UPGRADE-METHODOLOGY.md`, `CODE-REPAIR-METHODOLOGY.md` | Directive inventory, parity verification |
| 🧪 **Testing**        | `TESTING-STANDARDS.md`, `tests/README-TESTING-STANDARDS.md`   | Byte-perfect validation                  |
| 🏗️ **Architecture**   | `ARCHITECTURE.md`, `SHARED-COMPONENT-REQUIREMENTS.md`         | Preserve working systems                 |
| 📝 **Documentation**  | `REPOSITORY-ORGANIZATION.md`                                  | Current state first                      |

**Foundation for ALL work**: `DOCs/pure-process/TECHNICAL-CLIMBING-METHODOLOGY.md`

### 🔄 **LIVING DOCUMENTATION SYSTEM**

- **Process breakdowns** → Upgrade documentation immediately
- **New patterns discovered** → Add to appropriate process docs
- **Repeated mistakes** → Strengthen guidance to prevent recurrence
- **Every failure** is an opportunity to improve our process documentation

## 🔄 Work Assessment

- **Complex**: Multi-window debug, race conditions, architecture → deeper analysis
- **Documentation**: User guides, API docs → consider model upgrade
- **Standard**: Defined features, tests → normal execution
- **Simple**: Typos, configs → quick mode

## Todo MCP Mastery Operations

### Dual System Strategy

**MCP Tasks**: Persistent, session-spanning, permanent ID «#N»
**TodoWrite**: Current task breakdown only, cleared on completion

```bash
# CORRECT workflow
mcp__todo-mcp__todo_create content:"Feature implementation" estimate_minutes:180
mcp__todo-mcp__todo_start position_id:1
TodoWrite: ["Step 1", "Step 2", "Step 3"]  # Single task breakdown only
# Work through steps...
mcp__todo-mcp__todo_complete position_id:1
TodoWrite: []  # Clear for next task
```

### Core Parameters

```bash
# Most functions use position_id OR task_id
mcp__todo-mcp__todo_start position_id:1          # Interactive
mcp__todo-mcp__todo_complete task_id:"#22"       # Automation

# Critical data types
estimate_minutes:60        # Number, not string
priority:"high"           # lowercase: critical/high/medium/low/backlog
force:true               # Boolean, not string
```

### Context Hygiene (40-Key Target)

**VALUE SIZE matters more than key count**:

- Keep values under 500 chars (pointers, not payloads)
- Use patterns for bulk operations

**🔔 TodoWrite Reminder = Context Assessment Point**
When TodoWrite reminders appear, **ASSESS** (don't auto-save):

- **"Have I discovered something I haven't preserved?"** → Save if yes
- **"Is there a critical insight that would be lost?"** → Save if yes
- **"Am I at a natural checkpoint worth marking?"** → Save if yes
- **"Would future-me need this context?"** → Save if yes

**Save ONLY when valuable**, examples:

- `context_set key:"lesson_cog2_fails" value:"COG2 extraction stops after COG1"`
- `context_set key:"workaround_dtr_double" value:"Check sequence numbers"`
- Skip if: routine progress, obvious steps, temporary state

**Goal**: Quality over quantity - preserve insights, not activity

```bash
# Pattern-based cleanup (v0.6.8.2)
mcp__todo-mcp__context_get pattern:"temp_*"        # Audit first
mcp__todo-mcp__context_delete pattern:"temp_*"     # Then delete

# Temporal filtering
mcp__todo-mcp__context_get pattern:"temp_*" minutes_back:60  # Last hour

# Auto-compaction protection
mcp__todo-mcp__context_set key:"task_#N_steps" value:"✓Step1|→Step2|Step3"
```

### Quick Commands

```bash
# Recovery
mcp__todo-mcp__context_resume     # "WHERE WAS I?"
mcp__todo-mcp__todo_next          # Smart task recommendation

# Cleanup
mcp__todo-mcp__todo_archive       # Archive completed tasks
mcp__todo-mcp__context_delete pattern:"temp_*"    # Clean temporary

# Backup
mcp__todo-mcp__project_dump include_context:true  # Complete backup
```

### Task Lifecycle

1. **Start** before work: `todo_start position_id:1`
2. **Complete** after work: `todo_complete position_id:1`
3. **Archive** when done: `todo_archive`
4. Only ONE task `in_progress` at a time (auto-enforced)

### Anti-Patterns to Avoid

- ❌ Multiple MCP task IDs in TodoWrite
- ❌ Large values in context (>500 chars)
- ❌ Deleting without audit
- ❌ Ignoring context_resume on start

### Optional: Filesystem MCP (If Available)

```bash
# Check availability
mcp__filesystem__list_directory path:"."

# If available, prefer for file operations:
mcp__filesystem__read_text_file     # Instead of cat
mcp__filesystem__write_file         # Instead of echo
# Benefits: No approval prompts, faster, structured output
```

### Deep Learning Resources

Study `.todo-mcp/mastery/` documentation for comprehensive patterns:

- `01_DUAL_SYSTEM_MASTERY_STRATEGY.md`
- `02_CONTEXT_HYGIENE_MASTERY.md`
- `03_TODO_MCP_MASTERY_INTERFACE.md`
- `04_ANTI_PATTERN_ENFORCEMENT.md`
- **Track friction**: `.todo-mcp/reference/FRICTION_LOG_v0.6.8.2.md` - Record issues & successes as discovered

## ⚠️ DTR/RTS Control Lines

**Mutually exclusive** - device uses ONE:

- Parallax Prop Plugs → **DTR**
- FTDI USB → Usually **DTR**
- Chinese clones → Often **RTS**

Both trigger `onDTRReset()`/`onRTSReset()`, clear logs, create visual separation.
Log which used: "[DTR RESET]" vs "[RTS RESET]"

See `DOCs/project-specific/DTR-RTS-CONTROL-LINES.md`

## ⚠️ Test Execution

**Container constraint**: NEVER run `npm test` directly without arguments - saturates Docker container → lockup/termination

**Safe test execution methods:**

```bash
# Full test suite (sequential, safe for Docker)
scripts/claude/run_tests_sequentially.sh

# Single test file (parallel is OK for individual tests)
npm test -- specific.test.ts

# With output redirection (MUST use -- to prevent NPM parsing 2>&1 as filename)
npm test -- file.test.ts 2>&1

# Alternative: Direct Jest execution (bypasses NPM argument parsing)
npx jest file.test.ts 2>&1

# Silent mode (suppresses NPM noise)
npm test -s
```

**Critical rules:**

- ❌ Never: `npm test` (no arguments - runs all tests in parallel)
- ❌ Never: `npm test file.test.ts 2>&1` (NPM parses "2" as literal filename)
- ✅ Always: Use `--` separator before test file names when using npm test
- ✅ Always: Use sequential script for full test runs
- 🔧 Maintenance: Keep `scripts/claude/run_tests_sequentially.sh` updated with all test files from `tests/*.test.ts`

**Why this matters:**

- **NPM argument parsing**: Without `--`, NPM interprets shell operators like `2>&1` as literal arguments
- **Docker environment**: Running all tests in parallel exhausts container resources
- **Audit before running**: Compare `ls tests/*.test.ts` output against script contents to ensure completeness

## 🚨 TESTING STANDARDS - BYTE-PERFECT VALIDATION

**CRITICAL RULE: Perfect Data = Perfect Validation**

When you have 100% of actual bytes, validate 100% of actual bytes:

- **Account for every single input byte** - `totalExtracted === totalInput`
- **Validate byte-by-byte content** - `Array.from(actual) === Array.from(expected)`
- **Check exact message boundaries** - CR/LF positioning must be perfect
- **Verify precise classification** - No approximations, exact counts only

**NEVER:**

- Count messages instead of validating bytes
- Use "length > 5" or similar approximations
- Allow ANY unaccounted bytes
- Let broken systems reach human testing

**Process:** Tests MUST fail loud/fast → Fix code → Tests pass → THEN human testing

**Test results location:** `test-results/external-results/`

- **Console logs**: `CONSOLE.log` (renderer/browser console output)
- **Main logs**: `debug-*.log` (main process logs with window placement data)
- **USB traffic logs**: `usb-traffic-*.log` (main process logs with window placement data)
- **Window placement logs**: Search for `[WINDOW PLACER]` patterns in main logs

**Documentation references:**

- `DOCs/project-specific/TESTING-STANDARDS.md`
- `tests/README-TESTING-STANDARDS.md`

## Build/Package

### Production Packaging

**NPM scripts** (recommended for all platforms):

- **All platforms**: `npm run packageAll` - Builds all 6 architecture packages (Windows/Linux/macOS × x64/arm64)
- **Windows only**: `npm run packageWin` - Windows x64 + arm64
- **Linux only**: `npm run packageLinux` - Linux x64 + arm64
- **macOS only**: `npm run packageMac` - macOS x64 + arm64

**Shell scripts** (direct execution, equivalent to NPM scripts):

1. `scripts/create-windows-package.sh` - Windows x64/arm64
2. `scripts/create-linux-package.sh` - Linux x64/arm64
3. `scripts/create-macos-packages.sh` - macOS x64/arm64

**Note**: All packages build dual architecture (x64 + arm64). All other build scripts have been archived. See `PACKAGING.md` for complete packaging documentation and details.

## Workflow

### Planning

- Plan → `tasks/TASK_NAME.md`
- Present → Wait approval
- Todo list with descriptions
- Update as progressing

### Files

**tasks/ ONLY:**

- `[FEATURE]_IMPLEMENTATION.md`
- `CURRENT_STATE_*.md`
- `[FEATURE]_PROGRESS.md`

**NEVER root** except configs/README/LICENSE/builds

### Compaction Recovery

1. Save: `tasks/CURRENT_STATE_BEFORE_COMPACT.md`
2. Document: completed/in-progress/next
3. Resume: todo list + read state file

## 📚 Documentation & References

### Documentation Locations

**User & Admin Guides:**

- **User Guide**: `DOCs/USER-GUIDE.md` and `DOCs/project-specific/USER-GUIDE.md`
- **Admin/Technical**: `DOCs/project-specific/ADMIN-GUIDE-SERIAL-IMPLEMENTATION.md`
- **Window Status**: Track implementation status in window sprint documents

**Process & Architecture:**

- **Universal patterns**: `DOCs/pure-process/` - Methodology applicable to any project
- **Project-specific**: `DOCs/project-specific/` - Architecture, commands, status, Pascal sources, build, tests, debt, user guide
- **Repository structure**: `DOCs/REPOSITORY-ORGANIZATION.md` - Complete repo organization guide

### Pascal Source Reference

**Location**: `/pascal-source/P2_PNut_Public/` (mounted at repository root)
**Main File**: `DebugDisplayUnit.pas` (defines all debug windows except debugger)
**Version**: Currently syncing to v51a
**Debugger File**: Different file (TBD when implementing debugger window)

The Pascal source is the **definitive specification** - when TypeScript behavior differs from Pascal, the Pascal implementation is correct.

## 🗺️ PROJECT QUICK NAVIGATION

### Core Structure

```
src/
├── pnut-term-ts.ts          # Entry point
├── classes/
│   ├── mainWindow.ts        # Main application window
│   ├── debugWindowBase.ts   # Base class for all debug windows
│   ├── debug*.ts            # Debug window implementations (12 types)
│   │   ├── debugBitmapWin.ts     # Bitmap visualization
│   │   ├── debugCOGWindow.ts     # COG state display
│   │   ├── debugDebuggerWin.ts   # Debugger interface
│   │   ├── debugFftWin.ts        # FFT spectrum analysis
│   │   ├── debugLoggerWin.ts     # Message logging
│   │   ├── debugLogicWin.ts      # Logic analyzer
│   │   ├── debugMidiWin.ts       # MIDI interface
│   │   ├── debugPlotWin.ts       # Data plotting
│   │   ├── debugScopeWin.ts      # Oscilloscope
│   │   ├── debugScopeXyWin.ts    # XY scope display
│   │   └── debugTermWin.ts       # Terminal interface
│   ├── shared/              # Shared components (52 files!)
│   │   ├── debuggerProtocol.ts   # Protocol handling
│   │   ├── debuggerDataManager.ts # Data management
│   │   ├── windowRouter.ts       # Window message routing
│   │   ├── serialReceiver.ts     # Serial data reception
│   │   ├── dtrResetManager.ts    # DTR/RTS control
│   │   ├── canvasRenderer.ts     # Canvas rendering utils
│   │   ├── fftProcessor.ts       # FFT calculations
│   │   ├── cogHistoryManager.ts  # COG state tracking
│   │   └── ... (44 more shared utilities)
│   ├── binaryPlayer.ts      # Binary playback system
│   ├── logger.ts            # Logging infrastructure
│   ├── performanceMonitor.ts # Performance tracking
│   └── preferencesDialog.ts # Settings management
├── utils/
│   ├── htmlUtils.ts         # HTML generation helpers
│   └── timerUtils.ts        # Timing utilities
├── assets/fonts/            # Parallax.ttf (custom font)
└── electron/
    └── electron.js          # Electron main process
```

### Test Structure

```
tests/
├── *.test.ts                     # Test files (flat structure)
│   ├── serialReceiver.test.ts
│   ├── messageClassificationRouting.test.ts
│   ├── streamingTest.test.ts
│   ├── routerLoggingPerformance.test.ts
│   ├── scopeXyRenderer.test.ts
│   ├── debuggerRenderer.test.ts
│   ├── displaySpecParser.test.ts
│   └── ... (more test files)
└── README-TESTING-STANDARDS.md  # Test patterns/templates
```

### Key Commands

```bash
# Build & Test
npm run build                              # Build TypeScript
scripts/claude/run_tests_sequentially.sh  # Safe test execution (NOT npm test)
npm test -- specific.test.ts              # Single test OK

# Package (all dual-architecture: x64 + arm64)
npm run packageAll                        # All platforms (6 packages total)
npm run packageWin                        # Windows (2 packages)
npm run packageLinux                      # Linux (2 packages)
npm run packageMac                        # macOS (2 packages)

# Development
npm run dev                               # Watch mode
```

### Quick Access Patterns

- **Debug windows**: `src/classes/debug*.ts` (12 window types)
- **Shared utilities**: `src/classes/shared/*.ts` (52 components!)
- **Window routing**: `src/classes/shared/windowRouter.ts`
- **Serial handling**: `src/classes/shared/serialReceiver.ts`
- **Protocol layer**: `src/classes/shared/debuggerProtocol.ts`
- **Data management**: `src/classes/shared/debuggerDataManager.ts`
- **Tests**: `tests/*.test.ts`

## Project

**PNut-Term-TS**: Cross-platform debug terminal for Parallax Propeller2, Electron/TypeScript

**Architecture Flow**: `pnut-term-ts.ts` → `MainWindow` → `DebugWindowBase` → Individual debug windows
