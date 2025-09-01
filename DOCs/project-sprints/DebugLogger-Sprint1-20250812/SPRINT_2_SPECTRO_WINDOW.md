# Sprint 2: Porting the Last Missing Window

## Sprint Overview
**Focus**: Complete Spectro window port from Pascal
**Timeline**: Tuesday afternoon through Wednesday morning
**Goal**: Achieve 100% debug window coverage (10/10 complete)
**Scope**: ONLY the Spectro window - no additional features

## Why Spectro is Important
- Last missing piece for feature parity with Pascal PNut
- Spectrogram provides time-frequency analysis
- Essential for audio and signal processing applications
- Completes the "software-defined instrumentation" suite

## Spectro Window Specifications

### From Pascal Source (DebugDisplayUnit.pas)
- **Display Type**: `dis_spectro = 4`
- **Purpose**: Time-frequency visualization (waterfall display)
- **FFT Size**: 4 to 2048 points
- **Features**:
  - Windowed FFT results
  - Phase coloring option
  - Log scale mode
  - Scrolling waterfall display

### Configuration Parameters
```
SPECTRO {displayName}
  TITLE 'string'              - Window caption
  POS left top                - Window position
  SIZE width height           - Display size (pixels)
  SAMPLES points              - FFT size (4-2048, power of 2)
  RATE divider               - Sample rate divider
  LOGSCALE                   - Enable log frequency scale
  PHASE                      - Enable phase coloring
  WINDOW type                - FFT window function
```

### Data Feeding
- Accepts packed data in various formats
- Real-time FFT processing
- Color mapping for magnitude/phase
- Waterfall scrolling

## Implementation Tasks

### 1. Create DebugSpectroWindow Class
- Extend DebugWindowBase
- Implement parseSpectroDeclaration()
- Set up canvas for waterfall display

### 2. FFT Processing
- Reuse FFT code from DebugFFTWindow
- Implement windowing functions
- Add magnitude to color mapping
- Optional phase coloring

### 3. Waterfall Display
- Implement scrolling bitmap
- Time axis (vertical)
- Frequency axis (horizontal)
- Color legend

### 4. Data Input Handling
- Parse packed data modes
- Handle sample buffering
- Trigger FFT on buffer full

### 5. Display Options
- Linear/log frequency scale
- Various color maps
- Grid overlay
- Cursor/measurement tools

## Testing Strategy

### Test Data Generation
```spin2
' Spectro window test
PUB spectro_test()
  ' Create spectro window
  debug(`SPECTRO Audio SAMPLES 512 SIZE 400 300)
  
  ' Send audio samples
  repeat
    debug(`Audio sample_buffer)
    waitms(10)
```

### Validation Points
- Window creates successfully
- FFT processing works
- Waterfall scrolls properly
- Colors map correctly
- Log scale option works
- Phase coloring works

## Success Criteria

### Must Have (Demo Critical)
- [ ] Window creates from debug command
- [ ] Basic FFT processing
- [ ] Waterfall display updates
- [ ] Color magnitude mapping
- [ ] Window closes properly

### Should Have
- [ ] Log scale mode
- [ ] Phase coloring
- [ ] Multiple window functions
- [ ] Grid overlay

### Nice to Have
- [ ] Cursor measurements
- [ ] Color map selection
- [ ] Zoom controls
- [ ] Export capability

## Architectural Guidelines (Based on Debug Window Standardization)

### CRITICAL: Follow Established Patterns From Day One
**Based on lessons from debugMidiWin.ts standardization work**

#### ✅ Architecture Checklist
- **Constructor**: `(ctx: Context, displaySpec: SpectroDisplaySpec, windowId?: string)`
- **Import**: `BrowserWindow, CanvasRenderer, WindowPlacer, DisplaySpecParser`
- **Extend**: `DebugWindowBase` properly
- **Canvas**: Use shared `CanvasRenderer` - never direct canvas context
- **Positioning**: `WindowPlacer` integration from start
- **Window**: `BrowserWindow` pattern, not embedded HTML

#### ❌ Avoid These Mistakes (debugMidiWin.ts lessons)
- Don't create embedded HTML divs in main window
- Don't use direct canvas context (`this.canvasCtx`)
- Don't implement custom drawing primitives (use CanvasRenderer)
- Don't skip WindowPlacer integration
- Don't use non-standard constructor signatures

#### 📋 Copy Patterns From
- **Constructor**: `debugScopeWin.ts:191`
- **WindowPlacer**: `debugFftWin.ts:1776-1785`
- **BrowserWindow**: `debugFftWin.ts:1788-1798`
- **CanvasRenderer**: Any scope/fft/logic window
- **DisplaySpec**: `debugScopeWin.ts` ScopeDisplaySpec interface

**This prevents architectural debt that requires later standardization work.**

## Risk Mitigation

### Risk: Complex FFT/Display Code
- **Mitigation**: Reuse FFT from DebugFFTWindow
- **Fallback**: Basic implementation without all features

### Risk: Performance Issues
- **Mitigation**: Optimize rendering pipeline
- **Fallback**: Reduce FFT size or update rate

### Risk: Architectural Inconsistency
- **Mitigation**: Follow established patterns above from day one
- **Fallback**: Will require standardization work later

### Risk: Time Constraint
- **Mitigation**: Focus on core functionality first
- **Fallback**: Mark advanced features as "post-demo"

## Reference Implementation

### Pascal Source Location
- File: `DebugDisplayUnit.pas`
- Procedures:
  - `SPECTRO_Configure` - Setup and parameters
  - `SPECTRO_Update` - Process and display
  - `SPECTRO_Color` - Magnitude/phase to color

### Existing TypeScript Components to Reuse
- `DebugFFTWindow` - FFT processing
- `CanvasRenderer` - Drawing operations
- `PackedDataProcessor` - Data unpacking
- `DebugWindowBase` - Window framework

## Definition of Done

1. **Code Complete**:
   - DebugSpectroWindow class implemented
   - Registered with WindowRouter
   - All basic features working

2. **Testing**:
   - Creates from debug command
   - Displays test signal correctly
   - No crashes or memory leaks

3. **Integration**:
   - Works with Sprint 1 routing
   - Auto-placement works
   - Placement logging works

4. **Documentation**:
   - Class documented
   - Update IMPLEMENTATION-STATUS.md
   - Add to architecture docs

## Notes
- This is a STANDALONE sprint
- No scope creep allowed
- Focus on core functionality
- Advanced features can wait for post-demo