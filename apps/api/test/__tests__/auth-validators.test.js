const { normalizeEmail, assertValidEmailAndPassword } = require('../../domain/auth/validators');
const ErrorResponse = require('../../utils/errorResponse');

describe('auth email/password validation', () => {
  test('normalize email string for lowercase without spaces', () => {
    expect(normalizeEmail(" test@TEST.coM ")).toBe("test@test.com");
  });

  test('test good email and password to not throw error', () => {
    const email = "test@test.com";
    const password = "123456";
    expect(() => { assertValidEmailAndPassword(email, password) }).not.toThrow();
  });

  test('test good email and bad password throw error', () => {
    const email = "test@test.com";
    const password = "12345";
    expect(() => { assertValidEmailAndPassword(email, password) }).toThrow(ErrorResponse);
  });

  test('test bad email and good password throw error', () => {
    const email = "youcan'tcatchme.com";
    const password = "123456";
    expect(() => { assertValidEmailAndPassword(email, password) }).toThrow(ErrorResponse);
  });
});

