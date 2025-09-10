# USB Serial Download Integration Plan

## Overview
Wire up the existing USB serial download mechanisms (RAM and Flash) to the application's download buttons and menu system. The download infrastructure already exists - we need to integrate it properly with the UI.

## Current State Analysis

### ✅ Already Implemented:
1. **Downloader Class**: `src/classes/downloader.ts` - Complete download implementation
2. **USB Serial**: Download methods in `UsbSerial` class via `serialPort.download()`
3. **UI Elements**: RAM/Flash buttons and LEDs in toolbar
4. **Mode Selection**: `downloadMode` property and `setDownloadMode()` method
5. **Menu Integration**: Menu items with keyboard shortcuts (Ctrl+R, Ctrl+F)
6. **File Selection**: Dialog for binary file selection

### ❌ Missing Integration:
1. **Download Methods Not Connected**: `downloadToRAM()` and `downloadToFlash()` methods show dialogs but don't actually download
2. **Downloader Instance Management**: Need to create and manage `Downloader` instances properly
3. **Serial Port Coordination**: Need to coordinate between terminal and download operations
4. **Error Handling**: Proper user feedback during download operations
5. **Progress Indication**: Visual feedback during download process

## Current UI Structure

### Toolbar Buttons
```html
<button id="download-ram" class="toolbar-button">RAM</button>     <!-- Mode selector -->
<span id="ram-led">●</span>                                      <!-- Mode indicator -->
<button id="download-flash" class="toolbar-button">FLASH</button> <!-- Mode selector -->
<span id="flash-led">●</span>                                    <!-- Mode indicator -->
<button id="download-file" class="toolbar-button">📥 Download</button> <!-- Action button -->
```

### Menu Items
```typescript
{ label: 'Download to RAM', accelerator: 'CmdOrCtrl+R', click: () => this.downloadToRAM() }
{ label: 'Download to Flash', accelerator: 'CmdOrCtrl+F', click: () => this.downloadToFlash() }
```

### IPC Events
- `download-ram` → Sets mode to RAM
- `download-flash` → Sets mode to Flash  
- `download-file` → Triggers download using current mode

## Integration Plan

### 1. Fix Download Method Implementation

#### Current Issue
```typescript
// CURRENT - Only shows file dialog, doesn't download
private async downloadToRAM(): Promise<void> {
  const result = await dialog.showOpenDialog(this.mainWindow!, {
    title: 'Select Binary File to Download to RAM',
    // ... dialog config
  });
  // Missing: Actual download logic
}
```

#### Solution
```typescript
// NEW - Complete download implementation
private async downloadToRAM(): Promise<void> {
  // 1. Set mode and update UI
  this.setDownloadMode('ram');
  
  // 2. Show file selection dialog
  const result = await dialog.showOpenDialog(this.mainWindow!, {
    title: 'Select Binary File to Download to RAM',
    filters: [{ name: 'Binary Files', extensions: ['binary', 'bin'] }],
    properties: ['openFile']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    // 3. Execute download
    await this.executeDownload(result.filePaths[0], false); // false = RAM
  }
}

private async downloadToFlash(): Promise<void> {
  // 1. Set mode and update UI  
  this.setDownloadMode('flash');
  
  // 2. Show file selection dialog
  const result = await dialog.showOpenDialog(this.mainWindow!, {
    title: 'Select Binary File to Download to Flash',
    filters: [{ name: 'Binary Files', extensions: ['binary', 'bin'] }],
    properties: ['openFile']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    // 3. Execute download
    await this.executeDownload(result.filePaths[0], true); // true = Flash
  }
}
```

### 2. Implement Core Download Logic

```typescript
private async executeDownload(filePath: string, toFlash: boolean): Promise<void> {
  try {
    // 1. Show progress indication
    this.showDownloadProgress(true, toFlash ? 'Flash' : 'RAM');
    
    // 2. Create downloader instance (reuse existing serial port)
    if (!this.downloader) {
      this.downloader = new Downloader(this.context, this.serialPort);
    }
    
    // 3. Execute download using existing infrastructure
    await this.downloader.download(filePath, toFlash);
    
    // 4. Success feedback
    const target = toFlash ? 'Flash' : 'RAM';
    this.logMessage(`✅ Download to ${target} completed successfully: ${path.basename(filePath)}`);
    this.showDownloadStatus(`Downloaded to ${target}`, 'success');
    
  } catch (error) {
    // 5. Error handling
    const target = toFlash ? 'Flash' : 'RAM';
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.logMessage(`❌ Download to ${target} failed: ${errorMsg}`);
    this.showDownloadStatus(`Download failed: ${errorMsg}`, 'error');
    
  } finally {
    // 6. Hide progress indication
    this.showDownloadProgress(false);
  }
}
```

### 3. Add Progress and Status Feedback

#### Progress Indication
```typescript
private showDownloadProgress(show: boolean, target?: string): void {
  const statusText = show ? `Downloading to ${target}...` : 'Ready';
  
  this.safeExecuteJS(`
    const downloadBtn = document.getElementById('download-file');
    const recordingStatus = document.getElementById('recording-status');
    
    if (downloadBtn) {
      downloadBtn.disabled = ${show};
      downloadBtn.textContent = ${show ? `'⏳ Downloading...'` : `'📥 Download'`};
    }
    
    if (recordingStatus) {
      recordingStatus.textContent = '${statusText}';
      recordingStatus.style.color = ${show ? `'orange'` : `'#666'`};
    }
  `);
}

private showDownloadStatus(message: string, type: 'success' | 'error'): void {
  const color = type === 'success' ? 'green' : 'red';
  
  this.safeExecuteJS(`
    const recordingStatus = document.getElementById('recording-status');
    if (recordingStatus) {
      recordingStatus.textContent = '${message}';
      recordingStatus.style.color = '${color}';
      
      // Reset to normal after 3 seconds
      setTimeout(() => {
        recordingStatus.textContent = 'Ready';
        recordingStatus.style.color = '#666';
      }, 3000);
    }
  `);
}
```

### 4. Serial Port Coordination

#### Challenge
The terminal uses the serial port continuously. During download, we need to:
1. Temporarily pause terminal operations
2. Use the serial port for download
3. Resume terminal operations

#### Solution
```typescript
private async executeDownload(filePath: string, toFlash: boolean): Promise<void> {
  try {
    // 1. Pause terminal operations
    console.log('[DOWNLOAD] Pausing terminal operations for download');
    if (this.serialProcessor) {
      this.serialProcessor.pause();
    }
    
    // 2. Create fresh serial connection for download
    const downloadSerial = new UsbSerial(this.context);
    await downloadSerial.openPort(this._deviceNode);
    
    // 3. Execute download
    const downloader = new Downloader(this.context, downloadSerial);
    await downloader.download(filePath, toFlash);
    
    // 4. Close download connection
    await downloadSerial.close();
    
  } finally {
    // 5. Resume terminal operations
    console.log('[DOWNLOAD] Resuming terminal operations after download');
    if (this.serialProcessor) {
      this.serialProcessor.resume();
    }
  }
}
```

### 5. Update downloadFile() Method

#### Current Implementation
```typescript
private async downloadFile(): Promise<void> {
  if (this.downloadMode === 'ram') {
    await this.downloadToRAM();
  } else {
    await this.downloadToFlash();
  }
}
```

#### Enhancement
```typescript
private async downloadFile(): Promise<void> {
  // Validate serial port is available
  if (!this.serialPort || !this._deviceNode) {
    this.showDownloadStatus('No serial device connected', 'error');
    return;
  }
  
  // Execute download based on current mode
  if (this.downloadMode === 'ram') {
    await this.downloadToRAM();
  } else {
    await this.downloadToFlash();
  }
}
```

## Implementation Steps

### Phase 1: Core Integration
1. ✅ **Fix downloadToRAM() method** - Add actual download logic
2. ✅ **Fix downloadToFlash() method** - Add actual download logic  
3. ✅ **Implement executeDownload() method** - Core download orchestration
4. ✅ **Add progress indication** - Visual feedback during downloads

### Phase 2: User Experience
5. ✅ **Add status feedback** - Success/error messages
6. ✅ **Implement serial coordination** - Pause/resume terminal during download
7. ✅ **Error handling** - Graceful failure handling
8. ✅ **Validation** - Check device connection before download

### Phase 3: Polish
9. ✅ **Keyboard shortcuts** - Ensure Ctrl+R and Ctrl+F work properly
10. ✅ **Button states** - Proper enable/disable during operations
11. ✅ **Logging integration** - Proper message logging
12. ✅ **Testing** - Verify both RAM and Flash downloads work

## Success Criteria

### Functional Requirements
- ✅ **RAM Downloads**: Ctrl+R or RAM button + Download button works
- ✅ **Flash Downloads**: Ctrl+F or Flash button + Download button works
- ✅ **Mode Selection**: RAM/Flash buttons properly set mode with LED indicators
- ✅ **File Selection**: File dialog shows and allows binary file selection
- ✅ **Progress Feedback**: User sees download progress indication
- ✅ **Status Messages**: Clear success/error feedback

### Technical Requirements
- ✅ **Serial Coordination**: Terminal operations pause during download
- ✅ **Error Handling**: Graceful failure with user-friendly messages
- ✅ **Resource Management**: Proper cleanup of serial connections
- ✅ **Performance**: Downloads complete without blocking UI

## Files to Modify

### Core Implementation
- `src/classes/mainWindow.ts` - Main download integration
- `src/classes/downloader.ts` - Already implemented, may need minor updates

### Dependencies  
- `src/utils/usb.serial.ts` - Already has download() method
- `src/classes/shared/serialProcessor.ts` - May need pause/resume methods

## Testing Strategy

### Unit Testing
- Test download method selection based on mode
- Test file dialog integration
- Test error handling paths

### Integration Testing  
- Test with actual P2 hardware
- Test both RAM and Flash downloads
- Test serial port coordination
- Test progress indication

### User Acceptance Testing
- Verify keyboard shortcuts work
- Verify button interactions work
- Verify clear user feedback
- Verify graceful error handling

This plan leverages the existing download infrastructure while providing proper UI integration and user experience.