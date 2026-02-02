// Mock uuid module for Jest compatibility
module.exports = {
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
  v1: jest.fn(),
  v3: jest.fn(),
  v5: jest.fn(),
  validate: jest.fn(),
  version: jest.fn()
};
