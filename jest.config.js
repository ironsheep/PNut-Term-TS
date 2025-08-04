/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Test environment
  testEnvironment: 'node',
  
  // Root directories for tests
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  
  // Transform files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Coverage settings
  collectCoverage: false, // Set to true to enable coverage by default
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  
  // Coverage paths
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}'
  ],
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Module name mapping for imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Timeout for tests (30 seconds)
  testTimeout: 30000,
  
  // Resource Management Options (commented out by default)
  // Uncomment the options below to throttle test execution:
  
  // Run tests sequentially to reduce resource usage
  // maxWorkers: 1,
  
  // Use 50% of available CPU cores
  // maxWorkers: "50%",
  
  // Detect open handles (helps identify resource leaks)
  // detectOpenHandles: true,
  
  // Force exit after tests complete
  // forceExit: true,
  
  // Bail after first test failure (speeds up feedback)
  // bail: 1,
  
  // Limit concurrent test files
  // maxConcurrency: 5
};