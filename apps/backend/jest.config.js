export default {
  transform: {},
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/db.js'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  moduleFileExtensions: ['js', 'json', 'node']
};
