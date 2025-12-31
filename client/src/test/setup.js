import '@testing-library/jest-dom';
import 'vitest-canvas-mock';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// MSW Server setup can be done here or in individual tests
// For now, we'll keep it ready for components tests
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  window.location.hash = '';
});
afterAll(() => server.close());

// Mock scrollIntoView as it's not in JSDOM
Element.prototype.scrollIntoView = vi.fn();
