# Context Recovery Documentation
Date: 2025-08-20

## Valuable Context Externalized from August 13 Dump

### Architecture Decisions

#### Monitor Management Separation
**Key Decision**: P2 debug stream only knows window-relative positions; PNut-Term-TS handles ALL monitor management.

Implementation:
- Debug commands never specify monitor
- Monitor selection is application-layer concern
- Window state is (monitorId, x, y) tuple internally
- Windows track monitor changes during drag/move
- Monitor preferences saved/restored by application
- WindowPlacer tracks monitorId for each window
- Future: May add MONITOR directive as app extension

#### Original PST UI Reference
**Visual Styling Patterns to Match:**
- **RECESSED fields**: Both input (yellow) and terminal (blue) areas have inset/recessed appearance
- **Input area**: Yellow, one line high, has scrollbars (disabled when not needed)
- **Terminal area**: Blue, recessed with full page controls (draggable scrollbars vs just arrows)
- **Layout order**: Title bar → Input area → Terminal area → Status bar

Input field features: Input history support (10 lines), horizontal scrolling, recessed visual appearance

Adaptation notes: Additional controls (DTR/RTS toggles, flash/RAM toggle, download button) moved to top for easier implementation while maintaining "recessed field" visual language.

### Critical Lessons Learned

#### Shell Redirect NPM Scripts
**HARD-WON LESSON**: The "2" file error is ALWAYS a botched 2>&1 redirect!

Pattern recognition:
- See: "ENOENT: no such file or directory, open '2'"
- Think: "npm script is parsing 2>&1 as separate arguments"
- Fix: Use -- separator or npx direct execution

This has been "a bane of our existence in previous sprints" - immediate red flag when debugging build issues.

#### Shared Component Requirements
When extracting shared components:
1. Component must be framework-agnostic (no React/Vue dependencies)
2. Interface design before implementation (TypeScript-first)
3. Unit tests required (minimum 80% coverage for shared code)
4. Documentation with usage examples
5. Version compatibility matrix

Examples: WindowPlacer class, RouterLogger, multiCogManager

#### Sprint Test Maintenance
**CRITICAL**: Tests are part of deliverables, not afterthoughts.
- Test status document must be updated with sprint work
- Failing tests from previous sprints = technical debt
- New features require tests BEFORE sprint completion
- Coverage targets: 70% minimum for new code

### Friction Points for Tool Improvement

#### Compact Recovery Experience (Aug 13)
**Multiple back-to-back compacts without notification:**

What worked well:
- context_resume command IMMEDIATELY showed all 103 context keys organized by prefix
- Active tasks and TodoWrite list intact
- Critical project state preserved
- Recovery was FAST - single command gave complete situational awareness

What survived perfectly:
- All context keys spanning 3 days of work
- Complete MCP task list with full status
- TodoWrite list with exact fixes needed
- Project understanding and technical decisions

Key observation: System becoming MORE resilient with triple redundancy (context + MCP + TodoWrite).

#### Proactive Compact Success
**User-controlled compact vastly superior to forced auto-compact:**

Benefits:
- Forewarning at 12% allows planning
- User chooses timing rather than system forcing
- No surprise interruption during code editing
- Manual /compact becomes "save and checkpoint" operation

Recommendation: Proactive approach should be preferred pattern for all future compacts.

### Critical Workflow Reminders

#### Build Workflow Checklist
**NEVER FORGET:**
1. User announces 'shutting down for rebuild'
2. User FULLY QUITS running PNut-Term-TS app (not minimize!)
3. User waits 2-3 seconds for macOS to release file locks
4. User confirms 'app fully shut down, ready for rebuild'
5. ONLY THEN run: npm run clean (will succeed - no locks)
6. npm run build
7. ./scripts/create-electron-ready-package.sh
8. Announce 'New build ready in release/ folder'

REASON: Shared container/macOS filesystem + executable file locks cause rm -rf to fail if app still running!

### Key Achievements from Sprint 1

- 10 friction points documented with todo_archive as critical addition
- ESTIMATION_ANALYSIS.md showing 480x productivity gains
- Metrics philosophy captured - estimates for scale not accuracy
- P2 ecosystem documented in ARCHITECTURE.md
- Wednesday demo ready with complete metrics