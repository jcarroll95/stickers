/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    '!server.js',
    '!app.js',
    '!seeder.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: { branches: 85, functions: 85, lines: 85, statements: 85 }
  },
  setupFiles: ['<rootDir>/test/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  testTimeout: 30000,
};
