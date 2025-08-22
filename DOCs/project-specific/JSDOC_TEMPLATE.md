# JSDoc Template for Debug Windows

## Standard JSDoc Template

Based on the audit findings, particularly the excellent documentation in debugFftWin.ts and debugScopeXyWin.ts, here is the standard template all debug windows should follow:

```typescript
/**
 * Debug [WINDOW_TYPE] Window - [Brief Description]
 * 
 * [Detailed description of what this window does and its primary purpose]
 * 
 * ## Features
 * - **[Feature 1]**: [Description]
 * - **[Feature 2]**: [Description]
 * - **[Feature 3]**: [Description]
 * 
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set window size ([constraints], default: [values])
 * - `[PARAM] value` - [Description] ([constraints], default: [value])
 * - [Additional parameters with descriptions, constraints, and defaults]
 * 
 * ## Data Format
 * [Description of how data is fed to this window]
 * - [Format detail 1]
 * - [Format detail 2]
 * - Example: `debug(\`WindowName \`(value1, value2))`
 * 
 * ## Commands
 * - `CLEAR` - Clear display and reset state
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - [Additional window-specific commands]
 * 
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `[WindowType]_Configure` procedure
 * - Update: `[WindowType]_Update` procedure
 * - [Additional Pascal references with line numbers if available]
 * 
 * ## Examples
 * ```spin2
 * ' [Example description]
 * debug(\`[WINDOW_TYPE] MyWindow [configuration])
 * [example code]
 * ```
 * 
 * ## Implementation Notes
 * - [Important implementation detail 1]
 * - [Important implementation detail 2]
 * 
 * ## Deviations from Pascal
 * - [Deviation 1]: [Explanation]
 * - [Deviation 2]: [Explanation]
 * - [Or "None - Full Pascal compatibility maintained"]
 * 
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/[relevant test files]
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
```

## Key Requirements from Each Section

### 1. Header
- Window type in CAPS (e.g., "Debug TERM Window")
- Brief one-line description of purpose

### 2. Features
- Bullet list of main capabilities
- Use bold for feature names
- Brief description for each

### 3. Configuration Parameters
- Use backtick formatting for parameter names
- Include constraints in brackets (e.g., [1-256])
- Always include default values
- Group related parameters

### 4. Data Format
- Explain how data is fed to the window
- Include format specifications
- Provide concrete examples with spin2 code

### 5. Commands
- List all supported commands
- Use backtick formatting
- Brief description of what each does
- Include both standard (CLEAR, SAVE, CLOSE) and window-specific

### 6. Pascal Reference
- Reference specific procedures from DebugDisplayUnit.pas
- Use standard naming: [Type]_Configure, [Type]_Update
- Include line numbers when available

### 7. Examples
- Use spin2 code blocks
- Reference actual test files from DEBUG-TESTING folder
- Show typical usage patterns

### 8. Implementation Notes
- Technical details important for maintainers
- Algorithm descriptions (e.g., FFT implementation)
- Performance considerations

### 9. Deviations from Pascal
- List any differences from Pascal implementation
- Explain why the deviation exists
- If none, explicitly state "None - Full Pascal compatibility maintained"

### 10. @see References
- Link to Pascal test files in DEBUG-TESTING
- Link to DebugDisplayUnit.pas
- Any other relevant documentation

## Compliance Notes

Based on the audit:
- **Gold Standard**: debugFftWin.ts - follows all requirements perfectly
- **Good Examples**: debugScopeXyWin.ts, debugMidiWin.ts
- **Needs Work**: debugTermWin.ts, debugLogicWin.ts (missing class JSDoc entirely)
- **Needs Organization**: debugPlotWin.ts (has content but poor structure)

## Template Application Priority

1. **debugLogicWin.ts** - No JSDoc at all, needs complete documentation
2. **debugTermWin.ts** - Update existing partial JSDoc
3. **debugPlotWin.ts** - Reorganize existing content into template structure
4. **debugScopeWin.ts** - Add missing sections to existing JSDoc
5. **debugBitmapWin.ts** - Add Pascal references and examples
6. **debugMidiWin.ts** - Add Pascal references
7. **debugScopeXyWin.ts** - Minor additions (Pascal procedures)
8. **debugFftWin.ts** - Already compliant, may need minor updates for consistency