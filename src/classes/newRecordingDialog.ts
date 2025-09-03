import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class NewRecordingDialog {
  private parent: BrowserWindow;
  private recordingActive: boolean = false;
  private currentRecordingPath: string = '';
  private messageCount: number = 0;

  constructor(parent: BrowserWindow) {
    this.parent = parent;
  }

  public show(isRecordingActive: boolean, messageCount: number = 0): void {
    this.recordingActive = isRecordingActive;
    this.messageCount = messageCount;

    if (isRecordingActive) {
      this.showActiveRecordingDialog();
    } else {
      this.showNewRecordingDialog();
    }
  }

  private showActiveRecordingDialog(): void {
    const window = new BrowserWindow({
      width: 400,
      height: 250,
      parent: this.parent,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>New Recording</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 30px;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    
    h2 {
      color: #4ec9b0;
      margin-bottom: 20px;
      font-size: 18px;
    }
    
    .warning-icon {
      color: #ffaa00;
      font-size: 24px;
      margin-right: 10px;
      vertical-align: middle;
    }
    
    .message {
      background: #252526;
      padding: 20px;
      border-radius: 5px;
      border-left: 3px solid #ffaa00;
      margin-bottom: 20px;
    }
    
    .message-count {
      color: #4ec9b0;
      font-weight: bold;
      margin-top: 10px;
    }
    
    .buttons {
      margin-top: auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
    }
    
    button:hover {
      background: #1177bb;
    }
    
    button.cancel {
      background: #5a5a5a;
    }
    
    button.cancel:hover {
      background: #6a6a6a;
    }
    
    button.primary {
      background: #007acc;
    }
    
    button.primary:hover {
      background: #0099ff;
    }
  </style>
</head>
<body>
  <h2><span class="warning-icon">⚠</span>Active Recording</h2>
  <div class="message">
    <div>Current recording will be saved before starting a new one.</div>
    <div class="message-count">Messages recorded: ${this.messageCount}</div>
  </div>
  <div class="buttons">
    <button class="cancel" onclick="cancel()">Cancel</button>
    <button class="primary" onclick="saveAndStart()">Save & Start New</button>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    function cancel() {
      window.close();
    }
    
    function saveAndStart() {
      ipcRenderer.send('recording-save-and-start');
      window.close();
    }
  </script>
</body>
</html>`;

    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    ipcMain.once('recording-save-and-start', () => {
      // Signal main window to save current and start new
      this.parent.webContents.send('recording-action', 'save-and-start');
    });
  }

  private showNewRecordingDialog(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const recordingPath = path.join(process.cwd(), 'recordings', `recording_${timestamp}.p2rec`);
    
    const window = new BrowserWindow({
      width: 400,
      height: 250,
      parent: this.parent,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>New Recording</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 30px;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    
    h2 {
      color: #4ec9b0;
      margin-bottom: 20px;
      font-size: 18px;
    }
    
    .info-icon {
      color: #4ec9b0;
      font-size: 24px;
      margin-right: 10px;
      vertical-align: middle;
    }
    
    .message {
      background: #252526;
      padding: 20px;
      border-radius: 5px;
      border-left: 3px solid #4ec9b0;
      margin-bottom: 20px;
    }
    
    .file-path {
      color: #969696;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      margin-top: 10px;
      word-break: break-all;
    }
    
    .buttons {
      margin-top: auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
    }
    
    button:hover {
      background: #1177bb;
    }
    
    button.cancel {
      background: #5a5a5a;
    }
    
    button.cancel:hover {
      background: #6a6a6a;
    }
    
    button.primary {
      background: #007acc;
    }
    
    button.primary:hover {
      background: #0099ff;
    }
  </style>
</head>
<body>
  <h2><span class="info-icon">ℹ</span>New Recording</h2>
  <div class="message">
    <div>New recording will be saved to:</div>
    <div class="file-path">${recordingPath}</div>
  </div>
  <div class="buttons">
    <button class="cancel" onclick="cancel()">Cancel</button>
    <button class="primary" onclick="startRecording()">Start Recording</button>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    const path = require('path');
    const fs = require('fs');
    
    function cancel() {
      window.close();
    }
    
    function startRecording() {
      // Ensure recordings directory exists
      const recordingsDir = path.join(process.cwd(), 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      
      ipcRenderer.send('recording-start-new', '${recordingPath}');
      window.close();
    }
  </script>
</body>
</html>`;

    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    ipcMain.once('recording-start-new', (event, filePath) => {
      // Signal main window to start new recording
      this.parent.webContents.send('recording-action', 'start-new', filePath);
    });
  }
}