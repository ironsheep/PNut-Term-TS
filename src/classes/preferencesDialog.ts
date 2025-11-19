import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Context } from '../utils/context';

// Console logging control
const ENABLE_CONSOLE_LOG: boolean = false;

export class PreferencesDialog {
  private window: BrowserWindow | null = null;
  private parent: BrowserWindow;
  private context: Context;
  private onSettingsChanged: (settings: any) => void;

  constructor(parent: BrowserWindow, context: Context, onSettingsChanged: (settings: any) => void) {
    this.parent = parent;
    this.context = context;
    this.onSettingsChanged = onSettingsChanged;
  }

  public show(): void {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 650,
      height: 580,
      parent: this.parent,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false
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
    ipcMain.removeAllListeners('pref-apply-user');
    ipcMain.removeAllListeners('pref-apply-project');
    ipcMain.removeAllListeners('pref-cancel');
    ipcMain.removeAllListeners('pref-get-settings');
    ipcMain.removeAllListeners('pref-get-propplug-list');
    ipcMain.removeAllListeners('pref-update-propplug');
    ipcMain.removeAllListeners('pref-delete-propplug');
    ipcMain.removeAllListeners('pref-set-project-propplug');
  }

  private setupIPCHandlers(): void {
    ipcMain.once('pref-get-settings', (event) => {
      // Send both user-only and effective (cascaded) settings
      // User tab should show user-only settings, project tab shows effective settings
      const userSettings = this.context.getUserGlobalSettings();
      const effectiveSettings = this.context.preferences;

      event.reply('pref-settings', {
        user: userSettings,
        effective: effectiveSettings
      });
    });

    ipcMain.once('pref-apply-user', (event, newSettings) => {
      if (ENABLE_CONSOLE_LOG) console.log('[Preferences] User settings updated:', newSettings);

      // Save to user global file (delta-save)
      this.context.saveUserGlobalSettings(newSettings);

      // Update in-memory preferences and sync to runtime
      this.context.updatePreferences(newSettings);

      // Apply settings to application via callback
      if (this.onSettingsChanged) {
        this.onSettingsChanged(this.context.preferences);
      }

      if (this.window) {
        this.window.close();
      }
    });

    ipcMain.once('pref-apply-project', (event, projectOverrides) => {
      if (ENABLE_CONSOLE_LOG) console.log('[Preferences] Project settings updated:', projectOverrides);

      // Save to project local file (only overrides)
      this.context.saveProjectLocalSettings(projectOverrides);

      // Reload hierarchical settings to get new effective values
      // (this will re-cascade: app defaults → user global → project local)
      this.context.reloadHierarchicalSettings();

      // Apply settings to application via callback
      if (this.onSettingsChanged) {
        this.onSettingsChanged(this.context.preferences);
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

    // PropPlug management handlers
    ipcMain.on('pref-get-propplug-list', (event) => {
      const knownPlugs = this.context.getKnownPropPlugs();
      const projectSelected = this.context.getProjectSelectedPropPlug();
      const currentSerial = this.context.runEnvironment.selectedPropPlugSerial;
      event.reply('pref-propplug-list', {
        knownPlugs,
        projectSelected,
        currentSerial
      });
    });

    ipcMain.on('pref-update-propplug', (event, data) => {
      const { serialNumber, friendlyName, controlLine } = data;
      this.context.updateKnownPropPlug(serialNumber, { friendlyName, controlLine });
      // Send updated list back
      const knownPlugs = this.context.getKnownPropPlugs();
      event.reply('pref-propplug-list', {
        knownPlugs,
        projectSelected: this.context.getProjectSelectedPropPlug(),
        currentSerial: this.context.runEnvironment.selectedPropPlugSerial
      });
    });

    ipcMain.on('pref-delete-propplug', (event, serialNumber) => {
      this.context.deleteKnownPropPlug(serialNumber);
      // Send updated list back
      const knownPlugs = this.context.getKnownPropPlugs();
      event.reply('pref-propplug-list', {
        knownPlugs,
        projectSelected: this.context.getProjectSelectedPropPlug(),
        currentSerial: this.context.runEnvironment.selectedPropPlugSerial
      });
    });

    ipcMain.on('pref-set-project-propplug', (event, serialNumber) => {
      this.context.setProjectSelectedPropPlug(serialNumber);
      event.reply('pref-project-propplug-set', serialNumber);
    });
  }

  private generateSettingsHTML(tabType: 'user' | 'project'): string {
    const prefix = tabType;
    const isProject = tabType === 'project';

    return `
    <div class="section">
      <h2>Terminal</h2>
      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-terminal-mode" onchange="toggleOverride('${prefix}', 'terminal-mode')">
        <label>Terminal Mode:</label>
        <select id="${prefix}-terminal-mode" disabled>
          <option value="PST">PST</option>
          <option value="ANSI">ANSI</option>
        </select>
        <span class="global-value" id="${prefix}-global-terminal-mode"></span>
      </div>` : `<div class="form-group">
        <label>Terminal Mode:</label>
        <select id="${prefix}-terminal-mode">
          <option value="PST">PST</option>
          <option value="ANSI">ANSI</option>
        </select>
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-color-theme" onchange="toggleOverride('${prefix}', 'color-theme')">
        <label>Color Theme:</label>
        <select id="${prefix}-color-theme" disabled>
          <option value="green-on-black">Green on Black</option>
          <option value="white-on-black">White on Black</option>
          <option value="amber-on-black">Amber on Black</option>
        </select>
        <span class="global-value" id="${prefix}-global-color-theme"></span>
      </div>` : `<div class="form-group">
        <label>Color Theme:</label>
        <select id="${prefix}-color-theme">
          <option value="green-on-black">Green on Black</option>
          <option value="white-on-black">White on Black</option>
          <option value="amber-on-black">Amber on Black</option>
        </select>
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-font-size" onchange="toggleOverride('${prefix}', 'font-size')">
        <label>Font Size:</label>
        <input type="number" id="${prefix}-font-size" min="10" max="24" value="14" disabled>
        <span class="global-value" id="${prefix}-global-font-size"></span>
      </div>` : `<div class="form-group">
        <label>Font Size:</label>
        <input type="number" id="${prefix}-font-size" min="10" max="24" value="14">
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-font-family" onchange="toggleOverride('${prefix}', 'font-family')">
        <label>Font Family:</label>
        <select id="${prefix}-font-family" disabled>
          <option value="default">Default</option>
          <option value="parallax">Parallax</option>
          <option value="ibm3270">IBM 3270</option>
          <option value="ibm3270-green">IBM 3270 Green</option>
          <option value="ibm3270-amber">IBM 3270 Amber</option>
        </select>
        <span class="global-value" id="${prefix}-global-font-family"></span>
      </div>` : `<div class="form-group">
        <label>Font Family:</label>
        <select id="${prefix}-font-family">
          <option value="default">Default</option>
          <option value="parallax">Parallax</option>
          <option value="ibm3270">IBM 3270</option>
          <option value="ibm3270-green">IBM 3270 Green</option>
          <option value="ibm3270-amber">IBM 3270 Amber</option>
        </select>
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-show-cog-prefixes" onchange="toggleOverride('${prefix}', 'show-cog-prefixes')">
        <label>Show COG Prefixes:</label>
        <input type="checkbox" id="${prefix}-show-cog-prefixes" disabled>
        <span class="global-value" id="${prefix}-global-show-cog-prefixes"></span>
      </div>` : `<div class="form-group">
        <label>Show COG Prefixes:</label>
        <input type="checkbox" id="${prefix}-show-cog-prefixes">
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-local-echo" onchange="toggleOverride('${prefix}', 'local-echo')">
        <label>Local Echo:</label>
        <input type="checkbox" id="${prefix}-local-echo" disabled>
        <span class="global-value" id="${prefix}-global-local-echo"></span>
      </div>` : `<div class="form-group">
        <label>Local Echo:</label>
        <input type="checkbox" id="${prefix}-local-echo">
      </div>`}
    </div>

    <div class="section">
      <h2>Serial Port</h2>
      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-control-line" onchange="toggleOverride('${prefix}', 'control-line')">
        <label>Control Line:</label>
        <div class="radio-group">
          <label><input type="radio" name="${prefix}-control-line" value="DTR" disabled> DTR</label>
          <label><input type="radio" name="${prefix}-control-line" value="RTS" disabled> RTS</label>
        </div>
        <span class="global-value" id="${prefix}-global-control-line"></span>
      </div>` : `<div class="form-group">
        <label>Control Line:</label>
        <div class="radio-group">
          <label><input type="radio" name="${prefix}-control-line" value="DTR"> DTR</label>
          <label><input type="radio" name="${prefix}-control-line" value="RTS"> RTS</label>
        </div>
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-default-baud" onchange="toggleOverride('${prefix}', 'default-baud')">
        <label>Default Baud Rate:</label>
        <select id="${prefix}-default-baud" disabled>
          <option value="115200">115200</option>
          <option value="230400">230400</option>
          <option value="460800">460800</option>
          <option value="921600">921600</option>
          <option value="1000000">1000000</option>
          <option value="2000000">2000000</option>
        </select>
        <span class="global-value" id="${prefix}-global-default-baud"></span>
      </div>` : `<div class="form-group">
        <label>Default Baud Rate:</label>
        <select id="${prefix}-default-baud">
          <option value="115200">115200</option>
          <option value="230400">230400</option>
          <option value="460800">460800</option>
          <option value="921600">921600</option>
          <option value="1000000">1000000</option>
          <option value="2000000">2000000</option>
        </select>
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-reset-on-connection" onchange="toggleOverride('${prefix}', 'reset-on-connection')">
        <label>Reset P2 on App Startup:</label>
        <input type="checkbox" id="${prefix}-reset-on-connection" disabled>
        <span class="global-value" id="${prefix}-global-reset-on-connection"></span>
      </div>` : `<div class="form-group">
        <label>Reset P2 on App Startup:</label>
        <input type="checkbox" id="${prefix}-reset-on-connection">
      </div>`}
    </div>

    <div class="section">
      <h2>Logging</h2>
      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-log-directory" onchange="toggleOverride('${prefix}', 'log-directory')">
        <label>Log Directory:</label>
        <input type="text" id="${prefix}-log-directory" value="./logs/" disabled>
        <span class="global-value" id="${prefix}-global-log-directory"></span>
      </div>` : `<div class="form-group">
        <label>Log Directory:</label>
        <input type="text" id="${prefix}-log-directory" value="./logs/">
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-auto-save-debug" onchange="toggleOverride('${prefix}', 'auto-save-debug')">
        <label>Auto-Save Debug Output:</label>
        <input type="checkbox" id="${prefix}-auto-save-debug" disabled>
        <span class="global-value" id="${prefix}-global-auto-save-debug"></span>
      </div>` : `<div class="form-group">
        <label>Auto-Save Debug Output:</label>
        <input type="checkbox" id="${prefix}-auto-save-debug">
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-new-log-dtr" onchange="toggleOverride('${prefix}', 'new-log-dtr')">
        <label>New Log on P2 Reset:</label>
        <input type="checkbox" id="${prefix}-new-log-dtr" disabled>
        <span class="global-value" id="${prefix}-global-new-log-dtr"></span>
      </div>` : `<div class="form-group">
        <label>New Log on P2 Reset:</label>
        <input type="checkbox" id="${prefix}-new-log-dtr">
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-max-log-size" onchange="toggleOverride('${prefix}', 'max-log-size')">
        <label>Max Log Size:</label>
        <select id="${prefix}-max-log-size" disabled>
          <option value="1MB">1 MB</option>
          <option value="10MB">10 MB</option>
          <option value="100MB">100 MB</option>
          <option value="unlimited">Unlimited</option>
        </select>
        <span class="global-value" id="${prefix}-global-max-log-size"></span>
      </div>` : `<div class="form-group">
        <label>Max Log Size:</label>
        <select id="${prefix}-max-log-size">
          <option value="1MB">1 MB</option>
          <option value="10MB">10 MB</option>
          <option value="100MB">100 MB</option>
          <option value="unlimited">Unlimited</option>
        </select>
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-enable-usb-logging" onchange="toggleOverride('${prefix}', 'enable-usb-logging')">
        <label>Enable USB Traffic Logging:</label>
        <input type="checkbox" id="${prefix}-enable-usb-logging" disabled>
        <span class="global-value" id="${prefix}-global-enable-usb-logging"></span>
      </div>` : `<div class="form-group">
        <label>Enable USB Traffic Logging:</label>
        <input type="checkbox" id="${prefix}-enable-usb-logging">
      </div>`}

      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-usb-log-path" onchange="toggleOverride('${prefix}', 'usb-log-path')">
        <label>USB Log Directory:</label>
        <input type="text" id="${prefix}-usb-log-path" value="./logs/" disabled>
        <span class="global-value" id="${prefix}-global-usb-log-path"></span>
      </div>` : `<div class="form-group">
        <label>USB Log Directory:</label>
        <input type="text" id="${prefix}-usb-log-path" value="./logs/">
        <span style="font-size: 11px; color: #666; margin-left: 10px;">Logs are timestamped automatically</span>
      </div>`}
    </div>

    <div class="section">
      <h2>Recordings</h2>
      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-recordings-directory" onchange="toggleOverride('${prefix}', 'recordings-directory')">
        <label>Recordings Directory:</label>
        <input type="text" id="${prefix}-recordings-directory" value="./recordings/" disabled>
        <span class="global-value" id="${prefix}-global-recordings-directory"></span>
      </div>` : `<div class="form-group">
        <label>Recordings Directory:</label>
        <input type="text" id="${prefix}-recordings-directory" value="./recordings/">
      </div>`}
    </div>

    <div class="section">
      <h2>Debug Logger</h2>
      ${isProject ? `<div class="form-group">
        <input type="checkbox" class="override-checkbox" id="${prefix}-override-scrollback-lines" onchange="toggleOverride('${prefix}', 'scrollback-lines')">
        <label>History Lines:</label>
        <input type="number" id="${prefix}-scrollback-lines" min="100" max="10000" value="1000" disabled>
        <span class="global-value" id="${prefix}-global-scrollback-lines"></span>
      </div>` : `<div class="form-group">
        <label>History Lines:</label>
        <input type="number" id="${prefix}-scrollback-lines" min="100" max="10000" value="1000">
        <span style="font-size: 11px; color: #666; margin-left: 10px;">Lines to keep for scrolling back (1000 recommended)</span>
      </div>`}
    </div>
    `;
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

    .tabs {
      display: flex;
      border-bottom: 1px solid #ccc;
      background: #d0d0d0;  /* Darker gray to make tabs stand out */
    }

    .tab {
      padding: 12px 24px;
      cursor: pointer;
      border: none;
      background: white !important;  /* Force white background for all tabs */
      font-size: 13px;
      border-bottom: 4px solid transparent;  /* Thicker border area for alignment */
      color: #000 !important;
      margin: 0 2px;  /* Small gap between tabs */
    }

    .tab:hover {
      background: #f8f8f8 !important;  /* Very subtle hover effect */
      color: #000 !important;
    }

    .tab.active {
      background: white !important;
      border-bottom: 4px solid #007acc;  /* Thicker blue underline for active tab */
      color: #000 !important;
      font-weight: 600;  /* Bolder text for active */
    }

    .tab-content {
      display: none;
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      padding-bottom: 80px; /* Space for buttons */
    }

    .tab-content.active {
      display: block;
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

    .form-group.disabled {
      opacity: 0.5;
    }

    label {
      flex: 0 0 200px;
      font-size: 13px;
    }

    input[type="number"],
    input[type="text"],
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

    .override-checkbox {
      margin-right: 10px;
    }

    .global-value {
      font-size: 11px;
      color: #666;
      margin-left: 10px;
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
  <div class="tabs">
    <button class="tab active" onclick="switchTab('user')">User Settings</button>
    <button class="tab" onclick="switchTab('project')">Project Settings</button>
    <button class="tab" onclick="switchTab('propplug')">PropPlug Management</button>
  </div>

  <!-- USER SETTINGS TAB -->
  <div id="user-tab" class="tab-content active">
    ${this.generateSettingsHTML('user')}
  </div>

  <!-- PROJECT SETTINGS TAB -->
  <div id="project-tab" class="tab-content">
    ${this.generateSettingsHTML('project')}
  </div>

  <!-- PROPPLUG MANAGEMENT TAB -->
  <div id="propplug-tab" class="tab-content">
    <div class="section">
      <h2>Known PropPlug Devices</h2>
      <div id="propplug-list-container">
        <table id="propplug-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f0f0f0;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Serial</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Name</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Control</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Last Used</th>
            </tr>
          </thead>
          <tbody id="propplug-list">
            <!-- Populated dynamically -->
          </tbody>
        </table>
        <p id="no-propplug-msg" style="color: #666; font-style: italic; display: none;">No PropPlug devices found. Connect a device to add it to this list.</p>
      </div>
    </div>

    <div class="section" id="propplug-edit-section" style="display: none;">
      <h2>Edit Device</h2>
      <div class="form-group">
        <label>Serial Number:</label>
        <span id="edit-serial" style="flex: 1;"></span>
      </div>
      <div class="form-group">
        <label>Friendly Name:</label>
        <input type="text" id="edit-friendly-name" placeholder="e.g., Workbench Plug">
      </div>
      <div class="form-group">
        <label>Control Line:</label>
        <div class="radio-group">
          <label><input type="radio" name="edit-control-line" value="DTR"> DTR</label>
          <label><input type="radio" name="edit-control-line" value="RTS"> RTS</label>
        </div>
      </div>
      <div class="form-group">
        <label>Device Info:</label>
        <span id="edit-device-info" style="flex: 1; font-size: 11px; color: #666;"></span>
      </div>
      <div style="margin-top: 15px;">
        <button onclick="savePropplugedit()" style="margin-right: 10px;">Save Changes</button>
        <button onclick="deleteCurrentPropplug()" class="cancel" style="background: #ff4444; color: white; border: none;">Delete Device</button>
      </div>
    </div>

    <div class="section">
      <h2>Project PropPlug Selection</h2>
      <div class="form-group">
        <label>Use PropPlug:</label>
        <select id="project-propplug-select" style="flex: 1; max-width: 300px;">
          <option value="">Auto-detect (any available)</option>
          <!-- Populated dynamically -->
        </select>
      </div>
      <p style="font-size: 11px; color: #666; margin-top: 5px;">
        Select a specific PropPlug for this project, or use auto-detect to connect to any available device.
      </p>
    </div>
  </div>
  
  <div class="button-area">
    <button class="cancel" onclick="cancel()">Cancel</button>
    <button onclick="apply()">Apply</button>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');

    let userSettings = {};
    let effectiveSettings = {};
    let currentTab = 'user';
    let propplugList = [];
    let selectedPropplug = null;
    let projectSelectedPropplug = '';

    // Request current settings
    ipcRenderer.send('pref-get-settings');

    // PropPlug list handler
    ipcRenderer.on('pref-propplug-list', (event, data) => {
      propplugList = data.knownPlugs || [];
      projectSelectedPropplug = data.projectSelected || '';
      populatePropplugList();
      populateProjectPropplugSelect();
    });

    ipcRenderer.on('pref-project-propplug-set', (event, serialNumber) => {
      projectSelectedPropplug = serialNumber;
    });

    ipcRenderer.on('pref-settings', (event, data) => {
      // Data contains both user-only and effective (cascaded) settings
      userSettings = data.user;
      effectiveSettings = data.effective;
      loadSettings();
    });

    function switchTab(tabName) {
      currentTab = tabName;

      // Update tab buttons
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      event.target.classList.add('active');

      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tabName + '-tab').classList.add('active');

      // Load PropPlug data when switching to that tab
      if (tabName === 'propplug') {
        ipcRenderer.send('pref-get-propplug-list');
      }
    }

    function populatePropplugList() {
      const tbody = document.getElementById('propplug-list');
      const noMsg = document.getElementById('no-propplug-msg');
      const table = document.getElementById('propplug-table');

      tbody.innerHTML = '';

      if (propplugList.length === 0) {
        table.style.display = 'none';
        noMsg.style.display = 'block';
        return;
      }

      table.style.display = 'table';
      noMsg.style.display = 'none';

      propplugList.forEach(plug => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => selectPropplug(plug.serialNumber);

        const lastUsed = plug.lastUsed ? new Date(plug.lastUsed).toLocaleDateString() : 'Never';
        const name = plug.friendlyName || '(unnamed)';

        row.innerHTML = \`
          <td style="padding: 8px; border-bottom: 1px solid #eee;">\${plug.serialNumber}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">\${name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">\${plug.controlLine}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">\${lastUsed}</td>
        \`;

        if (selectedPropplug && selectedPropplug.serialNumber === plug.serialNumber) {
          row.style.background = '#e0e8ff';
        }

        tbody.appendChild(row);
      });
    }

    function selectPropplug(serialNumber) {
      selectedPropplug = propplugList.find(p => p.serialNumber === serialNumber);
      if (!selectedPropplug) return;

      // Update list highlighting
      populatePropplugList();

      // Show edit section
      const editSection = document.getElementById('propplug-edit-section');
      editSection.style.display = 'block';

      // Populate edit fields
      document.getElementById('edit-serial').textContent = selectedPropplug.serialNumber;
      document.getElementById('edit-friendly-name').value = selectedPropplug.friendlyName || '';
      document.querySelector(\`input[name="edit-control-line"][value="\${selectedPropplug.controlLine}"]\`).checked = true;
      document.getElementById('edit-device-info').textContent =
        \`VID: 0x\${selectedPropplug.vendorId.toString(16).padStart(4, '0')} PID: 0x\${selectedPropplug.productId.toString(16).padStart(4, '0')}\`;
    }

    function savePropplugedit() {
      if (!selectedPropplug) return;

      const friendlyName = document.getElementById('edit-friendly-name').value;
      const controlLine = document.querySelector('input[name="edit-control-line"]:checked').value;

      ipcRenderer.send('pref-update-propplug', {
        serialNumber: selectedPropplug.serialNumber,
        friendlyName,
        controlLine
      });
    }

    function deleteCurrentPropplug() {
      if (!selectedPropplug) return;

      if (confirm(\`Delete PropPlug "\${selectedPropplug.serialNumber}"?\`)) {
        ipcRenderer.send('pref-delete-propplug', selectedPropplug.serialNumber);
        selectedPropplug = null;
        document.getElementById('propplug-edit-section').style.display = 'none';
      }
    }

    function populateProjectPropplugSelect() {
      const select = document.getElementById('project-propplug-select');

      // Clear existing options except the first (auto-detect)
      while (select.options.length > 1) {
        select.remove(1);
      }

      // Add options for each known PropPlug
      propplugList.forEach(plug => {
        const option = document.createElement('option');
        option.value = plug.serialNumber;
        const name = plug.friendlyName || plug.serialNumber;
        option.textContent = \`\${name} (\${plug.serialNumber})\`;
        select.appendChild(option);
      });

      // Set current selection
      select.value = projectSelectedPropplug || '';

      // Add change handler
      select.onchange = () => {
        ipcRenderer.send('pref-set-project-propplug', select.value || null);
      };
    }

    function loadSettings() {
      // Load user settings tab
      loadUserSettings();

      // Load project settings tab (with checkboxes and global values)
      loadProjectSettings();
    }

    function loadUserSettings() {
      const prefix = 'user';
      const settings = userSettings; // Use user-only settings for User tab

      // Terminal
      document.getElementById(prefix + '-terminal-mode').value = settings.terminal.mode;
      document.getElementById(prefix + '-color-theme').value = settings.terminal.colorTheme;
      document.getElementById(prefix + '-font-size').value = settings.terminal.fontSize;
      document.getElementById(prefix + '-font-family').value = settings.terminal.fontFamily;
      document.getElementById(prefix + '-show-cog-prefixes').checked = settings.terminal.showCogPrefixes;
      document.getElementById(prefix + '-local-echo').checked = settings.terminal.localEcho;

      // Serial Port
      document.querySelector(\`input[name="\${prefix}-control-line"][value="\${settings.serialPort.controlLine}"]\`).checked = true;
      document.getElementById(prefix + '-default-baud').value = settings.serialPort.defaultBaud;
      document.getElementById(prefix + '-reset-on-connection').checked = settings.serialPort.resetOnConnection;

      // Logging
      document.getElementById(prefix + '-log-directory').value = settings.logging.logDirectory;
      document.getElementById(prefix + '-auto-save-debug').checked = settings.logging.autoSaveDebug;
      document.getElementById(prefix + '-new-log-dtr').checked = settings.logging.newLogOnDtrReset;
      document.getElementById(prefix + '-max-log-size').value = settings.logging.maxLogSize;
      document.getElementById(prefix + '-enable-usb-logging').checked = settings.logging.enableUSBLogging || false;
      document.getElementById(prefix + '-usb-log-path').value = settings.logging.usbLogFilePath || './logs/';

      // Recordings
      document.getElementById(prefix + '-recordings-directory').value = settings.recordings.recordingsDirectory;

      // Debug Logger
      document.getElementById(prefix + '-scrollback-lines').value = settings.debugLogger.scrollbackLines;
    }

    function loadProjectSettings() {
      const prefix = 'project';
      const settings = effectiveSettings; // Use effective (cascaded) settings for Project tab

      // Note: Project settings tab shows current effective settings but all controls start disabled
      // User must check override checkbox to enable editing

      // Terminal
      document.getElementById(prefix + '-terminal-mode').value = settings.terminal.mode;
      document.getElementById(prefix + '-color-theme').value = settings.terminal.colorTheme;
      document.getElementById(prefix + '-font-size').value = settings.terminal.fontSize;
      document.getElementById(prefix + '-font-family').value = settings.terminal.fontFamily;
      document.getElementById(prefix + '-show-cog-prefixes').checked = settings.terminal.showCogPrefixes;
      document.getElementById(prefix + '-local-echo').checked = settings.terminal.localEcho;

      // Serial Port
      document.querySelector(\`input[name="\${prefix}-control-line"][value="\${settings.serialPort.controlLine}"]\`).checked = true;
      document.getElementById(prefix + '-default-baud').value = settings.serialPort.defaultBaud;
      document.getElementById(prefix + '-reset-on-connection').checked = settings.serialPort.resetOnConnection;

      // Logging
      document.getElementById(prefix + '-log-directory').value = settings.logging.logDirectory;
      document.getElementById(prefix + '-auto-save-debug').checked = settings.logging.autoSaveDebug;
      document.getElementById(prefix + '-new-log-dtr').checked = settings.logging.newLogOnDtrReset;
      document.getElementById(prefix + '-max-log-size').value = settings.logging.maxLogSize;
      document.getElementById(prefix + '-enable-usb-logging').checked = settings.logging.enableUSBLogging || false;
      document.getElementById(prefix + '-usb-log-path').value = settings.logging.usbLogFilePath || './logs/';

      // Recordings
      document.getElementById(prefix + '-recordings-directory').value = settings.recordings.recordingsDirectory;

      // Debug Logger
      document.getElementById(prefix + '-scrollback-lines').value = settings.debugLogger.scrollbackLines;

      // Set global value labels (show current effective values)
      updateGlobalValueLabels();
    }

    function updateGlobalValueLabels() {
      const prefix = 'project';
      const settings = effectiveSettings; // Use effective settings for global value labels

      // Terminal
      setGlobalLabel(prefix, 'terminal-mode', settings.terminal.mode);
      setGlobalLabel(prefix, 'color-theme', settings.terminal.colorTheme);
      setGlobalLabel(prefix, 'font-size', settings.terminal.fontSize);
      setGlobalLabel(prefix, 'font-family', settings.terminal.fontFamily);
      setGlobalLabel(prefix, 'show-cog-prefixes', settings.terminal.showCogPrefixes ? 'Yes' : 'No');
      setGlobalLabel(prefix, 'local-echo', settings.terminal.localEcho ? 'Yes' : 'No');

      // Serial Port
      setGlobalLabel(prefix, 'control-line', settings.serialPort.controlLine);
      setGlobalLabel(prefix, 'default-baud', settings.serialPort.defaultBaud);
      setGlobalLabel(prefix, 'reset-on-connection', settings.serialPort.resetOnConnection ? 'Yes' : 'No');

      // Logging
      setGlobalLabel(prefix, 'log-directory', settings.logging.logDirectory);
      setGlobalLabel(prefix, 'auto-save-debug', settings.logging.autoSaveDebug ? 'Yes' : 'No');
      setGlobalLabel(prefix, 'new-log-dtr', settings.logging.newLogOnDtrReset ? 'Yes' : 'No');
      setGlobalLabel(prefix, 'max-log-size', settings.logging.maxLogSize);
      setGlobalLabel(prefix, 'enable-usb-logging', settings.logging.enableUSBLogging ? 'Yes' : 'No');
      setGlobalLabel(prefix, 'usb-log-path', settings.logging.usbLogFilePath || './logs/');

      // Recordings
      setGlobalLabel(prefix, 'recordings-directory', settings.recordings.recordingsDirectory);

      // Debug Logger
      setGlobalLabel(prefix, 'scrollback-lines', settings.debugLogger.scrollbackLines);
    }

    function setGlobalLabel(prefix, fieldId, value) {
      const label = document.getElementById(\`\${prefix}-global-\${fieldId}\`);
      if (label) {
        label.textContent = \`(Global: \${value})\`;
      }
    }

    function toggleOverride(prefix, fieldId) {
      const checkbox = document.getElementById(\`\${prefix}-override-\${fieldId}\`);
      const field = document.getElementById(\`\${prefix}-\${fieldId}\`);
      const globalLabel = document.getElementById(\`\${prefix}-global-\${fieldId}\`);

      if (checkbox.checked) {
        // Enable override
        field.disabled = false;
        if (globalLabel) globalLabel.style.display = 'none';

        // For radio buttons
        if (fieldId === 'control-line') {
          document.querySelectorAll(\`input[name="\${prefix}-control-line"]\`).forEach(radio => {
            radio.disabled = false;
          });
        }
      } else {
        // Disable override (reset to global value)
        field.disabled = true;
        if (globalLabel) globalLabel.style.display = 'inline';

        // Reset to current effective (global) value
        loadProjectSettings();

        // For radio buttons
        if (fieldId === 'control-line') {
          document.querySelectorAll(\`input[name="\${prefix}-control-line"]\`).forEach(radio => {
            radio.disabled = true;
          });
        }
      }
    }

    function apply() {
      if (currentTab === 'user') {
        applyUserSettings();
      } else {
        applyProjectSettings();
      }
    }

    function applyUserSettings() {
      const prefix = 'user';
      const newSettings = {
        terminal: {
          mode: document.getElementById(prefix + '-terminal-mode').value,
          colorTheme: document.getElementById(prefix + '-color-theme').value,
          fontSize: parseInt(document.getElementById(prefix + '-font-size').value),
          fontFamily: document.getElementById(prefix + '-font-family').value,
          showCogPrefixes: document.getElementById(prefix + '-show-cog-prefixes').checked,
          localEcho: document.getElementById(prefix + '-local-echo').checked
        },
        serialPort: {
          controlLine: document.querySelector(\`input[name="\${prefix}-control-line"]:checked\`).value,
          defaultBaud: parseInt(document.getElementById(prefix + '-default-baud').value),
          resetOnConnection: document.getElementById(prefix + '-reset-on-connection').checked
        },
        logging: {
          logDirectory: document.getElementById(prefix + '-log-directory').value,
          autoSaveDebug: document.getElementById(prefix + '-auto-save-debug').checked,
          newLogOnDtrReset: document.getElementById(prefix + '-new-log-dtr').checked,
          maxLogSize: document.getElementById(prefix + '-max-log-size').value,
          enableUSBLogging: document.getElementById(prefix + '-enable-usb-logging').checked,
          usbLogFilePath: document.getElementById(prefix + '-usb-log-path').value
        },
        recordings: {
          recordingsDirectory: document.getElementById(prefix + '-recordings-directory').value
        },
        debugLogger: {
          scrollbackLines: parseInt(document.getElementById(prefix + '-scrollback-lines').value)
        }
      };

      ipcRenderer.send('pref-apply-user', newSettings);
    }

    function applyProjectSettings() {
      const prefix = 'project';
      const projectOverrides = {};

      // Only include settings that have override checkbox checked
      const overrides = [
        { category: 'terminal', id: 'terminal-mode', key: 'mode', parser: (v) => v },
        { category: 'terminal', id: 'color-theme', key: 'colorTheme', parser: (v) => v },
        { category: 'terminal', id: 'font-size', key: 'fontSize', parser: (v) => parseInt(v) },
        { category: 'terminal', id: 'font-family', key: 'fontFamily', parser: (v) => v },
        { category: 'terminal', id: 'show-cog-prefixes', key: 'showCogPrefixes', parser: (v) => v },
        { category: 'terminal', id: 'local-echo', key: 'localEcho', parser: (v) => v },
        { category: 'serialPort', id: 'control-line', key: 'controlLine', parser: (v) => v, isRadio: true },
        { category: 'serialPort', id: 'default-baud', key: 'defaultBaud', parser: (v) => parseInt(v) },
        { category: 'serialPort', id: 'reset-on-connection', key: 'resetOnConnection', parser: (v) => v },
        { category: 'logging', id: 'log-directory', key: 'logDirectory', parser: (v) => v },
        { category: 'logging', id: 'auto-save-debug', key: 'autoSaveDebug', parser: (v) => v },
        { category: 'logging', id: 'new-log-dtr', key: 'newLogOnDtrReset', parser: (v) => v },
        { category: 'logging', id: 'max-log-size', key: 'maxLogSize', parser: (v) => v },
        { category: 'logging', id: 'enable-usb-logging', key: 'enableUSBLogging', parser: (v) => v },
        { category: 'logging', id: 'usb-log-path', key: 'usbLogFilePath', parser: (v) => v },
        { category: 'recordings', id: 'recordings-directory', key: 'recordingsDirectory', parser: (v) => v },
        { category: 'debugLogger', id: 'scrollback-lines', key: 'scrollbackLines', parser: (v) => parseInt(v) }
      ];

      overrides.forEach(override => {
        const checkbox = document.getElementById(\`\${prefix}-override-\${override.id}\`);
        if (checkbox && checkbox.checked) {
          let value;
          if (override.isRadio) {
            value = document.querySelector(\`input[name="\${prefix}-\${override.id}"]:checked\`)?.value;
          } else {
            const field = document.getElementById(\`\${prefix}-\${override.id}\`);
            value = field.type === 'checkbox' ? field.checked : field.value;
          }

          if (value !== undefined) {
            if (!projectOverrides[override.category]) {
              projectOverrides[override.category] = {};
            }
            projectOverrides[override.category][override.key] = override.parser(value);
          }
        }
      });

      ipcRenderer.send('pref-apply-project', projectOverrides);
    }

    function cancel() {
      ipcRenderer.send('pref-cancel');
    }
  </script>
</body>
</html>`;
  }
}