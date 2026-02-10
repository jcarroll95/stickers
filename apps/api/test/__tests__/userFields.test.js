const {
  CREATE_USER_FIELDS,
  UPDATE_USER_FIELDS,
  pickAllowedFields,
} = require('../../domain/users/userFields');

describe('userFields allowlists', () => {
  test('CREATE_USER_FIELDS contains expected fields', () => {
    expect(CREATE_USER_FIELDS).toEqual([
      'name',
      'email',
      'role',
      'password',
      'isVerified',
      'cheersStickers',
    ]);
  });

  test('UPDATE_USER_FIELDS contains expected fields', () => {
    expect(UPDATE_USER_FIELDS).toEqual([
      'name',
      'email',
      'role',
      'isVerified',
      'cheersStickers',
    ]);
  });
});

describe('pickAllowedFields', () => {
  test('picks only allowed fields from body', () => {
    const body = {
      name: 'Alice',
      email: 'alice@test.com',
      role: 'admin',
      password: 'secret',
      isVerified: true,
      cheersStickers: [1, 2, 3],
      injected: 'hacker-field',
    };

    const result = pickAllowedFields(body, CREATE_USER_FIELDS);

    expect(result).toEqual({
      name: 'Alice',
      email: 'alice@test.com',
      role: 'admin',
      password: 'secret',
      isVerified: true,
      cheersStickers: [1, 2, 3],
    });
  });

  test('ignores fields not present on the body', () => {
    const body = {
      name: 'Bob',
    };

    const result = pickAllowedFields(body, UPDATE_USER_FIELDS);

    expect(result).toEqual({
      name: 'Bob',
    });
  });

  test('returns empty object when body is null or undefined', () => {
    expect(pickAllowedFields(null, CREATE_USER_FIELDS)).toEqual({});
    expect(pickAllowedFields(undefined, UPDATE_USER_FIELDS)).toEqual({});
  });

  test('allows explicit null values but skips undefined', () => {
    const body = {
      name: null,
      email: undefined,
      role: 'user',
    };

    const result = pickAllowedFields(body, UPDATE_USER_FIELDS);

    expect(result).toEqual({
      name: null,
      role: 'user',
    });
  });
});
