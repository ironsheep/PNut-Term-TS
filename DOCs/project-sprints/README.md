# Project Sprints Documentation

## Purpose
This folder contains historical records of development sprints, preserving the planning, execution, and completion artifacts from each sprint effort.

## 🔥 CURRENT ACTIVE SPRINT
**Sprint 1: DebugLogger-Sprint1-20250812** - Implementation of debug logger system  
All current work and planning documents are in this folder.

## Intent
- **Historical Record**: Preserve sprint planning and outcomes
- **Learning Repository**: Study what worked and what didn't
- **Progress Tracking**: See evolution of the project over time
- **Knowledge Preservation**: Maintain context for future reference
- **Active Sprint Tracking**: Always shows which sprint is currently in progress

## Folder Naming Convention
`{SprintName}-Sprint{N}-{YYYYMMDD}`
- SprintName: Descriptive name of the sprint focus
- SprintN: Optional sprint number if sequential
- YYYYMMDD: Date of earliest sprint document

## What Belongs Here
- Sprint planning documents
- Task lists and implementation plans
- Readiness checklists
- Sprint retrospectives
- Completion summaries
- Any artifacts specific to a time-bounded development effort

## What Does NOT Belong Here
- Current/active sprint work (use tasks/current)
- Generic process documentation
- Architectural decisions (unless sprint-specific)

## Sprint Timeline

### Initial Prototype (Pre-Sprint)
**Components from prototype:**
- MainWindow - Base application window
- DebugTermWin - Terminal window  
- DebugLogicWin - Logic analyzer window
- DebugScopeWin - Oscilloscope window

### Production Sprints (Pascal Parity Achievement)

| Sprint | Date | Focus | Status |
|--------|------|-------|--------|
| **Logic-Sprint** | ~2025-08-04 | Bring DebugLogicWin from prototype to production with Pascal parity | ✅ Complete |
| **Scope-Sprint** | ~2025-08-04 | Bring DebugScopeWin from prototype to production with Pascal parity | ✅ Complete |
| **Terminal-Sprint** | 2025-08-05 | Bring DebugTermWin from prototype to production with Pascal parity | ✅ Complete |
| **FFT-Sprint** | 2025-08-05 | Implement DebugFFTWin from Pascal with parity | ✅ Complete |
| **Plot-Sprint** | ~2025-08-05 | Implement DebugPlotWin from Pascal with parity | ✅ Complete |
| **Bitmap-Sprint** | ~2025-08-05 | Implement DebugBitmapWin from Pascal with parity | ✅ Complete |
| **MIDI-Sprint** | ~2025-08-05 | Implement DebugMidiWin from Pascal with parity | ✅ Complete |
| **ScopeXY-Sprint** | ~2025-08-05 | Implement DebugScopeXYWin from Pascal with parity | ✅ Complete |
| **Debugger-Sprint** | 2025-08-06 | Implement DebugDebuggerWin from Pascal with full P2 debugging | ✅ Complete |
| **WindowRouter-Sprint** | 2025-08-10 | Implement WindowRouter for message routing infrastructure | ✅ Complete |
| **DebugLogger-Sprint1** | 2025-08-12 | Implement DebugLoggerWin singleton with three-paradigm debug | 🔥 **ACTIVE** |
| **Documentation-Cleanup-Sprint** | 2025-08-12 | Reorganize repository documentation | ✅ Complete |

### Future Sprints
- **Sprint 2**: DebugSpectroWin - Spectrogram window implementation
- **Sprint 3**: Flash Download - Flash programming capability

### Sprint Management Protocol
1. **Active Sprint**: Always marked with 🔥 **ACTIVE** in the table
2. **Sprint Transition**: When Sprint 1 completes:
   - Mark Sprint 1 as ✅ Complete
   - Sprint 2 becomes 🔥 **ACTIVE**
   - Sprint 3 becomes Sprint 2
   - Add new Sprint 3 to planning
3. **This README**: Always shows current active sprint at the top
4. **Work Location**: All current work happens in the active sprint's folder

### Sprint Summary
- **9 Debug Windows Completed**: Term, Logic, Scope, FFT, Plot, Bitmap, MIDI, ScopeXY, Debugger
- **1 Infrastructure Window**: DebugLogger (in progress)
- **1 Window Remaining**: Spectro
- **Total Windows**: 10 of 11 complete or in progress

### Notes
- Prototype provided foundation for MainWindow, Term, Logic, and Scope
- These 4 prototype windows required sprints to achieve Pascal parity
- All other windows (FFT, Plot, Bitmap, MIDI, ScopeXY, Debugger) implemented from Pascal source
- WindowRouter added as critical infrastructure for message routing
- DebugLogger added as new capability (not in original Pascal)

## Usage
Review past sprints to understand project evolution, extract patterns for process improvement, and maintain historical context for decisions made.