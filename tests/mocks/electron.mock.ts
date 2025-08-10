/**
 * Electron API mocks for testing
 */

import { jest } from '@jest/globals';

// @ts-ignore - Ignore Jest typing issues for mocks

// Mock crashReporter
export const mockCrashReporter = {
  start: jest.fn(),
  getLastCrashReport: jest.fn().mockReturnValue(null),
  getUploadedReports: jest.fn().mockReturnValue([]),
  getCrashesDirectory: jest.fn().mockReturnValue('/tmp/crashes')
};

// Mock app
export const mockApp = {
  exit: jest.fn(),
  quit: jest.fn(),
  getPath: jest.fn((name: string) => {
    switch (name) {
      case 'crashDumps': return '/tmp/crash-dumps';
      case 'userData': return '/tmp/user-data';
      case 'temp': return '/tmp';
      default: return `/tmp/${name}`;
    }
  }),
  getGPUFeatureStatus: jest.fn().mockReturnValue({
    gpu_compositing: 'enabled'
  }),
  disableHardwareAcceleration: jest.fn(),
  commandLine: {
    appendSwitch: jest.fn()
  },
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn()
};

// Mock BrowserWindow
export const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  once: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn()
  },
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  destroy: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false)
}));

// Mock Menu
export const mockMenu = {
  setApplicationMenu: jest.fn(),
  buildFromTemplate: jest.fn().mockReturnValue({})
};

// Mock MenuItem
export const mockMenuItem = jest.fn();

// Export the mock module structure that matches Electron
export const electronMock = {
  crashReporter: mockCrashReporter,
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  Menu: mockMenu,
  MenuItem: mockMenuItem
};