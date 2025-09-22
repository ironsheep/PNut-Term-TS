# Distribution Preparation Plan: `pnut-term-ts` Executable Naming

**Status**: DRAFT - Pending decisions before execution
**Created**: 2025-01-21
**Objective**: Standardize executable name as `pnut-term-ts` across all platforms

## Executive Summary

Currently, the application runs with different executable names on different platforms (Electron, PNut-Term-TS.exe, etc.). This plan outlines the steps to standardize the executable name as `pnut-term-ts` across macOS, Windows, and Linux for consistent user experience and documentation.

## Current State Analysis

| Platform | Current Executable Name | Desired Name |
|----------|------------------------|--------------|
| macOS App Bundle | `Electron` | `pnut-term-ts` |
| Windows | `PNut-Term-TS.exe` | `pnut-term-ts.exe` |
| Linux | `PNut-Term-TS` | `pnut-term-ts` |
| npm global | `pnut-term-ts` ✓ | `pnut-term-ts` |

## Implementation Phases

### Phase 1: Electron Builder Configuration
**Priority**: HIGH
**Impact**: All future builds

#### Tasks:
1. Update `electron.builder.json` with `executableName` field
2. Configure platform-specific executable names
3. Test builds on each platform

#### Configuration Changes:
```json
{
  "executableName": "pnut-term-ts",
  "mac": {
    "executableName": "pnut-term-ts",
    "bundleId": "biz.ironsheep.pnut-term-ts"
  },
  "win": {
    "executableName": "pnut-term-ts"
  },
  "linux": {
    "executableName": "pnut-term-ts"
  }
}
```

### Phase 2: macOS Special Handling
**Priority**: HIGH
**Complexity**: Medium

macOS apps require special handling due to bundle structure:
- **Bundle name** (user-visible): `PNut-Term-TS.app`
- **Internal executable**: `Contents/MacOS/pnut-term-ts`

#### Options to Evaluate:
1. **Option A**: Use Electron Builder's native configuration
2. **Option B**: Post-build script to rename executable
3. **Option C**: Create symlink approach for compatibility

#### Recommended Approach: TBD after testing

### Phase 3: Standalone/SEA Packages
**Priority**: MEDIUM
**Affects**: Node.js Single Executable Applications

#### Tasks:
1. Update `create-standalone-package.sh`
2. Update `create-native-sea-package.sh`
3. Update `create-cross-platform-sea.sh`
4. Ensure output binary naming consistency

### Phase 4: Command-Line Wrapper Strategy
**Priority**: MEDIUM
**Purpose**: Universal launcher across platforms

#### Components:
1. **Unix/Linux/macOS**: Shell script `pnut-term-ts`
2. **Windows**: Batch file `pnut-term-ts.cmd`
3. **Auto-detection**: Platform-specific binary launching

#### Wrapper Structure:
```bash
#!/bin/sh
# pnut-term-ts universal launcher
# Detects platform and launches appropriate executable
```

### Phase 5: Package Manager Distribution
**Priority**: LOW
**Timeline**: Post-release

| Package Manager | Platform | Configuration Needed |
|----------------|----------|---------------------|
| Homebrew | macOS | Formula with `pnut-term-ts` command |
| Chocolatey | Windows | Shim to `pnut-term-ts.exe` |
| Snap | Linux | Command alias configuration |
| Flatpak | Linux | Desktop file configuration |
| npm | All | Already configured ✓ |

## Implementation Steps

### Step 1: Electron Builder Updates
- [ ] Backup current `electron.builder.json`
- [ ] Add `executableName` configuration
- [ ] Test build on each platform
- [ ] Verify executable names

### Step 2: Post-Build Scripts
- [ ] Create `scripts/post-build-rename.sh`
- [ ] Add post-build hooks to `package.json`
- [ ] Test with CI/CD pipeline

### Step 3: Update Build Scripts
- [ ] Modify `create-electron-ready-package.sh`
- [ ] Update `create-standalone-package.sh`
- [ ] Adjust DMG creation scripts

### Step 4: Testing Matrix
- [ ] npm global install → `pnut-term-ts` command
- [ ] macOS .app → Terminal access as `pnut-term-ts`
- [ ] Windows installer → `pnut-term-ts.exe` in PATH
- [ ] Linux package → `/usr/bin/pnut-term-ts`
- [ ] Standalone executables → Correct naming

### Step 5: Documentation Updates
- [ ] Update README.md with new command
- [ ] Update USER-GUIDE.md
- [ ] Update installation instructions
- [ ] Update CI/CD documentation

## Decisions Required

### Before Execution:
1. **macOS Strategy**: Which option (A, B, or C) for handling macOS bundle?
2. **Backward Compatibility**: Support old executable names with symlinks?
3. **Migration Path**: How to handle existing installations?
4. **Version Timing**: Implement in current version or wait for major release?
5. **Wrapper Scripts**: Include universal launcher or platform-specific only?

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing scripts | HIGH | Provide compatibility symlinks |
| Confusing current users | MEDIUM | Clear migration documentation |
| Platform build failures | MEDIUM | Extensive testing before release |
| Package manager conflicts | LOW | Coordinate with package maintainers |

## Success Criteria

1. Single command `pnut-term-ts` works on all platforms
2. Documentation requires only one command reference
3. Tab completion works consistently
4. No breaking changes for existing users
5. Package managers recognize new naming

## Timeline

**Estimated Duration**: 2-3 days of implementation + testing

1. **Day 1**: Electron Builder configuration and testing
2. **Day 2**: Platform-specific scripts and wrappers
3. **Day 3**: Testing and documentation updates

## Notes

- This plan is in DRAFT status pending decisions on implementation approach
- Priority is to maintain backward compatibility while transitioning
- Consider phased rollout: npm first, then Electron packages
- May require coordination with downstream packagers (Homebrew, etc.)

## Next Steps

1. Review and approve plan with stakeholders
2. Make decisions on pending items
3. Create feature branch for implementation
4. Begin Phase 1 implementation
5. Progressive testing on each platform

---

**Document Status**: DRAFT - Awaiting decisions before execution