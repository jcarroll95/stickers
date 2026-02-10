const { updatePack } = require('../../usecases/admin/packs/updatePack');
const StickerPack = require('../../models/StickerPack');
const { emitAuditEvent } = require('../../utils/audit');

jest.mock('../../models/StickerPack');
jest.mock('../../utils/audit');

describe('updatePack usecase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should update pack name and description', async () => {
    const mockPack = {
      _id: 'p1',
      name: 'Old Name',
      description: 'Old Desc',
      save: jest.fn().mockResolvedValue(true),
    };
    StickerPack.findById.mockResolvedValue(mockPack);

    const result = await updatePack({
      actor: { id: 'admin1' },
      packId: 'p1',
      updates: { name: 'New Name', description: 'New Desc' },
      reqForAudit: { id: 'req1', headers: {} },
    });

    expect(mockPack.name).toBe('New Name');
    expect(mockPack.description).toBe('New Desc');
    expect(mockPack.save).toHaveBeenCalled();
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'pack.update',
        changes: expect.arrayContaining([
          { path: 'name', before: 'Old Name', after: 'New Name' },
          { path: 'description', before: 'Old Desc', after: 'New Desc' },
        ]),
      })
    );
    expect(result.pack).toBe(mockPack);
  });

  test('should throw 404 if pack not found', async () => {
    StickerPack.findById.mockResolvedValue(null);

    await expect(updatePack({ packId: 'invalid' }))
      .rejects.toThrow('Pack not found');
  });

  test('should not emit audit event if no changes', async () => {
    const mockPack = {
      _id: 'p1',
      name: 'Name',
      description: 'Desc',
      save: jest.fn().mockResolvedValue(true),
    };
    StickerPack.findById.mockResolvedValue(mockPack);

    await updatePack({
      packId: 'p1',
      updates: { name: 'Name' }, // Same name
      reqForAudit: {},
    });

    expect(emitAuditEvent).not.toHaveBeenCalled();
  });
});
