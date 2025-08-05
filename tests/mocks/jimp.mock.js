// Mock for Jimp to avoid ES module issues in tests
module.exports = {
  Jimp: class MockJimp {
    constructor(options) {
      this.bitmap = {
        width: options?.width || 100,
        height: options?.height || 100,
        data: Buffer.alloc((options?.width || 100) * (options?.height || 100) * 4)
      };
    }
    
    static read(path) {
      return Promise.resolve(new MockJimp());
    }
    
    static create(width, height) {
      return Promise.resolve(new MockJimp({ width, height }));
    }
    
    write(path) {
      return Promise.resolve();
    }
    
    writeAsync(path) {
      return Promise.resolve();
    }
    
    getPixelColor(x, y) {
      return 0xFF000000; // Black pixel
    }
    
    setPixelColor(color, x, y) {
      return this;
    }
    
    scan(x, y, w, h, callback) {
      for (let _y = y; _y < y + h; _y++) {
        for (let _x = x; _x < x + w; _x++) {
          callback.call(this, _x, _y, (_y * this.bitmap.width + _x) * 4);
        }
      }
      return this;
    }
  }
};