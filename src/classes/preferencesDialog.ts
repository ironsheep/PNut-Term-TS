import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

export class PreferencesDialog {
  private window: BrowserWindow | null = null;
  private parent: BrowserWindow;
  private onSettingsChanged: (settings: any) => void;
  private settings: any = {
    terminal: {
      mode: 'PST',
      colorTheme: 'green-on-black',
      fontSize: 14,
      fontFamily: 'default',
      showCogPrefixes: true,
      localEcho: false
    },
    serialPort: {
      controlLine: 'DTR',
      defaultBaud: 115200,
      autoReconnect: true
    },
    logging: {
      logDirectory: './logs/',
      autoSaveDebug: true,
      newLogOnDtrReset: true,
      maxLogSize: 'unlimited',
      enableUSBLogging: false,
      usbLogFilePath: './logs/'  // Directory only - filename is auto-timestamped
    },
    recordings: {
      recordingsDirectory: './recordings/'
    },
    debugLogger: {
      scrollbackLines: 1000
    }
  };

  constructor(parent: BrowserWindow, onSettingsChanged: (settings: any) => void) {
    this.parent = parent;
    this.onSettingsChanged = onSettingsChanged;
  }

  public show(): void {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 600,
      height: 500,
      parent: this.parent,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const html = this.getHTML();
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    this.setupIPCHandlers();

    this.window.on('closed', () => {
      this.cleanup();
      this.window = null;
    });
  }

  private cleanup(): void {
    ipcMain.removeAllListeners('pref-apply');
    ipcMain.removeAllListeners('pref-cancel');
    ipcMain.removeAllListeners('pref-get-settings');
  }

  private setupIPCHandlers(): void {
    ipcMain.once('pref-get-settings', (event) => {
      event.reply('pref-settings', this.settings);
    });

    ipcMain.once('pref-apply', (event, newSettings) => {
      this.settings = newSettings;
      console.log('[Preferences] Settings updated:', this.settings);
      
      // Apply settings to application via callback
      if (this.onSettingsChanged) {
        this.onSettingsChanged(this.settings);
      }
      
      if (this.window) {
        this.window.close();
      }
    });

    ipcMain.once('pref-cancel', () => {
      if (this.window) {
        this.window.close();
      }
    });
  }

  private getHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Preferences</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      margin: 0;
      padding: 0;
      background-color: white;
      color: black;
      color-scheme: light;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      padding-bottom: 80px; /* Space for buttons */
    }
    
    .button-area {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid #ccc;
      padding: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    h2 {
      margin-bottom: 15px;
      font-size: 18px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    
    .section {
      margin-bottom: 25px;
    }
    
    .form-group {
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    label {
      flex: 0 0 200px;
      font-size: 13px;
    }
    
    input[type="number"],
    select {
      flex: 1;
      max-width: 200px;
      border: 1px solid #ccc;
      padding: 5px 8px;
      border-radius: 3px;
      font-size: 13px;
    }
    
    input[type="checkbox"],
    input[type="radio"] {
      margin-right: 5px;
    }
    
    .radio-group {
      display: flex;
      gap: 15px;
      flex: 1;
      max-width: none;
      justify-content: flex-start;
    }
    
    .radio-group label {
      flex: 0 0 auto;
      min-width: 60px;
      display: flex;
      align-items: center;
    }
    
    
    button {
      border: 1px solid #ccc;
      padding: 8px 20px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
    }
    
    button:hover {
      background: #f0f0f0;
    }
    
    button.cancel {
      background: #f5f5f5;
    }
    
    button.cancel:hover {
      background: #e0e0e0;
    }
    
    button:not(.cancel) {
      background: #007acc;
      color: white;
      border: none;
    }
    
    button:not(.cancel):hover {
      background: #0099ff;
    }
  </style>
</head>
<body>
  <div class="content">
    <div class="section">
    <h2>Terminal</h2>
    <div class="form-group">
      <label>Terminal Mode:</label>
      <select id="terminal-mode">
        <option value="PST">PST</option>
        <option value="ANSI">ANSI</option>
      </select>
    </div>
    <div class="form-group">
      <label>Color Theme:</label>
      <select id="color-theme">
        <option value="green-on-black">Green on Black</option>
        <option value="white-on-black">White on Black</option>
        <option value="amber-on-black">Amber on Black</option>
      </select>
    </div>
    <div class="form-group">
      <label>Font Size:</label>
      <input type="number" id="font-size" min="10" max="24" value="14">
    </div>
    <div class="form-group">
      <label>Font Family:</label>
      <select id="font-family">
        <option value="default">Default</option>
        <option value="parallax">Parallax</option>
        <option value="ibm3270">IBM 3270</option>
        <option value="ibm3270-green">IBM 3270 Green</option>
        <option value="ibm3270-amber">IBM 3270 Amber</option>
      </select>
    </div>
    <div class="form-group">
      <label>Show COG Prefixes:</label>
      <input type="checkbox" id="show-cog-prefixes" checked>
    </div>
    <div class="form-group">
      <label>Local Echo:</label>
      <input type="checkbox" id="local-echo">
    </div>
  </div>
  
  <div class="section">
    <h2>Serial Port</h2>
    <div class="form-group">
      <label>Control Line:</label>
      <div class="radio-group">
        <label><input type="radio" name="control-line" value="DTR" checked> DTR</label>
        <label><input type="radio" name="control-line" value="RTS"> RTS</label>
      </div>
    </div>
    <div class="form-group">
      <label>Default Baud Rate:</label>
      <select id="default-baud">
        <option value="115200">115200</option>
        <option value="230400">230400</option>
        <option value="460800">460800</option>
        <option value="921600">921600</option>
        <option value="1000000">1000000</option>
        <option value="2000000">2000000</option>
      </select>
    </div>
    <div class="form-group">
      <label>Auto-Reconnect:</label>
      <input type="checkbox" id="auto-reconnect" checked>
    </div>
  </div>
  
  <div class="section">
    <h2>Logging</h2>
    <div class="form-group">
      <label>Log Directory:</label>
      <input type="text" id="log-directory" value="./logs/" style="flex: 1; max-width: 200px; border: 1px solid #ccc; padding: 5px 8px; border-radius: 3px; font-size: 13px;">
    </div>
    <div class="form-group">
      <label>Auto-Save Debug Output:</label>
      <input type="checkbox" id="auto-save-debug" checked>
    </div>
    <div class="form-group">
      <label>New Log on DTR Reset:</label>
      <input type="checkbox" id="new-log-dtr" checked>
    </div>
    <div class="form-group">
      <label>Max Log Size:</label>
      <select id="max-log-size">
        <option value="1MB">1 MB</option>
        <option value="10MB" selected>10 MB</option>
        <option value="100MB">100 MB</option>
        <option value="unlimited">Unlimited</option>
      </select>
    </div>
    <div class="form-group">
      <label>Enable USB Traffic Logging:</label>
      <input type="checkbox" id="enable-usb-logging">
    </div>
    <div class="form-group">
      <label>USB Log Directory:</label>
      <input type="text" id="usb-log-path" value="./logs/" style="flex: 1; max-width: 200px; border: 1px solid #ccc; padding: 5px 8px; border-radius: 3px; font-size: 13px;" title="Directory for timestamped USB traffic logs">
      <span style="font-size: 11px; color: #666; margin-left: 10px;">Logs are timestamped automatically</span>
    </div>
  </div>

  <div class="section">
    <h2>Recordings</h2>
    <div class="form-group">
      <label>Recordings Directory:</label>
      <input type="text" id="recordings-directory" value="./recordings/" style="flex: 1; max-width: 200px; border: 1px solid #ccc; padding: 5px 8px; border-radius: 3px; font-size: 13px;">
    </div>
  </div>

  <div class="section">
    <h2>Debug Logger</h2>
    <div class="form-group">
      <label>History Lines:</label>
      <input type="number" id="scrollback-lines" min="100" max="10000" value="1000" style="flex: 1; max-width: 100px;">
      <span style="font-size: 11px; color: #666; margin-left: 10px;">Lines to keep for scrolling back (1000 recommended)</span>
    </div>
  </div>
  </div>
  
  <div class="button-area">
    <button class="cancel" onclick="cancel()">Cancel</button>
    <button onclick="apply()">Apply</button>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    let settings = {};
    
    // Request current settings
    ipcRenderer.send('pref-get-settings');
    
    ipcRenderer.on('pref-settings', (event, data) => {
      settings = data;
      loadSettings();
    });
    
    function loadSettings() {
      // Terminal settings
      document.getElementById('terminal-mode').value = settings.terminal.mode;
      document.getElementById('color-theme').value = settings.terminal.colorTheme;
      document.getElementById('font-size').value = settings.terminal.fontSize;
      document.getElementById('font-family').value = settings.terminal.fontFamily;
      document.getElementById('show-cog-prefixes').checked = settings.terminal.showCogPrefixes;
      document.getElementById('local-echo').checked = settings.terminal.localEcho;
      
      // Serial Port settings
      document.querySelector(\`input[name="control-line"][value="\${settings.serialPort.controlLine}"]\`).checked = true;
      document.getElementById('default-baud').value = settings.serialPort.defaultBaud;
      document.getElementById('auto-reconnect').checked = settings.serialPort.autoReconnect;
      
      // Logging settings
      document.getElementById('log-directory').value = settings.logging.logDirectory;
      document.getElementById('auto-save-debug').checked = settings.logging.autoSaveDebug;
      document.getElementById('new-log-dtr').checked = settings.logging.newLogOnDtrReset;
      document.getElementById('max-log-size').value = settings.logging.maxLogSize;
      document.getElementById('enable-usb-logging').checked = settings.logging.enableUSBLogging || false;
      document.getElementById('usb-log-path').value = settings.logging.usbLogFilePath || './logs/usb-traffic.log';

      // Recordings settings
      document.getElementById('recordings-directory').value = settings.recordings.recordingsDirectory;

      // Debug Logger settings
      document.getElementById('scrollback-lines').value = settings.debugLogger.scrollbackLines;
    }
    
    function apply() {
      const newSettings = {
        terminal: {
          mode: document.getElementById('terminal-mode').value,
          colorTheme: document.getElementById('color-theme').value,
          fontSize: parseInt(document.getElementById('font-size').value),
          fontFamily: document.getElementById('font-family').value,
          showCogPrefixes: document.getElementById('show-cog-prefixes').checked,
          localEcho: document.getElementById('local-echo').checked
        },
        serialPort: {
          controlLine: document.querySelector('input[name="control-line"]:checked').value,
          defaultBaud: parseInt(document.getElementById('default-baud').value),
          autoReconnect: document.getElementById('auto-reconnect').checked
        },
        logging: {
          logDirectory: document.getElementById('log-directory').value,
          autoSaveDebug: document.getElementById('auto-save-debug').checked,
          newLogOnDtrReset: document.getElementById('new-log-dtr').checked,
          maxLogSize: document.getElementById('max-log-size').value,
          enableUSBLogging: document.getElementById('enable-usb-logging').checked,
          usbLogFilePath: document.getElementById('usb-log-path').value
        },
        recordings: {
          recordingsDirectory: document.getElementById('recordings-directory').value
        },
        debugLogger: {
          scrollbackLines: parseInt(document.getElementById('scrollback-lines').value)
        }
      };
      
      ipcRenderer.send('pref-apply', newSettings);
    }
    
    function cancel() {
      ipcRenderer.send('pref-cancel');
    }
  </script>
</body>
</html>`;
  }
}