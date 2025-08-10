# Known Build Issues

## TypeScript Compilation Errors (2025-08-10)

The following TypeScript errors exist in the current build and need to be resolved:

### DebuggerProtocol Method Names
The actual `DebuggerProtocol` class has different method names than what was used in integration:
- Used: `sendGoCommand()` → Actual: `sendGo(cogId: number)`
- Used: `sendBreakCommand()` → Actual: `sendBreak(cogId: number)`
- Used: `toggleDebugMode()` → Not implemented
- Used: `sendInitCommand()` → Not implemented
- Used: `sendStepCommand()` → Not implemented
- Used: `sendStepOverCommand()` → Not implemented
- Used: `sendStepOutCommand()` → Not implemented
- Used: `sendResetCommand()` → Not implemented
- Used: `sendEventCommand()` → Not implemented
- Used: `sendInterruptCommand()` → Not implemented
- Used: `sendMainCommand()` → Not implemented

### DebuggerDataManager Methods
Missing methods that were assumed to exist:
- `processInitialMessage()` → Not implemented
- `addBreakpoint()` → Should be `setBreakpoint()`
- `removeBreakpoint()` → Should be `clearBreakpoint()`
- `clearBreakpoints()` → Should be `clearAllBreakpoints()`
- `updateProgramCounter()` → Not implemented
- `cleanup()` → Not implemented

### DebuggerRenderer Constructor
- Expected: `new DebuggerRenderer(dataManager, cogId)`
- Actual: `new DebuggerRenderer(canvas, dataManager, cogId)` - needs canvas element

### Missing cleanup() Methods
Several classes are missing cleanup methods:
- DebuggerProtocol
- DebuggerDataManager
- DebuggerRenderer

### DebugDebuggerWindow
- Missing `initialize()` method - should use base class `initialize()`

## Resolution Steps

To fix these issues:

1. **Update DebuggerProtocol calls** in:
   - `src/classes/debugDebuggerWin.ts`
   - `src/classes/shared/debuggerInteraction.ts`
   
2. **Add missing methods** to:
   - DebuggerProtocol: Add command methods or update callers
   - DebuggerDataManager: Add missing methods or update callers
   
3. **Fix constructor calls**:
   - DebuggerRenderer needs canvas element passed

4. **Add cleanup methods** where needed

5. **Use correct method names** from actual implementations

## Temporary Workaround

To get a successful build while these are being fixed:
1. Comment out the problematic files from compilation
2. Or stub out the missing methods
3. Or update all call sites to use correct method signatures

## Impact

These errors prevent:
- Full TypeScript compilation
- Building the minified distribution
- Running tests that depend on these components

However, the core functionality and architecture are complete and the errors are primarily integration mismatches that can be resolved by aligning method signatures.