/**
 * Shared mock helpers for consistent test setup across all debug window tests
 * 
 * This module provides factory functions for creating standardized mocks used
 * throughout the test suite, ensuring consistent behavior and reducing duplication.
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

/**
 * Creates a mock Canvas 2D rendering context with all required methods and properties
 * @param overrides Optional overrides for specific methods/properties
 * @returns Mocked CanvasRenderingContext2D
 */
export function createMockCanvasContext(overrides: Partial<CanvasRenderingContext2D> = {}): jest.Mocked<CanvasRenderingContext2D> {
  const canvas = {
    width: 512,
    height: 512,
    ...overrides.canvas
  };

  const mockCtx: jest.Mocked<CanvasRenderingContext2D> = {
    // Canvas reference
    canvas: canvas as HTMLCanvasElement,
    
    // State management
    save: jest.fn(),
    restore: jest.fn(),
    
    // Transformations
    scale: jest.fn(),
    rotate: jest.fn(),
    translate: jest.fn(),
    transform: jest.fn(),
    setTransform: jest.fn(),
    resetTransform: jest.fn(),
    
    // Drawing methods
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    
    // Text
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 10 } as TextMetrics),
    
    // Line styles
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    setLineDash: jest.fn(),
    getLineDash: jest.fn().mockReturnValue([]),
    lineDashOffset: 0,
    
    // Fill and stroke styles
    fillStyle: '#000000',
    strokeStyle: '#000000',
    
    // Compositing
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    
    // Paths
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    bezierCurveTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    arc: jest.fn(),
    arcTo: jest.fn(),
    ellipse: jest.fn(),
    rect: jest.fn(),
    
    // Path operations
    fill: jest.fn(),
    stroke: jest.fn(),
    clip: jest.fn(),
    isPointInPath: jest.fn().mockReturnValue(false),
    isPointInStroke: jest.fn().mockReturnValue(false),
    
    // Focus management
    drawFocusIfNeeded: jest.fn(),
    
    // Image data
    createImageData: jest.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb'
    })) as any,
    getImageData: jest.fn((x: number, y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb'
    })) as any,
    putImageData: jest.fn(),
    
    // Drawing images
    drawImage: jest.fn(),
    
    // Pixel manipulation
    createPattern: jest.fn().mockReturnValue({} as CanvasPattern),
    createLinearGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn()
    } as any),
    createRadialGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn()
    } as any),
    createConicGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn()
    } as any),
    
    // Text styles
    font: '10px monospace',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'ltr',
    letterSpacing: '0px',
    fontKerning: 'auto',
    fontStretch: 'normal',
    fontVariantCaps: 'normal',
    textRendering: 'auto',
    wordSpacing: '0px',
    
    // Other properties
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    
    filter: 'none',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    
    // Additional methods
    getContextAttributes: jest.fn().mockReturnValue({}),
    getTransform: jest.fn().mockReturnValue({} as DOMMatrix),
    roundRect: jest.fn(),
    
    // Apply any overrides
    ...overrides
  } as jest.Mocked<CanvasRenderingContext2D>;

  return mockCtx;
}

/**
 * Creates a mock HTMLCanvasElement with getContext support
 * @param width Canvas width
 * @param height Canvas height
 * @returns Mocked HTMLCanvasElement
 */
export function createMockCanvas(width: number = 512, height: number = 512): jest.Mocked<HTMLCanvasElement> {
  const mockContext = createMockCanvasContext();
  
  const mockCanvas = {
    width,
    height,
    getContext: jest.fn((contextType: string) => {
      if (contextType === '2d') {
        return mockContext;
      }
      return null;
    }),
    toDataURL: jest.fn().mockReturnValue('data:image/png;base64,'),
    toBlob: jest.fn((callback: BlobCallback) => {
      callback(new Blob([''], { type: 'image/png' }));
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    getBoundingClientRect: jest.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0
    }),
    offsetWidth: width,
    offsetHeight: height,
    clientWidth: width,
    clientHeight: height,
    style: {} as CSSStyleDeclaration,
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn().mockReturnValue(false),
      toggle: jest.fn()
    } as any
  } as unknown as jest.Mocked<HTMLCanvasElement>;

  // Make sure the context knows about its canvas
  (mockContext as any).canvas = mockCanvas;

  return mockCanvas;
}

/**
 * Creates a mock OffscreenCanvas with context support
 * @param width Canvas width
 * @param height Canvas height
 * @returns Mocked OffscreenCanvas
 */
export function createMockOffscreenCanvas(width: number = 512, height: number = 512): jest.Mocked<OffscreenCanvas> {
  const mockContext = createMockCanvasContext();
  
  const mockOffscreenCanvas = {
    width,
    height,
    getContext: jest.fn((contextType: string) => {
      if (contextType === '2d') {
        return mockContext;
      }
      return null;
    }),
    convertToBlob: (jest.fn() as any).mockResolvedValue(new Blob([''], { type: 'image/png' })),
    transferToImageBitmap: jest.fn()
  } as unknown as jest.Mocked<OffscreenCanvas>;

  // Make sure the context knows about its canvas
  (mockContext as any).canvas = mockOffscreenCanvas;

  return mockOffscreenCanvas;
}

/**
 * Creates a mock Electron BrowserWindow with IPC support
 * @param overrides Optional overrides for specific methods/properties
 * @returns Mocked BrowserWindow-like object
 */
export function createMockBrowserWindow(overrides: any = {}) {
  const mockWebContents = {
    send: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    executeJavaScript: (jest.fn() as any).mockResolvedValue(undefined),
    ...overrides.webContents
  };

  const mockWindow = {
    id: 1,
    webContents: mockWebContents,
    loadFile: (jest.fn() as any).mockResolvedValue(undefined),
    loadURL: (jest.fn() as any).mockResolvedValue(undefined),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    focus: jest.fn(),
    blur: jest.fn(),
    isFocused: jest.fn().mockReturnValue(true),
    isVisible: jest.fn().mockReturnValue(true),
    setTitle: jest.fn(),
    getTitle: jest.fn().mockReturnValue('Test Window'),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    setSize: jest.fn(),
    getSize: jest.fn().mockReturnValue([800, 600]),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
    setMenu: jest.fn(),
    ...overrides
  };

  return mockWindow;
}

/**
 * Creates a mock serial port with event emitter capabilities
 * @param overrides Optional overrides for specific methods/properties
 * @returns Mocked serial port
 */
export function createMockSerialPort(overrides: any = {}) {
  class MockSerialPort extends EventEmitter {
    isOpen = true;
    path = '/dev/ttyUSB0';
    
    write = jest.fn((data: any, callback?: (error?: Error | null) => void) => {
      if (callback) {
        process.nextTick(() => callback(null));
      }
      return true;
    });
    
    close = jest.fn((callback?: (error?: Error | null) => void) => {
      this.isOpen = false;
      if (callback) {
        process.nextTick(() => callback(null));
      }
    });
    
    open = jest.fn((callback?: (error?: Error | null) => void) => {
      this.isOpen = true;
      if (callback) {
        process.nextTick(() => callback(null));
      }
    });
    
    drain = jest.fn((callback?: (error?: Error | null) => void) => {
      if (callback) {
        process.nextTick(() => callback(null));
      }
    });
    
    flush = jest.fn((callback?: (error?: Error | null) => void) => {
      if (callback) {
        process.nextTick(() => callback(null));
      }
    });
    
    pause = jest.fn();
    resume = jest.fn();
    
    // Apply overrides
    constructor() {
      super();
      Object.assign(this, overrides);
    }
  }
  
  return new MockSerialPort();
}

/**
 * Creates a mock Logger instance
 * @returns Mocked Logger
 */
export function createMockLogger() {
  return {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logMessage: jest.fn(),
    setLogLevel: jest.fn(),
    getLogLevel: jest.fn().mockReturnValue('info'),
    enableFileLogging: jest.fn(),
    disableFileLogging: jest.fn(),
    flush: jest.fn()
  };
}

/**
 * Creates a mock Context object
 * @param overrides Optional overrides for specific properties
 * @returns Mocked Context
 */
export function createMockContext(overrides: any = {}) {
  return {
    appPath: '/test/app',
    configPath: '/test/config',
    logPath: '/test/logs',
    downloadPath: '/test/downloads',
    verbose: false,
    quiet: false,
    logger: createMockLogger(),
    serialPort: null,
    mainWindow: null,
    debugWindows: new Map(),
    ...overrides
  };
}

/**
 * Standard beforeEach setup for debug window tests
 * @returns Object containing commonly used mocks
 */
export function setupDebugWindowTest() {
  const mockContext = createMockContext();
  const mockCanvas = createMockCanvas();
  const mockWindow = createMockBrowserWindow();
  const mockOffscreenCanvas = createMockOffscreenCanvas();
  
  // Mock DOM methods if document exists
  let getElementById: jest.SpiedFunction<typeof document.getElementById> | undefined;
  let createElement: jest.SpiedFunction<typeof document.createElement> | undefined;
  
  if (typeof document !== 'undefined') {
    getElementById = jest.spyOn(document, 'getElementById');
    createElement = jest.spyOn(document, 'createElement');
    
    getElementById.mockImplementation((id: string) => {
      if (id === 'canvas' || id === 'plot-area' || id === 'text-area') {
        return mockCanvas as any;
      }
      return null;
    });
    
    createElement.mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return createMockCanvas() as any;
      }
      return document.createElement(tagName);
    });
  } else {
    // Create mock document global
    (global as any).document = {
      getElementById: jest.fn((id: string) => {
        if (id === 'canvas' || id === 'plot-area' || id === 'text-area') {
          return mockCanvas as any;
        }
        return null;
      }),
      createElement: jest.fn((tagName: string) => {
        if (tagName === 'canvas') {
          return createMockCanvas() as any;
        }
        return { tagName } as any;
      })
    };
  }
  
  // Mock OffscreenCanvas constructor
  (global as any).OffscreenCanvas = jest.fn((width: number, height: number) => {
    return createMockOffscreenCanvas(width, height);
  });
  
  return {
    mockContext,
    mockCanvas,
    mockWindow,
    mockOffscreenCanvas,
    getElementById,
    createElement
  };
}

/**
 * Standard afterEach cleanup for debug window tests
 */
export function cleanupDebugWindowTest() {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  
  // Clean up global mocks
  if ((global as any).OffscreenCanvas) {
    delete (global as any).OffscreenCanvas;
  }
  
  if ((global as any).document && !(typeof document !== 'undefined')) {
    delete (global as any).document;
  }
}

/**
 * Helper to wait for async operations to complete
 * @param ms Milliseconds to wait
 */
export async function waitFor(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a mock USB Serial instance
 * For use in InputForwarder and other USB communication tests
 */
export function createMockUsbSerial(): any {
  const mock = {
    write: (jest.fn() as any).mockResolvedValue(undefined),
    close: (jest.fn() as any).mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    deviceIsPropeller: (jest.fn() as any).mockResolvedValue(true),
    getIdStringOrError: jest.fn().mockReturnValue(['Propeller2', '']),
    deviceInfo: 'Mock Propeller2 Device',
    deviceError: undefined,
    isOpen: true,
    // Add additional methods that might be called
    downloadNoCheck: (jest.fn() as any).mockResolvedValue(undefined),
    deviceIsPropellerV2: (jest.fn() as any).mockResolvedValue(true),
    get foundP2(): boolean { return true; },
    get usbConnected(): boolean { return true; }
  };
  
  return mock as any;
}