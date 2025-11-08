# PNut-Term-TS Documentation

This directory contains public-facing documentation for PNut-Term-TS, a cross-platform debug terminal for the Parallax Propeller 2 microcontroller.

## User Documentation

### Primary Guides

- **[USER-GUIDE.md](USER-GUIDE.md)** - Complete user guide covering all features and debug windows
- **[USER-GUIDE-UPDATED.md](USER-GUIDE-UPDATED.md)** - Updated version with latest enhancements
- **[APP-HELP.md](APP-HELP.md)** - Built-in application help content (displayed in Help menu)
- **[QUICK-START-NEW-FEATURES.md](QUICK-START-NEW-FEATURES.md)** - Quick reference for new features

### Specialized Guides

- **[DEBUGGER-USER-MANUAL.md](DEBUGGER-USER-MANUAL.md)** - Detailed guide for using the debugger window
- **[PATH-SETUP-GUIDE.md](PATH-SETUP-GUIDE.md)** - Configuration guide for PNut compiler path setup

## Technical Documentation

### System Architecture

- **[ADMIN-GUIDE-SERIAL-IMPLEMENTATION.md](ADMIN-GUIDE-SERIAL-IMPLEMENTATION.md)** - Technical guide to serial implementation and architecture
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

## Documentation Purpose

This documentation serves multiple audiences:

1. **End Users** - Learn how to use PNut-Term-TS effectively
2. **Developers** - Understand the architecture and implementation details
3. **Contributors** - Reference materials for maintaining Pascal parity

## Version Information

These documents are maintained alongside the codebase and reflect the current implementation status. For the most up-to-date information, always refer to the latest version in the repository.
