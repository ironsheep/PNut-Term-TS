# PNut-Term-TS Documentation

This directory contains public-facing documentation for PNut-Term-TS, a cross-platform debug terminal for the Parallax Propeller 2 microcontroller.

## User Documentation

### Primary Guides

- **[QUICK-START.md](QUICK-START.md)** - Get up and running in 2 minutes
- **[USER-GUIDE.md](USER-GUIDE.md)** - Complete reference covering all features
- **[APP-HELP.md](APP-HELP.md)** - Built-in application help content (displayed in Help menu)

### Specialized Guides

- **[DEBUGGER-USER-MANUAL.md](DEBUGGER-USER-MANUAL.md)** - Detailed guide for using the debugger window
- **[PATH-SETUP-GUIDE.md](PATH-SETUP-GUIDE.md)** - Configuration guide for PNut compiler path setup

## Technical Documentation

### System Architecture

- **[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)** - Technical implementation details and architecture
- **[WINDOW-PLACEMENT-ALGORITHM.md](WINDOW-PLACEMENT-ALGORITHM.md)** - Algorithm documentation for debug window positioning
- **[REPOSITORY-ORGANIZATION.md](REPOSITORY-ORGANIZATION.md)** - Repository structure and organization guide

## Reference Materials

### Pascal Source References

The `pascal-REF/` directory contains theory of operations documentation derived from the original Pascal implementation:

- **theory-of-operations/** - Detailed operational specifications for each debug window type:
  - `BITMAP_Theory_of_Operations.md` - Bitmap visualization window
  - `FFT_Theory_of_Operations.md` - FFT spectrum analyzer window
  - `LOGIC_Theory_of_Operations.md` - Logic analyzer window
  - `MIDI_Theory_of_Operations.md` - MIDI interface window
  - `PLOT_Theory_of_Operations.md` - Data plotting window
  - `SCOPE_Theory_of_Operations.md` - Oscilloscope window
  - `SCOPE_XY_Theory_of_Operations.md` - XY oscilloscope window
  - `SINGLE_STEP_DEBUGGER_Theory_of_Operations.md` - Debugger window
  - `SPECTRO_Theory_of_Operations.md` - Spectrogram window
  - `TERM_Theory_of_Operations.md` - Terminal window

### Additional Resources

- **images/** - Application icons, logos, and visual assets
- **source/** - Source materials including font notes and layout files
- **archive/** - Previous versions of documentation for reference

## Documentation Purpose

This documentation serves multiple audiences:

1. **End Users** - Learn how to use PNut-Term-TS effectively
2. **Developers** - Understand the architecture and implementation details
3. **Contributors** - Reference materials for maintaining Pascal parity

## Quick Reference

### For New Users
Start with **[QUICK-START.md](QUICK-START.md)** to get running in minutes, then refer to **[USER-GUIDE.md](USER-GUIDE.md)** for detailed information on specific features.

### For Developers
Review **[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)** for architecture overview and the theory-of-operations documents for window-specific implementation details.

## Version Information

These documents are maintained alongside the codebase and reflect the current implementation status. For the most up-to-date information, always refer to the latest version in the repository.

**Current Version**: 0.9.0