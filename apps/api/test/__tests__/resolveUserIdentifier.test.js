const { isMongoObjectIdLike, normalizeEmail } = require('../../domain/identifiers/resolveUserIdentifier');


describe('resolve user identifier', () => {
  test('user identifier matches mongodb ObjectId format', () => {
    expect(isMongoObjectIdLike("0123456789abcdef01234567")).toBe(true);
    expect(isMongoObjectIdLike("0123456789abcdefg1234567")).toBe(false);
    expect(isMongoObjectIdLike("0123456789abcdef0123456")).toBe(false);
    expect(isMongoObjectIdLike(" {}$*(#$*& ")).toBe(false);
  });
  test('email address trimmed and lowercase', () => {
    expect(normalizeEmail(" test@TEST.CoM ")).toBe("test@test.com");
  });
});
