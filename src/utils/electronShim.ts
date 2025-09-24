// Electron shim for CLI mode compatibility
let electronModule: any = null;

// Only load electron if we're actually in an Electron environment
if (process.versions && process.versions.electron) {
  try {
    electronModule = eval("require('electron')");
  } catch (error) {
    console.warn('Failed to load Electron module:', error);
  }
}

// Create a proxy that returns undefined for any property access when electron isn't available
const electronProxy = new Proxy({}, {
  get: (target, prop) => {
    if (electronModule) {
      return electronModule[prop];
    }
    // Return a dummy class for BrowserWindow and other constructors
    if (prop === 'BrowserWindow' || prop === 'Menu' || prop === 'MenuItem') {
      return class DummyElectronClass {
        constructor() {
          throw new Error(`Cannot use ${String(prop)} - Electron not available in CLI mode`);
        }
      };
    }
    return undefined;
  }
});

export = electronProxy;
