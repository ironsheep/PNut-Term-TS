# CLAUDE.md

Essential guidance for Claude Code when working with this repository.

## 🎯 Todo-MCP Task Management (v0.6.8)

### Dual-Parameter Resolution (v0.6.8 - RESOLVED!)

**Position vs ID confusion RESOLVED!** Dual-parameter resolution now supports both:
- **Position**: Use `position_id:1` (changes when list reorders) 
- **Task ID**: Use `task_id:"#22"` (permanent, immutable reference)
- **Legacy**: Still supports `id:1` for backward compatibility (position-based)
- **Priority**: If both provided, `task_id` takes precedence with validation
- **Best Practice**: Use `position_id` for interactive work, `task_id` for automation

### Working Efficiently with v0.6.8

```bash
# Starting work (single recovery command!)
mcp__todo-mcp__context_resume                    # Shows tasks + saved context

# CRITICAL v0.6.8 Parameter Formats:
# - Most functions use id:22 (number, no #) for legacy compatibility
# - Tag functions accept BOTH task_id:"#49" OR position_id:1
# - estimate_minutes MUST be number, not string

# Task operations (most use id parameter as number)
mcp__todo-mcp__todo_list                         # See positions (1,2,3...) and IDs (#n)
mcp__todo-mcp__todo_start id:22                  # Start by task ID (number, no #)
mcp__todo-mcp__todo_complete id:22               # Must start before complete!
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

**Parameter Formats (MUST be exact):**
- `id:22` - Number without # (most functions)
- `task_id:"#49"` - String with # (tag functions only)
- `estimate_minutes:60` - Always number, never string
- `priority:"high"` - Exact: critical/high/medium/low/backlog
- `status:"in_progress"` - Exact: created/in_progress/paused/completed

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

**Use Context For (HIGH VALUE):**
```bash
# Cross-session continuity  
mcp__todo-mcp__context_set "implementation_order" "Tasks #22,#23,#24 sequence critical"
mcp__todo-mcp__context_set "lesson_mcp_id_confusion" "Always use position not task ID"
mcp__todo-mcp__context_set "workaround_autosort" "Store manual order in context"
mcp__todo-mcp__context_set "recovery_electron_mocks" "Add to jest.setup.js for tests"
```

**Don't Use Context For (LOW VALUE):**
- Current task status (`working_on` - MCP tasks handle this better)
- Progress percentages (`15 of 30 complete` - duplicates MCP data)
- Implementation details (belong in code comments/docs)
- Temporary debugging state (clean up when resolved)

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

**Context Key Naming:**
- `lesson_`: Permanent learning (keep forever)
- `workaround_`: Tool/process fixes (keep until tool fixed)
- `recovery_`: Crash/problem solutions (keep for future)
- `friction_`: Tool problems (keep for improvement reports)
- `temp_`, `current_`, `active_`: Temporary (delete when done)
- `session_`, `handoff_`: Cross-session continuity (delete after use)
- Unprefixed status keys: Clean up aggressively (2-4 hour lifetime)

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

## External References CLAUDE specific

📁 **Portable process guidance in `docs/claude-process/`** (carry to new projects):
- `context-management.md` - Context state hygiene and cleanup patterns
- `dual-system-strategy.md` - MCP vs TodoWrite task management
- `todowrite-lifecycle.md` - TodoWrite lifecycle tied to task execution
- `output-formatting.md` - MCP human-readable output standards (NO raw JSON)

📁 **Project-specific guidance in `docs/claude-reference/`** (todo-mcp only):
- `mcp-commands.md` - MCP command reference, position/ID handling
- `workflows.md` - Development workflows, compaction recovery
- `task-format.md` - STF format, dual task system strategy
- `testing-standards.md` - Testing requirements and standards
- `working-principles.md` - Todo management, state preservation, tool usage

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
