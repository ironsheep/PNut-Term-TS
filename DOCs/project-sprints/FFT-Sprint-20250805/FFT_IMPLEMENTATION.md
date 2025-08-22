# FFT Debug Window Implementation Plan

## Phase 1: Pascal Source Analysis

### Core Functionality
The FFT debug window provides real-time frequency spectrum analysis using Fast Fourier Transform:
- Performs FFT on incoming sample data (4 to 2048 samples, power of 2)
- Displays frequency spectrum as magnitude vs frequency plot
- Supports multi-channel display (up to 8 channels overlaid)
- Uses Hanning window function to reduce spectral leakage
- Implements Cooley-Tukey FFT algorithm with bit-reversal

### Key Features
1. **Sample Configuration**:
   - Sample sizes: 4 to 2048 (must be power of 2)
   - Configurable frequency range display (first/last bins)
   - Rate control for update frequency
   - Default: 512 samples

2. **Display Modes**:
   - Line drawing (positive linesize = connected lines)
   - Bar drawing (negative linesize = vertical bars from baseline)
   - Dot plotting (when dotsize > 0)
   - Combination modes (dots + lines/bars)
   - Log scale option for magnitude display

3. **Channel Configuration** (per channel):
   - Label string
   - Magnitude scaling (0-11, acts as right-shift)
   - High value (max expected magnitude)
   - Tall value (vertical display height)
   - Base value (baseline offset)
   - Grid value (grid line positioning)
   - Individual color

4. **Interactive Features**:
   - PC_KEY forwarding
   - PC_MOUSE forwarding with coordinate transformation
   - CLEAR command to reset display
   - SAVE command for screenshots

### Pascal Implementation Details

#### FFT_Configure (lines 1552-1618)
- Sets defaults: 512 samples, FFTexp=9, linesize=3
- Processes configuration keywords:
  - `SAMPLES n [first] [last]`: FFT size and display range
  - `RATE n`: Update rate (samples between updates)
  - `DOTSIZE n`: Dot size (0-32)
  - `LINESIZE n`: Line size (-32 to 32, negative for bars)
  - `LOGSCALE`: Enable log scale display
  - `HIDEXY`: Hide coordinate display
- Calls PrepareFFT to initialize lookup tables
- Initializes channel defaults

#### FFT_Update (lines 1620-1679)
- Processes channel configuration strings: `'label' mag high tall base grid color`
- Handles data samples with packing modes
- Fills circular sample buffer (Y_SampleBuff)
- Triggers FFT_Draw when buffer full and rate counter expires
- Supports CLEAR, SAVE, PC_KEY, PC_MOUSE commands

#### FFT_Draw (lines 1681-1712)
- Iterates channels in reverse order (for proper overlay)
- Copies samples from circular buffer to FFT input
- Calls PerformFFT for each channel
- Applies log scaling if enabled
- Renders using DrawLineDot or SmoothLine/SmoothDot
- Coordinate calculation: frequency bin to X position mapping

#### PrepareFFT (lines 4170-4183)
- Pre-calculates sine/cosine lookup tables (12-bit fixed point)
- Pre-calculates Hanning window coefficients
- Uses Rev32 for bit-reversal calculation

#### PerformFFT (lines 4185-4243)
- Applies Hanning window to input samples
- Performs Cooley-Tukey FFT (decimation in time)
- Uses fixed-point arithmetic (12-bit precision)
- Converts complex results to power/angle
- Power scaling: divided by (0x800 << FFTexp >> FFTmag)

### Mouse Interaction
- Transforms window coordinates to FFT display space
- Shows frequency bin and magnitude at cursor position (unless HIDEXY)
- Forwards clicks/movements via PC_MOUSE

### Data Flow
1. Samples arrive via debug feed → circular buffer
2. When buffer full and rate counter zero → trigger FFT
3. Copy samples, apply window, perform FFT
4. Scale and render power spectrum
5. Update display canvas

## TypeScript Implementation Architecture

### File Structure
```
src/classes/debugWindows/
  debugFftWindow.ts         # Main FFT window class
src/classes/shared/
  fftProcessor.ts          # NEW: FFT algorithm implementation
  windowFunctions.ts       # NEW: Hanning window function
tests/
  debugFftWindow.test.ts   # Unit tests for FFT window
  fftProcessor.test.ts     # Unit tests for FFT processor
  windowFunctions.test.ts  # Unit tests for window functions
tests/utils/
  signalGenerator.ts       # NEW: Test signal generation utility
  signalGenerator.test.ts  # Unit tests for signal generator (100% coverage required)
```

### Class Hierarchy
```
DebugWindowBase
  └── DebugFftWindow
        ├── Uses: CanvasRenderer (EXISTING)
        ├── Uses: ColorTranslator (EXISTING)
        ├── Uses: PackedDataProcessor (EXISTING)
        ├── Uses: InputForwarder (EXISTING)
        ├── Uses: FFTProcessor (NEW)
        └── Uses: WindowFunctions (NEW)
```

### NEW Shared Classes

#### FFTProcessor
- Purpose: Encapsulate FFT algorithm and related calculations
- Methods:
  - `prepareFFT(size: number)`: Initialize lookup tables
  - `performFFT(samples: number[], magnitude: number)`: Execute FFT
  - `rev32(value: number)`: Bit reversal for FFT
- Data:
  - Sine/cosine lookup tables (fixed-point)
  - Real/imaginary working arrays
  - Power/angle output arrays

#### WindowFunctions
- Purpose: Provide windowing functions for signal processing
- Methods:
  - `hanning(size: number)`: Generate Hanning window coefficients
- Note: Only Hanning window is in Pascal source. Hamming/Blackman are NOT in Pascal and could be added as future enhancements if needed

### EXISTING Shared Classes to Use
- `CanvasRenderer`: All drawing operations
- `ColorTranslator`: Color parsing and management
- `PackedDataProcessor`: Handle packed data modes
- `InputForwarder`: Mouse/keyboard forwarding
- `Spin2NumericParser`: Parse numeric values

### Implementation Requirements
1. Support 4-2048 samples (power of 2 only)
2. Multi-channel overlay (up to 8 channels)
3. Circular buffer for sample storage
4. Fixed-point FFT with 12-bit precision
5. Exact Pascal color constants
6. Log scale transformation
7. Line/bar/dot rendering modes

### Configuration Interface
```typescript
interface FFTConfig {
  samples: number;      // 4-2048, power of 2
  first: number;        // First bin to display
  last: number;         // Last bin to display
  rate: number;         // Update rate
  dotSize: number;      // 0-32
  lineSize: number;     // -32 to 32
  logScale: boolean;    // Log scale mode
  hideXY: boolean;      // Hide coordinates
  channels: FFTChannel[];
}

interface FFTChannel {
  label: string;
  magnitude: number;    // 0-11 (shift amount)
  high: number;         // Max value
  tall: number;         // Display height
  base: number;         // Baseline offset
  grid: number;         // Grid positioning
  color: number;        // RGB color
}
```

## Testing Strategy

### Incremental Unit Testing Approach
1. **Phase 1**: Basic window creation and configuration parsing
2. **Phase 2**: FFT algorithm verification (compare with known outputs)
3. **Phase 3**: Window function tests
4. **Phase 4**: Rendering and display mode tests
5. **Phase 5**: Multi-channel and interaction tests

### Unit Test Structure

#### debugFftWindow.test.ts
- Window creation and lifecycle
- Configuration parsing
- Command processing (CLEAR, SAVE)
- Data feeding and buffer management
- Multi-channel setup
- Input forwarding

#### fftProcessor.test.ts
- FFT algorithm correctness (test with known signals)
- Lookup table generation
- Bit reversal function
- Fixed-point precision
- Edge cases (min/max samples)

#### windowFunctions.test.ts
- Hanning window coefficient generation
- Coefficient range validation
- Size variations

### Test Examples from DEBUG-TESTING
- `/pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_FFT.spin2`
  - Multi-channel FFT with scope
  - Log scale display
  - Rate control example
- Reference in JSDoc for usage patterns

### Coverage Goals
- Minimum 80% overall coverage
- 100% coverage for new shared classes (FFTProcessor, WindowFunctions)
- Document any uncovered edge cases as technical debt

## Implementation Steps

### Time Tracking
**Total Estimate**: 3 days (25 hours of work)
**Actual Time**: [To be tracked]

| Phase | Description | Estimate | Actual | Status | Notes |
|-------|-------------|----------|--------|--------|-------|
| 1 | Core Infrastructure | 4 hours | - | Pending | |
| 2 | FFT Processing | 9 hours | - | Pending | Includes signal generator |
| 3 | Data Management | 4 hours | - | Pending | |
| 4 | Rendering Implementation | 6 hours | - | Pending | |
| 5 | Polish and Commands | 2 hours | - | Pending | |
| **Total** | **All Phases** | **25 hours** | **-** | **-** | |

### Phase 1: Core Infrastructure
**Estimate**: 4 hours | **Actual**: [TBD] | **Start**: [TBD] | **End**: [TBD]
1. Create `debugFftWindow.ts` extending DebugWindowBase (30 min)
2. Add comprehensive JSDoc with: (30 min)
   - Feature description
   - Configuration parameters (SAMPLES, RATE, DOTSIZE, LINESIZE, etc.)
   - Data format (packed modes support)
   - Commands (CLEAR, SAVE, PC_KEY, PC_MOUSE)
   - Reference to DEBUG_FFT.spin2 example
3. Implement basic configuration parsing (1 hour)
4. Set up canvas with proper dimensions (30 min)
5. Initialize InputForwarder (30 min)
6. Create initial test file with basic tests (1 hour)

### Phase 2: FFT Processing
**Estimate**: 9 hours | **Actual**: [TBD] | **Start**: [TBD] | **End**: [TBD]
1. Implement `signalGenerator.ts` test utility: (1 hour)
   - Sine wave generation
   - Square wave generation  
   - White noise generation
   - DC offset generation
   - Unit tests with 100% coverage
2. Implement `fftProcessor.ts` shared class: (4 hours)
   - PrepareFFT with lookup table generation (1 hour)
   - PerformFFT with Cooley-Tukey algorithm (2 hours)
   - Use exact Pascal fixed-point arithmetic (div not shift) (30 min)
   - Rev32 bit reversal function (30 min)
3. Implement `windowFunctions.ts`: (1 hour)
   - Hanning window generation only
   - Match Pascal formula exactly
4. Add unit tests for FFT and window classes (2 hours)
5. Verify FFT output against test signals: (1 hour)
   - **Approach 1**: Generate reference with Python/NumPy for complex signals
   - **Approach 2**: Use mathematical formulas for simple cases
   - Compare both approaches to our implementation
   - Document any differences observed
   - If significant discrepancies, extract Pascal outputs as last resort

### Phase 3: Data Management
**Estimate**: 4 hours | **Actual**: [TBD] | **Start**: [TBD] | **End**: [TBD]
1. Implement circular sample buffer (1 hour)
   - Size: 2048 samples × 8 channels
   - Pointer management with mask
2. Channel configuration parsing (1 hour)
   - String format: 'label' mag high tall base grid color
3. Rate counter for update control (30 min)
4. Integration with PackedDataProcessor (30 min)
5. Add tests for buffer management (1 hour)

### Phase 4: Rendering Implementation
**Estimate**: 6 hours | **Actual**: [TBD] | **Start**: [TBD] | **End**: [TBD]
1. Implement FFT_Draw equivalent: (2 hours)
   - Multi-channel overlay (reverse order - critical for correct appearance)
   - Frequency to X coordinate mapping
   - Magnitude to Y coordinate mapping
2. Line drawing modes: (1.5 hours)
   - Connected lines (positive linesize) - try Canvas primitives first
   - Vertical bars (negative linesize) - evaluate custom vs rectangles for performance
   - Switch to custom drawing if primitives don't match Pascal visually
3. Dot rendering (when dotsize > 0) (30 min)
4. Log scale transformation (1 hour)
5. Add rendering tests (1 hour)

### Phase 5: Polish and Commands
**Estimate**: 2 hours | **Actual**: [TBD] | **Start**: [TBD] | **End**: [TBD]
1. Implement CLEAR command (15 min)
2. Implement SAVE command (15 min)
3. Mouse coordinate transformation (30 min)
4. Coordinate display (unless HIDEXY) (30 min)
5. Complete test coverage (30 min)
6. Performance optimization if needed (TBD)

## Pascal Parity Checklist

### Critical Behaviors to Match
- [x] FFT size: 4-2048 (power of 2 only)
- [x] Fixed-point arithmetic: 12-bit precision
- [x] Hanning window formula: `(1 - cos(i/size * 2π)) * 0x1000`
- [x] Power scaling: `hypot(real,imag) / (0x800 << FFTexp >> mag)`
- [x] Log scale formula: `log2(v+1) / log2(high+1) * high`
- [x] Default values: 512 samples, linesize=3
- [x] Channel limit: 8 channels
- [x] Color system: exact Pascal RGB values
- [x] Update rate: configurable with counter

### Exact Values from Pascal
- FFTmax = 2048 (max sample size)
- FFTexpMax = 11 (log2(2048))
- fft_default = 512
- Fixed-point scale = 0x1000 (12-bit)
- Power divisor = 0x800
- Window formula multiplier = 0x1000

### What Can Be Optimized
- Canvas rendering (use GPU acceleration)
- TypedArrays for better performance
- Modern FFT libraries (if exact match not required)
  - Decision: Implement Pascal algorithm for exact parity

## Risk Mitigation

### Performance Considerations
- **Risk**: FFT computation may be slow for 2048 samples
- **Mitigation**: 
  - Use TypedArrays for numeric arrays
  - Pre-calculate all lookup tables
  - Consider WebAssembly if performance critical
  - Profile and optimize hot paths

### Compatibility Concerns
- **Risk**: Fixed-point arithmetic differences between Pascal/JS
- **Mitigation**:
  - Focus on matching Pascal exactly - any differences must be resolved
  - Careful testing with known signals
  - Unit tests for edge cases
  - If precision differences found, adjust implementation until exact match achieved
  - Do NOT accept "close enough" - must be exact

### Technical Debt Items
- Sub-pixel rendering precision (Canvas API limitation)
- Custom anti-aliasing (rely on Canvas 2D)
- Additional window functions (Hamming, Blackman - NOT in Pascal, future enhancement only)
- FFT optimization: If performance issues arise, consider modern FFT library (WASM, GPU compute)

## Success Criteria

### Functional Parity
- ✅ Performs FFT on 4-2048 samples
- ✅ Multi-channel display works
- ✅ All display modes render correctly
- ✅ Log scale matches Pascal
- ✅ Commands work (CLEAR, SAVE, PC_KEY, PC_MOUSE)

### Visual Parity
- ✅ Frequency spectrum matches Pascal output
- ✅ Colors match exactly
- ✅ Line/bar/dot rendering identical
- ✅ Channel overlay order correct

### Performance Targets
- ✅ 60 FPS for 512 samples or less
- ✅ 30 FPS for 1024-2048 samples
- ✅ No visible lag in interaction

### Test Coverage
- ✅ Minimum 80% overall coverage
- ✅ 100% for FFTProcessor class
- ✅ 100% for WindowFunctions class
- ✅ All edge cases tested

### Documentation Completeness
- ✅ Comprehensive JSDoc
- ✅ Usage examples referenced
- ✅ Technical debt documented
- ✅ Project docs updated

## Implementation Decisions (Finalized)

1. **FFT Algorithm Implementation**:
   - **Decision**: Use exact Pascal fixed-point algorithm for perfect parity
   - **Technical Debt**: If performance issues arise, consider modern FFT library as optimization

2. **Fixed-Point Arithmetic**:
   - **Decision**: Use division with rounding (`Math.round(value / 0x1000)`) rather than bit-shifting
   - **Rationale**: Pascal uses `div $1000` not bit-shifting, ensures exact display match
   - **Note**: Profile both approaches during implementation, document if performance differs significantly

3. **Rendering Approach**:
   - **Decision**: Start with Canvas 2D primitives, but evaluate custom drawing if:
     - Visual parity is not achievable with primitives
     - Performance would be better with custom drawing (e.g., batch operations)
   - **Canvas Coordinates**: Match Pascal's bottom-up drawing (Y increasing upward)
   - **Note**: For bars (negative linesize), custom drawing may be more efficient than individual rectangles

4. **Buffer Management**:
   - **Decision**: Use TypedArrays for circular buffer for performance
   - Match Pascal's logical structure exactly (2048 × 8 organization)
   - **Channel Data**: Expect interleaved channel data exactly as Pascal does

5. **Error Handling**:
   - **Decision**: For non-power-of-2 samples:
     - Log detailed warning with original value and issue
     - Round to nearest power of 2 using Pascal's approach
     - Continue execution with corrected value
   - **Log Format**: Include window name, original value, corrected value, and context

6. **Performance Requirements**:
   - **Decision**: Target 30+ FPS for all sample sizes
   - **Technical Debt**: Defer optimization unless performance is unacceptable

7. **Test Data Generation**:
   - **Decision**: Create `tests/utils/signalGenerator.ts` as shared utility
   - **Coverage**: Must achieve 100% coverage as shared component
   - Generate: sine waves, square waves, white noise, DC offset
   - Verify against known FFT outputs for these signals

8. **FFT Result Verification**:
   - **Decision**: Use two-pronged approach for testing
   - **Primary**: Try both NumPy reference and mathematical formulas
   - **Comparison**: Document differences between approaches
   - **Fallback**: Extract Pascal outputs only if significant discrepancies found
   - **Goal**: Ensure our fixed-point implementation matches expected behavior

## Next Steps
1. ✅ Initial review completed
2. ✅ Technical decisions finalized
3. ✅ Plan updated based on feedback
4. Create detailed todo list for implementation (awaiting final approval)
5. Begin Phase 1 implementation (after approval)