# CLAUDE.md

Essential guidance for Claude Code when working with this repository.

## 🎯 Todo-MCP Task Management (v0.6.8)

### Dual-Parameter Resolution (v0.6.8 - RESOLVED!)

**Position vs ID confusion RESOLVED!** Dual-parameter resolution now supports both:
- **Position**: Use `position_id:1` (changes when list reorders)
- **Task ID**: Use `task_id:"#22"` (permanent, immutable reference)
- **Priority**: If both provided, `task_id` takes precedence with validation
- **Best Practice**: Use `position_id` for interactive work, `task_id` for automation

### Working Efficiently with v0.6.8

```bash
# Starting work (single recovery command!)
mcp__todo-mcp__context_resume                    # Shows tasks + saved context

# CRITICAL v0.6.8 Parameter Formats:
# - Most functions use 'id' parameter (number WITHOUT #)
# - Only 3 functions have dual-parameter support (complete, tag_add, tag_remove)
# - estimate_minutes MUST be number, not string

# Task operations (most use id parameter as number)
mcp__todo-mcp__todo_list                         # See positions (1,2,3...) and IDs (#n)
mcp__todo-mcp__todo_start id:22                  # Start by ID (number, no #)
mcp__todo-mcp__todo_complete position_id:1       # Complete by position (dual-parameter support)
mcp__todo-mcp__todo_update id:22 status:"in_progress" estimate_minutes:90

# Tag operations (dual-parameter support)
mcp__todo-mcp__todo_tag_add task_id:"#49" tags:["urgent"]      # By permanent ID
mcp__todo-mcp__todo_tag_add position_id:1 tags:["backend"]    # OR by position

# Track state for recovery
mcp__todo-mcp__context_set key:"working_on" value:"debugFFT.ts:234 fixing transform"
mcp__todo-mcp__context_set key:"blocked_by" value:"need Pascal source"
```

### Key Features

**Tag Auto-Extraction**
- **Inline**: `"Fix the #bug"` → Content: "Fix the bug", Tags: [bug]
- **Trailing**: `"Fix parser #urgent"` → Content: "Fix parser", Tags: [urgent]

**Bulk Operations (Atomic)**
```bash
mcp__todo-mcp__todo_bulk operation:"set_priority" filters:{priority:"low"} data:{priority:"high"}
mcp__todo-mcp__todo_bulk operation:"add_tags" filters:{status:"created"} data:{tags:["urgent"]}
```

### Safe Data Management

```bash
mcp__todo-mcp__todo_archive                      # Safe: exports then clears completed
mcp__todo-mcp__project_dump include_context:true # Full backup with context
mcp__todo-mcp__project_restore file:"dump.json" mode:"merge"  # Restore from backup
```

### Context Management

```bash
mcp__todo-mcp__context_delete pattern:"temp*"    # Pattern deletion
mcp__todo-mcp__context_resume                    # Post-compaction recovery
```

### Quick Actions
- "I'm back" → `mcp__todo-mcp__context_resume`
- "next task" → `mcp__todo-mcp__todo_next`
- "archive completed" → `mcp__todo-mcp__todo_archive`

### Critical v0.6.8 Gotchas

**⚠️ PARAMETER CONFUSION? See DOCs/claude-reference/TODO-MCP-PARAMETER-TRUTH.md**

**Parameter Formats (MUST be exact):**

**Pattern 1: Legacy Functions (most common)**
- `id:22` - Number WITHOUT # for: start, update, pause, resume, delete, estimate
- NEVER use position_id with these functions!

**Pattern 2: Dual-Parameter Functions (only 3!)**
- `position_id:1` OR `task_id:"#22"` for: complete, tag_add, tag_remove
- These are the ONLY functions that accept position_id

**Pattern 3: Data Types**
- `estimate_minutes:60` - Always number, never string
- `priority:"high"` - Exact: critical/high/medium/low/backlog
- `status:"in_progress"` - Exact: created/in_progress/paused/completed

**⚠️ CRITICAL**: todo_start uses `id:` NOT `position_id:` - this is the #1 error!

**Workflow Rules:**
- MUST `todo_start` before `todo_complete` (enforced!)
- Only ONE task in_progress at a time (auto-pauses others)
- Bulk operations are atomic (all succeed or all fail)
- Archive replaces clear_completed (safer with backup)

## 🧹 Context Hygiene Strategy

**LEARNED: Context serves TWO purposes - crash recovery AND cross-activity continuity**

**Cross-Activity Continuity Pattern:**
When planning scope covers multiple related activities (e.g., 34 tasks in one project):
- Context naturally accumulates valuable patterns, decisions, learnings
- Each activity benefits from previous activity's discoveries
- Implementation patterns discovered early inform all subsequent work
- Friction points accumulate across activities for tool improvement
- This is INTENTIONAL continuity, not accidental accumulation

**The Balance:**
- Within project: Accumulate valuable cross-activity context
- Between projects: Clean slate with only universal lessons
- Within activity: Clean up temporary/status keys when done
- Across activities: Preserve patterns, learnings, architectural decisions

**Context Storage is UNRESTRICTED**:
- Use ANY keys that make sense for your work
- No required formats or patterns
- Store whatever helps with continuity and recovery

**Patterns observed in past usage** (not requirements):
- Some keys used prefixes like `lesson_`, `workaround_`, `temp_`
- Prefixes helped with bulk cleanup (`context_delete pattern:"temp_*"`)
- But many successful keys had no prefix at all

**Consider whether context adds value**:
- MCP already tracks task status (might not need duplication)
- Code comments/docs might be better for implementation details
- But store ANYTHING that helps with your workflow
- The system is designed to be flexible

**Context Cleanup Pattern:**
```bash
# IMMEDIATE: Clean up when task completes
mcp__todo-mcp__context_delete "current_task"         # Delete RIGHT AFTER task complete
mcp__todo-mcp__context_delete "task_#X_progress"     # Remove progress tracking
mcp__todo-mcp__context_delete "working_on"           # Clear active work status

# PERIODIC: Review context age (keys get stale!)
mcp__todo-mcp__context_get_all                       # Check for old keys
# Delete keys > 2 hours old unless prefixed lesson_, friction_, recovery_

# AT MILESTONES: Bulk cleanup
mcp__todo-mcp__context_delete "build_fixes_temp"     # Resolved issues
mcp__todo-mcp__context_delete "debugger_progress"    # Completed work
```

**Age Guidelines (Learned from 67→24 key cleanup):**
- Status keys > 2 hours: Likely stale, delete
- Progress keys > 4 hours: Outdated, delete
- Task completion keys > 1 hour after complete: Delete
- Implementation details > 1 day: Move to docs, then delete
- Lesson/friction/recovery: Keep indefinitely
- Session/handoff keys: Keep until next session starts
- Build/fix keys: Delete once issue resolved

**What I Learned About Aging:**
- Without cleanup, I accumulated 58 keys over 8 hours
- 43 of 67 keys (64%) were deletable old status/progress
- Most keys become stale within 2-4 hours
- Good hygiene should maintain <20 keys normally
- Prefix naming (temp_, current_) makes bulk cleanup easier

**Context Key Observations** (from past projects, not rules):
- Keys with prefixes made pattern-based deletion easier
- Unprefixed keys worked fine but required individual deletion
- Meaningful names helped during recovery regardless of format
- The system imposes NO restrictions on key naming

**Ideal context_resume Behavior (v6.8+):**
```bash
# If <10 keys: Show all with preview
# If 10-25 keys: Show categorized summary
# If >25 keys: Show cleanup warnings

# Always show aging hints:
⚠️ "current_task" (7h old) - Task #31 completed, consider deletion
✅ 3 lesson_* keys - Permanent learning, keep
🤔 "implementation_status" (3h old) - Review for relevance
```

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

## 🎓 Advanced Dual System Patterns

**TodoWrite → MCP Promotion Pattern:**
```bash
# 1. Explore in TodoWrite (disposable, fast)
TodoWrite: ["Research echo behavior", "Test with PST", "Document findings"]

# 2. Promote discoveries to permanent MCP tasks
mcp__todo-mcp__todo_create content:"[CRITICAL] Echo is NOT local echo - it's filtering received chars that match recently sent ones" estimate_minutes:30

# 3. Clean TodoWrite when MCP task created
TodoWrite: []  # Good hygiene
```

**Context + Task Integration (v0.6.8):**
```bash
# Store task sequences using permanent IDs (not positions!)
mcp__todo-mcp__context_set key:"implementation_sequence" value:"Must do #22→#23→#24 (dependencies!)"

# Track estimation accuracy for learning
mcp__todo-mcp__context_set key:"lesson_estimation" value:"Task #31: 6h est, 8m actual - over-estimating complex tasks"
```

**Session Handoff Protocol:**
```bash
# Before major interruption/compaction
mcp__todo-mcp__context_set key:"session_handoff" value:"Mid-task #34: completed interaction class, need integration with debugWindow.ts line 245"

# After interruption - use context_resume for perfect continuity
```

**Anti-Patterns to Avoid:**
- ❌ Don't track current task in context (use MCP task status)
- ❌ Don't leave TodoWrite populated between MCP tasks (creates confusion)
- ❌ Don't estimate less than 15 minutes (MCP overhead not worth it)
- ❌ Don't store progress percentages in context (MCP calculates better)

## ⚠️ CRITICAL: DTR/RTS Control Lines

**DTR and RTS are functionally equivalent** reset/sync control lines that are **mutually exclusive** - each device uses one OR the other, never both:

- **Parallax Prop Plugs** (vendor-approved) → Always use **DTR**  
- **FTDI USB devices** (non-vendor) → Usually **DTR**
- **Chinese FTDI clones** → Often require **RTS** instead

**When implementing DTR features, ALWAYS remember to handle RTS equivalently:**
- Both trigger parser synchronization (`onDTRReset()` and `onRTSReset()`)
- Both clear debug logs  
- Both create visual separation in output
- Log messages should indicate which control was used: "[DTR RESET]" vs "[RTS RESET]"

See `DOCs/project-specific/DTR-RTS-CONTROL-LINES.md` for complete documentation.

## ⚠️ CRITICAL: Test Execution in Container Environment

**NEVER USE `npm test` DIRECTLY** - Container cannot handle concurrent test execution!

**PROBLEM**: Running `npm test` saturates the container with parallel test execution, causing:
- Container lockup and process termination
- Complete loss of context and progress
- Need for full session recovery

**ALWAYS USE**: 
```bash
# Use the sequential test runner script:
scripts/claude/run_tests_sequentially.sh

# BEFORE running, audit the script for missing test files:
# 1. Check what test files exist: ls tests/*.test.ts
# 2. Check what's in the script: cat scripts/claude/run_tests_sequentially.sh
# 3. Add any missing test files to the script
```

**Critical Rules**:
- NEVER run `npm test` without arguments (runs all tests in parallel)
- ALWAYS use the sequential test script for full test runs
- Individual tests OK: `npm test -- specific.test.ts`
- Keep the test script updated when adding new test files

## ⚠️ CRITICAL: Shell Redirection in NPM Scripts

**PROBLEM**: NPM scripts pass `2>&1` as literal arguments, not shell redirections!
```bash
# WRONG - "2" becomes a filename argument:
npm test something.test.ts 2>&1  # Test runner tries to test file "2"
npm run build 2>&1               # Build script gets "2" as argument

# CORRECT - Use these patterns:
npm test -- something.test.ts 2>&1   # -- stops npm argument parsing
npx jest something.test.ts 2>&1      # Direct execution works
npm test -s                           # Silent mode (no npm output)
```

**ALWAYS USE**:
- `npm command -- args 2>&1` - Double dash separator
- `npx command args 2>&1` - Direct execution
- Wrap complex redirects in package.json: `"script": "sh -c 'command 2>&1'"`

## Packaging & Build

**USE**: `./scripts/create-electron-ready-package.sh` for macOS packages
**DON'T USE**: `npm run packageMac` (broken - missing dmg-license in container)
**See**: `PACKAGING.md` for full details on working vs broken packaging methods

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

## External References

📁 **Pure Process (Portable to ANY project)** in `DOCs/pure-process/`:
- [`PLANNING-METHODOLOGY.md`](DOCs/pure-process/PLANNING-METHODOLOGY.md) - Universal planning patterns

📁 **Claude Process (AI collaboration)** in `DOCs/claude-process/`:
- [`DUAL-SYSTEM-STRATEGY.md`](DOCs/claude-process/DUAL-SYSTEM-STRATEGY.md) - TodoWrite + MCP workflow
- [`CRASH-RECOVERY-PROCEDURE.md`](DOCs/claude-process/CRASH-RECOVERY-PROCEDURE.md) - Session recovery
- [`CLAUDE_MD_TEMPLATE.md`](DOCs/claude-process/CLAUDE_MD_TEMPLATE.md) - Template for new projects

📁 **Tool Reference (todo-mcp v0.6.8)** in `DOCs/claude-reference/`:
- [`TODO-MCP-V068-CONSOLIDATED-BEST-PRACTICES.md`](DOCs/claude-reference/TODO-MCP-V068-CONSOLIDATED-BEST-PRACTICES.md) - **AUTHORITATIVE GUIDE** with correct parameters
- [`TODO-MCP-V068-EXPERIENCE.md`](DOCs/claude-reference/TODO-MCP-V068-EXPERIENCE.md) - Command reference
- [`TODO-MCP-V068-SUCCESS-STORIES.md`](DOCs/claude-reference/TODO-MCP-V068-SUCCESS-STORIES.md) - What works well
- [`MCP_FRICTION_LOG.md`](DOCs/claude-reference/MCP_FRICTION_LOG.md) - Known issues/workarounds

📁 **Project Documentation** in `DOCs/project-specific/`:
- [`ARCHITECTURE.md`](DOCs/project-specific/ARCHITECTURE.md) - System design, components
- [`COMMANDS.md`](DOCs/project-specific/COMMANDS.md) - Build/test commands
- [`IMPLEMENTATION-STATUS.md`](DOCs/project-specific/IMPLEMENTATION-STATUS.md) - Window progress
- [`PASCAL-REFERENCES.md`](DOCs/project-specific/PASCAL-REFERENCES.md) - Pascal sources
- [`BUILD-SYSTEM.md`](DOCs/project-specific/BUILD-SYSTEM.md) - Build pipeline
- [`TEST-STATUS.md`](DOCs/project-specific/TEST-STATUS.md) - Test suite status
- [`TECHNICAL-DEBT.md`](DOCs/project-specific/TECHNICAL-DEBT.md) - Tech debt tracking
- [`USER-GUIDE.md`](DOCs/project-specific/USER-GUIDE.md) - End user documentation

📁 **Repository Organization** - See [`DOCs/REPOSITORY-ORGANIZATION.md`](DOCs/REPOSITORY-ORGANIZATION.md)

## Key Requirements

- Run tests sequentially (Docker container environment)
- Use `--` separator with npm test redirects: `npm test -- file.test.ts 2>&1`
- Preserve unparsed debug strings for error logging
- Include full command context in error messages
- Update test files when adding new classes to `scripts/claude/`
