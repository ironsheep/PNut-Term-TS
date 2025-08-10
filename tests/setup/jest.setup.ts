/**
 * Jest setup file for jsdom environment
 * 
 * This file configures the jsdom environment to support canvas operations
 * and other browser APIs needed by our debug windows.
 */

// Mock Electron APIs before any tests run
jest.mock('electron', () => {
  const { electronMock } = require('../mocks/electron.mock');
  return electronMock;
});

// Add missing globals that our code expects
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(Date.now()), 0) as unknown as number;
};

global.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};

// Add performance.now if not available
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Ensure TextEncoder/TextDecoder are available
if (!global.TextEncoder) {
  const util = require('util');
  global.TextEncoder = util.TextEncoder;
  global.TextDecoder = util.TextDecoder;
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// Suppress console errors during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console.error = jest.fn();
  global.console.warn = jest.fn();
}