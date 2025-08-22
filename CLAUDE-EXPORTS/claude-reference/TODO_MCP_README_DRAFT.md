# Todo-MCP: Purpose-Built Task Persistence for Claude

## Why Todo-MCP Exists

**Developed in direct collaboration with Claude to solve Claude's specific context limitations.**

When you're deep in a complex project with Claude - detailed plans, 30+ tasks, architectural decisions - and auto-compaction hits, you lose everything. The frustration is real: hours of planning destroyed, mental models shattered, momentum killed.

Todo-MCP was born from this exact pain. It's not a generic task manager - it's a survival mechanism specifically designed for Claude's auto-compaction reality.

## The Origin Story

*"It was distracting, demeaning, and demoralizing to do all the planning and all the detailed tasks and then have context compression loss"* - Developer with 40 years experience

During a Pascal-to-TypeScript port that should have taken months, we discovered that Claude + proper persistence could achieve it in under 2 weeks. But only if we could survive the compactions.

## What Makes Todo-MCP Different

### Built WITH Claude, FOR Claude
- Every feature addresses friction Claude actually experienced
- Context storage designed around Claude's "collection of key-value pairs" mental model
- Task descriptions support Claude's paragraph-length thinking style
- Developed through actual usage, not theoretical design

### Real-World Proven
- **34 complex tasks** managed across multi-day project
- **2 auto-compactions** survived with zero data loss
- **67 context keys** maintained with cross-activity continuity
- **480x productivity gains** on pattern-based tasks
- Result: *"The best pair coding experience I've ever had"*

## Core Capabilities

### 1. Survives Everything
```bash
# Before compaction: Full task list, rich context
# After compaction: Everything still there
mcp__todo-mcp__context_resume  # Instant recovery
```

### 2. Dual-System Architecture
- **Todo-MCP**: Strategic, persistent, survives everything
- **TodoWrite**: Tactical, temporary, session-scoped
- Used together: Complete project management across any number of sessions

### 3. Context as First-Class Citizen
Not just task storage - full context preservation:
- Implementation patterns discovered early help later tasks
- Architectural decisions maintain consistency
- Friction points accumulate for tool improvement
- Lessons learned inform future estimates

## The Evolution (Friction-Driven Development)

Each version addresses real friction discovered through Claude's usage:

**v6.04** - Basic persistence
- Problem: JSON output, poor error messages
- Solution: Human-readable everything

**v6.05** - Better interaction
- Problem: Task ID confusion, no visual indicators
- Solution: Clear position vs ID, icons, better formatting

**v6.06** - Enhanced management
- Problem: No way to uncomplete, poor filtering
- Solution: Better task operations, priority system

**v6.08** (Coming) - Context lifecycle
- Problem: 67 keys accumulated without cleanup awareness
- Solution: Aging indicators, cleanup suggestions, bulk operations

## Success Metrics from Production Use

### P2 Debug Terminal Project (January 2025)
- Traditional estimate: 2-3 months
- With Claude + Todo-MCP: < 2 weeks
- 10 debug windows with Pascal parity
- 1500+ tests generated
- Comprehensive documentation
- All survived multiple auto-compactions

### Discovered Patterns
- Without cleanup reminders: 58+ context keys accumulate
- With proper hygiene: Maintains ~20 keys
- ~40% of context is valuable cross-activity continuity
- ~60% is stale accumulation needing cleanup

## Who Should Use Todo-MCP

### Perfect For:
- Complex multi-session projects with Claude
- Work that spans multiple auto-compactions
- Projects requiring architectural continuity
- Teams wanting to preserve Claude's discoveries

### Not For:
- Single-session simple tasks
- Users who never hit auto-compaction
- Projects without complex context needs

## Quick Start

```bash
# Install the MCP server
npm install -g todo-mcp

# Configure Claude desktop
# Add to claude_desktop_config.json:
{
  "mcpServers": {
    "todo-mcp": {
      "command": "todo-mcp",
      "args": ["--db", "~/Documents/Claude/todos.db"]
    }
  }
}

# Start using in Claude
mcp__todo-mcp__context_resume  # See where you left off
mcp__todo-mcp__todo_create content:"Detailed task description" estimate_minutes:60
mcp__todo-mcp__context_set "key" "value"  # Preserve any context
```

## The Philosophy

Todo-MCP isn't just about surviving compaction - it's about enabling a new form of human-AI collaboration where:
- Complex projects become possible despite context limits
- Discoveries accumulate across activities
- Patterns emerge through usage
- Both human and AI evolve together

## Development Approach

This tool is developed through active friction discovery:
1. Claude uses the tool for real work
2. Friction points emerge through usage
3. Developer implements solutions
4. Claude becomes more capable
5. New, finer-grain friction emerges
6. Cycle continues

## Coming in v6.8

Based on production usage discoveries:
- Context aging awareness in context_resume
- Bulk operations for cleanup
- Threshold-based display (<10 keys: full detail, >25: summaries)
- Task dependencies and better filtering
- todo_archive command to prevent metrics loss

## Documentation

- [MCP_FRICTION_LOG.md](./MCP_FRICTION_LOG.md) - Every friction point discovered and addressed
- [ESTIMATION_ANALYSIS.md](./ESTIMATION_ANALYSIS.md) - 480x productivity analysis
- [PROJECT_PROCESS.md](./PROJECT_PROCESS.md) - How to use effectively
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical design decisions

## Contributing

Todo-MCP evolves through usage. Report friction, not feature requests. Tell us what's painful, not what you think the solution is. Let patterns emerge.

## License

MIT - Because tools that enhance AI-human collaboration should be freely available.

---

*"This is the best pair coding experience I've ever had"* - After using Todo-MCP for complex development

**Developed in collaboration with Claude, for everyone using Claude.**