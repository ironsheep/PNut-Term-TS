// tests/__mocks__/serialport.js
// Global mock for serialport module to prevent loading issues in tests

const EventEmitter = require('events');

class MockSerialPort extends EventEmitter {
  constructor(options) {
    super();
    this.path = options?.path || '/dev/tty.mock';
    this.baudRate = options?.baudRate || 115200;
    this.isOpen = false;
  }

  open(callback) {
    this.isOpen = true;
    if (callback) callback();
  }

  close(callback) {
    this.isOpen = false;
    if (callback) callback();
  }

  write(data, callback) {
    if (callback) callback();
  }

  drain(callback) {
    if (callback) callback();
  }

  flush(callback) {
    if (callback) callback();
  }

  set(options, callback) {
    if (callback) callback();
  }

  get(callback) {
    if (callback) callback(null, {});
  }

  static list() {
    return Promise.resolve([]);
  }
}

module.exports = {
  SerialPort: MockSerialPort,
  default: MockSerialPort
};