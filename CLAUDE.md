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

## 📚 WORK TYPE QUICK REFERENCE

| Work Type | Primary Docs | Key Focus |
|-----------|-------------|-----------|
| 🐛 **Debug/Fix** | `CODE-REPAIR-METHODOLOGY.md`, `TEST-DRIVEN-DEBUGGING.md` | Surgical fixes, test-first |
| 🔧 **Feature** | `TECHNICAL-CLIMBING.md`, `SYSTEMATIC-CHANGE-PROCESS.md` | Build on protection, impact analysis |
| 🧪 **Testing** | `TESTING-STANDARDS.md`, `tests/README-TESTING-STANDARDS.md` | Byte-perfect validation |
| 🏗️ **Architecture** | `ARCHITECTURE.md`, `SHARED-COMPONENT-REQUIREMENTS.md` | Preserve working systems |
| 📝 **Documentation** | `REPOSITORY-ORGANIZATION.md` | Current state first |

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

## ⚠️ Test Execution Container

**NEVER `npm test` directly** - saturates container → lockup/termination

**USE:**
```bash
scripts/claude/run_tests_sequentially.sh
# Audit first: ls tests/*.test.ts vs cat script
```

Rules:
- No `npm test` without args (parallel)
- Use sequential script for full runs
- Individual OK: `npm test -- specific.test.ts`
- Keep script updated

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
**See:** `DOCs/project-specific/TESTING-STANDARDS.md` and `tests/README-TESTING-STANDARDS.md`

## ⚠️ Shell Redirection NPM

NPM passes `2>&1` as literal args!

**WRONG:**
```bash
npm test file.test.ts 2>&1  # "2" becomes filename
```

**CORRECT:**
```bash
npm test -- file.test.ts 2>&1  # -- stops parsing
npx jest file.test.ts 2>&1     # Direct execution
npm test -s                     # Silent mode
```

## Build/Package

- **USE**: `./scripts/create-electron-ready-package.sh` (macOS)
- **DON'T**: `npm run packageMac` (broken - missing dmg-license)
- See `PACKAGING.md`

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

# Package (macOS only)
./scripts/create-electron-ready-package.sh

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

## References

📁 `DOCs/pure-process/`: Universal patterns
📁 `DOCs/project-specific/`: Architecture, commands, status, Pascal sources, build, tests, debt, user guide
📁 `DOCs/REPOSITORY-ORGANIZATION.md`: Repo structure

## Requirements

- Sequential tests (Docker environment)
- Use `--` with npm test redirects
- Preserve unparsed debug strings
- Full command context in errors
- Update test files in `scripts/claude/`