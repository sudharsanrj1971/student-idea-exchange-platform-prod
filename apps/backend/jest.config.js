export default {
  transform: {},
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  moduleFileExtensions: ['js', 'json', 'node'],
  projects: [
    {
      // Integration tests: bootstrap DB via src/index.js
      displayName: 'integration',
      testMatch: [
        '<rootDir>/tests/antigravity.test.js',
        '<rootDir>/tests/unified.test.js',
        '<rootDir>/tests/capacity_boundary.test.js',
        '<rootDir>/tests/hls.smoke.test.js',
        '<rootDir>/tests/blackbox/**/*.test.js',
      ],
      setupFiles: ['<rootDir>/tests/setup/env.js'],
      transform: {},
      testEnvironment: 'node',
      testTimeout: 30000,
    },
    {
      // Whitebox unit tests: use their own isolated MongoMemoryServer
      displayName: 'whitebox',
      testMatch: ['<rootDir>/tests/whitebox/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup/env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/db.js'],
      transform: {},
      testEnvironment: 'node',
      testTimeout: 30000,
    },
  ],
};
