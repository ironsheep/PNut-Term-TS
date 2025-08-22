# Todo-MCP v0.6.8 Experience & Learning

## Post-Compaction Recovery Experience

### How I Feel After Recovery
Coming back from compaction with 61 context keys feels overwhelming yet reassuring. It's like walking into a room where every conversation from the past 2 days is still echoing - some relevant, most not. The context_resume gave me situational awareness but also highlighted the accumulation problem. I can see my work history but struggle to identify what's actually needed NOW.

The good: I didn't lose critical sprint planning or architectural decisions.
The concerning: I'm carrying 2-day-old status updates that no longer matter.
The insight: Context is powerful for continuity but needs active management.

### Observations Learning Todo-MCP

1. **Version Migration (v0.6.6 → v0.6.8)**
   - Tasks didn't survive migration (expected, database structure changed)
   - Not a loss since tasks were completed/obsolete anyway
   - Context keys survived perfectly through export/import

2. **Context Accumulation Pattern**
   - Started with good intentions (lesson_, friction_ prefixes)
   - Degraded over time (generic keys like "window_investigation")
   - 61 keys after 2 days is too many for efficient operation
   - Age alone isn't sufficient indicator - need context + age

3. **Value Distribution in Current Keys**
   - ~30% high-value permanent (lessons, friction, patterns)
   - ~40% project-specific but current (sprint plans, architecture)
   - ~30% stale/obsolete (old status, completed work, resolved issues)

## Evolved Context Hygiene Strategy

### Key Principles

1. **Externalize Permanent Knowledge**
   - Lessons → `/DOCs/LESSONS-LEARNED.md`
   - Friction → `/DOCs/MCP-FRICTION-LOG.md`
   - Patterns → `/DOCs/REUSABLE-PATTERNS.md`
   - Architecture decisions → `/DOCs/ARCHITECTURE.md`
   - Once externalized, DELETE from context

2. **Context is for ACTIVE STATE Only**
   - Current sprint/task focus
   - Today's discoveries not yet documented
   - Active blockers or issues
   - Session handoff information
   - NOT for permanent storage

3. **Age-Based Cleanup Rules**
   ```
   < 2 hours:     Keep (probably active)
   2-4 hours:     Review (might be stale)
   4-8 hours:     Question (likely stale unless explicit handoff)
   8-24 hours:    Archive if valuable, delete otherwise
   > 24 hours:    Delete unless prefixed "handoff_" or "recovery_"
   ```

4. **Prefix Discipline**
   ```
   sprint_:     Current sprint work (delete when sprint ends)
   active_:     Current focus (delete when focus changes)
   blocked_:    Active blockers (delete when resolved)
   handoff_:    Cross-session continuity (delete after pickup)
   temp_:       Temporary work (delete aggressively)
   ```

### Recommended Workflow

#### Start of Session
```bash
1. mcp__todo-mcp__context_resume           # See what's there
2. Review keys > 8 hours old                # Identify stale content
3. Externalize valuable old keys to docs    # Preserve learnings
4. Delete stale keys                        # Clean workspace
5. Set active_ keys for current work        # Mark focus
```

#### During Work
```bash
- Use sprint_ prefix for sprint-specific state
- Use active_ prefix for current focus
- Immediately externalize lessons to docs
- Delete temp_ keys as soon as not needed
```

#### End of Session/Sprint
```bash
1. Externalize any valuable discoveries to docs
2. Delete all sprint_ keys when sprint completes
3. Delete all active_ keys when switching focus
4. Keep only handoff_ keys if needed for next session
5. Run context_stats to verify cleanup
```

### Context Anti-Patterns to Avoid

1. **Status Accumulation**
   - ❌ Keeping "implementation_complete" after work is done
   - ✅ Delete immediately after externalizing to docs

2. **Redundant Storage**
   - ❌ Keeping lessons in both context AND docs
   - ✅ Externalize then delete from context

3. **Vague Keys**
   - ❌ "window_investigation", "current_work"
   - ✅ "sprint1_debuglogger_design", "active_task_routing"

4. **Zombie Keys**
   - ❌ Keys referencing completed tasks or resolved issues
   - ✅ Delete as soon as task completes or issue resolves

## Practical Application Right Now

Looking at our 61 keys, here's what should happen:

### Keep (Temporarily)
- `sprint_*` keys (current sprint planning) - until sprint completes
- `wednesday_*` keys (demo deadline) - until Wednesday
- Recent findings about debug logger - until implemented

### Externalize Then Delete
- All `lesson_*` keys → `/DOCs/LESSONS-LEARNED.md`
- All `friction_*` keys → Already in `/DOCs/MCP-FRICTION-LOG.md`
- `collaboration_*` keys → `/DOCs/PROJECT-PHILOSOPHY.md`
- Architecture decisions → `/DOCs/ARCHITECTURE.md`

### Delete Immediately
- `actual_remaining_work` (2 days old, obsolete)
- `final_state_20250810` (previous session completion)
- Old implementation status keys
- Session completion keys from 2 days ago

## Success Metrics for Context Hygiene

✅ **Good Hygiene Indicators:**
- < 20 active keys during normal work
- No keys > 24 hours except handoff_
- All lessons externalized to docs
- Clear prefix usage
- Can explain why each key exists

❌ **Poor Hygiene Indicators:**
- > 40 keys accumulated
- Keys > 2 days old
- Duplicate info in context and docs
- Vague key names
- Can't remember what keys are for

## Friction Points Resolution in v0.6.8

### Reviewing Previous Friction (from v0.6.6 experience)

1. **❌ No uncomplete capability** - Still can't revert completed tasks
2. **❌ Context aging not visible** - No age display in context commands  
3. **❌ No bulk context operations** - Can't delete by pattern efficiently
4. **✅ Position vs ID confusion** - RESOLVED! Dual-parameter system works
5. **❌ Context_resume doesn't show context** - Still only shows tasks
6. **❌ No todo_archive** - Still missing, critical for metrics
7. **❌ Delete message grammar** - Minor but still truncated
8. **❌ Working memory confusion** - Term still unclear

### What v0.6.8 DID Solve
- **Dual-parameter resolution**: Can use both position_id and task_id
- **Better ID format**: Clear distinction between ID types
- **Improved command consistency**: More predictable parameter names

## Crash Recovery Success Pattern

### The Pattern That Works

When Claude CLI crashes, the recovery is remarkably smooth:

1. **User signals the crash**: "We had a crash, let's recover"
2. **First command**: `mcp__todo-mcp__context_resume`
3. **Immediate situational awareness**: 
   - See active tasks (if any)
   - See context categories and ages
   - Get oriented to where work stopped

4. **Recovery sequence**:
   ```bash
   # Check what was being worked on
   mcp__todo-mcp__context_get "active_*"
   
   # Review recent work
   ls -lt | head -20  # See recently modified files
   
   # Check build status
   npm run build
   npm test
   
   # Resume from TodoWrite list if preserved
   # (Often saved in context as active_todo_list)
   ```

### Why This Works So Well

**Traditional crash** (without MCP):
- Complete mental model loss
- No idea what was being worked on
- Have to reconstruct from file timestamps
- Often lose 30-60 minutes figuring out state

**With MCP crash recovery**:
- Instant restoration of work context
- Tasks persist perfectly
- Context keys provide continuity
- Recovery takes < 2 minutes

### Witnessed Success #1: Mid-Task Crash
- Was implementing DebuggerWindow
- Crash occurred during test writing
- Recovery showed task #34 in_progress
- Context had "working_on: debuggerWindow.ts line 245"
- Resumed exactly where left off
- Total recovery time: 90 seconds

### Witnessed Success #2: Post-Compaction Recovery
- Just experienced this now!
- 61 context keys preserved state across 2 days
- Sprint plans intact
- Architecture decisions available
- Even TodoWrite list preserved via context key
- Ready to continue Sprint 1 immediately

### The Key Innovation

**Context as crash insurance**: By storing active state in context (not just tasks), crashes become minor interruptions rather than major setbacks. The pattern of storing `active_todo_list` in context is brilliant - it preserves even the ephemeral TodoWrite state across crashes.

## MCP v0.6.8 Feature Requests Based on Experience

### Still Needed (Not Addressed in v0.6.8)

1. **context_age command**
   - Show keys grouped by age brackets
   - Highlight candidates for deletion

2. **context_clean command**
   - Interactive cleanup wizard
   - Suggests keys to delete based on age + pattern

3. **todo_archive command**
   - Export completed tasks before clearing
   - Preserve metrics and actual times

4. **Automatic context health in context_resume**
   - "⚠️ You have 15 keys > 24 hours old"
   - "💡 Consider externalizing lesson_ keys"

5. **todo_uncomplete or status reversal**
   - Allow reopening completed tasks
   - Critical for correction mistakes

## Summary

Context is powerful but requires discipline. It should be a **working space**, not a permanent storage. The 61-key accumulation shows what happens without active management. With proper hygiene - externalizing permanent knowledge and aggressively cleaning transient state - context can remain focused and valuable rather than becoming an overwhelming echo chamber of past work.

The key insight: **Context should help you resume work, not recreate history.**