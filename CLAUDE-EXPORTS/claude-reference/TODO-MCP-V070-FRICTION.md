# Todo-MCP v0.7.0 Friction & Feature Requests

## Target: Multi-Agent & Sub-Agent Support
v0.7.0 will support multiple agents, sub-agents, and multiple Claude instances, each with isolated todo list silos in the database.

## New Friction Points Discovered in v0.6.8

### Context Management

1. **No age visibility in context commands**
   - Problem: Can't see how old keys are without manual tracking
   - Solution: Add timestamps and age display to all context commands
   - Priority: HIGH - Essential for hygiene

2. **No bulk context operations**
   - Problem: Pattern deletion works but limited (can't combine patterns)
   - Solution: Support complex queries like "delete keys older than X AND matching pattern Y"
   - Priority: MEDIUM

3. **Context health not shown in resume**
   - Problem: context_resume shows tasks but not context health metrics
   - Solution: Add summary like "35 keys, 5 stale (>24h), 10 temporary"
   - Priority: HIGH

### Task Management

4. **Can't uncomplete/reopen tasks**
   - Problem: Accidentally completed tasks can't be reverted
   - Solution: Allow status changes from completed back to in_progress
   - Priority: HIGH - Common mistake

5. **No todo_archive command**
   - Problem: Clearing completed tasks loses metrics and actual times
   - Solution: Export to markdown/json before clearing
   - Priority: CRITICAL - Data loss issue

6. **TodoWrite doesn't survive compaction**
   - Problem: Ephemeral todo list lost on compaction
   - Solution: In v0.7.0, could each agent have persistent TodoWrite?
   - Priority: MEDIUM - Have workaround via context

### Multi-Agent Considerations for v0.7.0

7. **Agent context namespace collision**
   - Problem: Multiple agents might use same context key names
   - Solution: Automatic agent-prefixing or separate context stores
   - Priority: CRITICAL for v0.7.0

8. **Cross-agent task visibility**
   - Problem: Might want main agent to see sub-agent progress
   - Solution: Optional task sharing/visibility controls
   - Priority: HIGH for coordination

9. **Agent handoff mechanism**
   - Problem: How to pass state between agents?
   - Solution: Explicit handoff commands with state transfer
   - Priority: HIGH for v0.7.0

### Quality of Life

10. **Delete message truncation**
    - Problem: "has been delete" instead of "deleted"
    - Solution: Fix message formatting
    - Priority: LOW - Cosmetic

11. **"Working Memory" terminology confusion**
    - Problem: context_resume shows "Working Memory: (empty)" confusingly
    - Solution: Rename or clarify what this section means
    - Priority: LOW

## Positive Patterns to Preserve

### What Works Brilliantly
- Crash recovery via context_resume
- Dual-parameter system (position_id and task_id)
- Context as key-value store
- Pattern-based deletion
- Task persistence across sessions

### Successful Patterns for v0.7.0
- Keep agent isolation strong
- Maintain backwards compatibility
- Continue human-readable output format
- Preserve the simplicity of key-value context

## Implementation Priority for v0.7.0

### CRITICAL (Breaks multi-agent if missing)
- Agent namespace isolation for context
- Agent namespace isolation for tasks
- Cross-agent visibility controls

### HIGH (Significant friction)
- todo_archive command
- Context age visibility
- Task uncomplete capability
- Context health in resume

### MEDIUM (Nice to have)
- Bulk context operations
- Persistent TodoWrite per agent
- Agent handoff mechanisms

### LOW (Cosmetic)
- Fix delete message grammar
- Clarify "Working Memory" term

## Notes for v0.7.0 Design

### Agent Isolation Strategy
Each agent should have:
- Own task list (confirmed)
- Own context namespace (suggested)
- Own TodoWrite persistence (suggested)
- Optional shared "handoff" space

### Coordination Patterns
- Parent can see child agent summaries
- Explicit handoff with state transfer
- Shared context keys with agent prefixes
- Progress aggregation for parent visibility

## Success Patterns from v0.6.8 Usage

### Crash Recovery Excellence
- **Pattern**: Always run context_resume first after crash
- **Success**: 2 witnessed recoveries in < 2 minutes each
- **Why it works**: Context + tasks = complete state restoration

### Context as TodoWrite Backup
- **Pattern**: Store `active_todo_list` in context
- **Success**: TodoWrite list survived compaction via context
- **Anti-pattern**: Don't rely on TodoWrite alone for critical lists

### Sprint-Prefix Organization
- **Pattern**: Use `sprint1_`, `sprint2_` prefixes for sprint-specific keys
- **Success**: Easy bulk cleanup after sprint completion
- **Anti-pattern**: Generic keys like "current_work" accumulate

### Externalize Then Delete
- **Pattern**: Move lessons/friction to docs, then delete from context
- **Success**: Permanent knowledge preserved, context stays lean
- **Anti-pattern**: Keeping duplicate info in context and docs

## Anti-Patterns to Avoid

### Context Accumulation
- **Anti-pattern**: Not cleaning keys after task completion
- **Result**: 61 keys after 2 days (should be <20)
- **Fix**: Delete task-specific keys immediately after completion

### Vague Key Names
- **Anti-pattern**: "window_investigation", "current_status"
- **Result**: Can't remember purpose, afraid to delete
- **Fix**: "sprint1_debuglogger_routing", specific and temporary

### Status in Context
- **Anti-pattern**: Storing task status in context (duplicates MCP)
- **Result**: Stale status keys that confuse
- **Fix**: Use MCP for status, context for unique state only

### Over-Reliance on Memory
- **Anti-pattern**: Trying to remember what keys are for
- **Result**: Accumulation because unsure if safe to delete
- **Fix**: Aggressive externalization and deletion

## Process Notes

### Why We're Doing This
As early adopters of todo-mcp v0.6.8, we're:
1. **Testing in production** - Real project, real deadlines
2. **Finding friction** - Actual usage reveals what theory misses
3. **Documenting patterns** - Success and failure modes
4. **Informing v0.7.0** - Multi-agent design based on experience

### The Feedback Loop
- Use todo-mcp intensively
- Hit friction point
- Document immediately
- Develop workaround
- Inform next version
- Test improvements
- Repeat

This tight feedback loop has driven rapid improvement from v0.6.4 → v0.6.8 in just one week.

## Success Metrics for v0.7.0

✅ **Success Indicators:**
- Multiple agents can work without collision
- Context remains isolated per agent
- Parent agent can monitor progress
- State handoff is smooth
- Backwards compatible with v0.6.8
- Context hygiene easier to maintain
- Metrics never lost (todo_archive)

❌ **Failure Indicators:**
- Context key collisions between agents
- Task list confusion
- Lost state during handoff
- Breaking changes to existing workflow
- Context still accumulates without cleanup
- Still losing metrics on task clear