// apps/api/test/__tests__/bulkUpdateStickerStatus.test.js

const mongoose = require('mongoose');

// Mock dependencies BEFORE importing the usecase module
jest.mock('../../models/StickerDefinition', () => ({
  find: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../../utils/audit', () => ({
  emitAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

// Keep if your model graph tries to require it somewhere indirectly
jest.mock('../../models/MediaVariant', () => ({}));

const { bulkUpdateStickerStatus } = require('../../usecases/admin/stickers/bulkUpdateStickerStatus');

const StickerDefinition = require('../../models/StickerDefinition');
const { emitAuditEvent } = require('../../utils/audit');

describe('bulkUpdateStickerStatus usecase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const ids = [
    new mongoose.Types.ObjectId().toString(),
    new mongoose.Types.ObjectId().toString(),
  ];

  test('should bulk update sticker status', async () => {
    StickerDefinition.find.mockResolvedValue([
      { _id: ids[0], stickerKey: 's1', status: 'staged' },
      { _id: ids[1], stickerKey: 's2', status: 'staged' },
    ]);

    StickerDefinition.updateMany.mockResolvedValue({
      matchedCount: 2,
      modifiedCount: 2,
    });

    const result = await bulkUpdateStickerStatus({
      actor: { id: 'admin1' },
      ids,
      nextStatus: 'active',
      reqForAudit: { id: 'req1', headers: {} },
    });

    expect(StickerDefinition.updateMany).toHaveBeenCalledTimes(1);

    // Assert shape, not exact ObjectId instances
    expect(StickerDefinition.updateMany).toHaveBeenCalledWith(
      { _id: { $in: expect.any(Array) } },
      {
        $set: expect.objectContaining({
          status: 'active',
          activatedAt: expect.any(Date),
        }),
      }
    );

    expect(emitAuditEvent).toHaveBeenCalledTimes(1);
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sticker.bulk_status_change',
        meta: expect.objectContaining({
          nextStatus: 'active',
          matched: 2,
          modified: 2,
        }),
      })
    );

    expect(result.matched).toBe(2);
    expect(result.modified).toBe(2);
  });

  test('should throw if ids is empty', async () => {
    await expect(
      bulkUpdateStickerStatus({ ids: [], nextStatus: 'active' })
    ).rejects.toThrow('ids must be a non-empty array');
  });

  test('should throw if nextStatus is invalid', async () => {
    const invalidId = new mongoose.Types.ObjectId().toString();
    await expect(
      bulkUpdateStickerStatus({ ids: [invalidId], nextStatus: 'invalid' })
    ).rejects.toThrow('Invalid status');
  });
});

