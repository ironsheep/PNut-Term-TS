# Planning Methodology

## Critical Lesson Learned: Track Everything

During our first major project, we lost valuable estimation vs actual data due to not systematically recording completion times. This document ensures future projects capture this critical information.

## Project Initialization

### 1. Clean State Protocol
Verify clean starting state:
- Task system should be empty or previous project complete
- Session-scoped tasks should be empty
- Archive project-specific context, keep universal lessons

### 2. Project Context Setup
Initialize project tracking:
- Set project name
- Record project start time
- Initialize estimation tracking structure

## Cross-Activity Context Continuity

### Critical Insight: Context Accumulates Value Across Activities

**Expected Behavior**: Context zeroed between activities
**Actual Behavior**: Context naturally accumulates valuable continuity when planning scope is project-wide

### What Accumulates (Keep Across Activities):
- **Discovered Patterns**: Architectural patterns that inform all components
- **Implementation Orders**: Dependency sequences that survive reorganization
- **Architectural Decisions**: Core choices that maintain consistency
- **Friction Points**: Tool problems that accumulate for improvement
- **Estimation Learnings**: Accuracy refinements for future estimates

### What to Clean (After Each Activity):
- **Status Keys**: Current task tracking - delete when done
- **Progress Tracking**: Completion percentages - delete after completion
- **Temporary Fixes**: Workarounds - delete when resolved

### The Pattern:
```
# Start project with broad planning (all tasks identified)
# Activity 1: Core Infrastructure
  - Discover key patterns → store for reuse
  - Complete activity → clean status, keep patterns
# Activity 2: Feature Implementation
  - Apply patterns from previous activities
  - Discover new patterns → add to knowledge base
# Activity N: Final Integration
  - Benefits from all accumulated patterns/learnings
# Project Complete:
  - Rich context for demo, handoff, next project
```

This EMERGENT behavior arises naturally from good planning - not programmed but discovered through usage.

## During Development

### Task Completion Recording (CRITICAL)
Every time a task is completed:
- Record the actual time IMMEDIATELY
- Compare with original estimate
- Calculate estimation ratio
- Store for future calibration

### Estimation Calibration
Track patterns:
- Which types of tasks are consistently over-estimated
- Which types are under-estimated
- Personal velocity trends
- Environmental factors affecting estimates

## Sprint Workflow

### Planning Phase
1. Define sprint goals clearly
2. Break down into concrete tasks
3. Estimate each task realistically
4. Identify dependencies and order
5. Plan for contingencies

### Execution Phase
1. Work tasks in dependency order
2. Track actual vs estimated time
3. Adjust remaining estimates based on learnings
4. Document blockers and solutions

### Wrap-up Phase
1. Complete all testing
2. Update documentation
3. Clean up temporary artifacts
4. Capture lessons learned
5. Prepare handoff materials

## Key Principles

### Progressive Elaboration
- Start with high-level planning
- Refine as understanding grows
- Adjust based on discoveries
- Maintain flexibility while preserving structure

### Knowledge Preservation
- Document patterns as discovered
- Keep solutions to common problems
- Build reusable templates
- Create institutional memory

### Continuous Improvement
- Analyze estimation accuracy
- Refine processes based on experience
- Eliminate repeated friction
- Optimize workflow continuously