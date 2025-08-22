# Documentation Reorganization Guide for Large Projects

## Purpose
This guide helps reorganize project documentation into **portable knowledge packages** that can be:
1. Copied between projects to share methodologies
2. Kept separate from project-specific details
3. Evolved independently as process improves
4. Combined with knowledge from other projects

## Why Reorganize?

### The Problem
Over time, project documentation tends to mix:
- Generic process wisdom (portable)
- Project-specific configuration (not portable)
- Tool-specific guides (semi-portable)
- Historical artifacts (should be archived)
- Active planning (should be prominent)
- Completed work (should be archived)

### The Solution
Create clear separation between:
- **What can be copied to ANY project** (pure process)
- **What teaches tool usage** (tool-specific guides)
- **What configures THIS project** (project-specific)
- **What shows evolution** (historical learning)
- **What's actively being worked on** (current)
- **What's completed or obsolete** (archived)

## Target Folder Structure

```
docs/
├── pure-process/              # PORTABLE to any project
├── claude-process/            # PORTABLE (adapt examples)
├── claude-reference/          # PORTABLE (adapt examples)
├── project-specific/          # THIS project only
├── project-sprints/{sprintName}-[YYMMDD]/                  # record from each spring effort
├── project-evolution/         # Historical learning
│   ├── friction-studies/
│   ├── design-decisions/
│   └── future-features/
├── releases/                  # Version documentation
│   └── v[X.Y.Z]/
├── testing/                   # Test documentation
└── _offline/                      # Archived content, to be ignored by claude but kept here


tasks/
├── current/                   # Active work
├── future/                    # Planned work
├── templates/                 # Reusable task templates
└── _offline/                  # Completed/obsolete, to be ignored by claude but kept here
```

## Reorganization Process

### Step 1: Analyze Current Structure

hunt the all .md files in docs/ and tasks/ looking for hints for purpose of each document assign to proper folder based on intention of the content

### Step 2: Create New Structure

make directories that match the folder structure shown above

### Step 3: Identify Content Categories

#### Pure Process (Portable Everywhere)
Look for documents about:
- Planning methodologies
- Task generation approaches
- Quality standards
- Sprint workflows
- Development patterns
- Testing strategies

**Key indicator**: No mention of specific tools, projects, or technologies

#### Claude Process (Portable with Adaptation)
Look for documents about:
- How to work with Claude
- Context management strategies
- Task tracking patterns
- Output formatting standards
- Claude-specific workflows

**Key indicator**: Mentions Claude but principles apply to any AI assistant

#### Claude Reference (Portable with Adaptation)

**Key indicator**: Mentions todo-mcp, taskWriter. HOW claude should best interact with these tools

#### Project-Specific (Not Portable)
Look for documents about:
- This project's architecture
- This repositorie's architecture
- Specific build configurations
- Platform requirements
- Company information
- Deployment settings
- **Project-specific process**:
  - Build procedures (BUILD_PROCESS.md)
  - Test procedures (TEST_PROCEDURE.md)
  - Coverage testing guides
  - Regression testing plans
  - Script usage documentation
  - Deployment workflows
  - CI/CD configurations
  - Platform-specific test plans
  - Manual test scenarios
  - Common mistakes to avoid

**Key indicator**: Specific to THIS codebase/product or HOW this project does things

#### Tool Guides (Semi-Portable)
Look for documents about:
- Specific tool commands
- Tool-specific workflows
- Integration guides
- Configuration examples

**Key indicator**: Names specific tools/frameworks

#### Project Evolution (Study Material)
Look for documents about:
- Friction logs
- Problem → solution mappings
- Design decisions
- Future feature plans
- Learning captures

**Key indicator**: Historical "why we did X" content

### Step 4: Extract and Move Content

Critical: if a document is versioned use 'git mv' to record the document location change

#### Extract Pure Process
For each process document that mixes generic and specific:
1. Copy the document
2. Remove all tool-specific references
3. Replace specific examples with generic patterns
4. Save to `docs/pure-process/`

Example transformation:
```markdown
# Before (mixed)
"Use mcp__todo-mcp__todo_create to create tasks"

# After (pure)
"Create tasks with clear action verbs and specific targets"
```


### Step 5: Clean Up References

#### Update Main Documentation
If you have a CLAUDE.md or README.md, update paths:
```markdown
# Before
See docs/claude-friction/FUTURE_FRICTION_POINTS.md

# After
See docs/project-evolution/friction-studies/FUTURE_FRICTION_POINTS.md
```

#### Archive Obsolete Content
Move to _OFFLINE/ anything that is:
- Completed sprint plans older than 2 versions
- Test results from old versions
- Superseded documentation
- Old implementation plans

### Step 6: Document What Goes Where

Create `docs/FOLDER_GUIDE.md`:
```markdown
# Where Content Belongs

## docs/pure-process/
PUT: Generic methodologies, patterns, standards
DON'T: Tool names, project specifics, code examples

## docs/claude-process/
PUT: Claude collaboration patterns, context strategies
DON'T: Project-specific commands, non-Claude content

## docs/project-specific/
PUT: Architecture, build config, deployment
DON'T: Generic patterns, portable processes

## tasks/current/
PUT: Active sprint work, in-progress plans
DON'T: Completed work, old versions

## tasks/_OFFLINE/
PUT: Completed plans, old test results
DON'T: Anything still referenced
```

## Benefits After Reorganization

### Immediate Benefits
1. **Clear separation** of portable vs project-specific
2. **Easy to find** active vs archived content
3. **Ready to receive** process docs from other projects
4. **Clean working directory** with less clutter

### Future Benefits
1. **Copy `pure-process/` folder** to any new project
2. **Share `claude-process/`** with other Claude users
3. **Study `project-evolution/`** for patterns
4. **Merge process improvements** from other projects

## Merging Process Documents from Other Projects

When receiving process documents from another project:

### 1. Compare Versions
```bash
# Check if documents exist
ls docs/pure-process/
ls docs/incoming/pure-process/  # From other project
```

### 2. Merge Strategy
- **If file doesn't exist**: Copy it directly
- **If file exists**:
  1. Read both versions
  2. Identify unique insights from each
  3. Create merged version with best of both
  4. Document source of each insight

### 3. Example Merge
```markdown
# docs/pure-process/planning-methodology.md

## Planning Principles
[From Project A]
- Planning is iterative until no questions remain
- Always evaluate multiple alternatives

[From Project B]
- Explicitly decide backward compatibility approach
- Check for architecture degradation each sprint

[Merged insight]
- Planning must be complete before task generation
```

## Advanced Knowledge Synthesis Strategy

### Step 1: Prepare Both Projects
Run reorganization in BOTH projects first:
1. Project A creates portable packages
2. Project B creates portable packages
3. Both have clean `pure-process/` and `claude-process/` folders

### Step 2: Create Synthesis Workspace
```bash
# In a temporary location
mkdir -p synthesis/from-project-a/
mkdir -p synthesis/from-project-b/
mkdir -p synthesis/merged/

# Copy from both projects
cp -r project-a/docs/pure-process/* synthesis/from-project-a/
cp -r project-b/docs/pure-process/* synthesis/from-project-b/
```

### Step 3: Automated Merge Process
Ask Claude to:
```markdown
"I have two sets of process documentation:
- synthesis/from-project-a/ (from todo-mcp project)
- synthesis/from-project-b/ (from Pascal-to-TypeScript project)

Please:
1. Read all files from both directories
2. Identify overlapping topics
3. For each topic, create a merged version that:
   - Combines unique insights from both
   - Resolves any contradictions
   - Marks source of each practice [Project A] or [Project B]
   - Adds [Synthesis] for new insights from combining
4. Save merged versions to synthesis/merged/
5. Create INDEX.md listing what came from where"
```

### Step 4: Review and Integrate
1. Review merged documents
2. Copy back to BOTH projects:
   ```bash
   cp synthesis/merged/* project-a/docs/pure-process/
   cp synthesis/merged/* project-b/docs/pure-process/
   ```
3. Now both projects have the combined wisdom

### Knowledge Evolution Pattern
```
Project A          Project B
    ↓                  ↓
[Process v1]      [Process v1]
    ↓                  ↓
[Learn/Evolve]    [Learn/Evolve]
    ↓                  ↓
[Process v2]      [Process v2]
    ↘                ↙
      [Synthesis v3]
     ↙              ↘
[Process v3]      [Process v3]
```

### What Gets Synthesized Well

#### Pure Process (Best synthesis potential)
- Planning methodologies → Combined approaches
- Task generation → Richer patterns
- Quality standards → Higher bar
- Sprint workflows → More complete

#### Claude Process (Good synthesis)
- Context management → More strategies
- Output formatting → Better standards
- Error recovery → More scenarios
- Task tracking → Multiple approaches

#### Project Evolution (Learning synthesis)
- Friction patterns → Common problems across projects
- Solutions → Multiple ways to solve same problem
- Anti-patterns → What to avoid universally

### Synthesis Quality Checklist
After merging:
- [ ] No contradictions (or explicitly noted)
- [ ] Sources marked [Project A] [Project B] [Synthesis]
- [ ] Richer than either source alone
- [ ] Still portable (no project specifics)
- [ ] Clear examples from both domains
- [ ] INDEX shows contribution sources

## Quality Checklist

After reorganization, verify:
- [ ] Pure process docs contain NO project-specific references
- [ ] Claude process docs use generic examples
- [ ] Active work is in tasks/current/
- [ ] Old versions are organized in _OFFLINE/v[X.Y.Z]/
- [ ] Friction studies are preserved in project-evolution/
- [ ] Main docs (CLAUDE.md, README) have updated paths
- [ ] Each folder has clear purpose documented
- [ ] Portable packages are identified

## Common Patterns to Archive

### In tasks/
- `*_TEST_RESULTS.md` older than current version
- `*_IMPLEMENTATION_PLAN.md` for completed features
- `READY_FOR_v*.md` from old releases
- `*_FIX_SUMMARY.md` from resolved issues
- Old validation/verification plans

### In docs/
- Old release notes (keep latest 2-3 versions)
- Superseded API documentation
- Old troubleshooting guides for fixed issues
- Previous migration guides
- Outdated setup instructions

## Final Tips

1. **Don't delete, archive** - Move to _OFFLINE/ folders
2. **Use git mv** - Preserve history when moving files
3. **Create before moving** - Make directories first
4. **Test portability** - Ensure pure-process has no project refs
5. **Document decisions** - Note why things were categorized
6. **Iterate** - This structure can evolve as you learn

## Expected Time
- Small project (< 50 docs): 30-60 minutes
- Medium project (50-200 docs): 1-2 hours
- Large project (200+ docs): 2-4 hours

The investment pays off immediately in clarity and long-term in knowledge sharing.
