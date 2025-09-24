module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    '../index.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    'jest.config.js',
    'jest.setup.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};