// Global test setup
global.console = {
    ...console,
    // Suppress console.log in tests unless explicitly needed
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random available port
process.env.BUILD_TIER = 'dev';