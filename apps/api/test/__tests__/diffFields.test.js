const { diffFields } = require('../../domain/admin/packs/diffFields');

describe('diffFields', () => {
  test('should return empty array when no fields change', () => {
    const before = { name: 'A', description: 'B' };
    const after = { name: 'A', description: 'B' };
    const changes = diffFields(before, after, ['name', 'description']);
    expect(changes).toEqual([]);
  });

  test('should return changes when fields differ', () => {
    const before = { name: 'A', description: 'B' };
    const after = { name: 'Updated', description: 'B' };
    const changes = diffFields(before, after, ['name', 'description']);
    expect(changes).toEqual([
      { path: 'name', before: 'A', after: 'Updated' }
    ]);
  });

  test('should handle missing properties', () => {
    const before = { name: 'A' };
    const after = { name: 'A', description: 'B' };
    const changes = diffFields(before, after, ['name', 'description']);
    expect(changes).toEqual([
      { path: 'description', before: undefined, after: 'B' }
    ]);
  });

  test('should use toString() for comparison (e.g. for ObjectIds)', () => {
    const id1 = { toString: () => '507f1f77bcf86cd799439011' };
    const id2 = { toString: () => '507f1f77bcf86cd799439011' };
    const before = { id: id1 };
    const after = { id: id2 };
    const changes = diffFields(before, after, ['id']);
    expect(changes).toEqual([]);
  });

  test('should detect change when toString() differs', () => {
    const id1 = { toString: () => '1' };
    const id2 = { toString: () => '2' };
    const before = { id: id1 };
    const after = { id: id2 };
    const changes = diffFields(before, after, ['id']);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe('id');
  });
});
