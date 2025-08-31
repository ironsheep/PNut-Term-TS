# CLAUDE.md

Essential guidance for Claude Code in PNut-Term-TS repository.

## 🎯 CRITICAL: SESSION START PROTOCOL (EXECUTE IMMEDIATELY)

**MANDATORY ON SESSION START/RESUME:**

```bash
mcp__todo-mcp__context_resume    # Primary recovery command - WHERE WAS I?
# Provides: current tasks, context state, next recommendations - everything needed
```

**ALWAYS execute this command FIRST before any other work.**

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

## 🎯 CRITICAL: SESSION START PROTOCOL (EXECUTE IMMEDIATELY)

**MANDATORY ON SESSION START/RESUME:**
```bash
mcp__todo-mcp__context_resume    # Primary recovery command - WHERE WAS I?
# Provides: current tasks, context state, next recommendations
```

**ALWAYS execute this command FIRST before any other work.**

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