# Testing and Fix Protocol

## Standard Operating Procedure for Test-Fix Cycles

### Phase 1: HANDOFF & HOLD
**When**: Package delivered to human for testing
**Actions**:
- Document checkpoint with timestamp
- Create WAITING task in todo-mcp
- Set context with handoff status
- **FULL STOP** on all code changes

**Claude's Role**: 
- Wait and listen
- Document incoming feedback
- NO code changes
- NO builds
- NO jumping to solutions

### Phase 2: FEEDBACK COLLECTION
**When**: Human provides test results
**Actions**:
- Receive ALL feedback items one by one
- Document each issue without acting
- Ask clarifying questions if needed
- Build complete picture of problems
- **DO NOT START FIXING**

**Claude's Role**:
- Active listening
- Note-taking
- Pattern recognition
- NO solutions yet

### Phase 3: EVALUATION & PLANNING
**When**: Human signals testing complete
**Actions**:
- Review all collected issues together
- Discuss root causes
- Explore solution space
- Consider trade-offs
- Agree on approach
- Create prioritized fix plan

**Claude's Role**:
- Propose solutions
- Explain trade-offs
- Suggest priorities
- Get human approval on plan

### Phase 4: EXECUTION
**When**: Both parties agree on fix approach
**Actions**:
- Execute agreed plan
- Follow the priority order
- Test each fix
- Document changes
- Build new package

**Claude's Role**:
- Implement approved fixes only
- Stay within agreed scope
- Test thoroughly
- Prepare next package

## Key Principles

### 1. No Premature Solutions
- Collect ALL feedback first
- Understand the full picture
- Avoid fixing symptoms vs root causes

### 2. Collaborative Planning
- Human and Claude evaluate together
- Both must agree on approach
- No surprises in implementation

### 3. Clear Phase Transitions
- Human explicitly signals phase changes
- "Testing complete, let's evaluate"
- "Plan approved, proceed with fixes"

### 4. Documentation Throughout
- Every issue recorded
- Every decision documented
- Clear audit trail

## Benefits

1. **Better Solutions**: Full context before solving
2. **Fewer Iterations**: Fix root causes, not symptoms  
3. **Aligned Expectations**: Both parties agree before work
4. **Efficient Use of Time**: No wasted work on wrong approaches
5. **Learning**: Patterns emerge from complete feedback

## Example Flow

```
Human: "Here's the package for testing"
Claude: [Creates checkpoint, enters HOLD]