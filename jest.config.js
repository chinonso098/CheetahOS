module.exports = {
    preset: 'jest-preset-angular',
    testEnvironment: '<rootDir>/jest.environment.js',
    setupFilesAfterEnv: ['<rootDir>/src/setupJest.ts'],
    // Mirrors tsconfig baseUrl:"./" so the codebase's `src/app/...` imports resolve.
    // modulePaths (absolute roots), not moduleDirectories (upward-searched folder
    // *names*) — the latter sends resolution above the project directory.
    modulePaths: ['<rootDir>'],
    // Mirrors the tsconfig "paths" browser shims.
    moduleNameMapper: {
      '^path$': '<rootDir>/node_modules/path-browserify',
      '^url$': '<rootDir>/node_modules/url',
    },
  }