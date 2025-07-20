global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn()
    }
  }
};

Object.defineProperty(window, 'chrome', {
  value: global.chrome,
  writable: true
});

Object.defineProperty(global, 'chrome', {
  value: global.chrome,
  writable: true
});