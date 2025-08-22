# CLAUDE.md

Essential guidance for Claude Code in PNut-Term-TS repository.

## 🚨 SESSION START - MANDATORY
```bash
mcp__todo-mcp__context_resume  # ALWAYS FIRST - Shows tasks/context/state
```
**NON-OPTIONAL**: Shows in-progress tasks, recent context (10min), current state. Without this = flying blind.

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