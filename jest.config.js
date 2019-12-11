const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['node_modules', path.resolve(__dirname, 'lib')],
  collectCoverageFrom: [
    "src/**/*.ts",
    "src/**/*.tsx"
  ],
  moduleNameMapper: {
    '\\.scss$': 'identity-obj-proxy'
  },
  setupFiles: [
    './jest.setup.js'
  ],
  snapshotSerializers: [
    'enzyme-to-json/serializer'
  ],
  reporters: [
    'default',
    'jest-junit'
  ]
};