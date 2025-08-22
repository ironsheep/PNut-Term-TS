#!/usr/bin/env node

// Simple test to check if Debug Logger window gets created
// Run with: node tests/testDebugLoggerSimple.js

const { MainWindow } = require('../dist/classes/mainWindow');

// Mock context
const context = {
  homeDirectory: '/tmp',
  isPackaged: false,
  isDevelopment: true,
  isWindows: false,
  isMac: false,
  isLinux: true,
  appPath: '/tmp',
  documentsDirectory: '/tmp',
  libraryFolder: '/tmp/library',
  extensionFolder: '/tmp/extensions',
  currentFolder: '/tmp',
  logger: {
    logMessage: (msg) => console.log(`[LOG] ${msg}`),
    log: console.log,
    error: console.error,
    warn: console.warn,
  },
  runEnvironment: {
    selectedPropPlug: '/dev/ttyUSB0',
    loggingEnabled: true,
    downloadBaud: 115200,
    terminalBaud: 115200,
    cliMode: false,
    verboseMode: true,
  },
  settings: {
    showDTR: true,
    showRTS: false,
    serialEcho: false,
    currentTheme: 'dark',
    debuggerFont: 'monospace',
    selectedRAMAddress: false,
    selectedFLASHAddress: true,
  }
};

console.log('Creating MainWindow...');
const mainWindow = new MainWindow(context);

console.log('Simulating INIT message...');
mainWindow.rxQueue = mainWindow.rxQueue || [];
mainWindow.rxQueue.push('INIT $0000_0000 $0000_0000 load');

console.log('Processing queue...');
if (typeof mainWindow.processRxQueue === 'function') {
  mainWindow.processRxQueue();
} else {
  console.error('processRxQueue is not a function!');
}

console.log('Checking for Debug Logger window...');
console.log('debugLoggerWindow:', mainWindow.debugLoggerWindow);
console.log('displays:', mainWindow.displays);

if (mainWindow.debugLoggerWindow) {
  console.log('✅ SUCCESS: Debug Logger window was created!');
} else {
  console.log('❌ FAILURE: Debug Logger window was NOT created');
  console.log('Check the console output above for errors');
}