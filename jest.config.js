/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: [
    '**/*.test.ts',
    '!**/graphql-comprehensive.test.ts', // Exclude Bun-specific test
    '!**/test-runner.ts', // Exclude test runner
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts', '!src/index.ts'],
  coverageDirectory: 'coverage/jest',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Sequential execution for integration tests
}
