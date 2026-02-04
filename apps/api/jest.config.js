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
    global: { branches: 60, functions: 60, lines: 60, statements: 60 }
  },
  setupFiles: ['<rootDir>/test/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  testTimeout: 30000,
  testMatch: ['**/?(*.)+(test).js'], // prevents helpers from being treated as suites
};
