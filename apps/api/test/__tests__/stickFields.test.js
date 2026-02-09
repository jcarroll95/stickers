const { buildStickUpdateData } = require('../../domain/stix/stickFields');

describe('buildStickUpdateData', () => {
  test('includes only allowed fields that are provided', () => {
    const body = { weight: 180, cost: 12.5 };
    expect(buildStickUpdateData({ body })).toEqual({ weight: 180, cost: 12.5 });
  });

  test('converts empty string to null (clearing a field)', () => {
    const body = { description: '' };
    expect(buildStickUpdateData({ body })).toEqual({ description: null });
  });

  test('ignores fields that are not on the allowlist', () => {
    const body = { hacker: 'lol', __proto__: 'x' };
    expect(buildStickUpdateData({ body })).toEqual({});
  });

  test('returns empty object when body is missing', () => {
    expect(buildStickUpdateData({ body: undefined })).toEqual({});
  });
});
