# CLAUDE.md

Essential guidance for Claude Code in PNut-Term-TS repository.

## 🚨 SESSION START - MANDATORY
```bash
mcp__todo-mcp__context_resume  # ALWAYS FIRST - Shows tasks/context/state
```
**NON-OPTIONAL**: Shows in-progress tasks, recent context (10min), current state. Without this = flying blind.

### 🏔️ SESSION MINDSET - TECHNICAL CLIMBING
**Before ANY work**: Remember we follow **Technical Climbing Methodology**
- **Start from last protection point** (working code + tests + documentation)  
- **Place protection before climbing** (document/test what works before changing)
- **Never fall below protection** (don't break working functionality)
- **Document immediately** when something works or fails

## 📚 WORK TYPE GUIDANCE - READ FIRST

### Starting New Work - Document Dispatch System

**Before ANY work**, identify work type and read required guidance:

### 🏔️ **UNIVERSAL FOUNDATION - READ FIRST FOR ALL WORK TYPES**
**MANDATORY**: `DOCs/pure-process/TECHNICAL-CLIMBING-METHODOLOGY.md` - Core philosophy for making progress while placing protection

### 🐛 **DEBUGGING/BUG FIXING**
Required Reading Order:
1. 🏔️ `DOCs/pure-process/TECHNICAL-CLIMBING-METHODOLOGY.md` - Foundation: protection through tests + documentation
2. `DOCs/pure-process/CODE-REPAIR-METHODOLOGY.md` - What NOT to do, surgical fixes only
3. `DOCs/pure-process/TEST-DRIVEN-DEBUGGING-METHODOLOGY.md` - Tests are truth, systematic debugging  
4. `DOCs/project-specific/SYSTEMATIC-CHANGE-PROCESS.md` - Component analysis, dependency planning
5. `DOCs/project-specific/TESTING-FRAMEWORK-INTEGRATION.md` - How to test in this codebase

### 🔧 **FEATURE DEVELOPMENT**
Required Reading Order:
1. 🏔️ `DOCs/pure-process/TECHNICAL-CLIMBING-METHODOLOGY.md` - Foundation: building on working protection
2. `DOCs/pure-process/TEST-DRIVEN-DEBUGGING-METHODOLOGY.md` - Test-first development
3. `DOCs/project-specific/SYSTEMATIC-CHANGE-PROCESS.md` - Change impact planning
4. `DOCs/project-specific/TESTING-FRAMEWORK-INTEGRATION.md` - Testing patterns
5. `DOCs/project-specific/ARCHITECTURE.md` - System understanding

### 🧪 **TEST CREATION/FIXING**
Required Reading Order:
1. 🏔️ `DOCs/pure-process/TECHNICAL-CLIMBING-METHODOLOGY.md` - Foundation: tests as protection
2. `DOCs/project-specific/TESTING-STANDARDS.md` - Byte-perfect validation requirements
3. `tests/README-TESTING-STANDARDS.md` - Test patterns and templates
4. `DOCs/project-specific/TESTING-FRAMEWORK-INTEGRATION.md` - Component testing patterns
5. `DOCs/pure-process/TEST-DRIVEN-DEBUGGING-METHODOLOGY.md` - Testing discipline

### 🏗️ **ARCHITECTURE CHANGES**
Required Reading Order:
1. 🏔️ `DOCs/pure-process/TECHNICAL-CLIMBING-METHODOLOGY.md` - Foundation: preserve working systems
2. `DOCs/pure-process/CODE-REPAIR-METHODOLOGY.md` - Preserve working systems
3. `DOCs/project-specific/ARCHITECTURE.md` - Current system understanding
4. `DOCs/pure-process/SHARED-COMPONENT-REQUIREMENTS.md` - Component boundaries
5. `DOCs/project-specific/SYSTEMATIC-CHANGE-PROCESS.md` - Change impact analysis

### 📝 **DOCUMENTATION WORK**
Required Reading Order:
1. `DOCs/REPOSITORY-ORGANIZATION.md` - File organization
2. `DOCs/project-specific/ARCHITECTURE.md` - System overview
3. Current documentation being updated
4. Related process documentation

**Process**: Read required docs → Understand current state → Plan approach → Get approval → Execute

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

## 🎯 Todo MCP Mastery

### Reference: `.todo-mcp/mastery/`
Living docs - record patterns/friction/workarounds as discovered.

### Core Concepts
- **Position IDs ephemeral**: `position_id:1` = current list position
- **Task IDs permanent**: `#42` = same task always
- **TodoWrite = ONE MCP task**: Subtasks only, not project tracker
- **Context = pointers**: Store "see /docs/x.md" not 5000 words
- **Value size kills**: 10 huge values crash, 100 tiny fine

### Workflows

**Start:**
```bash
mcp__todo-mcp__todo_list
mcp__todo-mcp__todo_start position_id:1
TodoWrite: ["Step 1", "Step 2"]  # Current task only
mcp__todo-mcp__context_set key:"task_#N_steps" value:'[TodoWrite]'
```

**Safe test:**
```bash
mcp__todo-mcp__project_dump include_context:false
# Run dangerous tests
mcp__todo-mcp__project_restore file:"dump.json" mode:"replace" include_context:false
```

**Complete:**
```bash
mcp__todo-mcp__todo_complete position_id:1
mcp__todo-mcp__context_get_all  # Review accumulated
context_delete pattern:"task_#N_*"  # Clean stale
TodoWrite: []  # Clear
```

**Crash recovery:**
```bash
mcp__todo-mcp__context_resume
mcp__todo-mcp__context_get_all  # If incomplete
```

### Advanced Filtering (v0.6.8.2+)

**Context Search (No More Key Guessing):**
```bash
context_get pattern:"task_*"                    # Glob patterns  
context_get pattern:"/^session_.*/"             # Regex patterns
context_get key:"specific_key" minutes_back:30  # Time window
```

**Smart Task Filtering:**
```bash
todo_next priority:"critical"                   # Priority focus
todo_next status:"created" tags:["sonnet"]      # Model-specific work
todo_next status:"pending"                      # Ready to start
```

**Multi-Model Workflows:**
- Tag tasks by model: `#sonnet`, `#haiku`, `#opus`
- Filter work: `todo_next tags:["sonnet"]` for Sonnet-specific tasks
- Time-boxed context: `context_get pattern:"session_*" minutes_back:60`
- Pattern discovery: `context_resume` shows grouped patterns

### Parameters (Tested 2025-08-19)
```bash
estimate_minutes: 60      # NUMBER
priority: "high"          # Any case
status: "in_progress"     # Exact lowercase
task_id: #42             # No quotes
```

### Async Input
New request mid-work? Create MCP task: `todo_create content:"[request]" priority:"high"`

### Critical Rules
- **Must start before complete** - System enforced, will error otherwise
- **One in_progress** - Only ONE task active at a time (automatic)
- **Context bridge discipline** - ALWAYS save TodoWrite to context after changes (crash insurance)
- **Archive > delete** - Use `todo_archive` for safe export with backup
- **Atomic operations** - Bulk ops are all-or-nothing; if ANY ID invalid, ENTIRE operation rolls back
- Pattern cleanup > individual
- Full ref: `.todo-mcp/mastery/`

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

## Project

**PNut-Term-TS**: Cross-platform debug terminal for Parallax Propeller2, Electron/TypeScript

**Build**: `npm run build` → `npm test` → `dist/pnut-term-ts.min.js`

**Architecture**: `src/pnut-term-ts.ts` → `MainWindow` → Debug windows extend `DebugWindowBase`

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