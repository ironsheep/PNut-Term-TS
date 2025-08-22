# Pascal Source References

**IMPORTANT**: The Pascal reference source is located at `/pascal-source/` in the root filesystem, NOT in the workspace.

## Key Pascal Files
- `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` - Core debug display implementation (~50k lines)
- `/pascal-source/P2_PNut_Public/DebugUnit.pas` - Window management
- `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` - Debugger functionality (~8.5k lines)

## Documentation PDFs
- `/pascal-source/P2_PNut_Public/P2 Spin2 Documentation v51-250425.pdf` - Complete Spin2 reference
- `/pascal-source/P2_PNut_Public/MouseComamnds.pdf` - PC_KEY and PC_MOUSE specifications
- `/pascal-source/P2_PNut_Public/debugStatements.pdf` - Debug display command reference

## Test Files
`/pascal-source/P2_PNut_Public/DEBUG-TESTING/` contains test programs and binaries

## Key Translation Resources
- `src/classes/shared/debugStatements.ts` - TypeScript constants and interfaces
- `src/classes/debugColor.ts` - Color system implementation
- `src/classes/shared/packedDataProcessor.ts` - Packed data handling

## Pascal Translation Notes
For detailed Pascal translation guidance and implementation patterns, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).