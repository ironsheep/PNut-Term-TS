# Debug Logger Scrollbar Implementation Plan

## Overview
Implement hybrid scrolling approach for Debug Logger window to fix critical scrolling issues and provide user-controllable history access.

## Current Problems
1. **CRITICAL**: Window stops showing new messages once screen fills up
2. **No History Access**: User cannot scroll back to review recent messages
3. **No User Control**: Fixed behavior with no configuration options

## Implementation Plan

### 1. Core Features
- **Hybrid Approach**: Smart auto-scroll with pausable history access
- **1000 Lines Default**: Reasonable scrollback for debugging sessions
- **User Configurable**: Preference setting for scrollback lines (100-10000 range)
- **Quick Live Return**: Button/control to jump back to following live data

### 2. Preferences Dialog Integration
```typescript
// Add to PreferencesDialog
debugLoggerScrollbackLines: number = 1000;  // Default 1000 lines
```

**Settings UI:**
- Label: "Debug Logger History"
- Input: Number field (100-10000 range)  
- Description: "Number of lines to keep for scrolling back (1000 recommended)"

### 3. Debug Logger Window Changes

#### New Properties
```typescript
private autoScroll: boolean = true;          // Start in live mode
private scrollbackLines: number = 1000;      // From user preferences
private scrollThreshold: number = 50;        // Pixels from bottom = "live mode"
private maxDOMLines: number = 1500;          // DOM performance limit
```

#### CSS Changes
```css
#output {
  overflow-y: auto;           // Enable vertical scrollbar (fix critical issue)
  scroll-behavior: smooth;    // Smooth auto-scroll transitions
  height: calc(100vh - 80px); // Fixed height to enable proper scrolling
}
```

### 4. Smart Scrolling Behavior

#### Live Mode (Default)
- New messages auto-scroll to bottom
- Window always shows latest content
- Status: "🔴 Live" indicator
- Behavior: `output.scrollTop = output.scrollHeight` on new messages

#### History Mode (When User Scrolls Up)
- Auto-scroll pauses when user scrolls up
- User can scroll freely through recent history
- Status: "📜 History" indicator + "Return to Live" button visible
- Behavior: Preserve user's scroll position

#### Auto-Return to Live
- **Trigger 1**: When user scrolls within 50px of bottom
- **Trigger 2**: When user clicks "Return to Live" button
- **Action**: Resume auto-scrolling, hide "Return to Live" button

### 5. UI Controls

#### Status Bar Addition
```html
<div id="scroll-status">
  <span id="mode-indicator">🔴 Live</span>
  <button id="return-to-live" style="display: none;">↓ Follow Live Data</button>
  <span id="line-count">Line 1000 of 1000</span>
</div>
```

#### Visual Indicators
- **Live Mode**: "🔴 Live" indicator
- **History Mode**: "📜 History" indicator  
- **Line Counter**: "Line 850 of 1000" format
- **Return Button**: Only visible in history mode

### 6. Reset Behavior

#### On DTR/RTS Reset
1. Clear all content: `output.innerHTML = '';`
2. Reset to live mode: `autoScroll = true;`
3. Show "Session Reset" separator line
4. Start line count from 1
5. Hide "Return to Live" button

#### On Program Start
- Same as reset behavior
- Fresh session with empty content
- Start in live mode

### 7. Performance Optimization

#### Memory Management
```typescript
// DOM Management
maxDOMLines: number = 1500;        // Keep extra 500 beyond scrollback for smooth scrolling
maxScrollbackLines: number = 1000; // User configurable from preferences

// When DOM exceeds maxDOMLines:
while (output.children.length > this.maxDOMLines) {
  output.removeChild(output.firstChild);
}
```

#### Lazy Loading
- Keep scrollback data in memory array
- Lazy-load history when user scrolls up beyond DOM content
- Maintain smooth scrolling performance

### 8. User Experience Flow

1. **Program Starts** → Debug Logger opens in Live mode (auto-scroll enabled)
2. **Messages Stream** → Always visible at bottom, stay in Live mode  
3. **User Scrolls Up** → Auto-scroll pauses, switch to History mode, show "Return to Live" button
4. **User Reviews History** → Can scroll through last N lines (user-configurable)
5. **Return to Live** → Via button click OR scrolling near bottom → Auto-scroll resumes
6. **DTR/RTS Reset** → Clear content, fresh session, back to Live mode

### 9. Configuration Options

#### User Preferences
- **Scrollback Lines**: Range 100-10000, default 1000
- **Location**: Preferences Dialog under "Debug Logger History"

#### Fixed Parameters
- **Auto-scroll Threshold**: 50px from bottom
- **DOM Buffer**: +500 lines beyond scrollback for performance
- **Visual Indicators**: Always enabled

### 10. Technical Implementation Details

#### Scroll Event Handler
```typescript
private onScroll(): void {
  const output = this.debugWindow?.webContents.executeJavaScript('document.getElementById("output")');
  const isNearBottom = (output.scrollTop + output.clientHeight) >= (output.scrollHeight - this.scrollThreshold);
  
  if (isNearBottom && !this.autoScroll) {
    // User scrolled back to bottom - resume live mode
    this.autoScroll = true;
    this.updateModeIndicator('live');
    this.hideReturnToLiveButton();
  } else if (!isNearBottom && this.autoScroll) {
    // User scrolled away from bottom - pause live mode
    this.autoScroll = false;
    this.updateModeIndicator('history');
    this.showReturnToLiveButton();
  }
}
```

#### Message Append Logic
```typescript
private appendMessage(message: string, type: string): void {
  // Add message to DOM
  this.addMessageToDOM(message, type);
  
  // Auto-scroll only if in live mode
  if (this.autoScroll) {
    this.scrollToBottom();
  }
  
  // Update line counter
  this.updateLineCounter();
  
  // Manage DOM size
  this.trimOldMessages();
}
```

## Success Criteria
1. ✅ **New messages always visible** in live mode
2. ✅ **User can scroll back** through configurable history
3. ✅ **Quick return to live** via button or scroll position
4. ✅ **Session-based reset** on DTR/RTS events
5. ✅ **Performance optimized** for high-speed data streams
6. ✅ **User configurable** scrollback length in preferences

## Files to Modify
- `src/classes/debugLoggerWin.ts` - Core scrolling implementation
- `src/classes/preferencesDialog.ts` - Add scrollback preference
- `src/classes/shared/messageRouter.ts` - Ensure DTR/RTS reset events reach logger

## Testing Requirements
- Test with high-speed message streams
- Test scroll behavior during active streaming
- Test DTR/RTS reset functionality  
- Test preference changes apply immediately
- Test performance with maximum scrollback settings