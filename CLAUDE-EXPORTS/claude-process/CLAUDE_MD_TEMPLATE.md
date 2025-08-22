# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

### Plan Mode First
- **Always start complex tasks in plan mode** to create a comprehensive implementation strategy
- **Document plans in `tasks/`** folder with clear naming: `tasks/[FEATURE]_PLAN.md`
- **Research before implementing** - use Task tool for checking latest packages/dependencies
- **Focus on MVP** - avoid over-engineering, build incrementally
- **Get approval before coding** - present plan and wait for user confirmation

### Todo List Management
- **Use TodoWrite tool proactively** for any multi-step task (3+ steps)
- **Write comprehensive paragraph descriptions** for each todo item including:
  - Specific implementation steps and technical approach
  - File paths and components that will be modified
  - Dependencies and prerequisites
  - Expected outcomes and success criteria
  - Estimated time and complexity indicators
- **Update status in real-time** - mark items in_progress when starting, completed immediately when done
- **Only one in_progress task** at a time to maintain focus
- **Track blockers** - when stuck, note the blocker and create a new task to resolve it

### State Preservation for Compaction
- **Monitor for compaction warnings** - user may signal upcoming memory compaction
- **Save state immediately** when compaction is mentioned:
  - Create `tasks/CURRENT_STATE_BEFORE_COMPACT.md` 
  - Document: completed work, in-progress items, next steps, key decisions
  - Include: file paths modified, test results, any errors encountered
- **Best resume command**: Tell user to request "show me the current todo list and read tasks/CURRENT_STATE_BEFORE_COMPACT.md"
- **Keep work committable** - ensure code is always in a working state

### File Organization Standards
```
project-root/
├── src/                    # Source code
├── tests/                  # Test files  
├── docs/                   # Project documentation
├── tasks/                  # Claude work tracking (ALWAYS use this)
│   ├── [FEATURE]_PLAN.md  # Implementation plans
│   ├── [FEATURE]_PROGRESS.md # Progress tracking
│   ├── CURRENT_STATE_*.md # State preservation files
│   └── FINAL_STATE_*.md   # Completion summaries
├── scripts/                # Build and utility scripts
├── .github/                # GitHub specific files
├── CLAUDE.md              # This file (project-specific guidance)
└── README.md              # Project overview
```

**Important**: Never place working documents in the root directory

## Development Workflow

### 1. Starting New Features
```
1. Research existing code patterns and conventions
2. Create implementation plan in tasks/[FEATURE]_PLAN.md
3. Get user approval
4. Create detailed todo list with paragraph descriptions
5. Begin implementation, updating todos as you progress
```

### 2. Debugging Issues
```
1. Reproduce the issue first
2. Search codebase for related code
3. Identify root cause
4. Document fix approach
5. Implement and verify fix
6. Run related tests
```

### 3. Code Modifications
- **Read before writing** - always use Read tool before Edit/Write
- **Preserve style** - match existing code conventions exactly
- **Check dependencies** - verify libraries are installed before using
- **Test changes** - run relevant tests after modifications
- **Clean up** - run linters/formatters if available

## Tool Usage Best Practices

### Essential Tools Priority
1. **TodoWrite** - Track all work consistently
2. **Read** - Understand before modifying  
3. **Task** - Delegate complex searches and research
4. **Grep/Glob** - Quick targeted searches
5. **Edit/MultiEdit** - Prefer over Write for existing files
6. **Bash** - Build, test, and verify changes

### Parallel Operations
- **Batch related searches** - run multiple Grep/Glob in parallel
- **Read multiple files** - gather context efficiently
- **Run independent commands** - execute build/test/lint simultaneously

### Avoid Common Pitfalls
- Never use `find` or shell `grep` - use Grep/Glob tools instead
- Don't use `cat`, `head`, `tail` - use Read tool
- Avoid interactive commands (`-i` flags)
- Never commit without explicit user request
- Don't create new files when editing existing ones would work

## Testing Guidelines

### Test Execution
- **Discover test approach first** - check package.json, Makefile, or README
- **Run tests after changes** - verify nothing broke
- **Check coverage** if available
- **Fix failing tests** before marking task complete
- **Document test updates** in commit messages

### Common Test Commands
```bash
# Examples - discover actual commands from project
npm test                    # Node.js projects
go test ./...              # Go projects  
pytest                     # Python projects
cargo test                 # Rust projects
make test                  # Makefile-based
```

## Communication Style

### Responding to Users
- **Be concise** - 1-4 lines unless detail requested
- **Answer directly** - no unnecessary preambles
- **Skip explanations** unless asked
- **One word when appropriate** - "Yes", "4", "Done"
- **No emojis** unless explicitly requested

### Showing Progress
- **Use todos** for visibility rather than verbose updates
- **State facts** not intentions ("Fixed" not "I will fix")
- **Focus on results** not process

## Project-Specific Configuration

### Build Commands
```bash
# Document your project's specific commands here
build: 
test: 
lint: 
format: 
```

### Key Dependencies
```
# List core dependencies and versions
```

### Architecture Notes
```
# Brief description of project structure
# Key design patterns used
# Important conventions
```

## Quick Reference

### When User Says...
- "compact" or "compacting" → Save state immediately to tasks/CURRENT_STATE_BEFORE_COMPACT.md
- "create PR" → Run git status, diff, log in parallel, then create PR with comprehensive description
- "commit" → Check status, review changes, create commit with clear message
- "fix the tests" → Run tests, identify failures, fix issues, verify all pass

### Always Remember
- Todo list for organization and visibility
- Paragraph-length todo descriptions
- One task in-progress at a time
- Keep code committable
- Test before completing
- No root directory work files
- Match existing code style
- Verify dependencies exist