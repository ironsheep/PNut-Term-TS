# CLAUDE.md

Essential guidance for Claude Code when working with this repository.

## 🎯 Todo-MCP Task Management

**CRITICAL v6.6 CONFUSION**: The "id" parameter actually wants POSITION, not task ID!
- **Position**: 1, 2, 3... (changes when list reorders)
- **Task ID**: «#22», «#49»... (permanent, shown for reference only)
- **ALWAYS USE POSITION** for start/complete/update operations
- **WARNING**: Create returns "#49" (no guillemets) but list shows "«#49»" - inconsistent!

```bash
# Starting work (single recovery command!)
mcp__todo-mcp__context_resume                    # Shows tasks + saved context

# Working efficiently  
mcp__todo-mcp__todo_list                         # See positions (1,2,3...) and IDs («#n»)
mcp__todo-mcp__todo_start id:1                   # USE POSITION not «#n»!
mcp__todo-mcp__todo_complete id:1                # Position from list, not task ID
mcp__todo-mcp__todo_update id:3 status:"in_progress"  # Position 3, not «#3»

# Track my state (CRITICAL for compaction recovery!)
mcp__todo-mcp__context_set "working_on" "debugFFT.ts:234 fixing transform"
mcp__todo-mcp__context_set "blocked_by" "need Pascal source for window functions"
mcp__todo-mcp__context_set "next_step" "implement Hanning after amplitude fix"
```

**My patterns**: Always set "working_on" when starting tasks, "blocked_by" when stuck, "next_step" before breaks
**BEST PRACTICE**: When storing task references in context, ALWAYS use task IDs («#n») not positions - positions change but IDs are permanent!

## 📋 Dual Task System Strategy

**Todo-MCP** (Persistent): Project features, bugs, session-spanning work
**TodoWrite** (Temporary): Quick implementation steps, test fixes within session

```bash
# Workflow: MCP for strategy, TodoWrite for tactics
mcp__todo-mcp__todo_create content:"Implement Spectro window" estimate_minutes:120
TodoWrite: ["Study Pascal source", "Create class structure", "Add tests"]

# Promote discoveries to MCP
mcp__todo-mcp__todo_create content:"[FOUND] Refactor InputForwarder" estimate_minutes:60
```

**Rule**: Start with MCP for main task → Break down with TodoWrite → Promote important findings

## Critical Workflow

### Plan & Review (REQUIRED)
- Start in plan mode → Write plan to `tasks/TASK_NAME.md`
- Present plan for approval → Wait for user confirmation
- Create detailed todo list with paragraph descriptions
- Update plan document as work progresses

### File Organization (STRICT)
**tasks/ folder ONLY**:
- Implementation plans: `tasks/[FEATURE]_IMPLEMENTATION.md`
- State files: `tasks/CURRENT_STATE_*.md`
- Progress tracking: `tasks/[FEATURE]_PROGRESS.md`

**NEVER create in root**: Only project configs, standard docs (README, LICENSE), and build artifacts belong in root.

### Compaction Recovery
When warned about compaction:
1. Save state to `tasks/CURRENT_STATE_BEFORE_COMPACT.md`
2. Document: completed work, in-progress, next steps
3. Resume: "show me todo list and read tasks/CURRENT_STATE_BEFORE_COMPACT.md"

## Project Context

PNut-Term-TS: Cross-platform debug terminal for Parallax Propeller2, Electron/TypeScript app recreating Chip's Debug listener.

**Quick Build**: `npm run build` → `npm test` → Main: `dist/pnut-term-ts.min.js`

**Architecture**: Entry `src/pnut-term-ts.ts` → `MainWindow` → Debug windows extend `DebugWindowBase`

## External References (Read Only When Needed)

- [`docs/COMMANDS.md`](docs/COMMANDS.md) - All build/test commands, helper scripts
- [`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md) - Window implementation progress
- [`docs/PASCAL-REFERENCES.md`](docs/PASCAL-REFERENCES.md) - Pascal source locations
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - System design, components
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) - Development scenarios
- [`docs/BUILD-SYSTEM.md`](docs/BUILD-SYSTEM.md) - Build pipeline details
- [`docs/TEST-STATUS.md`](docs/TEST-STATUS.md) - Test suite status
- [`docs/TECHNICAL-DEBT.md`](docs/TECHNICAL-DEBT.md) - Tech debt tracking

## Key Requirements

- Run tests sequentially (Docker container environment)
- Use `--` separator with npm test redirects: `npm test -- file.test.ts 2>&1`
- Preserve unparsed debug strings for error logging
- Include full command context in error messages
- Update test files when adding new classes to `scripts/claude/`
