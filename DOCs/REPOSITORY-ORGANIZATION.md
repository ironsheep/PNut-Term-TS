# Repository Organization Guide

## Overview
This document explains the organization structure of the PNut-Term-TS repository, helping developers quickly understand where different types of content belong and why the structure exists.

## Philosophy
The repository is organized to separate **portable knowledge** (can be copied to other projects) from **project-specific content** (unique to this codebase), while maintaining clear boundaries between process documentation, implementation artifacts, and historical records.

## Directory Structure

```
PNut-Term-TS/
├── src/                           # TypeScript source code
├── tests/                         # Test suites
├── dist/                          # Build outputs
├── DOCs/                          # All documentation
│   ├── pure-process/              # 🌟 PORTABLE: Generic methodologies
│   ├── claude-process/            # 🤖 PORTABLE: AI collaboration patterns
│   ├── claude-reference/          # 📚 Tool-specific: todo-mcp guides
│   ├── project-specific/          # 🏗️ THIS PROJECT: Architecture, build, test
│   ├── project-sprints/           # 📅 Historical: Sprint artifacts by date
│   ├── project-evolution/         # 📈 Learning: Decisions and friction
│   │   ├── friction-studies/      # Problems encountered and solutions
│   │   ├── design-decisions/      # Architectural choices and rationale
│   │   └── future-features/       # Planned enhancements
│   ├── releases/                  # 📦 Version documentation
│   ├── testing/                   # 🧪 Test plans and results
│   └── _offline/                  # 🗄️ Archived: Completed/obsolete
├── tasks/                         # Task management
│   ├── current/                   # 🔥 Active work in progress
│   ├── future/                    # 📋 Planned future work
│   ├── templates/                 # 🎯 Reusable task templates
│   └── _offline/                  # 🗄️ Completed tasks
└── CLAUDE.md                      # 🎯 AI assistant guidance (critical)
```

## Folder Categories Explained

### 🌟 Portable Process (Copy to ANY Project)
**`DOCs/pure-process/`**
- Planning methodologies that work universally
- Sprint execution patterns proven through experience
- Estimation and tracking strategies
- No tool-specific or project-specific content
- **Key Value**: Take these to your next project immediately

### 🤖 Claude Collaboration (AI-Assisted Development)
**`DOCs/claude-process/`**
- Patterns for working with Claude effectively
- Context management and compaction recovery
- Dual-system task management strategies
- Session handoff procedures
- **Key Value**: Maximum productivity with AI assistance

### 📚 Tool Reference (Version-Specific Guides)
**`DOCs/claude-reference/`**
- todo-mcp v0.6.8 command reference
- TodoWrite usage patterns
- Tool-specific friction logs and workarounds
- Success stories with metrics
- **Key Value**: Operational efficiency with current tools

### 🏗️ Project Documentation (THIS Codebase)
**`DOCs/project-specific/`**
- PNut-Term-TS architecture and design
- Build and test procedures
- Implementation status tracking
- User guides and tutorials
- **Key Value**: Everything needed to understand and maintain this project

### 📅 Sprint History (Development Timeline)
**`DOCs/project-sprints/`**
- Chronological record of development efforts
- Named by feature and dated by earliest document
- Preserves planning, execution, and retrospectives
- **Key Value**: Learn from past sprints, track project evolution

### 📈 Project Evolution (Learning Repository)
**`DOCs/project-evolution/`**
- Friction studies: Problems faced and solutions found
- Design decisions: Why we built it this way
- Future features: Where the project is heading
- **Key Value**: Institutional memory and continuous improvement

### 🗄️ Archived Content (`_offline` folders)
- Completed sprint plans
- Obsolete documentation
- Superseded procedures
- **Key Value**: Historical reference without cluttering active workspace

## Navigation Tips

1. **Starting a new project?** 
   - Copy entire `DOCs/pure-process/` folder
   - Review `DOCs/claude-process/` for AI collaboration

2. **Working on PNut-Term-TS?**
   - Start with `DOCs/project-specific/ARCHITECTURE.md`
   - Check `tasks/current/` for active work
   - Reference `CLAUDE.md` for AI guidance

3. **Debugging an issue?**
   - Check `DOCs/project-evolution/friction-studies/`
   - Review relevant sprint in `DOCs/project-sprints/`

4. **Planning new work?**
   - Study `DOCs/pure-process/PLANNING-METHODOLOGY.md`
   - Use templates from `tasks/templates/`

## Key Principles

### Separation of Concerns
- **Portable vs Project-Specific**: Clear boundaries enable knowledge transfer
- **Current vs Historical**: Active work stays visible, completed work archived
- **Process vs Implementation**: Methodologies separate from code

### Knowledge Preservation
- **Sprint Artifacts**: Maintain development history
- **Friction Studies**: Learn from problems
- **Design Decisions**: Understand the "why"

### Continuous Improvement
- **Evolution Tracking**: See how project and process improve
- **Success Stories**: Celebrate and replicate wins
- **Friction Logs**: Address pain points systematically

## File Naming Conventions

### Important Documents: UPPERCASE
- Critical guidance documents use ALL-CAPS names
- Examples: `PLANNING-METHODOLOGY.md`, `ARCHITECTURE.md`
- Makes them stand out in directory listings

### Sprint Folders: Feature-Sprint-Date
- Format: `{Feature}-Sprint{N}-{YYYYMMDD}`
- Example: `DebugLogger-Sprint1-20250812`
- Provides context and chronology at a glance

### Archived Content: _offline Prefix
- Underscore prefix sorts to bottom
- "offline" clearly indicates archived status
- Preserves history without cluttering active space

## Maintenance Guidelines

### When Adding Documentation
1. Determine if it's portable or project-specific
2. Check if it's current work or historical
3. Use UPPERCASE for critical guidance documents
4. Place in appropriate category folder

### When Completing Work
1. Move sprint artifacts to `project-sprints` with proper naming
2. Archive completed tasks to `tasks/_offline`
3. Extract reusable patterns to `pure-process`
4. Document lessons in `project-evolution`

### Regular Cleanup
- Review `tasks/current` for stale items
- Check documentation age and relevance
- Move obsolete content to `_offline`
- Update this guide as structure evolves

## Benefits of This Organization

1. **Knowledge Portability**: Pure process travels to new projects
2. **Clear Boundaries**: Easy to find what you need
3. **Historical Context**: Learn from the past
4. **Active Focus**: Current work stays visible
5. **Continuous Learning**: Evolution captured systematically

This organization structure has been refined through multiple projects and represents best practices for maintaining both portable wisdom and project-specific knowledge.